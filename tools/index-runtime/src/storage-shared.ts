import { filesystemFailure, failure } from "./diagnostics.ts";
import { validateStateSourceRevisionValue } from "./validation.ts";
import type {
  JsonObject,
  StateIndexContext,
  StateIndexDefinition,
  StateIndexResult,
  StateIndexSyncMode,
  StateIndexSyncResult,
  StateSourceRevision
} from "./types.ts";

export function normalizeIndexLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

export async function readSourceRevision<
  State extends object,
  Metadata extends JsonObject
>(
  definition: StateIndexDefinition<State, Metadata>,
  context: StateIndexContext,
  indexPath: string
): Promise<StateIndexResult<StateSourceRevision>> {
  if (context.signal?.aborted === true) {
    return failure(
      "state-index.operation-aborted",
      "revision read was aborted",
      { path: indexPath }
    );
  }
  let revision: unknown;
  try {
    revision = await definition.readRevision(context);
  } catch (error) {
    return filesystemFailure(
      "state-index.revision-read-failed",
      "failed to read the current state-index source revision; inspect source availability and access, then retry",
      {
        error,
        operation: "read a state-index source revision",
        path: indexPath,
        target: "state-index source"
      }
    );
  }
  const validated = validateStateSourceRevisionValue(revision, indexPath);
  if (validated.status === "error") {
    return {
      diagnostics: validated.diagnostics.map((entry) => ({
        ...entry,
        code: "state-index.revision-invalid",
        message: `readRevision returned an invalid source revision: ${entry.message}`
      })),
      status: "error",
      value: null
    };
  }
  return validated;
}

export function isStateIndexSyncMode(
  value: unknown
): value is StateIndexSyncMode {
  return value === "check" || value === "write";
}

export function failedSync<State extends object, Metadata extends JsonObject>(
  options: {
    definition: StateIndexDefinition<State, Metadata>;
    indexPath: string;
    mode: StateIndexSyncMode;
  },
  state:
    | "index-invalid"
    | "index-missing"
    | "index-path-invalid"
    | "index-read-failed"
    | "index-stale"
    | "index-write-failed"
    | "selected-baseline-invalid"
    | "selected-id-missing"
    | "selection-invalid"
    | "collection-changed"
    | "scoped-stale"
    | "unselected-changes"
    | "source-invalid",
  diagnostics: StateIndexSyncResult["diagnostics"],
  scope: "all" | "selected",
  selectedIds: readonly string[],
  changedIds: readonly string[] = []
): StateIndexSyncResult {
  return {
    changed: false,
    changedIds: [...changedIds],
    diagnostics,
    indexPath: options.indexPath,
    mode: options.mode,
    namespace: options.definition.namespace,
    scope,
    selectedIds: [...selectedIds],
    state,
    status: "error"
  };
}
