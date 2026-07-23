import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  openVersionControl,
  VersionControlError
} from "../src/version-control/index.ts";

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "version-control-test-"));
const brokenHeadRoot = path.join(tempRoot, "broken-head");
const conflictRoot = path.join(tempRoot, "conflict");
const repositoryRoot = path.join(tempRoot, "repository");
const linkedWorktreeRoot = path.join(tempRoot, "linked-worktree");

try {
  await fs.mkdir(repositoryRoot, { recursive: true });
  runGit(repositoryRoot, ["init", "--quiet"]);
  runGit(repositoryRoot, ["config", "core.autocrlf", "false"]);
  runGit(repositoryRoot, ["config", "user.email", "version-control@example.invalid"]);
  runGit(repositoryRoot, ["config", "user.name", "Version Control Test"]);

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
  await fs.mkdir(path.join(repositoryRoot, "nested"), { recursive: true });

  const repository = await openVersionControl(path.join(repositoryRoot, "nested"));
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
  assert.deepEqual(await repository.listChangedPaths({ from: baseRevision }), [
    "docs/current-only.md",
    "docs/tracked.md"
  ]);
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

  runGit(repositoryRoot, [
    "worktree",
    "add",
    "--detach",
    "--quiet",
    linkedWorktreeRoot,
    currentRevision
  ]);
  await fs.mkdir(path.join(linkedWorktreeRoot, "nested"), { recursive: true });
  const linked = await openVersionControl(path.join(linkedWorktreeRoot, "nested"));
  assert.equal(linked.rootDirectory, path.resolve(linkedWorktreeRoot));
  assert.equal(await linked.getCurrentRevision(), currentRevision);
  assert.deepEqual(
    await linked.listRevisionFiles(currentRevision, {
      pathScopes: ["docs/tracked.md"]
    }),
    ["docs/tracked.md"]
  );

  const unbornRoot = path.join(tempRoot, "unborn");
  await fs.mkdir(unbornRoot, { recursive: true });
  runGit(unbornRoot, ["init", "--quiet"]);
  assert.equal(await (await openVersionControl(unbornRoot)).getCurrentRevision(), null);

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

  await fs.mkdir(conflictRoot, { recursive: true });
  runGit(conflictRoot, ["init", "--quiet"]);
  runGit(conflictRoot, ["config", "user.email", "version-control@example.invalid"]);
  runGit(conflictRoot, ["config", "user.name", "Version Control Test"]);
  await writeFile(conflictRoot, "conflicted.txt", "base\n");
  runGit(conflictRoot, ["add", "conflicted.txt"]);
  runGit(conflictRoot, ["commit", "--quiet", "--message", "base"]);
  const primaryBranch = runGit(conflictRoot, ["branch", "--show-current"]).trim();
  runGit(conflictRoot, ["checkout", "--quiet", "-b", "conflict-side"]);
  await writeFile(conflictRoot, "conflicted.txt", "side\n");
  runGit(conflictRoot, ["commit", "--quiet", "--all", "--message", "side"]);
  runGit(conflictRoot, ["checkout", "--quiet", primaryBranch]);
  await writeFile(conflictRoot, "conflicted.txt", "primary\n");
  runGit(conflictRoot, ["commit", "--quiet", "--all", "--message", "primary"]);
  assert.throws(() => runGit(conflictRoot, ["merge", "--quiet", "conflict-side"]));
  const conflictedRepository = await openVersionControl(conflictRoot);
  await assert.rejects(
    conflictedRepository.readPendingFiles(),
    (error: unknown) => error instanceof VersionControlError
      && error.code === "operation-failed"
      && error.message.includes("resolve pending content conflicts")
  );

  const plainDirectory = path.join(tempRoot, "plain");
  await fs.mkdir(plainDirectory, { recursive: true });
  await assert.rejects(
    openVersionControl(plainDirectory),
    (error: unknown) => hasVersionControlCode(error, "not-repository")
  );
} finally {
  await fs.rm(tempRoot, { force: true, recursive: true });
}

console.log("Version-control middle-layer tests passed.");

function runGit(workingDirectory: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", workingDirectory, ...args], {
    encoding: "utf8",
    windowsHide: true
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
