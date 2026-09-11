import {
  assert,
  createRepositoryFixture,
  fs,
  gitTestOptions,
  hasVersionControlCode,
  openGitVersionControl,
  openVersionControl,
  path,
  readPendingText,
  rejectedVersionControlError,
  runGit,
  test,
  VersionControlError,
  withTempRoot
} from "./version-control-test-support.ts";

test(
  "rejects stale pending replacements without changing pending files",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot } = await createRepositoryFixture(tempRoot);
      const repository = await openVersionControl(repositoryRoot);
      const staleRevision = await repository.getCurrentRevision();
      runGit(repositoryRoot, [
        "commit",
        "--quiet",
        "--message",
        "advance revision"
      ]);
      const currentRevision = await repository.getCurrentRevision();
      const before = await readPendingText(repository);
      const replacement = [
        {
          data: Buffer.from("replacement\n"),
          path: "docs/tracked.md"
        }
      ];

      const stale = await rejectedVersionControlError(
        repository.replacePendingFiles({
          expectedRevision: staleRevision,
          files: replacement,
          pathScope: "docs"
        })
      );
      assert.equal(stale.causeCategory, "unknown");
      assert.equal(stale.operation, "verify a pending replacement");
      assert.equal(stale.target, "docs");
      assert.deepEqual(await readPendingText(repository), before);

      const lockPath = path.join(repositoryRoot, ".git", "index.lock");
      await fs.writeFile(lockPath, "busy\n", "utf8");
      try {
        const busy = await rejectedVersionControlError(
          repository.replacePendingFiles({
            expectedRevision: currentRevision,
            files: replacement,
            pathScope: "docs"
          })
        );
        assert.equal(busy.causeCategory, "busy");
        assert.equal(busy.operation, "verify a pending replacement");
        assert.equal(busy.target, "docs");
      } finally {
        await fs.rm(lockPath, { force: true });
      }
      assert.deepEqual(await readPendingText(repository), before);
    });
  }
);

test(
  "restores the original range after a pending write failure",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot } = await createRepositoryFixture(tempRoot);
      const repository = await openGitVersionControl(repositoryRoot, {
        beforePendingWrite: () => {
          throw Object.assign(
            new Error(
              "permission denied for /private/repository/index with token=ghp_123456789012345678901234567890"
            ),
            { code: "EACCES" }
          );
        }
      });
      const before = await readPendingText(repository, "docs");
      await assert.rejects(
        repository.replacePendingFiles({
          expectedRevision: await repository.getCurrentRevision(),
          files: [
            {
              data: Buffer.from("replacement\n"),
              path: "docs/tracked.md"
            }
          ],
          pathScope: "docs"
        }),
        (error: unknown) =>
          error instanceof VersionControlError &&
          error.code === "pending-replacement-failed" &&
          error.causeCategory === "access-denied" &&
          error.operation === "replace a pending range" &&
          error.target === "docs" &&
          error.detail !== null &&
          !/private|ghp_/iu.test(error.detail)
      );
      assert.deepEqual(await readPendingText(repository, "docs"), before);
    });
  }
);

test(
  "restores the original range after pending readback fails",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot } = await createRepositoryFixture(tempRoot);
      const repository = await openGitVersionControl(repositoryRoot, {
        afterPendingWrite: () => {
          throw new Error("injected readback failure");
        }
      });
      const before = await readPendingText(repository, "docs");

      await assert.rejects(
        repository.replacePendingFiles({
          expectedRevision: await repository.getCurrentRevision(),
          files: [
            {
              data: Buffer.from("replacement\n"),
              path: "docs/tracked.md"
            }
          ],
          pathScope: "docs"
        }),
        (error: unknown) =>
          hasVersionControlCode(error, "pending-replacement-failed")
      );
      assert.deepEqual(await readPendingText(repository, "docs"), before);
    });
  }
);

test(
  "reports incomplete pending recovery with stable public semantics",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot } = await createRepositoryFixture(tempRoot);
      const repository = await openGitVersionControl(repositoryRoot, {
        afterPendingWrite: () => {
          throw new Error("injected readback failure");
        },
        beforePendingRecovery: () => {
          throw new Error("injected recovery failure");
        }
      });
      await assert.rejects(
        repository.replacePendingFiles({
          expectedRevision: await repository.getCurrentRevision(),
          files: [
            {
              data: Buffer.from("replacement\n"),
              path: "docs/tracked.md"
            }
          ],
          pathScope: "docs"
        }),
        (error: unknown) =>
          error instanceof VersionControlError &&
          error.code === "pending-recovery-failed" &&
          error.operation === "recover a pending range" &&
          error.target === "docs"
      );
    });
  }
);

test(
  "lists committed and pending changes and validates revision paths",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { baseRevision, currentRevision, repositoryRoot } =
        await createRepositoryFixture(tempRoot);
      const repository = await openVersionControl(repositoryRoot);
      assert.deepEqual(
        await repository.listChangedPaths({ from: baseRevision }),
        ["docs/current-only.md", "docs/tracked.md"]
      );
      assert.deepEqual(
        await repository.listPendingChangedPaths({
          from: currentRevision,
          pathScopes: ["docs"]
        }),
        ["docs/staged-copy.bin", "docs/staged.bin", "docs/tracked.md"]
      );
      assert.deepEqual(
        await repository.listChangedPaths({
          from: currentRevision,
          to: currentRevision
        }),
        []
      );

      await assert.rejects(
        repository.listRevisionFiles(currentRevision, {
          pathScopes: ["../outside.md"]
        }),
        (error: unknown) => hasVersionControlCode(error, "invalid-path")
      );
      await assert.rejects(
        repository.listRevisionFiles("missing-revision"),
        (error: unknown) => hasVersionControlCode(error, "revision-not-found")
      );
      await assert.rejects(
        repository.readRevisionFile(currentRevision, "../outside.md"),
        (error: unknown) => hasVersionControlCode(error, "invalid-path")
      );
      await assert.rejects(
        repository.listPendingChangedPaths({ from: "missing-revision" }),
        (error: unknown) => hasVersionControlCode(error, "revision-not-found")
      );
    });
  }
);

test(
  "opens linked worktrees as independent repository roots",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { currentRevision, repositoryRoot } =
        await createRepositoryFixture(tempRoot);
      const linkedWorktreeRoot = path.join(tempRoot, "linked-worktree");
      runGit(repositoryRoot, [
        "worktree",
        "add",
        "--detach",
        "--quiet",
        linkedWorktreeRoot,
        currentRevision
      ]);
      const nested = path.join(linkedWorktreeRoot, "nested");
      await fs.mkdir(nested, { recursive: true });
      const linked = await openVersionControl(nested);
      assert.equal(linked.rootDirectory, path.resolve(linkedWorktreeRoot));
      assert.equal(await linked.getCurrentRevision(), currentRevision);
      assert.deepEqual(
        await linked.listRevisionFiles(currentRevision, {
          pathScopes: ["docs/tracked.md"]
        }),
        ["docs/tracked.md"]
      );
    });
  }
);
