/*
 * Synced TypeScript runtime; repository maintenance edits tools/record-operations/src/history-index.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/record-operations/src/history-index.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/record-operations/src/history-index.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import type {
  StateIndexDiagnostic,
  StateIndexResult
} from "../../index-runtime/src/index.ts";
import {
  VersionControlError,
  type VersionControlRepository
} from "../../shared/src/version-control/index.ts";

export type RecordDiagnosticSource = Readonly<{
  kind: "git-revision";
  path: string;
  revision: string;
}>;
export type RecordDiagnosticCause = Readonly<{
  code: string;
  detail: string;
  path?: string | null;
  stateId?: string;
  filesystem?: StateIndexDiagnostic["filesystem"];
  versionControl?: StateIndexDiagnostic["versionControl"];
}>;

export type HistoricalIndexResult<T> =
  | Readonly<{ status: "missing"; source: RecordDiagnosticSource }>
  | Readonly<{
      status: "invalid";
      source: RecordDiagnosticSource;
      causes: readonly RecordDiagnosticCause[];
    }>
  | Readonly<{ status: "ok"; source: RecordDiagnosticSource; value: T }>;

/** Read one immutable revision; absence is a fact, not a first-collection decision. */
export async function readHistoricalIndex<T>(
  options: Readonly<{
    repository: Pick<VersionControlRepository, "readRevisionFile">;
    revision: string;
    path: string;
    parse: (text: string, path: string) => StateIndexResult<T>;
  }>
): Promise<HistoricalIndexResult<T>> {
  const source: RecordDiagnosticSource = {
    kind: "git-revision",
    path: options.path,
    revision: options.revision
  };
  let file: Awaited<ReturnType<VersionControlRepository["readRevisionFile"]>>;
  try {
    file = await options.repository.readRevisionFile(
      options.revision,
      options.path
    );
  } catch (error) {
    return {
      status: "invalid",
      source,
      causes: [historicalIndexErrorCause(error, options.path)]
    };
  }
  if (file === null) return { status: "missing", source };
  if (file.kind !== "regular" && file.kind !== "executable")
    return {
      status: "invalid",
      source,
      causes: [
        {
          code: "record-operations.history-index-type-invalid",
          detail: "historical index must be an ordinary file",
          path: options.path
        }
      ]
    };
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(file.data);
  } catch {
    return {
      status: "invalid",
      source,
      causes: [
        {
          code: "record-operations.history-index-utf8-invalid",
          detail: "historical index is not valid UTF-8",
          path: options.path
        }
      ]
    };
  }
  const parsed = options.parse(text, options.path);
  if (parsed.status === "error")
    return {
      status: "invalid",
      source,
      causes: parsed.diagnostics.map(
        ({ code, message, path, stateId, filesystem, versionControl }) => ({
          code,
          detail: message,
          path,
          ...(stateId === null ? {} : { stateId }),
          ...(filesystem === undefined ? {} : { filesystem }),
          ...(versionControl === undefined ? {} : { versionControl })
        })
      )
    };
  return { status: "ok", source, value: parsed.value };
}

/** Preserve the fixed index locator and system facts for a failed history operation. */
export function historicalIndexErrorCause(
  error: unknown,
  path: string
): RecordDiagnosticCause {
  const boundary =
    error instanceof VersionControlError
      ? {
          causeCategory: error.causeCategory,
          detail: error.detail,
          operation: error.operation,
          target: error.target
        }
      : undefined;
  return {
    code:
      error instanceof VersionControlError
        ? error.code
        : "record-operations.history-index-read-failed",
    detail: error instanceof Error ? error.message : String(error),
    path,
    ...(boundary === undefined ? {} : { versionControl: boundary })
  };
}
