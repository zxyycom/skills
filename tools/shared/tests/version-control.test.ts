import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  openVersionControl,
  VersionControlError
} from "../src/version-control/index.ts";
import { openGitVersionControl } from "../src/version-control/git.ts";

const gitTestOptions = { timeout: 15_000 };

async function withTempRoot(
  run: (tempRoot: string) => Promise<void>
): Promise<void> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "version-control-test-"));
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

test("discovers the repository root and reads revision snapshots", gitTestOptions, async () => {
  await withTempRoot(async (tempRoot) => {
    const {
      baseRevision,
      currentRevision,
      repositoryRoot
    } = await createRepositoryFixture(tempRoot);
    const nested = path.join(repositoryRoot, "nested");
    await fs.mkdir(nested, { recursive: true });
    const repository = await openVersionControl(nested);
    assert.equal(repository.rootDirectory, path.resolve(repositoryRoot));
    assert.equal(await repository.getCurrentRevision(), currentRevision);
    assert.deepEqual(
      await repository.listRevisionFiles(baseRevision, { pathScopes: ["docs"] }),
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
});

test("reads pending index content separately from workspace state", gitTestOptions, async () => {
  await withTempRoot(async (tempRoot) => {
    const {
      repositoryRoot,
      stagedBinary
    } = await createRepositoryFixture(tempRoot);
    const repository = await openVersionControl(repositoryRoot);
    assert.deepEqual(
      (await repository.readPendingFiles({
        pathScopes: ["docs/tracked.md"]
      })).map((file) => ({
        data: Buffer.from(file.data).toString("utf8"),
        path: file.path
      })),
      [{ data: "staged\n", path: "docs/tracked.md" }]
    );
    assert.deepEqual(
      (await repository.readPendingFiles({
        pathScopes: ["docs/staged.bin", "docs/staged-copy.bin"]
      })).map((file) => ({
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
      (await repository.readPendingFiles({ pathScopes: ["docs"] }))
        .map((file) => file.path),
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
    assert.deepEqual(await repository.listWorkspaceChangedPaths(), [
      "docs/staged-copy.bin",
      "docs/staged.bin",
      "docs/tracked.md",
      "docs/untracked.md"
    ]);
  });
});

test("replaces a literal pending range exactly and preserves pending files outside it", gitTestOptions, async () => {
  await withTempRoot(async (tempRoot) => {
    const { repositoryRoot } = await createRepositoryFixture(tempRoot);
    await writeFile(repositoryRoot, "selected/modify.md", "revision modify\n");
    await writeFile(repositoryRoot, "selected/delete.md", "revision delete\n");
    await writeFile(repositoryRoot, "selected/link.md", "revision link\n");
    await writeFile(repositoryRoot, "selected/mode-only.md", "revision mode\n");
    await writeFile(repositoryRoot, "outside/keep.md", "revision outside\n");
    runGit(repositoryRoot, ["add", "selected", "outside"]);
    runGit(repositoryRoot, ["commit", "--quiet", "--message", "replacement base"]);

    await writeFile(repositoryRoot, "selected/modify.md", "old pending modify\n");
    await writeFile(repositoryRoot, "outside/keep.md", "pending outside\n");
    runGit(repositoryRoot, [
      "add",
      "selected/modify.md",
      "outside/keep.md"
    ]);
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
    await writeFile(repositoryRoot, "selected/modify.md", "workspace modify\n");

    const repository = await openVersionControl(repositoryRoot);
    const result = await repository.replacePendingFiles({
      expectedRevision: await repository.getCurrentRevision(),
      files: [
        { data: Buffer.from("target add\n"), path: "selected/add.md" },
        { data: Buffer.from("revision link\n"), path: "selected/link.md" },
        { data: Buffer.from("revision mode\n"), path: "selected/mode-only.md" },
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
    assert.deepEqual(
      await readPendingText(repository, "selected"),
      [
        { data: "target add\n", path: "selected/add.md" },
        { data: "revision link\n", path: "selected/link.md" },
        { data: "revision mode\n", path: "selected/mode-only.md" },
        { data: "target modify\n", path: "selected/modify.md" }
      ]
    );
    assert.deepEqual(
      await readPendingText(repository, "outside/keep.md"),
      [{ data: "pending outside\n", path: "outside/keep.md" }]
    );
    assert.deepEqual(
      await repository.listPendingChangedPaths({ from: "HEAD" }),
      [
        "outside/keep.md",
        "selected/add.md",
        "selected/delete.md",
        "selected/modify.md"
      ]
    );
    assert.deepEqual(readPendingModes(repositoryRoot, [
      "selected/link.md",
      "selected/mode-only.md"
    ]), [
      { mode: "100644", path: "selected/link.md" },
      { mode: "100644", path: "selected/mode-only.md" }
    ]);
    assert.equal(
      await fs.readFile(
        path.join(repositoryRoot, "selected/modify.md"),
        "utf8"
      ),
      "workspace modify\n"
    );
  });
});

test("rejects invalid pending replacement paths without changing pending files", gitTestOptions, async () => {
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
});

test("rejects stale pending replacements without changing pending files", gitTestOptions, async () => {
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
    const replacement = [{
      data: Buffer.from("replacement\n"),
      path: "docs/tracked.md"
    }];

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
});

test("restores the original range after a pending write failure", gitTestOptions, async () => {
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
        files: [{
          data: Buffer.from("replacement\n"),
          path: "docs/tracked.md"
        }],
        pathScope: "docs"
      }),
      (error: unknown) => error instanceof VersionControlError
        && error.code === "pending-replacement-failed"
        && error.message.includes("the original range was restored")
        && !/git|index|object|mode|lock/iu.test(error.message)
    );
    assert.deepEqual(await readPendingText(repository, "docs"), before);
  });
});

test("restores the original range after pending readback fails", gitTestOptions, async () => {
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
        files: [{
          data: Buffer.from("replacement\n"),
          path: "docs/tracked.md"
        }],
        pathScope: "docs"
      }),
      (error: unknown) => hasVersionControlCode(
        error,
        "pending-replacement-failed"
      )
    );
    assert.deepEqual(await readPendingText(repository, "docs"), before);
  });
});

