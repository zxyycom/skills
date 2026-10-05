import { changedPendingPaths } from "../src/version-control/index.ts";
import {
  assert,
  createPendingConflictRepository,
  createRepositoryFixture,
  execFileSync,
  fs,
  gitCommitEnvironment,
  gitTestOptions,
  hasVersionControlCode,
  openGitVersionControl,
  openVersionControl,
  path,
  readPendingModes,
  runGit,
  test,
  withTempRoot,
  writeFile,
  writeGitBlob
} from "./version-control-test-support.ts";

test(
  "preserves executable and symlink pending representations through replacement",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { currentRevision, repositoryRoot } =
        await createRepositoryFixture(tempRoot);
      await writeFile(
        repositoryRoot,
        "representations/measure.sh",
        "measure\n"
      );
      runGit(repositoryRoot, ["add", "representations"]);
      runGit(repositoryRoot, [
        "update-index",
        "--chmod=+x",
        "representations/measure.sh"
      ]);
      const linkBlob = writeGitBlob(repositoryRoot, "measure.sh");
      runGit(repositoryRoot, [
        "update-index",
        "--add",
        "--cacheinfo",
        `120000,${linkBlob},representations/link`
      ]);
      let writes = 0;
      const repository = await openGitVersionControl(repositoryRoot, {
        beforePendingWrite: () => {
          writes += 1;
        }
      });
      const expected = await repository.readPendingFiles({
        pathScopes: ["representations"]
      });
      assert.deepEqual(
        expected.map(({ kind, path: filePath }) => ({ kind, path: filePath })),
        [
          { kind: "symlink", path: "representations/link" },
          { kind: "executable", path: "representations/measure.sh" }
        ]
      );
      await repository.replacePendingFiles({
        expectedFiles: expected,
        expectedRevision: currentRevision,
        files: expected,
        pathScope: "representations"
      });
      assert.equal(writes, 0);
      const target = expected.map((file) =>
        file.kind === "executable"
          ? { ...file, data: Buffer.from("changed measure\n") }
          : file
      );
      target.push({
        data: Buffer.from("new executable\n"),
        kind: "executable",
        path: "representations/summarize.py"
      });
      await repository.replacePendingFiles({
        expectedFiles: expected,
        expectedRevision: currentRevision,
        files: target,
        pathScope: "representations"
      });
      assert.equal(writes, 1);
      assert.deepEqual(
        await repository.readPendingFiles({ pathScopes: ["representations"] }),
        target
      );
      assert.deepEqual(
        readPendingModes(
          repositoryRoot,
          target.map((file) => file.path)
        ),
        [
          { mode: "120000", path: "representations/link" },
          { mode: "100755", path: "representations/measure.sh" },
          { mode: "100755", path: "representations/summarize.py" }
        ]
      );
    });
  }
);

test(
  "rejects representation-only pending drift against a captured snapshot",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { currentRevision, repositoryRoot } =
        await createRepositoryFixture(tempRoot);
      let writes = 0;
      const repository = await openGitVersionControl(repositoryRoot, {
        beforePendingWrite: () => {
          writes += 1;
        }
      });
      const filePath = "docs/tracked.md";
      for (const mode of ["100755", "120000"]) {
        const objectId = runGit(repositoryRoot, [
          "rev-parse",
          `:${filePath}`
        ]).trim();
        runGit(repositoryRoot, [
          "update-index",
          "--cacheinfo",
          `${mode},${objectId},${filePath}`
        ]);
        const expected = await repository.readPendingFiles({
          pathScopes: [filePath]
        });
        runGit(repositoryRoot, [
          "update-index",
          "--cacheinfo",
          `100644,${objectId},${filePath}`
        ]);
        const before = await fs.readFile(
          path.join(repositoryRoot, ".git", "index")
        );
        await assert.rejects(
          repository.replacePendingFiles({
            expectedFiles: expected,
            expectedRevision: currentRevision,
            files: expected,
            pathScope: filePath
          }),
          (error: unknown) => hasVersionControlCode(error, "pending-conflict")
        );
        assert.deepEqual(
          await fs.readFile(path.join(repositoryRoot, ".git", "index")),
          before
        );
      }
      assert.equal(writes, 0);
    });
  }
);

