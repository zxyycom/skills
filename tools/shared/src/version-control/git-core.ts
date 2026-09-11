import {
  classifyVersionControlCause,
  VersionControlError,
  type VersionControlErrorCauseCategory
} from "./errors.ts";
import { normalizeRepositoryPath } from "./repository-path.ts";
import type { RevisionId } from "./types.ts";

const gitIndexModePattern = /^[0-7]{6}$/u;
const objectIdPattern = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;

export const gitBlobModes = new Set(["100644", "100755", "120000"]);
export const defaultGitBlobMode = "100644";

export type GitIndexEntry = Readonly<{
  mode: string;
  objectId: string;
  path: string;
  stage: 0 | 1 | 2 | 3;
}>;

export function assertRevisionInput(revision: string): void {
  if (
    revision.length === 0 ||
    revision.startsWith("-") ||
    revision.includes("\0") ||
    /[\r\n]/u.test(revision)
  ) {
    throw new VersionControlError({
      causeCategory: "revision-unavailable",
      code: "revision-not-found",
      detail: "the requested revision format is invalid",
      operation: "validate a revision",
      target: "requested revision"
    });
  }
}

export function parseObjectId(output: string, source: string): RevisionId {
  const objectId = output.trim();
  if (!objectIdPattern.test(objectId)) {
    throw operationError("parse a version-control object identifier", source);
  }
  return objectId;
}

export function parseGitIndexEntries(output: string): GitIndexEntry[] {
  const records = output.split("\0");
  if (records.at(-1) === "") records.pop();
  return records.map(parseGitIndexEntry).sort(comparePaths);
}

function parseGitIndexEntry(record: string): GitIndexEntry {
  const separatorIndex = record.indexOf("\t");
  const metadata =
    separatorIndex === -1 ? [] : record.slice(0, separatorIndex).split(/\s+/u);
  const [mode, objectId, stageText] = metadata;
  const stage = parseGitIndexStage(stageText);
  if (stage === null || !isIndexMetadata(metadata, mode, objectId)) {
    throw operationError("parse pending snapshot entries");
  }
  try {
    return {
      mode,
      objectId,
      path: normalizeRepositoryPath(record.slice(separatorIndex + 1)),
      stage
    };
  } catch (error) {
    throw operationError("parse pending snapshot entries", error);
  }
}

function isIndexMetadata(
  metadata: readonly string[],
  mode: string | undefined,
  objectId: string | undefined
): boolean {
  return [
    metadata.length === 3,
    gitIndexModePattern.test(mode ?? ""),
    objectIdPattern.test(objectId ?? "")
  ].every(Boolean);
}

function parseGitIndexStage(
  value: string | undefined
): GitIndexEntry["stage"] | null {
  switch (value) {
    case "0":
      return 0;
    case "1":
      return 1;
    case "2":
      return 2;
    case "3":
      return 3;
    default:
      return null;
  }
}

export function normalizePathScopes(pathScopes: readonly string[]): string[] {
  return [...new Set(pathScopes.map(normalizeRepositoryPath))].sort(
    compareText
  );
}

export function parseNullSeparatedPaths(output: string): string[] {
  const candidates = output.split("\0");
  if (candidates.at(-1) === "") candidates.pop();
  if (candidates.some((candidate) => candidate.length === 0)) {
    throw operationError("parse version-control paths");
  }
  return [...new Set(candidates.map(normalizeRepositoryPath))].sort(
    compareText
  );
}

export function operationError(
  operation: string,
  detail?: unknown,
  options: Readonly<{
    causeCategory?: VersionControlErrorCauseCategory;
    target?: string | null;
  }> = {}
): VersionControlError {
  return new VersionControlError({
    cause: errorCause(detail),
    causeCategory: classifyVersionControlCause(
      detail,
      options.causeCategory ?? "unknown"
    ),
    code: "operation-failed",
    detail: errorDetail(detail),
    operation,
    target: options.target ?? null
  });
}

function errorCause(detail: unknown): unknown {
  return detail instanceof VersionControlError
    ? (detail.cause ?? detail)
    : detail;
}

function errorDetail(detail: unknown): unknown {
  return detail instanceof VersionControlError ? detail.detail : detail;
}

function comparePaths(left: GitIndexEntry, right: GitIndexEntry): number {
  return compareText(left.path, right.path);
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right);
}
