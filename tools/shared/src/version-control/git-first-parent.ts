import { execFile } from "node:child_process";
import { classifyVersionControlCause, VersionControlError } from "./errors.ts";
import { parseGitFirstParentRevisionChanges } from "./git-numstat.ts";
import { parseObjectId } from "./git-core.ts";
import type {
  RevisionId,
  VersionControlRepository,
  VersionControlRevisionChange
} from "./types.ts";

const gitOutputMaxBuffer = 16 * 1024 * 1024;

type GitCommandExit = Readonly<{
  exitCode: number;
  stderr: string;
  stdout: string;
}>;

/** Endpoints must already be commit IDs resolved by this repository. */
export async function listResolvedFirstParentRevisionChanges(
  repository: VersionControlRepository,
  options: Readonly<{ from: RevisionId; to: RevisionId }>
): Promise<readonly VersionControlRevisionChange[] | null> {
  const from = parseObjectId(options.from, "first-parent start revision");
  const to = parseObjectId(options.to, "first-parent end revision");
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
