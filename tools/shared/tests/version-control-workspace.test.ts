import {
  assert,
  createRepositoryFixture,
  fs,
  gitTestOptions,
  hasVersionControlCode,
  initializeRepository,
  listFirstParentRevisionChanges,
  openVersionControl,
  path,
  readPendingModes,
  readPendingText,
  repositoryRelativePathFromFileSystemPath,
  runGit,
  test,
  VersionControlError,
  withTempRoot,
  writeFile,
  writeGitBlob
} from "./version-control-test-support.ts";

test(
  "maps first-parent Git command failures to operation failures",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const repositoryRoot = path.join(tempRoot, "first-parent-failure");
      await fs.mkdir(repositoryRoot, { recursive: true });
      initializeRepository(repositoryRoot);
      await writeFile(repositoryRoot, "docs/unreadable.md", "base\n");
      runGit(repositoryRoot, ["add", "."]);
      runGit(repositoryRoot, ["commit", "--quiet", "--message", "base"]);
      const baseRevision = runGit(repositoryRoot, ["rev-parse", "HEAD"]).trim();

      await writeFile(repositoryRoot, "docs/unreadable.md", "current\n");
      runGit(repositoryRoot, ["add", "."]);
      runGit(repositoryRoot, ["commit", "--quiet", "--message", "current"]);
      const currentRevision = runGit(repositoryRoot, [
        "rev-parse",
        "HEAD"
      ]).trim();
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

      await assert.rejects(
        listFirstParentRevisionChanges(
          await openVersionControl(repositoryRoot),
          { from: baseRevision, to: currentRevision }
        ),
        (error: unknown) =>
          error instanceof VersionControlError &&
          error.code === "operation-failed" &&
          error.message.includes("list first-parent revision changes")
      );
    });
  }
);

test(
  "converts absolute descendants to normalized repository paths",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const repositoryRoot = path.join(tempRoot, "repository-path");
      await fs.mkdir(repositoryRoot, { recursive: true });
      initializeRepository(repositoryRoot);
      const repository = await openVersionControl(repositoryRoot);
      assert.equal(
        repositoryRelativePathFromFileSystemPath(
          repository.rootDirectory,
          path.join(repositoryRoot, "nested", "file.md")
        ),
        "nested/file.md"
      );
      assert.throws(
        () =>
          repositoryRelativePathFromFileSystemPath(
            repository.rootDirectory,
            "nested/file.md"
          ),
        (error: unknown) => hasVersionControlCode(error, "invalid-path")
      );
      assert.throws(
        () =>
          repositoryRelativePathFromFileSystemPath(
            repository.rootDirectory,
            repositoryRoot
          ),
        (error: unknown) => hasVersionControlCode(error, "invalid-path")
      );
      assert.throws(
        () =>
          repositoryRelativePathFromFileSystemPath(
            repository.rootDirectory,
            path.join(repositoryRoot, "..", "outside.md")
          ),
        (error: unknown) => hasVersionControlCode(error, "invalid-path")
      );
    });
  }
);

test(
  "reads pending index content separately from workspace state",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot, stagedBinary } =
        await createRepositoryFixture(tempRoot);
      const repository = await openVersionControl(repositoryRoot);
      assert.deepEqual(
        (
          await repository.readPendingFiles({
            pathScopes: ["docs/tracked.md"]
          })
        ).map((file) => ({
          data: Buffer.from(file.data).toString("utf8"),
          path: file.path
        })),
        [{ data: "staged\n", path: "docs/tracked.md" }]
      );
      assert.deepEqual(
        (
          await repository.readPendingFiles({
            pathScopes: ["docs/staged.bin", "docs/staged-copy.bin"]
          })
        ).map((file) => ({
          data: Buffer.from(file.data),
          path: file.path
        })),
        [
          {
            data: stagedBinary,
            path: "docs/staged-copy.bin"
          },
          {
            data: stagedBinary,
            path: "docs/staged.bin"
          }
        ]
      );
      assert.deepEqual(
        (await repository.readPendingFiles({ pathScopes: ["docs"] })).map(
          (file) => file.path
        ),
        [
          "docs/base-only.md",
          "docs/current-only.md",
          "docs/staged-copy.bin",
          "docs/staged.bin",
          "docs/tracked.md"
        ]
      );
      assert.deepEqual(await repository.listWorkspaceFiles(), [
        ".gitignore",
        "docs/base-only.md",
        "docs/current-only.md",
        "docs/staged-copy.bin",
        "docs/staged.bin",
        "docs/tracked.md",
        "docs/untracked.md"
      ]);
      assert.deepEqual(
        await repository.listWorkspaceFiles({
          pathScopes: ["docs/current-only.md", "docs/staged.bin"]
        }),
        ["docs/current-only.md", "docs/staged.bin"]
      );
      await assert.rejects(
        repository.listWorkspaceFiles({ pathScopes: ["../outside.md"] }),
        (error: unknown) => hasVersionControlCode(error, "invalid-path")
      );
      assert.deepEqual(await repository.listWorkspaceChangedPaths(), [
        "docs/staged-copy.bin",
        "docs/staged.bin",
        "docs/tracked.md",
        "docs/untracked.md"
      ]);
    });
  }
);

