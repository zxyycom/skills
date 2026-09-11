import {
  assert,
  createRepositoryFixture,
  gitTestOptions,
  hasVersionControlCode,
  isPendingConflict,
  openGitVersionControl,
  openVersionControl,
  readPendingModes,
  readPendingText,
  rejectedVersionControlError,
  runGit,
  test,
  withTempRoot,
  writeFile
} from "./version-control-test-support.ts";

test(
  "reuses verified pending entries and avoids publishing an unchanged replacement",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { currentRevision, repositoryRoot } =
        await createRepositoryFixture(tempRoot);
      runGit(repositoryRoot, ["reset", "--quiet", "HEAD"]);
      const expectedFiles = [
        { data: Buffer.from("current\n"), path: "docs/tracked.md" }
      ];
      let pendingWrites = 0;
      const repository = await openGitVersionControl(repositoryRoot, {
        beforePendingWrite: () => {
          pendingWrites += 1;
        }
      });

      const unchanged = await repository.replacePendingFiles({
        expectedFiles,
        expectedRevision: currentRevision,
        files: expectedFiles,
        pathScope: "docs/tracked.md"
      });
      assert.deepEqual(unchanged, {
        pathScope: "docs/tracked.md",
        pendingPaths: ["docs/tracked.md"],
        previousPaths: ["docs/tracked.md"]
      });
      assert.equal(pendingWrites, 0);

      await repository.replacePendingFiles({
        expectedFiles,
        expectedRevision: currentRevision,
        files: [
          { data: Buffer.from("replacement\n"), path: "docs/tracked.md" }
        ],
        pathScope: "docs/tracked.md"
      });
      assert.equal(pendingWrites, 1);
      assert.deepEqual(await readPendingText(repository, "docs/tracked.md"), [
        { data: "replacement\n", path: "docs/tracked.md" }
      ]);
    });
  }
);

test(
  "rejects replacements when expected pending ordinary files differ",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { currentRevision, repositoryRoot } =
        await createRepositoryFixture(tempRoot);
      runGit(repositoryRoot, ["reset", "--quiet", "HEAD"]);
      await writeFile(
        repositoryRoot,
        "outside/preserve.md",
        "outside pending\n"
      );
      runGit(repositoryRoot, ["add", "outside/preserve.md"]);
      const expectedFile = {
        data: Buffer.from("current\n"),
        path: "docs/tracked.md"
      };
      let pendingWrites = 0;
      const repository = await openGitVersionControl(repositoryRoot, {
        beforePendingWrite: () => {
          pendingWrites += 1;
        }
      });

      await writeFile(repositoryRoot, "docs/tracked.md", "other pending\n");
      runGit(repositoryRoot, ["add", "docs/tracked.md"]);
      const expectedPendingConflict = await rejectedVersionControlError(
        repository.replacePendingFiles({
          expectedFiles: [expectedFile],
          expectedRevision: currentRevision,
          files: [
            {
              data: Buffer.from("replacement\n"),
              path: "docs/tracked.md"
            }
          ],
          pathScope: "docs/tracked.md"
        })
      );
      assert.equal(expectedPendingConflict.causeCategory, "unknown");
      assert.equal(
        expectedPendingConflict.operation,
        "verify a pending replacement"
      );
      assert.equal(expectedPendingConflict.target, "docs/tracked.md");
      assert.equal(pendingWrites, 0);
      assert.deepEqual(await readPendingText(repository, "docs/tracked.md"), [
        {
          data: "other pending\n",
          path: "docs/tracked.md"
        }
      ]);

      const revisionBlob = runGit(repositoryRoot, [
        "rev-parse",
        `${currentRevision}:docs/tracked.md`
      ]).trim();
      const representationScenarios = [
        {
          mode: "100755",
          prepare: () =>
            runGit(repositoryRoot, [
              "update-index",
              "--chmod=+x",
              "docs/tracked.md"
            ])
        },
        {
          mode: "120000",
          prepare: () =>
            runGit(repositoryRoot, [
              "update-index",
              "--add",
              "--cacheinfo",
              `120000,${revisionBlob},docs/tracked.md`
            ])
        }
      ] as const;
      for (const scenario of representationScenarios) {
        runGit(repositoryRoot, [
          "reset",
          "--quiet",
          "HEAD",
          "--",
          "docs/tracked.md"
        ]);
        scenario.prepare();
        const conflict = await rejectedVersionControlError(
          repository.replacePendingFiles({
            expectedFiles: [expectedFile],
            expectedRevision: currentRevision,
            files: [
              {
                data: Buffer.from("replacement\n"),
                path: "docs/tracked.md"
              }
            ],
            pathScope: "docs/tracked.md"
          })
        );
        assert.equal(conflict.causeCategory, "unknown");
        assert.equal(conflict.operation, "verify a pending replacement");
        assert.equal(conflict.target, "docs/tracked.md");
        assert.deepEqual(
          readPendingModes(repositoryRoot, ["docs/tracked.md"]),
          [
            {
              mode: scenario.mode,
              path: "docs/tracked.md"
            }
          ]
        );
      }
      assert.equal(pendingWrites, 0);
      assert.deepEqual(
        await readPendingText(repository, "outside/preserve.md"),
        [
          {
            data: "outside pending\n",
            path: "outside/preserve.md"
          }
        ]
      );

      runGit(repositoryRoot, ["reset", "--hard", "--quiet", "HEAD"]);
      const primaryBranch = runGit(repositoryRoot, [
        "branch",
        "--show-current"
      ]).trim();
      runGit(repositoryRoot, ["checkout", "--quiet", "-b", "pending-conflict"]);
      await writeFile(repositoryRoot, "docs/tracked.md", "side content\n");
      runGit(repositoryRoot, ["add", "docs/tracked.md"]);
      runGit(repositoryRoot, ["commit", "--quiet", "--message", "side"]);
      runGit(repositoryRoot, ["checkout", "--quiet", primaryBranch]);
      await writeFile(repositoryRoot, "docs/tracked.md", "primary content\n");
      runGit(repositoryRoot, ["add", "docs/tracked.md"]);
      runGit(repositoryRoot, ["commit", "--quiet", "--message", "primary"]);
      assert.throws(() =>
        runGit(repositoryRoot, ["merge", "--no-edit", "pending-conflict"])
      );
      const conflictRevision = await repository.getCurrentRevision();
      assert.notEqual(conflictRevision, null);
      const conflictExpected = await repository.readRevisionFile(
        conflictRevision!,
        "docs/tracked.md"
      );
      assert.notEqual(conflictExpected, null);
      const unmergedBefore = runGit(repositoryRoot, [
        "ls-files",
        "--unmerged",
        "--",
        "docs/tracked.md"
      ]);
      const unmergedConflict = await rejectedVersionControlError(
        repository.replacePendingFiles({
          expectedFiles: [conflictExpected!],
          expectedRevision: conflictRevision,
          files: [
            {
              data: Buffer.from("replacement\n"),
              path: "docs/tracked.md"
            }
          ],
          pathScope: "docs/tracked.md"
        })
      );
      assert.equal(unmergedConflict.causeCategory, "unknown");
      assert.equal(unmergedConflict.operation, "verify a pending replacement");
      assert.equal(unmergedConflict.target, "docs/tracked.md");
      assert.equal(pendingWrites, 0);
      assert.equal(
        runGit(repositoryRoot, [
          "ls-files",
          "--unmerged",
          "--",
          "docs/tracked.md"
        ]),
        unmergedBefore
      );
    });
  }
);

