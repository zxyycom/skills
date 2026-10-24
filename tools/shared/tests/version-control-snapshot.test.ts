import { deflateSync } from "node:zlib";
import {
  readPendingSnapshot,
  replacePendingSnapshot,
  samePendingSnapshots
} from "../src/version-control/pending-snapshot.ts";
import {
  assert,
  createRepositoryFixture,
  execFileSync,
  fs,
  gitTestOptions,
  openGitVersionControl,
  openVersionControl,
  path,
  runGit,
  test,
  withTempRoot,
  writeFile,
  hasVersionControlCode
} from "./version-control-test-support.ts";

const contentPath = "docs/tracked.md";

test(
  "pending snapshot patch preserves scope inside and outside sentinels and staged deletions",
  gitTestOptions,
  async () => {
    await withTempRoot(async (temp) => {
      const { repositoryRoot, currentRevision } =
        await createRepositoryFixture(temp);
      await writeFile(
        repositoryRoot,
        "outside/sentinel.txt",
        "outside sentinel\n"
      );
      await writeFile(repositoryRoot, "docs/sentinel.txt", "inside sentinel\n");
      runGit(repositoryRoot, [
        "add",
        "outside/sentinel.txt",
        "docs/sentinel.txt"
      ]);
      runGit(repositoryRoot, ["rm", "--cached", "docs/current-only.md"]);
      const repository = await openVersionControl(repositoryRoot);
      const snapshot = await readPendingSnapshot(repository, {
        pathScope: "docs",
        contentPaths: [contentPath]
      });
      assert.equal(snapshot.files.length, 1);
      assert.ok(snapshot.members.length > snapshot.files.length);
      const before = runGit(repositoryRoot, ["ls-files", "--stage"]);
      const result = await replacePendingSnapshot(repository, {
        expectedRevision: currentRevision,
        expectedSnapshot: snapshot,
        updates: [
          {
            path: contentPath,
            kind: "executable",
            data: Buffer.from("new selected bytes\n")
          }
        ]
      });
      assert.deepEqual(result.changedPaths, [contentPath]);
      assert.equal(
        runGit(repositoryRoot, ["show", ":outside/sentinel.txt"]),
        "outside sentinel\n"
      );
      assert.equal(
        runGit(repositoryRoot, ["show", ":docs/sentinel.txt"]),
        "inside sentinel\n"
      );
      assert.ok(!result.pendingPaths.includes("docs/current-only.md"));
      assert.deepEqual(
        runGit(repositoryRoot, ["ls-files", "--stage"])
          .split("\n")
          .filter((line) => !line.endsWith(contentPath)),
        before.split("\n").filter((line) => !line.endsWith(contentPath))
      );
    });
  }
);

test(
  "pending snapshots reject forged and other repository tokens without mutation",
  gitTestOptions,
  async () => {
    await withTempRoot(async (temp) => {
      const first = await createRepositoryFixture(path.join(temp, "first"));
      const second = await createRepositoryFixture(path.join(temp, "second"));
      const repository = await openVersionControl(first.repositoryRoot);
      const other = await openVersionControl(second.repositoryRoot);
      const snapshot = await readPendingSnapshot(repository, {
        pathScope: "docs",
        contentPaths: []
      });
      const sameRootAdapter = await openVersionControl(first.repositoryRoot);
      await assert.rejects(
        replacePendingSnapshot(sameRootAdapter, {
          expectedRevision: first.currentRevision,
          expectedSnapshot: snapshot,
          updates: []
        }),
        (error: unknown) => hasVersionControlCode(error, "pending-conflict")
      );
      const before = await fs.readFile(
        path.join(second.repositoryRoot, ".git/index")
      );
      assert.ok(Object.isFrozen(snapshot));
      assert.equal(samePendingSnapshots(snapshot, { ...snapshot }), false);
      for (const expectedSnapshot of [
        snapshot,
        { ...snapshot, pathScope: "outside" }
      ]) {
        await assert.rejects(
          replacePendingSnapshot(other, {
            expectedRevision: second.currentRevision,
            expectedSnapshot,
            updates: []
          }),
          (error: unknown) => hasVersionControlCode(error, "pending-conflict")
        );
        assert.deepEqual(
          await fs.readFile(path.join(second.repositoryRoot, ".git/index")),
          before
        );
      }
    });
  }
);

for (const drift of ["bytes", "mode", "member", "head"]) {
  test(
    `pending snapshot locked CAS rejects ${drift} drift without publication`,
    gitTestOptions,
    async () => {
      await withTempRoot(async (temp) => {
        const { repositoryRoot, currentRevision } =
          await createRepositoryFixture(temp);
        const repository = await openVersionControl(repositoryRoot);
        const snapshot = await readPendingSnapshot(repository, {
          pathScope: "docs",
          contentPaths: [contentPath]
        });
        if (drift === "bytes") {
          await writeFile(repositoryRoot, "docs/staged.bin", "fresh bytes\n");
          runGit(repositoryRoot, ["add", "docs/staged.bin"]);
        }
        if (drift === "mode")
          runGit(repositoryRoot, [
            "update-index",
            "--chmod=+x",
            "docs/staged.bin"
          ]);
        if (drift === "member")
          runGit(repositoryRoot, ["rm", "--cached", "docs/current-only.md"]);
        if (drift === "head")
          runGit(repositoryRoot, ["commit", "--quiet", "--message", "advance"]);
        const before = await fs.readFile(
          path.join(repositoryRoot, ".git/index")
        );
        await assert.rejects(
          replacePendingSnapshot(repository, {
            expectedRevision: currentRevision,
            expectedSnapshot: snapshot,
            updates: [
              {
                path: contentPath,
                kind: "regular",
                data: Buffer.from("should not publish\n")
              }
            ]
          }),
          (error: unknown) => hasVersionControlCode(error, "pending-conflict")
        );
        assert.deepEqual(
          await fs.readFile(path.join(repositoryRoot, ".git/index")),
          before
        );
        await assert.rejects(
          fs.access(path.join(repositoryRoot, ".git/index.lock"))
        );
      });
    }
  );
}

