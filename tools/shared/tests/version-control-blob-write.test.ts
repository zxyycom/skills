import {
  assert,
  createRepositoryFixture,
  fs,
  gitTestOptions,
  openVersionControl,
  path,
  runGit,
  test,
  withTempRoot
} from "./version-control-test-support.ts";
import {
  withGitWriteTrace,
  traceEvents,
  peakAndSettlement,
  waitForStarts
} from "./version-control-blob-write-support.ts";
import { Hash } from "node:crypto";

test(
  "pending replacement deduplicates actual bytes with bounded Git writes and preserves modes",
  { ...gitTestOptions, skip: process.platform === "win32" },
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot, currentRevision } =
        await createRepositoryFixture(tempRoot);
      const repository = await openVersionControl(repositoryRoot);
      const files = Array.from({ length: 24 }, (_, index) => ({
        path: `payload/${String(index).padStart(2, "0")}`,
        data: Buffer.from(index < 12 ? "duplicate" : `unique-${index}`),
        kind:
          index === 0
            ? ("executable" as const)
            : index === 1
              ? ("symlink" as const)
              : ("regular" as const)
      }));
      await withGitWriteTrace(tempRoot, repositoryRoot, async (trace) => {
        const gate = path.join(tempRoot, "release-writes");
        const previousGate = process.env.GIT_TEST_WRITE_GATE;
        process.env.GIT_TEST_WRITE_GATE = gate;
        const operation = repository
          .replacePendingFiles({
            expectedRevision: currentRevision,
            expectedFiles: [],
            files,
            pathScope: "payload"
          })
          .then(
            (value) => ({ status: "ok" as const, value }),
            (error: unknown) => ({ status: "error" as const, error })
          );
        try {
          await waitForStarts(trace, 2);
          await fs.writeFile(gate, "release");
          const outcome = await operation;
          if (outcome.status === "error") throw outcome.error;
        } catch (error) {
          await fs.writeFile(gate, "release");
          await operation;
          throw error;
        } finally {
          if (previousGate === undefined)
            delete process.env.GIT_TEST_WRITE_GATE;
          else process.env.GIT_TEST_WRITE_GATE = previousGate;
        }
        const events = await traceEvents(trace);
        assert.equal(
          events.filter((event) => event.event === "start").length,
          13
        );
        const peak = peakAndSettlement(events);
        assert.ok(peak >= 2 && peak <= 4, `peak ${peak}`);
        assert.ok(events.every((event) => event.lock));
        const actual = await repository.readPendingFiles({
          pathScopes: ["payload"]
        });
        assert.deepEqual(actual, files);
      });
      assert.deepEqual(
        await repository
          .readPendingFiles({ pathScopes: ["docs/tracked.md"] })
          .then((items) =>
            items.map((item) => Buffer.from(item.data).toString())
          ),
        ["staged\n"]
      );
    });
  }
);

test(
  "each operation writes one blob for duplicate bytes and one per distinct payload",
  { ...gitTestOptions, skip: process.platform === "win32" },
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot, currentRevision } =
        await createRepositoryFixture(tempRoot);
      const repository = await openVersionControl(repositoryRoot);
      await withGitWriteTrace(tempRoot, repositoryRoot, async (trace) => {
        for (const [scope, identical] of [
          ["repeat", true],
          ["distinct", false],
          ["again", true]
        ] as const) {
          const files = Array.from({ length: 12 }, (_, index) => ({
            path: `${scope}/${String(index).padStart(2, "0")}`,
            data: Buffer.from(identical ? "same bytes" : `content-${index}`),
            kind: "regular" as const
          }));
          await fs.writeFile(trace, "");
          await repository.replacePendingFiles({
            expectedRevision: currentRevision,
            expectedFiles: [],
            files,
            pathScope: scope
          });
          const events = await traceEvents(trace);
          assert.equal(
            events.filter((event) => event.event === "start").length,
            identical ? 1 : 12
          );
          assert.ok(peakAndSettlement(events) <= 4);
          assert.deepEqual(
            await repository.readPendingFiles({ pathScopes: [scope] }),
            files
          );
        }
      });
    });
  }
);

