import {
  assert,
  createRepositoryFixture,
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
  writeFile,
  writeGitBlob
} from "./version-control-test-support.ts";

test(
  "discovers the repository root and reads revision snapshots",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { baseRevision, currentRevision, repositoryRoot } =
        await createRepositoryFixture(tempRoot);
      const nested = path.join(repositoryRoot, "nested");
      await fs.mkdir(nested, { recursive: true });
      const repository = await openVersionControl(nested);
      assert.equal(repository.rootDirectory, path.resolve(repositoryRoot));
      assert.equal(await repository.getCurrentRevision(), currentRevision);
      assert.deepEqual(
        await repository.listRevisionFiles(baseRevision, {
          pathScopes: ["docs"]
        }),
        ["docs/base-only.md", "docs/tracked.md"]
      );
      assert.deepEqual(
        await repository.listRevisionFiles("HEAD", {
          pathScopes: ["docs/current-only.md"]
        }),
        ["docs/current-only.md"]
      );
      assert.deepEqual(
        await repository.readRevisionFile(baseRevision, "docs/tracked.md"),
        {
          data: Buffer.from("base\n"),
          path: "docs/tracked.md"
        }
      );
      assert.equal(
        await repository.readRevisionFile(baseRevision, "docs/missing.md"),
        null
      );
    });
  }
);

test(
  "reads batched revision snapshots with literal scopes and supported blob modes",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const repositoryRoot = path.join(tempRoot, "batched-revision");
      await fs.mkdir(repositoryRoot, { recursive: true });
      initializeRepository(repositoryRoot);
      await writeFile(repositoryRoot, "docs/*.md", "literal star\n");
      await writeFile(repositoryRoot, "docs/other.md", "other\n");
      await writeFile(repositoryRoot, "docs/plain.md", "plain\n");
      await writeFile(repositoryRoot, "docs/run.sh", "run\n");
      await writeFile(repositoryRoot, "root.md", "root\n");
      runGit(repositoryRoot, ["add", "."]);
      runGit(repositoryRoot, ["update-index", "--chmod=+x", "docs/run.sh"]);
      const linkObjectId = writeGitBlob(repositoryRoot, "link target");
      runGit(repositoryRoot, [
        "update-index",
        "--add",
        "--cacheinfo",
        `120000,${linkObjectId},docs/link.md`
      ]);
      runGit(repositoryRoot, ["commit", "--quiet", "--message", "base"]);
      const revision = runGit(repositoryRoot, ["rev-parse", "HEAD"]).trim();
      const repository = await openVersionControl(repositoryRoot);

      const allFiles = await repository.readRevisionFiles(revision);
      assert.deepEqual(
        allFiles.map((file) => ({
          data: Buffer.from(file.data).toString("utf8"),
          path: file.path
        })),
        [
          { data: "literal star\n", path: "docs/*.md" },
          { data: "link target", path: "docs/link.md" },
          { data: "other\n", path: "docs/other.md" },
          { data: "plain\n", path: "docs/plain.md" },
          { data: "run\n", path: "docs/run.sh" },
          { data: "root\n", path: "root.md" }
        ]
      );
      assert.deepEqual(
        (
          await repository.readRevisionFiles(revision, {
            pathScopes: ["docs/*.md"]
          })
        ).map((file) => ({
          data: Buffer.from(file.data).toString("utf8"),
          path: file.path
        })),
        [{ data: "literal star\n", path: "docs/*.md" }]
      );
      assert.deepEqual(
        (
          await repository.readRevisionFiles(revision, {
            pathScopes: ["docs/plain.md", "root.md"]
          })
        ).map((file) => file.path),
        ["docs/plain.md", "root.md"]
      );
      assert.deepEqual(
        (
          await repository.readRevisionFiles(revision, {
            pathScopes: ["docs", "docs/plain.md"]
          })
        ).map((file) => file.path),
        [
          "docs/*.md",
          "docs/link.md",
          "docs/other.md",
          "docs/plain.md",
          "docs/run.sh"
        ]
      );
      assert.deepEqual(
        await repository.readRevisionFiles(revision, {
          pathScopes: ["missing"]
        }),
        []
      );
      await assert.rejects(
        repository.readRevisionFiles(revision, {
          pathScopes: ["../outside.md"]
        }),
        (error: unknown) => hasVersionControlCode(error, "invalid-path")
      );
    });
  }
);

test(
  "reads batched revision snapshots from SHA-256 repositories",
  gitTestOptions,
  async (t) => {
    await withTempRoot(async (tempRoot) => {
      const repositoryRoot = path.join(tempRoot, "sha-256-revision");
      await fs.mkdir(repositoryRoot, { recursive: true });
      try {
        runGit(repositoryRoot, ["init", "--quiet", "--object-format=sha256"]);
      } catch {
        t.skip("The installed Git does not support SHA-256 repositories");
        return;
      }
      runGit(repositoryRoot, ["config", "core.autocrlf", "false"]);
      await writeFile(repositoryRoot, "docs/sha.md", "sha 256\n");
      runGit(repositoryRoot, ["add", "."]);
      runGit(repositoryRoot, ["commit", "--quiet", "--message", "base"]);
      const revision = runGit(repositoryRoot, ["rev-parse", "HEAD"]).trim();
      assert.match(revision, /^[a-f0-9]{64}$/u);
      assert.deepEqual(
        await (
          await openVersionControl(repositoryRoot)
        ).readRevisionFiles(revision),
        [{ data: Buffer.from("sha 256\n"), path: "docs/sha.md" }]
      );
    });
  }
);

test(
  "rejects unsupported tree entries when reading batched revision snapshots",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const repositoryRoot = path.join(tempRoot, "gitlink-revision");
      await fs.mkdir(repositoryRoot, { recursive: true });
      initializeRepository(repositoryRoot);
      await writeFile(repositoryRoot, "docs/plain.md", "plain\n");
      runGit(repositoryRoot, ["add", "."]);
      runGit(repositoryRoot, ["commit", "--quiet", "--message", "base"]);
      const commitObjectId = runGit(repositoryRoot, [
        "rev-parse",
        "HEAD"
      ]).trim();
      runGit(repositoryRoot, [
        "update-index",
        "--add",
        "--cacheinfo",
        `160000,${commitObjectId},docs/gitlink`
      ]);
      runGit(repositoryRoot, ["commit", "--quiet", "--message", "gitlink"]);

      await assert.rejects(
        (await openVersionControl(repositoryRoot)).readRevisionFiles("HEAD", {
          pathScopes: ["docs"]
        }),
        (error: unknown) =>
          error instanceof VersionControlError &&
          error.code === "operation-failed" &&
          error.message.includes("docs/gitlink")
      );
    });
  }
);
