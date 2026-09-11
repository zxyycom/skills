import {
  assert,
  createPendingConflictRepository,
  fs,
  gitTestOptions,
  hasVersionControlCode,
  initializeRepository,
  openVersionControl,
  path,
  runGit,
  test,
  VersionControlError,
  withTempRoot,
  writeFile
} from "./version-control-test-support.ts";

test(
  "distinguishes unborn heads from broken heads",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const unbornRoot = path.join(tempRoot, "unborn");
      await fs.mkdir(unbornRoot, { recursive: true });
      runGit(unbornRoot, ["init", "--quiet"]);
      assert.equal(
        await (await openVersionControl(unbornRoot)).getCurrentRevision(),
        null
      );

      const brokenHeadRoot = path.join(tempRoot, "broken-head");
      await fs.mkdir(brokenHeadRoot, { recursive: true });
      runGit(brokenHeadRoot, ["init", "--quiet"]);
      runGit(brokenHeadRoot, ["symbolic-ref", "HEAD", "refs/heads/broken"]);
      await fs.writeFile(
        path.join(brokenHeadRoot, ".git", "refs", "heads", "broken"),
        "not-an-object\n",
        "utf8"
      );
      await assert.rejects(
        (await openVersionControl(brokenHeadRoot)).getCurrentRevision(),
        (error: unknown) => hasVersionControlCode(error, "operation-failed")
      );
    });
  }
);

test(
  "rejects pending reads while the index contains conflicts",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const repositoryRoot = await createPendingConflictRepository(
        tempRoot,
        "read-conflict"
      );

      const repository = await openVersionControl(repositoryRoot);
      await assert.rejects(
        repository.readPendingFiles(),
        (error: unknown) =>
          error instanceof VersionControlError &&
          error.code === "operation-failed" &&
          error.message.includes("resolve pending content conflicts")
      );
    });
  }
);

test(
  "maps an unresolved unguarded pending replacement to a replacement failure",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const repositoryRoot = await createPendingConflictRepository(
        tempRoot,
        "replacement-conflict"
      );
      const repository = await openVersionControl(repositoryRoot);
      const revision = await repository.getCurrentRevision();
      const before = runGit(repositoryRoot, [
        "ls-files",
        "--unmerged",
        "--",
        "conflicted.txt"
      ]);

      await assert.rejects(
        repository.replacePendingFiles({
          expectedRevision: revision,
          files: [
            {
              data: Buffer.from("replacement\n"),
              path: "conflicted.txt"
            }
          ],
          pathScope: "conflicted.txt"
        }),
        (error: unknown) =>
          hasVersionControlCode(error, "pending-replacement-failed")
      );
      assert.equal(
        runGit(repositoryRoot, [
          "ls-files",
          "--unmerged",
          "--",
          "conflicted.txt"
        ]),
        before
      );
    });
  }
);

test(
  "reports corrupt revision objects as operation failures",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const repositoryRoot = path.join(tempRoot, "corrupt-blob");
      await fs.mkdir(repositoryRoot, { recursive: true });
      initializeRepository(repositoryRoot);
      await writeFile(repositoryRoot, "docs/unreadable.md", "unreadable\n");
      runGit(repositoryRoot, ["add", "."]);
      runGit(repositoryRoot, ["commit", "--quiet", "--message", "base"]);
      const blobId = runGit(repositoryRoot, [
        "rev-parse",
        "HEAD:docs/unreadable.md"
      ]).trim();
      const blobPath = path.join(
        repositoryRoot,
        ".git",
        "objects",
        blobId.slice(0, 2),
        blobId.slice(2)
      );
      await fs.chmod(blobPath, 0o666);
      await fs.writeFile(blobPath, "corrupt Git object", "utf8");

      const repository = await openVersionControl(repositoryRoot);
      await assert.rejects(
        repository.readRevisionFile("HEAD", "docs/unreadable.md"),
        (error: unknown) =>
          error instanceof VersionControlError &&
          error.code === "operation-failed" &&
          error.causeCategory === "command-failed" &&
          error.operation === "read a file from a revision" &&
          error.target === "docs/unreadable.md"
      );
      await assert.rejects(
        repository.readRevisionFiles("HEAD"),
        (error: unknown) =>
          error instanceof VersionControlError &&
          error.code === "operation-failed" &&
          error.causeCategory === "command-failed" &&
          error.operation === "read files from a revision"
      );

      const commitId = runGit(repositoryRoot, ["rev-parse", "HEAD"]).trim();
      const commitPath = path.join(
        repositoryRoot,
        ".git",
        "objects",
        commitId.slice(0, 2),
        commitId.slice(2)
      );
      await fs.chmod(commitPath, 0o666);
      await fs.writeFile(commitPath, "corrupt Git object", "utf8");
      await assert.rejects(
        repository.resolveRevision("HEAD"),
        (error: unknown) =>
          error instanceof VersionControlError &&
          error.code === "operation-failed" &&
          error.causeCategory === "command-failed" &&
          error.operation === "resolve a revision" &&
          error.target === "requested revision"
      );
    });
  }
);

test(
  "rejects directories that are not Git repositories",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const plainDirectory = path.join(tempRoot, "plain");
      await fs.mkdir(plainDirectory, { recursive: true });
      await assert.rejects(
        openVersionControl(plainDirectory),
        (error: unknown) => hasVersionControlCode(error, "not-repository")
      );
    });
  }
);

test(
  "reports Git worktree discovery failures as operation failures",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const brokenWorktree = path.join(tempRoot, "broken-worktree");
      await fs.mkdir(brokenWorktree, { recursive: true });
      await fs.writeFile(
        path.join(brokenWorktree, ".git"),
        "invalid Git worktree metadata\n",
        "utf8"
      );

      await assert.rejects(
        openVersionControl(brokenWorktree),
        (error: unknown) =>
          hasVersionControlCode(error, "operation-failed") &&
          error instanceof Error &&
          /invalid gitfile format/iu.test(error.message)
      );
    });
  }
);
