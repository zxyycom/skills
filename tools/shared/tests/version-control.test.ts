import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  openVersionControl,
  repositoryRelativePathFromFileSystemPath,
  VersionControlError
} from "../src/version-control/index.ts";
import { operationErrorDetail } from "../src/version-control/error-detail.ts";
import { listFirstParentRevisionChanges } from "../src/version-control/git-first-parent.ts";
import { openGitVersionControl } from "../src/version-control/git.ts";
import { parseGitFirstParentRevisionChanges } from "../src/version-control/git-numstat.ts";

const gitTestOptions = { timeout: 15_000 };

test("normalizes structured version-control operation error details", () => {
  assert.equal(operationErrorDetail(undefined), null);
  assert.equal(operationErrorDetail("\n Git\tfailed \n"), "Git failed");
  const structured = operationErrorDetail({
    operation: "read revision",
    retries: 2
  });
  assert.ok(structured);
  assert.match(structured, /operation.*read revision/u);
  assert.match(structured, /retries.*2/u);
  assert.doesNotMatch(structured, /\[object Object\]/u);
});

async function withTempRoot(
  run: (tempRoot: string) => Promise<void>
): Promise<void> {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "version-control-test-")
  );
  try {
    await run(tempRoot);
  } finally {
    await fs.rm(tempRoot, { force: true, recursive: true });
  }
}

async function createRepositoryFixture(tempRoot: string) {
  const repositoryRoot = path.join(tempRoot, "repository");
  await fs.mkdir(repositoryRoot, { recursive: true });
  initializeRepository(repositoryRoot);

  await writeFile(repositoryRoot, ".gitignore", "ignored.txt\n");
  await writeFile(repositoryRoot, "docs/base-only.md", "base only\n");
  await writeFile(repositoryRoot, "docs/tracked.md", "base\n");
  runGit(repositoryRoot, ["add", "."]);
  runGit(repositoryRoot, ["commit", "--quiet", "--message", "base"]);
  const baseRevision = runGit(repositoryRoot, ["rev-parse", "HEAD"]).trim();

  await writeFile(repositoryRoot, "docs/tracked.md", "current\n");
  await writeFile(repositoryRoot, "docs/current-only.md", "current only\n");
  runGit(repositoryRoot, ["add", "."]);
  runGit(repositoryRoot, ["commit", "--quiet", "--message", "current"]);
  const currentRevision = runGit(repositoryRoot, ["rev-parse", "HEAD"]).trim();

  await writeFile(repositoryRoot, "docs/tracked.md", "staged\n");
  const stagedBinary = Buffer.from([0x00, 0x01, 0xfe, 0xff]);
  await fs.writeFile(
    path.join(repositoryRoot, "docs/staged.bin"),
    stagedBinary
  );
  await fs.writeFile(
    path.join(repositoryRoot, "docs/staged-copy.bin"),
    stagedBinary
  );
  runGit(repositoryRoot, [
    "add",
    "docs/tracked.md",
    "docs/staged.bin",
    "docs/staged-copy.bin"
  ]);
  await writeFile(repositoryRoot, "docs/tracked.md", "working\n");
  await writeFile(repositoryRoot, "docs/untracked.md", "untracked\n");
  await writeFile(repositoryRoot, "ignored.txt", "ignored\n");
  return {
    baseRevision,
    currentRevision,
    repositoryRoot,
    stagedBinary
  };
}

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
      runGit(repositoryRoot, [
        "config",
        "user.email",
        "version-control@example.invalid"
      ]);
      runGit(repositoryRoot, ["config", "user.name", "Version Control Test"]);
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
      await assert.rejects(
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
        }),
        isPendingConflict
      );
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
        await assert.rejects(
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
          }),
          isPendingConflict
        );
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
      await assert.rejects(
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
        }),
        isPendingConflict
      );
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

      await assert.rejects(
        repository.replacePendingFiles({
          expectedRevision: staleRevision,
          files: replacement,
          pathScope: "docs"
        }),
        isPendingConflict
      );
      assert.deepEqual(await readPendingText(repository), before);

      const lockPath = path.join(repositoryRoot, ".git", "index.lock");
      await fs.writeFile(lockPath, "busy\n", "utf8");
      try {
        await assert.rejects(
          repository.replacePendingFiles({
            expectedRevision: currentRevision,
            files: replacement,
            pathScope: "docs"
          }),
          isPendingConflict
        );
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
          throw new Error("injected write failure");
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
          error.message.includes("the original range was restored") &&
          !/git|index|object|mode|lock/iu.test(error.message)
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
          error.message.includes("the range may be partially updated") &&
          !/git|index|object|mode|lock/iu.test(error.message)
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
          error.message.includes("read docs/unreadable.md from revision")
      );
      await assert.rejects(
        repository.readRevisionFiles("HEAD"),
        (error: unknown) =>
          error instanceof VersionControlError &&
          error.code === "operation-failed" &&
          error.message.includes("read files from revision")
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
          error.message.includes("resolve revision HEAD")
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

async function createPendingConflictRepository(
  tempRoot: string,
  name: string
): Promise<string> {
  const repositoryRoot = path.join(tempRoot, name);
  await fs.mkdir(repositoryRoot, { recursive: true });
  initializeRepository(repositoryRoot);
  await writeFile(repositoryRoot, "conflicted.txt", "base\n");
  runGit(repositoryRoot, ["add", "conflicted.txt"]);
  runGit(repositoryRoot, ["commit", "--quiet", "--message", "base"]);
  const primaryBranch = runGit(repositoryRoot, [
    "branch",
    "--show-current"
  ]).trim();
  runGit(repositoryRoot, ["checkout", "--quiet", "-b", "conflict-side"]);
  await writeFile(repositoryRoot, "conflicted.txt", "side\n");
  runGit(repositoryRoot, ["commit", "--quiet", "--all", "--message", "side"]);
  runGit(repositoryRoot, ["checkout", "--quiet", primaryBranch]);
  await writeFile(repositoryRoot, "conflicted.txt", "primary\n");
  runGit(repositoryRoot, [
    "commit",
    "--quiet",
    "--all",
    "--message",
    "primary"
  ]);
  assert.throws(() =>
    runGit(repositoryRoot, ["merge", "--quiet", "conflict-side"])
  );
  return repositoryRoot;
}

function initializeRepository(repositoryRoot: string): void {
  runGit(repositoryRoot, ["init", "--quiet"]);
  runGit(repositoryRoot, ["config", "core.autocrlf", "false"]);
  runGit(repositoryRoot, [
    "config",
    "user.email",
    "version-control@example.invalid"
  ]);
  runGit(repositoryRoot, ["config", "user.name", "Version Control Test"]);
}

function runGit(workingDirectory: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", workingDirectory, ...args], {
    encoding: "utf8",
    windowsHide: true
  });
}