test(
  "replaces a literal pending range exactly and preserves pending files outside it",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot } = await createRepositoryFixture(tempRoot);
      await writeFile(
        repositoryRoot,
        "selected/modify.md",
        "revision modify\n"
      );
      await writeFile(
        repositoryRoot,
        "selected/delete.md",
        "revision delete\n"
      );
      await writeFile(repositoryRoot, "selected/link.md", "revision link\n");
      await writeFile(
        repositoryRoot,
        "selected/mode-only.md",
        "revision mode\n"
      );
      await writeFile(repositoryRoot, "outside/keep.md", "revision outside\n");
      runGit(repositoryRoot, ["add", "selected", "outside"]);
      runGit(repositoryRoot, [
        "commit",
        "--quiet",
        "--message",
        "replacement base"
      ]);

      await writeFile(
        repositoryRoot,
        "selected/modify.md",
        "old pending modify\n"
      );
      await writeFile(repositoryRoot, "outside/keep.md", "pending outside\n");
      runGit(repositoryRoot, ["add", "selected/modify.md", "outside/keep.md"]);
      runGit(repositoryRoot, [
        "update-index",
        "--chmod=+x",
        "selected/mode-only.md"
      ]);
      const linkObjectId = writeGitBlob(repositoryRoot, "pending link target");
      runGit(repositoryRoot, [
        "update-index",
        "--add",
        "--cacheinfo",
        `120000,${linkObjectId},selected/link.md`
      ]);
      await writeFile(
        repositoryRoot,
        "selected/modify.md",
        "workspace modify\n"
      );

      const repository = await openVersionControl(repositoryRoot);
      const result = await repository.replacePendingFiles({
        expectedRevision: await repository.getCurrentRevision(),
        files: [
          { data: Buffer.from("target add\n"), path: "selected/add.md" },
          { data: Buffer.from("revision link\n"), path: "selected/link.md" },
          {
            data: Buffer.from("revision mode\n"),
            path: "selected/mode-only.md"
          },
          { data: Buffer.from("target modify\n"), path: "selected/modify.md" }
        ],
        pathScope: "selected"
      });

      assert.deepEqual(result, {
        pathScope: "selected",
        pendingPaths: [
          "selected/add.md",
          "selected/link.md",
          "selected/mode-only.md",
          "selected/modify.md"
        ],
        previousPaths: [
          "selected/delete.md",
          "selected/link.md",
          "selected/mode-only.md",
          "selected/modify.md"
        ]
      });
      assert.deepEqual(await readPendingText(repository, "selected"), [
        { data: "target add\n", path: "selected/add.md" },
        { data: "revision link\n", path: "selected/link.md" },
        { data: "revision mode\n", path: "selected/mode-only.md" },
        { data: "target modify\n", path: "selected/modify.md" }
      ]);
      assert.deepEqual(await readPendingText(repository, "outside/keep.md"), [
        { data: "pending outside\n", path: "outside/keep.md" }
      ]);
      assert.deepEqual(
        await repository.listPendingChangedPaths({ from: "HEAD" }),
        [
          "outside/keep.md",
          "selected/add.md",
          "selected/delete.md",
          "selected/modify.md"
        ]
      );
      assert.deepEqual(
        readPendingModes(repositoryRoot, [
          "selected/link.md",
          "selected/mode-only.md"
        ]),
        [
          { mode: "100644", path: "selected/link.md" },
          { mode: "100644", path: "selected/mode-only.md" }
        ]
      );
      assert.equal(
        await fs.readFile(
          path.join(repositoryRoot, "selected/modify.md"),
          "utf8"
        ),
        "workspace modify\n"
      );
    });
  }
);
