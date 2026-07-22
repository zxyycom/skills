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
    const metadata = (await runGit(
      workspaceRoot,
      ["rev-parse", "--is-inside-work-tree", "--show-toplevel", "HEAD"]
    )).trim().split(/\r?\n/u);
    const [inside, gitRoot, headCommit] = metadata;
    if (inside !== "true") {
      errors.push(`${workspaceRoot} is not inside a Git worktree`);
      return { errors, workspace: null };
    }
    if (gitRoot === undefined || headCommit === undefined || metadata.length !== 3) {
      errors.push(`${workspaceRoot} Git metadata could not be resolved`);
      return { errors, workspace: null };
    }
    if (!pathsEqual(gitRoot, workspaceRoot)) {
      errors.push(
        `workspace root must be the Git worktree root: expected ${gitRoot}, `
        + `received ${workspaceRoot}`
      );
      return { errors, workspace: null };
    }

    const [files, status] = await Promise.all([
      runGit(workspaceRoot, [
        "ls-files",
        "--cached",
        "--others",
        "--exclude-standard",
        "-z"
      ]),
      runGit(workspaceRoot, [
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
        "--no-renames",
        "-z"
      ])
    ]);

    return {
      errors,
      workspace: {
        changedPathsSince: async (commit) => await loadChangedPathsSince(
          workspaceRoot,
          commit
        ),
        dirtyPaths: uniquePaths(parsePorcelainStatusPaths(status)),
        files: uniquePaths(parseNullSeparatedPaths(files)),
        headCommit
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
  return parseNullSeparatedPaths(await runGit(
    workspaceRoot,
    ["diff", "--name-only", "--no-renames", "-z", `${commit}^{commit}`, "HEAD"]
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

function parsePorcelainStatusPaths(value: string): string[] {
  return value
    .split("\0")
    .flatMap((entry) => {
      if (entry.length === 0) {
        return [];
      }
      if (entry.length < 4 || entry[2] !== " ") {
        throw new Error(`Unexpected git status output: ${entry}`);
      }

      const normalized = normalizeWorkspaceRelative(entry.slice(3));
      return normalized === null ? [] : [normalized];
    });
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