function writeGitBlob(workingDirectory: string, content: string): string {
  return execFileSync(
    "git",
    ["-C", workingDirectory, "hash-object", "-w", "--stdin"],
    {
      encoding: "utf8",
      input: Buffer.from(content, "utf8"),
      windowsHide: true
    }
  ).trim();
}

function readPendingModes(
  workingDirectory: string,
  paths: readonly string[]
): Array<{ mode: string; path: string }> {
  return runGit(workingDirectory, ["ls-files", "--stage", "--", ...paths])
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      const match = /^(?<mode>[0-7]{6}) [a-f0-9]+ 0\t(?<path>.+)$/u.exec(line);
      assert.ok(
        match?.groups !== undefined,
        `unexpected pending entry: ${line}`
      );
      return {
        mode: match.groups.mode ?? "",
        path: match.groups.path ?? ""
      };
    });
}

async function writeFile(
  rootDirectory: string,
  relativePath: string,
  content: string
): Promise<void> {
  const targetPath = path.join(rootDirectory, relativePath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content, "utf8");
}

function hasVersionControlCode(
  error: unknown,
  code: VersionControlError["code"]
): boolean {
  return error instanceof VersionControlError && error.code === code;
}

function isPendingConflict(error: unknown): boolean {
  return (
    error instanceof VersionControlError &&
    error.code === "pending-conflict" &&
    error.message.includes("retry from the current revision") &&
    !/git|index|object|mode|lock/iu.test(error.message)
  );
}

async function readPendingText(
  repository: Awaited<ReturnType<typeof openVersionControl>>,
  pathScope?: string
): Promise<Array<{ data: string; path: string }>> {
  const files = await repository.readPendingFiles(
    pathScope === undefined ? {} : { pathScopes: [pathScope] }
  );
  return files.map((file) => ({
    data: Buffer.from(file.data).toString("utf8"),
    path: file.path
  }));
}
