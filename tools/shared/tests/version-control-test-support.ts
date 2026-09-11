import assert from "node:assert/strict";
export { assert };
import { execFileSync } from "node:child_process";
export { execFileSync };
import fs from "node:fs/promises";
export { fs };
import os from "node:os";
import path from "node:path";
export { path };
import test, { after } from "node:test";
export { test };
import { fileURLToPath } from "node:url";
import {
  classifyVersionControlCause,
  openVersionControl,
  repositoryRelativePathFromFileSystemPath,
  VersionControlError
} from "../src/version-control/index.ts";
export {
  classifyVersionControlCause,
  openVersionControl,
  repositoryRelativePathFromFileSystemPath,
  VersionControlError
};
import { operationErrorDetail } from "../src/version-control/error-detail.ts";
export { operationErrorDetail };
import { listFirstParentRevisionChanges } from "../src/version-control/git-first-parent.ts";
export { listFirstParentRevisionChanges };
import { openGitVersionControl } from "../src/version-control/git.ts";
export { openGitVersionControl };
import { parseGitFirstParentRevisionChanges } from "../src/version-control/git-numstat.ts";
export { parseGitFirstParentRevisionChanges };
import { createGitRepositoryFixture } from "./git-fixture.ts";
export { createGitRepositoryFixture };
export const gitTestOptions = { timeout: 15_000 };
export const gitCommitEnvironment = {
  ...process.env,
  GIT_AUTHOR_EMAIL: "version-control@example.invalid",
  GIT_AUTHOR_NAME: "Version Control Test",
  GIT_COMMITTER_EMAIL: "version-control@example.invalid",
  GIT_COMMITTER_NAME: "Version Control Test"
};
export const versionControlRepositoryFixtureRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "git-repositories",
  "version-control-repository"
);

let repositoryTemplate: Promise<string> | null = null;
let repositoryTemplateParent: string | null = null;

after(async () => {
  if (repositoryTemplateParent !== null) {
    await fs.rm(repositoryTemplateParent, { force: true, recursive: true });
    repositoryTemplateParent = null;
  }
});

export async function withTempRoot(
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

export async function createRepositoryFixture(tempRoot: string) {
  const repositoryRoot = path.join(tempRoot, "repository");
  await fs.cp(await repositoryTemplateRoot(), repositoryRoot, {
    recursive: true
  });
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

async function repositoryTemplateRoot(): Promise<string> {
  repositoryTemplate ??= createRepositoryTemplate();
  try {
    return await repositoryTemplate;
  } catch (error) {
    repositoryTemplate = null;
    throw error;
  }
}

async function createRepositoryTemplate(): Promise<string> {
  const parent = await fs.mkdtemp(
    path.join(os.tmpdir(), "version-control-repository-template-")
  );
  repositoryTemplateParent = parent;
  try {
    const fixture = await createGitRepositoryFixture({
      fixtureRoot: versionControlRepositoryFixtureRoot,
      parentDirectory: parent,
      repositoryName: "repository",
      userEmail: "version-control@example.invalid",
      userName: "Version Control Test"
    });
    return fixture.repositoryRoot;
  } catch (error) {
    await fs.rm(parent, { force: true, recursive: true });
    repositoryTemplateParent = null;
    throw error;
  }
}
export async function createPendingConflictRepository(
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

export function initializeRepository(repositoryRoot: string): void {
  runGit(repositoryRoot, ["init", "--quiet"]);
  runGit(repositoryRoot, ["config", "core.autocrlf", "false"]);
}

export function runGit(
  workingDirectory: string,
  args: readonly string[]
): string {
  return execFileSync("git", ["-C", workingDirectory, ...args], {
    encoding: "utf8",
    env: gitCommitEnvironment,
    windowsHide: true
  });
}

export function writeGitBlob(
  workingDirectory: string,
  content: string
): string {
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

export function readPendingModes(
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

export async function writeFile(
  rootDirectory: string,
  relativePath: string,
  content: string
): Promise<void> {
  const targetPath = path.join(rootDirectory, relativePath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content, "utf8");
}

export function hasVersionControlCode(
  error: unknown,
  code: VersionControlError["code"]
): boolean {
  return error instanceof VersionControlError && error.code === code;
}

export function isPendingConflict(error: unknown): boolean {
  return (
    error instanceof VersionControlError &&
    error.code === "pending-conflict" &&
    error.operation === "verify a pending replacement"
  );
}

export async function rejectedVersionControlError(
  promise: Promise<unknown>
): Promise<VersionControlError> {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof VersionControlError);
    return error;
  }
  assert.fail("expected a version-control error");
}

export async function readPendingText(
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