test(
  "pending deduplication uses the repository SHA-256 object format",
  { ...gitTestOptions, skip: process.platform === "win32" },
  async () => {
    await withTempRoot(async (tempRoot) => {
      const repositoryRoot = path.join(tempRoot, "sha256");
      await fs.mkdir(repositoryRoot);
      runGit(repositoryRoot, ["init", "--quiet", "--object-format=sha256"]);
      const repository = await openVersionControl(repositoryRoot);
      const files = ["a", "b"].map((name) => ({
        path: `payload/${name}`,
        data: Buffer.from("identical"),
        kind: "regular" as const
      }));
      await withGitWriteTrace(tempRoot, repositoryRoot, async (trace) => {
        await repository.replacePendingFiles({
          expectedRevision: null,
          expectedFiles: [],
          files,
          pathScope: "payload"
        });
        assert.equal(
          (await traceEvents(trace)).filter((event) => event.event === "start")
            .length,
          1
        );
        const entries = runGit(repositoryRoot, [
          "ls-files",
          "--stage",
          "--",
          "payload"
        ])
          .trim()
          .split("\n");
        const ids = entries.map((entry) => entry.split(" ")[1]);
        assert.equal(ids.length, 2);
        assert.match(ids[0]!, /^[a-f0-9]{64}$/u);
        assert.equal(ids[0], ids[1]);
        assert.deepEqual(
          await repository.readPendingFiles({ pathScopes: ["payload"] }),
          files
        );
      });
    });
  }
);

test(
  "digest bucket collisions never merge unequal pending payloads",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot, currentRevision } =
        await createRepositoryFixture(tempRoot);
      const repository = await openVersionControl(repositoryRoot);
      const first = Buffer.from("alpha");
      const second = Buffer.from("bravo");
      const duplicate = Buffer.from("alpha");
      const files = [
        { path: "payload/a", data: first, kind: "regular" as const },
        { path: "payload/b", data: second, kind: "executable" as const },
        { path: "payload/c", data: duplicate, kind: "symlink" as const }
      ];
      const original = Reflect.get(
        Hash.prototype,
        "digest"
      ) as typeof Hash.prototype.digest;
      let buckets = 0;
      Hash.prototype.digest = function (this: Hash, encoding?: string) {
        const result: unknown = Reflect.apply(
          original,
          this,
          encoding === undefined ? [] : [encoding]
        );
        if (encoding === "hex") {
          buckets += 1;
          return "forced-collision";
        }
        return result;
      } as typeof Hash.prototype.digest;
      try {
        await repository.replacePendingFiles({
          expectedRevision: currentRevision,
          expectedFiles: [],
          files,
          pathScope: "payload"
        });
      } finally {
        Hash.prototype.digest = original;
      }
      assert.ok(buckets >= 2, `collision bucket visits: ${buckets}`);
      const actual = await repository.readPendingFiles({
        pathScopes: ["payload"]
      });
      assert.deepEqual(
        actual.map(({ path: filePath, data, kind }) => ({
          path: filePath,
          text: Buffer.from(data).toString(),
          kind
        })),
        [
          { path: "payload/a", text: "alpha", kind: "regular" },
          { path: "payload/b", text: "bravo", kind: "executable" },
          { path: "payload/c", text: "alpha", kind: "symlink" }
        ]
      );
    });
  }
);

test(
  "pending replacement copies input bytes before asynchronous work",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot, currentRevision } =
        await createRepositoryFixture(tempRoot);
      const repository = await openVersionControl(repositoryRoot);
      const data = Buffer.from("original payload");
      const operation = repository.replacePendingFiles({
        expectedRevision: currentRevision,
        expectedFiles: [],
        files: [{ path: "payload/a", data, kind: "regular" }],
        pathScope: "payload"
      });
      data.fill(0);
      await operation;
      const files = await repository.readPendingFiles({
        pathScopes: ["payload"]
      });
      assert.equal(files.length, 1);
      assert.equal(Buffer.from(files[0]!.data).toString(), "original payload");
    });
  }
);
