import { execFile } from "node:child_process";
import { classifyVersionControlCause, VersionControlError } from "./errors.ts";
import { parseGitFirstParentRevisionChanges } from "./git-numstat.ts";
import type {
  ListFirstParentRevisionChangesOptions,
  VersionControlRepository,
  VersionControlRevisionChange
} from "./types.ts";

const gitOutputMaxBuffer = 16 * 1024 * 1024;

type GitCommandExit = {
  exitCode: number;
  stderr: string;
  stdout: string;
};

export async function listFirstParentRevisionChanges(
  repository: VersionControlRepository,
  options: ListFirstParentRevisionChangesOptions
): Promise<VersionControlRevisionChange[] | null> {
  const from = await repository.resolveRevision(options.from);
  const to =
    options.to === undefined
      ? await repository.getCurrentRevision()
      : await repository.resolveRevision(options.to);
  if (to === null) {
    throw new VersionControlError({
      causeCategory: "revision-unavailable",
      code: "revision-not-found",
      operation: "read the current revision",
      target: "current revision"
    });
  }
  if (from === to) {
    return [];
  }

  let result: GitCommandExit;
  try {
    result = await runFirstParentGitLog(repository.rootDirectory, from, to);
  } catch (error) {
    throw firstParentOperationError(error);
  }
  if (result.exitCode !== 0) {
    throw firstParentOperationError(result.stderr);
  }
  return parseGitFirstParentRevisionChanges(result.stdout, from, to);
}

function runFirstParentGitLog(
  rootDirectory: string,
  from: string,
  to: string
): Promise<GitCommandExit> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      [
        "-C",
        rootDirectory,
        "log",
        "--first-parent",
        "--diff-merges=first-parent",
        "--reverse",
        "--format=%x00%H%x09%P%x00",
        "--numstat",
        "-z",
        "--no-renames",
        `${from}..${to}`,
        "--"
      ],
      {
        encoding: "utf8",
        maxBuffer: gitOutputMaxBuffer,
        windowsHide: true
      },
      (error, stdout, stderr) => {
        if (error === null) {
          resolve({ exitCode: 0, stderr, stdout });
          return;
        }

        const exitCode = "code" in error ? error.code : undefined;
        if (typeof exitCode === "number") {
          resolve({ exitCode, stderr, stdout });
          return;
        }
        reject(error);
      }
    );
  });
}

function firstParentOperationError(detail?: unknown): VersionControlError {
  return new VersionControlError({
    cause: detail,
    causeCategory: classifyVersionControlCause(detail, "command-failed"),
    code: "operation-failed",
    detail,
    operation: "list first-parent revision changes",
    target: "requested revision range"
  });
}
