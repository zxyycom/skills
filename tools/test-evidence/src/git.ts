import path from "node:path";
import { openVersionControl } from "../../shared/src/version-control/index.ts";

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
    const repository = await openVersionControl(workspaceRoot);
    if (!pathsEqual(repository.rootDirectory, workspaceRoot)) {
      errors.push(
        "workspace root must be the Git worktree root: expected "
        + `${repository.rootDirectory}, `
        + `received ${workspaceRoot}`
      );
      return { errors, workspace: null };
    }

    const headCommit = await repository.getCurrentRevision();
    if (headCommit === null) {
      errors.push(`${workspaceRoot} Git metadata could not be resolved`);
      return { errors, workspace: null };
    }
    const [files, dirtyPaths] = await Promise.all([
      repository.listWorkspaceFiles(),
      repository.listWorkspaceChangedPaths()
    ]);

    return {
      errors,
      workspace: {
        changedPathsSince: async (commit) => await repository.listChangedPaths({
          from: commit,
          to: headCommit
        }),
        dirtyPaths,
        files,
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

function pathsEqual(left: string, right: string): boolean {
  const normalizedLeft = path.resolve(left);
  const normalizedRight = path.resolve(right);
  return process.platform === "win32"
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}
