import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { normalizeWorkspaceRelative } from "./workspace-path.ts";

const execFileAsync = promisify(execFile);

export type GitWorkspace = {
  changedPathsSince: (commit: string) => Promise<string[]>;
  dirtyPaths: string[];
  files: string[];
  headCommit: string;
};

export type GitWorkspaceResult = {
  errors: string[];
  workspace: GitWorkspace | null;
};

export async function loadGitWorkspace(
  workspaceRoot: string
): Promise<GitWorkspaceResult> {
  const errors: string[] = [];
  try {
    const inside = (await runGit(
      workspaceRoot,
      ["rev-parse", "--is-inside-work-tree"]
    )).trim();
    if (inside !== "true") {
      errors.push(`${workspaceRoot} is not inside a Git worktree`);
      return { errors, workspace: null };
    }
    const gitRoot = (await runGit(
      workspaceRoot,
      ["rev-parse", "--show-toplevel"]
    )).trim();
    if (!pathsEqual(gitRoot, workspaceRoot)) {
      errors.push(
        `workspace root must be the Git worktree root: expected ${gitRoot}, `
        + `received ${workspaceRoot}`
      );
      return { errors, workspace: null };
    }

    const [headCommit, files, unstaged, staged, untracked] = await Promise.all([
      runGit(workspaceRoot, ["rev-parse", "HEAD"]),
      runGit(workspaceRoot, [
        "ls-files",
        "--cached",
        "--others",
        "--exclude-standard",
        "-z"
      ]),
      runGit(workspaceRoot, ["diff", "--name-only", "--no-renames", "-z"]),
      runGit(workspaceRoot, [
        "diff",
        "--cached",
        "--name-only",
        "--no-renames",
        "-z"
      ]),
      runGit(workspaceRoot, ["ls-files", "--others", "--exclude-standard", "-z"])
    ]);

    return {
      errors,
      workspace: {
        changedPathsSince: async (commit) => await loadChangedPathsSince(
          workspaceRoot,
          commit
        ),
        dirtyPaths: uniquePaths([
          ...parseNullSeparatedPaths(unstaged),
          ...parseNullSeparatedPaths(staged),
          ...parseNullSeparatedPaths(untracked)
        ]),
        files: uniquePaths(parseNullSeparatedPaths(files)),
        headCommit: headCommit.trim()
      }
    };
  } catch (error) {
    errors.push(
      `Git workspace could not be inspected: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return { errors, workspace: null };
  }
}

async function loadChangedPathsSince(
  workspaceRoot: string,
  commit: string
): Promise<string[]> {
  await runGit(workspaceRoot, ["cat-file", "-e", `${commit}^{commit}`]);
  return parseNullSeparatedPaths(await runGit(
    workspaceRoot,
    ["diff", "--name-only", "--no-renames", "-z", commit, "HEAD"]
  ));
}

async function runGit(workspaceRoot: string, args: readonly string[]): Promise<string> {
  const result = await execFileAsync(
    "git",
    ["-C", workspaceRoot, ...args],
    {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true
    }
  );
  return result.stdout;
}

function parseNullSeparatedPaths(value: string): string[] {
  return value
    .split("\0")
    .flatMap((candidate) => {
      const normalized = normalizeWorkspaceRelative(candidate);
      return normalized === null ? [] : [normalized];
    });
}

function uniquePaths(paths: readonly string[]): string[] {
  return [...new Set(paths)].sort();
}

function pathsEqual(left: string, right: string): boolean {
  const normalizedLeft = path.resolve(left);
  const normalizedRight = path.resolve(right);
  return process.platform === "win32"
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}
