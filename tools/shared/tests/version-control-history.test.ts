import {
  assert,
  fs,
  gitTestOptions,
  hasVersionControlCode,
  initializeRepository,
  listFirstParentRevisionChanges,
  openVersionControl,
  path,
  parseGitFirstParentRevisionChanges,
  runGit,
  test,
  withTempRoot,
  writeFile
} from "./version-control-test-support.ts";

test(
  "lists first-parent revision changes in order and preserves empty commits",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const repositoryRoot = path.join(tempRoot, "first-parent-changes");
      await fs.mkdir(repositoryRoot, { recursive: true });
      initializeRepository(repositoryRoot);
      await writeFile(repositoryRoot, "base.md", "base\n");
      runGit(repositoryRoot, ["add", "."]);
      runGit(repositoryRoot, ["commit", "--quiet", "--message", "base"]);
      const baseRevision = runGit(repositoryRoot, ["rev-parse", "HEAD"]).trim();
      const primaryBranch = runGit(repositoryRoot, [
        "branch",
        "--show-current"
      ]).trim();

      await writeFile(repositoryRoot, "docs/space ü.md", "special\n");
      await writeFile(repositoryRoot, "docs/text.md", "one\ntwo\n");
      await fs.mkdir(path.join(repositoryRoot, "assets"), { recursive: true });
      await fs.writeFile(
        path.join(repositoryRoot, "assets/binary.bin"),
        Buffer.from([0x00, 0x01, 0xfe, 0xff])
      );
      runGit(repositoryRoot, ["add", "."]);
      runGit(repositoryRoot, ["commit", "--quiet", "--message", "content"]);
      const contentRevision = runGit(repositoryRoot, [
        "rev-parse",
        "HEAD"
      ]).trim();

      runGit(repositoryRoot, [
        "commit",
        "--quiet",
        "--allow-empty",
        "--message",
        "empty"
      ]);
      const emptyRevision = runGit(repositoryRoot, [
        "rev-parse",
        "HEAD"
      ]).trim();

      await writeFile(repositoryRoot, "docs/text.md", "one\nthree\nfour\n");
      await fs.rm(path.join(repositoryRoot, "assets/binary.bin"));
      runGit(repositoryRoot, ["add", "--all"]);
      runGit(repositoryRoot, ["commit", "--quiet", "--message", "update"]);
      const updateRevision = runGit(repositoryRoot, [
        "rev-parse",
        "HEAD"
      ]).trim();

      runGit(repositoryRoot, [
        "checkout",
        "--quiet",
        "-b",
        "content-side",
        emptyRevision
      ]);
      await writeFile(repositoryRoot, "side.md", "side\n");
      runGit(repositoryRoot, ["add", "."]);
      runGit(repositoryRoot, ["commit", "--quiet", "--message", "side"]);
      runGit(repositoryRoot, ["checkout", "--quiet", primaryBranch]);
      runGit(repositoryRoot, [
        "merge",
        "--quiet",
        "--no-ff",
        "--message",
        "merge side",
        "content-side"
      ]);
      const mergeRevision = runGit(repositoryRoot, [
        "rev-parse",
        "HEAD"
      ]).trim();

      const repository = await openVersionControl(repositoryRoot);
      const changes = await listFirstParentRevisionChanges(repository, {
        from: baseRevision,
        to: mergeRevision
      });
      assert.deepEqual(changes, [
        {
          changes: [
            {
              addedLineCount: null,
              deletedLineCount: null,
              path: "assets/binary.bin"
            },
            {
              addedLineCount: 1,
              deletedLineCount: 0,
              path: "docs/space ü.md"
            },
            {
              addedLineCount: 2,
              deletedLineCount: 0,
              path: "docs/text.md"
            }
          ],
          revision: contentRevision
        },
        { changes: [], revision: emptyRevision },
        {
          changes: [
            {
              addedLineCount: null,
              deletedLineCount: null,
              path: "assets/binary.bin"
            },
            {
              addedLineCount: 2,
              deletedLineCount: 1,
              path: "docs/text.md"
            }
          ],
          revision: updateRevision
        },
        {
          changes: [
            {
              addedLineCount: 1,
              deletedLineCount: 0,
              path: "side.md"
            }
          ],
          revision: mergeRevision
        }
      ]);
      assert.deepEqual(
        await listFirstParentRevisionChanges(repository, {
          from: baseRevision
        }),
        changes
      );
      assert.deepEqual(
        await listFirstParentRevisionChanges(repository, {
          from: mergeRevision,
          to: mergeRevision
        }),
        []
      );
    });
  }
);

test(
  "returns null for revisions outside the first-parent history",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const repositoryRoot = path.join(tempRoot, "first-parent-relation");
      await fs.mkdir(repositoryRoot, { recursive: true });
      initializeRepository(repositoryRoot);
      await writeFile(repositoryRoot, "base.md", "base\n");
      runGit(repositoryRoot, ["add", "."]);
      runGit(repositoryRoot, ["commit", "--quiet", "--message", "base"]);
      const primaryBranch = runGit(repositoryRoot, [
        "branch",
        "--show-current"
      ]).trim();

      runGit(repositoryRoot, ["checkout", "--quiet", "-b", "side"]);
      await writeFile(repositoryRoot, "side.md", "side\n");
      runGit(repositoryRoot, ["add", "."]);
      runGit(repositoryRoot, ["commit", "--quiet", "--message", "side"]);
      const sideRevision = runGit(repositoryRoot, ["rev-parse", "HEAD"]).trim();

      runGit(repositoryRoot, ["checkout", "--quiet", primaryBranch]);
      await writeFile(repositoryRoot, "primary.md", "primary\n");
      runGit(repositoryRoot, ["add", "."]);
      runGit(repositoryRoot, ["commit", "--quiet", "--message", "primary"]);
      runGit(repositoryRoot, [
        "merge",
        "--quiet",
        "--no-ff",
        "--message",
        "merge",
        "side"
      ]);
      const mergeRevision = runGit(repositoryRoot, [
        "rev-parse",
        "HEAD"
      ]).trim();

      assert.equal(
        await listFirstParentRevisionChanges(
          await openVersionControl(repositoryRoot),
          { from: sideRevision, to: mergeRevision }
        ),
        null
      );
    });
  }
);

test("strictly parses NUL numstat records", () => {
  const from = "a".repeat(40);
  const to = "b".repeat(40);
  const output =
    "\0" +
    to +
    "\t" +
    from +
    "\0\0\n9007199254740991\t0\tdocs/tab\tand\nline.md" +
    "\0-\t-\tassets/binary.bin\0";
  assert.deepEqual(parseGitFirstParentRevisionChanges(output, from, to), [
    {
      changes: [
        {
          addedLineCount: null,
          deletedLineCount: null,
          path: "assets/binary.bin"
        },
        {
          addedLineCount: Number.MAX_SAFE_INTEGER,
          deletedLineCount: 0,
          path: "docs/tab\tand\nline.md"
        }
      ],
      revision: to
    }
  ]);

  const malformedOutputs = [
    output.slice(0, -1),
    output.replace("9007199254740991", "9007199254740992"),
    output.replace("9007199254740991", "01"),
    output.replace("-\t-\tassets", "-\t1\tassets"),
    output + "\0",
    "\0" + to + "\t" + from + "\0\0" + "1\t0\tdocs/no-prefix.md\0"
  ];
  for (const malformedOutput of malformedOutputs) {
    assert.throws(
      () => parseGitFirstParentRevisionChanges(malformedOutput, from, to),
      (error: unknown) => hasVersionControlCode(error, "operation-failed")
    );
  }
});
