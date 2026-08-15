import { execFile } from "node:child_process";
import { VersionControlError } from "./errors.ts";
import { parseGitFirstParentRevisionChanges } from "./git-numstat.ts";
import type {
  ListFirstParentRevisionChangesOptions,
  VersionControlRepository,
  VersionControlRevisionChange
} from "./types.ts";

const gitOutputMaxBuffer = 16 * 1024 * 1024;
const operationErrorDetailMaxLength = 500;

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
    throw new VersionControlError(
      "revision-not-found",
      "The current version-control revision does not exist"
    );
  }
  if (from === to) {
    return [];
  }

  let result: GitCommandExit;
  try {
    result = await runFirstParentGitLog(repository.rootDirectory, from, to);
  } catch (error) {
    throw firstParentOperationError(from, to, error);
  }
  if (result.exitCode !== 0) {
    throw firstParentOperationError(from, to, result.stderr);
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

function firstParentOperationError(
  from: string,
  to: string,
  detail?: unknown
): VersionControlError {
  const detailText = operationErrorDetail(detail);
  return new VersionControlError(
    "operation-failed",
    `Version-control operation failed: list first-parent revision changes from ${from} to ${to}` +
      (detailText === null ? "" : ": " + detailText)
  );
}

function operationErrorDetail(detail: unknown): string | null {
  if (detail === undefined || detail === null) {
    return null;
  }
  const text = (detail instanceof Error ? detail.message : String(detail))
    .trim()
    .replace(/\s+/gu, " ");
  if (text.length === 0) {
    return null;
  }
  return text.length <= operationErrorDetailMaxLength
    ? text
    : text.slice(0, operationErrorDetailMaxLength - 1) + "…";
}
