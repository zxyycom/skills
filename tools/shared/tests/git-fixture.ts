import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const currentWorkspacePath = Buffer.from(process.cwd());

export type GitRepositoryFixture = Readonly<{
  baselineRevision: string;
  repositoryRoot: string;
}>;

export type GitRepositoryFixtureOptions = Readonly<{
  fixtureRoot: string;
  parentDirectory: string;
  prepareRepository?: (repositoryRoot: string) => Promise<void>;
  repositoryName: string;
  userEmail: string;
  userName: string;
}>;

/**
 * Materializes a checked-in ordinary file tree as a private Git repository.
 * Fixture sources intentionally cannot contain Git metadata or links because
 * every consumer needs a new repository with independently mutable state.
 */
export async function createGitRepositoryFixture(
  options: GitRepositoryFixtureOptions
): Promise<GitRepositoryFixture> {
  await assertOrdinaryFixtureTree(options.fixtureRoot);
  const repositoryRoot = path.join(
    options.parentDirectory,
    options.repositoryName
  );
  await fs.cp(options.fixtureRoot, repositoryRoot, { recursive: true });
  await options.prepareRepository?.(repositoryRoot);
  runGit(repositoryRoot, ["init", "--quiet", "--initial-branch=main"]);
  runGit(repositoryRoot, ["config", "core.autocrlf", "false"]);
  runGit(repositoryRoot, ["config", "user.email", options.userEmail]);
  runGit(repositoryRoot, ["config", "user.name", options.userName]);
  runGit(repositoryRoot, ["add", "."]);
  runGit(repositoryRoot, [
    "commit",
    "--quiet",
    "--no-verify",
    "--message",
    "fixture"
  ]);

  return {
    baselineRevision: runGit(repositoryRoot, ["rev-parse", "HEAD"]).trim(),
    repositoryRoot
  };
}

async function assertOrdinaryFixtureTree(root: string): Promise<void> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.name === ".git") {
      throw new Error(`Git fixture must not contain .git: ${entryPath}`);
    }
    if (entry.isSymbolicLink()) {
      throw new Error(
        `Git fixture must not contain symbolic links: ${entryPath}`
      );
    }
    if (entry.isDirectory()) {
      await assertOrdinaryFixtureTree(entryPath);
      continue;
    }
    if (entry.isFile()) {
      const contents = await fs.readFile(entryPath);
      if (contents.includes(currentWorkspacePath)) {
        throw new Error(
          `Git fixture must not depend on the current workspace path: ${entryPath}`
        );
      }
    }
  }
}

function runGit(workingDirectory: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", workingDirectory, ...args], {
    encoding: "utf8",
    windowsHide: true
  });
}
