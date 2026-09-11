import fs from "node:fs/promises";
import path from "node:path";
import { isFileSystemError } from "../../shared/src/node/filesystem.ts";
import { operationErrorDetail } from "../../shared/src/version-control/error-detail.ts";
import { VersionControlError } from "../../shared/src/version-control/index.ts";
import {
  decisionDiagnostic,
  decisionFailure,
  decisionVersionControlFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";

const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

export function decisionRepositoryScope(
  repositoryRoot: string,
  decisionsDirectory: string
): string | null {
  const relativePath = path.relative(repositoryRoot, decisionsDirectory);
  if (
    relativePath.length === 0 ||
    path.isAbsolute(relativePath) ||
    relativePath === ".." ||
    relativePath.startsWith(".." + path.sep)
  ) {
    return null;
  }
  return relativePath.split(path.sep).join("/");
}

export function repositoryPath(scope: string, relativePath: string): string {
  return path.posix.join(scope, relativePath);
}

export function decisionRelativePath(
  scope: string,
  repositoryFilePath: string
): string {
  const prefix = scope + "/";
  if (!repositoryFilePath.startsWith(prefix)) {
    throw new Error(
      `version-controlled path is outside the decision scope: ${repositoryFilePath}`
    );
  }
  return repositoryFilePath.slice(prefix.length);
}

export function decodeUtf8(data: Uint8Array, displayPath: string): string {
  try {
    return utf8Decoder.decode(data);
  } catch (error) {
    throw new Error(`${displayPath} must contain valid UTF-8`, {
      cause: error
    });
  }
}

export function versionControlFailure(
  action: string,
  error: unknown
): DecisionApplicationFailure {
  return decisionVersionControlFailure(
    {
      action,
      outcome:
        error instanceof VersionControlError &&
        error.code === "pending-recovery-failed"
          ? "partial-or-unknown"
          : "no-change",
      scope: "Pending decision snapshot",
      target: "Pending decision snapshot"
    },
    error
  );
}

export class DecisionStageInputError extends Error {}

export class DecisionStageFileSystemError extends Error {
  constructor(cause: unknown) {
    super("Decision Stage filesystem operation failed", { cause });
    this.name = "DecisionStageFileSystemError";
  }
}

export async function readStageDirectory(directory: string) {
  try {
    return await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    throw new DecisionStageFileSystemError(error);
  }
}

export async function readStageFile(filePath: string): Promise<Buffer> {
  try {
    const entry = await fs.lstat(filePath);
    if (entry.isSymbolicLink() || !entry.isFile()) {
      throw new Error(
        "Decision source must be a regular non-symlink file: " +
          path.basename(filePath)
      );
    }
    return await fs.readFile(filePath);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Decision source")) {
      throw error;
    }
    throw new DecisionStageFileSystemError(error);
  }
}

export function stageFileSystemFailure(
  reason: string,
  error: unknown
): DecisionApplicationFailure {
  const detail = operationErrorDetail(error);
  const causeCategory =
    isFileSystemError(error, "EACCES") || isFileSystemError(error, "EPERM")
      ? "access-denied"
      : "unknown";
  return decisionFailure([
    decisionDiagnostic({
      causeCategory,
      code: "decision-records.stage-filesystem-unavailable",
      ...(detail === null ? {} : { detail }),
      reason,
      recovery:
        causeCategory === "access-denied"
          ? "Grant the current process filesystem access to the decision collection, then retry staging."
          : "Inspect the selected decision filesystem sources, then retry staging.",
      target: "Decision stage filesystem sources"
    })
  ]);
}

export function stageDomainFailure(
  code: string,
  reason: string,
  target: string,
  error: unknown
): DecisionApplicationFailure {
  const detail = operationErrorDetail(error);
  return decisionFailure([
    decisionDiagnostic({
      code,
      ...(detail === null ? {} : { detail }),
      reason,
      recovery:
        "Correct the selected Decision IDs or Decision source state, then retry staging.",
      target
    })
  ]);
}
