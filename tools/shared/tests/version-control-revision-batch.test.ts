import {
  assert,
  createRepositoryFixture,
  fs,
  gitTestOptions,
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
  "exact revision batch defers errors and matches individual reads",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { baseRevision, repositoryRoot } =
        await createRepositoryFixture(tempRoot);
      const repository = await openVersionControl(repositoryRoot);
      const paths = [
        "docs/tracked.md",
        "docs/missing.md",
        "docs",
        "../invalid"
      ];
      const reads = await repository.prepareRevisionFileReads!(
        baseRevision,
        paths
      );
      assert.deepEqual(
        await reads[0]!(),
        await repository.readRevisionFile(baseRevision, paths[0]!)
      );
      assert.equal(await reads[1]!(), null);
      await assert.rejects(reads[2]!());
      await assert.rejects(reads[3]!());
      const overlapping = await repository.prepareRevisionFileReads!(
        baseRevision,
        ["docs", "docs/tracked.md"]
      );
      await assert.rejects(overlapping[0]!());
      assert.deepEqual(
        await overlapping[1]!(),
        await repository.readRevisionFile(baseRevision, "docs/tracked.md")
      );
      // A later invalid path must not prevent consumption of an earlier path.
      const short = await repository.prepareRevisionFileReads!(baseRevision, [
        "docs/tracked.md",
        "../invalid"
      ]);
      assert.deepEqual(
        await short[0]!(),
        await repository.readRevisionFile(baseRevision, "docs/tracked.md")
      );
    });
  }
);

test(
  "exact revision batch uses bounded Git queries for growing path sets",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot } = await createRepositoryFixture(tempRoot);
      const paths = Array.from({ length: 100 }, (_, i) => `bulk/file-${i}.md`);
      for (const [index, filePath] of paths.entries())
        await writeFile(repositoryRoot, filePath, `content ${index}\n`);
      runGit(repositoryRoot, ["add", "bulk"]);
      runGit(repositoryRoot, ["commit", "--quiet", "-m", "bulk"]);
      const baseRevision = runGit(repositoryRoot, ["rev-parse", "HEAD"]).trim();
      const repository = await openVersionControl(repositoryRoot);
      const trace = path.join(tempRoot, "trace.jsonl");
      const previous = process.env.GIT_TRACE2_EVENT;
      process.env.GIT_TRACE2_EVENT = trace;
      try {
        const reads = await repository.prepareRevisionFileReads!(
          baseRevision,
          paths
        );
        for (const [index, read] of reads.entries())
          assert.equal(
            Buffer.from((await read())!.data).toString(),
            `content ${index}\n`
          );
      } finally {
        if (previous === undefined) delete process.env.GIT_TRACE2_EVENT;
        else process.env.GIT_TRACE2_EVENT = previous;
      }
      const starts = (await fs.readFile(trace, "utf8"))
        .split("\n")
        .filter((line) => line.includes('"event":"start"'));
      assert.equal(
        starts.filter((line) => line.includes('"ls-tree"')).length,
        1
      );
      assert.equal(
        starts.filter((line) => line.includes('"cat-file"')).length,
        1
      );
    });
  }
);

test(
  "exact batch falls back per path when an unconsumed blob is corrupt",
  gitTestOptions,
  async () => {
    await withTempRoot(async (root) => {
      const repositoryRoot = path.join(root, "corrupt");
      await fs.mkdir(repositoryRoot, { recursive: true });
      initializeRepository(repositoryRoot);
      await writeFile(repositoryRoot, "good.md", "good\n");
      await writeFile(repositoryRoot, "bad.md", "bad\n");
      runGit(repositoryRoot, ["add", "."]);
      runGit(repositoryRoot, ["commit", "--quiet", "-m", "base"]);
      const revision = runGit(repositoryRoot, ["rev-parse", "HEAD"]).trim();
      const blob = runGit(repositoryRoot, ["rev-parse", "HEAD:bad.md"]).trim();
      const blobPath = path.join(
        repositoryRoot,
        ".git",
        "objects",
        blob.slice(0, 2),
        blob.slice(2)
      );
      await fs.chmod(blobPath, 0o666);
      await fs.writeFile(blobPath, "corrupt");
      const repository = await openVersionControl(repositoryRoot);
      const reads = await repository.prepareRevisionFileReads!(revision, [
        "good.md",
        "bad.md"
      ]);
      assert.equal(Buffer.from((await reads[0]!())!.data).toString(), "good\n");
      await assert.rejects(
        reads[1]!(),
        (error: unknown) =>
          error instanceof VersionControlError && error.target === "bad.md"
      );
    });
  }
);