test(
  "pending snapshot compares actual unselected payload identity even when stored object identifier is unchanged",
  gitTestOptions,
  async () => {
    await withTempRoot(async (temp) => {
      const { repositoryRoot, currentRevision } =
        await createRepositoryFixture(temp);
      const repository = await openVersionControl(repositoryRoot);
      const before = await readPendingSnapshot(repository, {
        pathScope: "docs",
        contentPaths: [contentPath]
      });
      const oid = runGit(repositoryRoot, [
        "rev-parse",
        ":docs/staged.bin"
      ]).trim();
      const objectPath = path.join(
        repositoryRoot,
        ".git/objects",
        oid.slice(0, 2),
        oid.slice(2)
      );
      const altered = Buffer.from("different but valid blob payload\n");
      await fs.chmod(objectPath, 0o600);
      await fs.writeFile(
        objectPath,
        deflateSync(
          Buffer.concat([Buffer.from(`blob ${altered.length}\0`), altered])
        )
      );
      const current = await readPendingSnapshot(repository, {
        pathScope: "docs",
        contentPaths: [contentPath]
      });
      assert.equal(samePendingSnapshots(before, current), false);
      const pending = await fs.readFile(
        path.join(repositoryRoot, ".git/index")
      );
      await assert.rejects(
        replacePendingSnapshot(repository, {
          expectedRevision: currentRevision,
          expectedSnapshot: before,
          updates: []
        }),
        (error: unknown) => hasVersionControlCode(error, "pending-conflict")
      );
      assert.deepEqual(
        await fs.readFile(path.join(repositoryRoot, ".git/index")),
        pending
      );
    });
  }
);

test(
  "pending snapshot readback failure restores the index and retains sanitized failure facts",
  gitTestOptions,
  async () => {
    await withTempRoot(async (temp) => {
      const { repositoryRoot, currentRevision } =
        await createRepositoryFixture(temp);
      const repository = await openGitVersionControl(repositoryRoot, {
        afterPendingWrite: () => {
          throw Object.assign(
            new Error(
              "denied /private/target token=ghp_123456789012345678901234567890"
            ),
            { code: "EACCES" }
          );
        }
      });
      const snapshot = await readPendingSnapshot(repository, {
        pathScope: "docs",
        contentPaths: [contentPath]
      });
      const before = await fs.readFile(path.join(repositoryRoot, ".git/index"));
      await assert.rejects(
        replacePendingSnapshot(repository, {
          expectedRevision: currentRevision,
          expectedSnapshot: snapshot,
          updates: [
            {
              path: contentPath,
              kind: "regular",
              data: Buffer.from("changed\n")
            }
          ]
        }),
        (error: unknown) => {
          assert.ok(
            error instanceof Error &&
              "causeCategory" in error &&
              "detail" in error
          );
          assert.equal(error.causeCategory, "access-denied");
          assert.ok(!/private|ghp_/u.test(String(error.detail)));
          return true;
        }
      );
      assert.deepEqual(
        await fs.readFile(path.join(repositoryRoot, ".git/index")),
        before
      );
    });
  }
);

test(
  "pending snapshot detects locked unmerged representation before reading conflict objects",
  gitTestOptions,
  async () => {
    await withTempRoot(async (temp) => {
      const { repositoryRoot, currentRevision } =
        await createRepositoryFixture(temp);
      const repository = await openVersionControl(repositoryRoot);
      const snapshot = await readPendingSnapshot(repository, {
        pathScope: "docs",
        contentPaths: [contentPath]
      });
      const oid = runGit(repositoryRoot, [
        "rev-parse",
        ":docs/staged.bin"
      ]).trim();
      execFileSync(
        "git",
        ["-C", repositoryRoot, "update-index", "--index-info"],
        {
          input: `0 ${"0".repeat(40)}\tdocs/staged.bin\n100644 ${oid} 1\tdocs/staged.bin\n`
        }
      );
      const before = await fs.readFile(path.join(repositoryRoot, ".git/index"));
      const tracePath = path.join(
        repositoryRoot,
        "locked-conflict-trace.jsonl"
      );
      const priorTrace = process.env.GIT_TRACE2_EVENT;
      process.env.GIT_TRACE2_EVENT = tracePath;
      try {
        await assert.rejects(
          replacePendingSnapshot(repository, {
            expectedRevision: currentRevision,
            expectedSnapshot: snapshot,
            updates: []
          }),
          (error: unknown) => hasVersionControlCode(error, "pending-conflict")
        );
      } finally {
        if (priorTrace === undefined) delete process.env.GIT_TRACE2_EVENT;
        else process.env.GIT_TRACE2_EVENT = priorTrace;
      }
      const trace = await fs.readFile(tracePath, "utf8");
      assert.ok(!trace.includes('"cat-file"'));
      await assert.rejects(
        readPendingSnapshot(repository, {
          pathScope: "docs",
          contentPaths: [contentPath]
        }),
        (error: unknown) => hasVersionControlCode(error, "operation-failed")
      );
      assert.deepEqual(
        await fs.readFile(path.join(repositoryRoot, ".git/index")),
        before
      );
    });
  }
);