test("reports incomplete pending recovery with stable public semantics", gitTestOptions, async () => {
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
        files: [{
          data: Buffer.from("replacement\n"),
          path: "docs/tracked.md"
        }],
        pathScope: "docs"
      }),
      (error: unknown) => error instanceof VersionControlError
        && error.code === "pending-recovery-failed"
        && error.message.includes("the range may be partially updated")
        && !/git|index|object|mode|lock/iu.test(error.message)
    );
  });
});

test("lists committed and pending changes and validates revision paths", gitTestOptions, async () => {
  await withTempRoot(async (tempRoot) => {
    const {
      baseRevision,
      currentRevision,
      repositoryRoot
    } = await createRepositoryFixture(tempRoot);
    const repository = await openVersionControl(repositoryRoot);
    assert.deepEqual(await repository.listChangedPaths({ from: baseRevision }), [
      "docs/current-only.md",
      "docs/tracked.md"
    ]);
    assert.deepEqual(
      await repository.listPendingChangedPaths({
        from: currentRevision,
        pathScopes: ["docs"]
      }),
      [
        "docs/staged-copy.bin",
        "docs/staged.bin",
        "docs/tracked.md"
      ]
    );
    assert.deepEqual(await repository.listChangedPaths({
      from: currentRevision,
      to: currentRevision
    }), []);

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
});

test("opens linked worktrees as independent repository roots", gitTestOptions, async () => {
  await withTempRoot(async (tempRoot) => {
    const {
      currentRevision,
      repositoryRoot
    } = await createRepositoryFixture(tempRoot);
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
});

test("distinguishes unborn heads from broken heads", gitTestOptions, async () => {
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
});

test("rejects pending reads while the index contains conflicts", gitTestOptions, async () => {
  await withTempRoot(async (tempRoot) => {
    const repositoryRoot = path.join(tempRoot, "conflict");
    await fs.mkdir(repositoryRoot, { recursive: true });
    initializeRepository(repositoryRoot);
    await writeFile(repositoryRoot, "conflicted.txt", "base\n");
    runGit(repositoryRoot, ["add", "conflicted.txt"]);
    runGit(repositoryRoot, ["commit", "--quiet", "--message", "base"]);
    const primaryBranch = runGit(
      repositoryRoot,
      ["branch", "--show-current"]
    ).trim();
    runGit(repositoryRoot, ["checkout", "--quiet", "-b", "conflict-side"]);
    await writeFile(repositoryRoot, "conflicted.txt", "side\n");
    runGit(repositoryRoot, [
      "commit",
      "--quiet",
      "--all",
      "--message",
      "side"
    ]);
    runGit(repositoryRoot, ["checkout", "--quiet", primaryBranch]);
    await writeFile(repositoryRoot, "conflicted.txt", "primary\n");
    runGit(repositoryRoot, [
      "commit",
      "--quiet",
      "--all",
      "--message",
      "primary"
    ]);
    assert.throws(() => runGit(repositoryRoot, [
      "merge",
      "--quiet",
      "conflict-side"
    ]));

    const repository = await openVersionControl(repositoryRoot);
    await assert.rejects(
      repository.readPendingFiles(),
      (error: unknown) => error instanceof VersionControlError
        && error.code === "operation-failed"
        && error.message.includes("resolve pending content conflicts")
    );
  });
});

test("reports corrupt revision objects as operation failures", gitTestOptions, async () => {
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

    await assert.rejects(
      (await openVersionControl(repositoryRoot)).readRevisionFile(
        "HEAD",
        "docs/unreadable.md"
      ),
      (error: unknown) => error instanceof VersionControlError
        && error.code === "operation-failed"
        && error.message.includes("read docs/unreadable.md from revision")
    );
  });
});

test("rejects directories that are not Git repositories", gitTestOptions, async () => {
  await withTempRoot(async (tempRoot) => {
    const plainDirectory = path.join(tempRoot, "plain");
    await fs.mkdir(plainDirectory, { recursive: true });
    await assert.rejects(
      openVersionControl(plainDirectory),
      (error: unknown) => hasVersionControlCode(error, "not-repository")
    );
  });
});

test("reports Git worktree discovery failures as operation failures", gitTestOptions, async () => {
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
      (error: unknown) => (
        hasVersionControlCode(error, "operation-failed")
        && error instanceof Error
        && /invalid gitfile format/iu.test(error.message)
      )
    );
  });
});

function initializeRepository(repositoryRoot: string): void {
  runGit(repositoryRoot, ["init", "--quiet"]);
  runGit(repositoryRoot, ["config", "core.autocrlf", "false"]);
  runGit(repositoryRoot, [
    "config",
    "user.email",
    "version-control@example.invalid"
  ]);
  runGit(repositoryRoot, [
    "config",
    "user.name",
    "Version Control Test"
  ]);
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
  return runGit(workingDirectory, [
    "ls-files",
    "--stage",
    "--",
    ...paths
  ]).trim().split("\n").filter((line) => line.length > 0).map((line) => {
    const match = /^(?<mode>[0-7]{6}) [a-f0-9]+ 0\t(?<path>.+)$/u.exec(line);
    assert.ok(match?.groups !== undefined, `unexpected pending entry: ${line}`);
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
  return error instanceof VersionControlError
    && error.code === "pending-conflict"
    && error.message.includes("retry from the current revision")
    && !/git|index|object|mode|lock/iu.test(error.message);
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