test(
  "serializes concurrent replacements against expected pending files",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { currentRevision, repositoryRoot } =
        await createRepositoryFixture(tempRoot);
      runGit(repositoryRoot, ["reset", "--quiet", "HEAD"]);
      const expectedFiles = [
        {
          data: Buffer.from("current\n"),
          path: "docs/tracked.md"
        }
      ];
      const repositories = await Promise.all([
        openVersionControl(repositoryRoot),
        openVersionControl(repositoryRoot)
      ]);
      const replacements = ["first target\n", "second target\n"].map(
        (content, index) =>
          repositories[index]!.replacePendingFiles({
            expectedFiles,
            expectedRevision: currentRevision,
            files: [
              {
                data: Buffer.from(content),
                path: "docs/tracked.md"
              }
            ],
            pathScope: "docs/tracked.md"
          })
      );

      const results = await Promise.allSettled(replacements);
      assert.equal(
        results.filter((result) => result.status === "fulfilled").length,
        1
      );
      const rejected = results.find((result) => result.status === "rejected");
      assert.ok(rejected?.status === "rejected");
      assert.equal(isPendingConflict(rejected.reason), true);
      const pending = await readPendingText(
        repositories[0]!,
        "docs/tracked.md"
      );
      assert.equal(pending.length, 1);
      assert.ok(
        pending[0]?.data === "first target\n" ||
          pending[0]?.data === "second target\n"
      );
    });
  }
);

test(
  "rejects invalid pending replacement paths without changing pending files",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot } = await createRepositoryFixture(tempRoot);
      const repository = await openVersionControl(repositoryRoot);
      const before = await readPendingText(repository);
      const expectedRevision = await repository.getCurrentRevision();

      await assert.rejects(
        repository.replacePendingFiles({
          expectedRevision,
          files: [{ data: Buffer.from("outside\n"), path: "outside.md" }],
          pathScope: "docs"
        }),
        (error: unknown) => hasVersionControlCode(error, "invalid-path")
      );
      await assert.rejects(
        repository.replacePendingFiles({
          expectedRevision,
          files: [
            { data: Buffer.from("one\n"), path: "docs/duplicate.md" },
            { data: Buffer.from("two\n"), path: "docs\\duplicate.md" }
          ],
          pathScope: "docs"
        }),
        (error: unknown) => hasVersionControlCode(error, "invalid-path")
      );
      await assert.rejects(
        repository.replacePendingFiles({
          expectedRevision,
          files: [],
          pathScope: "../docs"
        }),
        (error: unknown) => hasVersionControlCode(error, "invalid-path")
      );

      assert.deepEqual(await readPendingText(repository), before);
    });
  }
);