test(
  "preserves pending representations when a replacement readback fails",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { currentRevision, repositoryRoot } =
        await createRepositoryFixture(tempRoot);
      runGit(repositoryRoot, ["update-index", "--chmod=+x", "docs/tracked.md"]);
      const repository = await openGitVersionControl(repositoryRoot, {
        afterPendingWrite: () => {
          execFileSync(
            "git",
            [
              "-C",
              repositoryRoot,
              "update-index",
              "--chmod=-x",
              "docs/tracked.md"
            ],
            {
              env: {
                ...gitCommitEnvironment,
                GIT_INDEX_FILE: path.join(repositoryRoot, ".git", "index.lock")
              },
              windowsHide: true
            }
          );
        }
      });
      const expected = await repository.readPendingFiles({
        pathScopes: ["docs/tracked.md"]
      });
      const before = await fs.readFile(
        path.join(repositoryRoot, ".git", "index")
      );
      await assert.rejects(
        repository.replacePendingFiles({
          expectedFiles: expected,
          expectedRevision: currentRevision,
          files: expected.map((file) => ({
            ...file,
            data: Buffer.from("changed\n")
          })),
          pathScope: "docs/tracked.md"
        }),
        (error: unknown) =>
          hasVersionControlCode(error, "pending-replacement-failed")
      );
      assert.deepEqual(
        await fs.readFile(path.join(repositoryRoot, ".git", "index")),
        before
      );
      assert.deepEqual(
        await repository.readPendingFiles({ pathScopes: ["docs/tracked.md"] }),
        expected
      );
    });
  }
);

test("reports representation-only pending changes", () => {
  const regular = {
    data: Buffer.from("same bytes"),
    kind: "regular" as const,
    path: "run.sh"
  };
  const executable = { ...regular, kind: "executable" as const };
  assert.deepEqual(changedPendingPaths([regular], [executable]), ["run.sh"]);
  assert.deepEqual(changedPendingPaths([executable], [regular]), ["run.sh"]);
  assert.deepEqual(changedPendingPaths([executable], [executable]), []);
});

test(
  "reads effective workspace executable representation under core.fileMode",
  { ...gitTestOptions, skip: process.platform === "win32" },
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot } = await createRepositoryFixture(tempRoot);
      const filePath = "docs/tracked.md";
      const absolute = path.join(repositoryRoot, filePath);
      const repository = await openVersionControl(repositoryRoot);
      runGit(repositoryRoot, ["config", "core.fileMode", "true"]);
      await fs.chmod(absolute, 0o755);
      assert.equal(
        (await repository.readWorkspaceFile(filePath))?.kind,
        "executable"
      );
      await fs.chmod(absolute, 0o644);
      assert.equal(
        (await repository.readWorkspaceFile(filePath))?.kind,
        "regular"
      );
      runGit(repositoryRoot, ["config", "core.fileMode", "false"]);
      runGit(repositoryRoot, ["update-index", "--chmod=+x", filePath]);
      assert.equal(
        (await repository.readWorkspaceFile(filePath))?.kind,
        "executable"
      );
      runGit(repositoryRoot, ["update-index", "--chmod=-x", filePath]);
      await fs.chmod(absolute, 0o755);
      assert.equal(
        (await repository.readWorkspaceFile(filePath))?.kind,
        "regular"
      );
      await writeFile(repositoryRoot, "new.sh", "new\n");
      await fs.chmod(path.join(repositoryRoot, "new.sh"), 0o755);
      assert.equal(
        (await repository.readWorkspaceFile("new.sh"))?.kind,
        "regular"
      );
    });
  }
);

test(
  "workspace reads reject non-regular sources and invalid executable-bit policy",
  { ...gitTestOptions, skip: process.platform === "win32" },
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot } = await createRepositoryFixture(tempRoot);
      const repository = await openVersionControl(repositoryRoot);
      assert.equal(await repository.readWorkspaceFile("missing"), null);
      await fs.symlink(
        "tracked.md",
        path.join(repositoryRoot, "docs", "linked.md")
      );
      for (const filePath of ["docs", "docs/linked.md"]) {
        await assert.rejects(
          repository.readWorkspaceFile(filePath),
          (error: unknown) => hasVersionControlCode(error, "operation-failed")
        );
      }
      await assert.rejects(
        repository.readWorkspaceFile("../outside"),
        (error: unknown) => hasVersionControlCode(error, "invalid-path")
      );
      const conflictRoot = await createPendingConflictRepository(
        tempRoot,
        "conflict"
      );
      runGit(conflictRoot, ["config", "core.fileMode", "false"]);
      await assert.rejects(
        (await openVersionControl(conflictRoot)).readWorkspaceFile(
          "conflicted.txt"
        ),
        (error: unknown) => hasVersionControlCode(error, "operation-failed")
      );
      runGit(repositoryRoot, ["config", "core.fileMode", "false"]);
      const filePath = "docs/tracked.md";
      const objectId = runGit(repositoryRoot, [
        "rev-parse",
        `:${filePath}`
      ]).trim();
      runGit(repositoryRoot, [
        "update-index",
        "--cacheinfo",
        `120000,${objectId},${filePath}`
      ]);
      await assert.rejects(
        repository.readWorkspaceFile(filePath),
        (error: unknown) => hasVersionControlCode(error, "operation-failed")
      );
      runGit(repositoryRoot, ["config", "core.fileMode", "invalid"]);
      await assert.rejects(
        repository.readWorkspaceFile("docs/tracked.md"),
        (error: unknown) => hasVersionControlCode(error, "operation-failed")
      );
    });
  }
);