test(
  "exact revision paths respect Git transport batches",
  gitTestOptions,
  async () => {
    await withTempRoot(async (root) => {
      const { baseRevision, repositoryRoot } =
        await createRepositoryFixture(root);
      const repository = await openVersionControl(repositoryRoot);
      const paths = Array.from(
        { length: 200 },
        (_, i) => `docs/missing-${i}-${"x".repeat(180)}.md`
      );
      paths.push("docs/tracked.md");
      const trace = path.join(root, "trace.jsonl");
      const previous = process.env.GIT_TRACE2_EVENT;
      process.env.GIT_TRACE2_EVENT = trace;
      try {
        const reads = await repository.prepareRevisionFileReads!(
          baseRevision,
          paths
        );
        assert.equal(await reads[0]!(), null);
        assert.equal(
          Buffer.from((await reads.at(-1)!())!.data).toString(),
          "base\n"
        );
      } finally {
        if (previous === undefined) delete process.env.GIT_TRACE2_EVENT;
        else process.env.GIT_TRACE2_EVENT = previous;
      }
      const trees = (await fs.readFile(trace, "utf8"))
        .split("\n")
        .filter(
          (line) =>
            line.includes('"event":"start"') && line.includes('"ls-tree"')
        );
      assert.ok(trees.length > 1);
      assert.ok(trees.every((line) => Buffer.byteLength(line) < 28_000));
    });
  }
);

test(
  "revision preparation freezes a missing ref failure even if that ref later appears",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot } = await createRepositoryFixture(tempRoot);
      const repository = await openVersionControl(repositoryRoot);
      const reads = await repository.prepareRevisionFileReads!(
        "future-branch",
        ["docs/tracked.md", "../invalid"]
      );
      runGit(repositoryRoot, ["branch", "future-branch", "HEAD"]);
      await assert.rejects(
        reads[0]!(),
        (error: unknown) =>
          error instanceof VersionControlError &&
          error.code === "revision-not-found"
      );
      await assert.rejects(
        reads[1]!(),
        (error: unknown) =>
          error instanceof VersionControlError && error.code === "invalid-path"
      );
    });
  }
);

test(
  "an exact directory remains invalid when every descendant is also requested",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot } = await createRepositoryFixture(tempRoot);
      await writeFile(repositoryRoot, "sole/only.md", "only\n");
      runGit(repositoryRoot, ["add", "sole/only.md"]);
      runGit(repositoryRoot, ["commit", "--quiet", "--message", "sole tree"]);
      const repository = await openVersionControl(repositoryRoot);
      const reads = await repository.prepareRevisionFileReads!("HEAD", [
        "sole",
        "sole/only.md"
      ]);
      await assert.rejects(
        reads[0]!(),
        (error: unknown) =>
          error instanceof VersionControlError &&
          error.code === "operation-failed"
      );
      assert.equal(Buffer.from((await reads[1]!())!.data).toString(), "only\n");
    });
  }
);

test(
  "prepared revision reads retain original HEAD after a later commit",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot } = await createRepositoryFixture(tempRoot);
      const repository = await openVersionControl(repositoryRoot);
      const reads = await repository.prepareRevisionFileReads!("HEAD", [
        "docs/tracked.md"
      ]);
      await writeFile(repositoryRoot, "docs/tracked.md", "new head\n");
      runGit(repositoryRoot, ["add", "docs/tracked.md"]);
      runGit(repositoryRoot, ["commit", "--quiet", "-m", "new head"]);
      assert.equal(
        Buffer.from((await reads[0]!())!.data).toString(),
        "current\n"
      );
    });
  }
);
