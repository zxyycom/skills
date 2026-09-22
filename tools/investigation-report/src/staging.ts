import path from "node:path";
import { err, errAsync, ok, ResultAsync } from "neverthrow";
import {
  createStateIndexRuntime,
  type StateIndexDiagnostic,
  type StateIndexEntryStageResult
} from "../../index-runtime/src/index.ts";
import {
  createInvestigationStateIndexDefinition,
  investigationIndexFileName,
  loadInvestigationIndex
} from "./investigation-state-index.ts";
import { investigationIndexStale } from "./index-staleness.ts";
import {
  investigationStageDiagnosticCodes,
  prepareInvestigationIndexStage,
  type InvestigationIndexStageFailure
} from "./staging-options.ts";
import { resolveInvestigationStageSelectors } from "./staging-selectors.ts";
import { canonicalizeInvestigationsDirectory } from "./report-path.ts";
import type {
  InvestigationIndexStageOptions,
  InvestigationIndexStageResult
} from "./types.ts";

export type { InvestigationIndexStageFailure } from "./staging-options.ts";

type InvestigationIndexStageSuccess = Extract<
  InvestigationIndexStageResult,
  { status: "ok" }
>;

export async function stageInvestigationIndex(
  options: InvestigationIndexStageOptions
): Promise<InvestigationIndexStageResult> {
  const executed = await executeInvestigationIndexStage(options);
  return executed.match(
    (result) => result,
    (failure) => failure.result
  );
}

export function executeInvestigationIndexStage(
  input: unknown
): ResultAsync<InvestigationIndexStageSuccess, InvestigationIndexStageFailure> {
  const prepared = prepareInvestigationIndexStage(input);
  if (prepared.isErr()) return errAsync(prepared.error);
  return canonicalizeInvestigationsDirectory(prepared.value.resolved)
    .mapErr((errors) => stageLocationFailure(prepared.value.indexPath, errors))
    .andThen((canonical) =>
      ResultAsync.fromSafePromise(
        stageFreshnessFailure(
          canonical.investigationsDirectory,
          prepared.value.indexPath
        )
      ).andThen((gate) =>
        gate !== null
          ? errAsync(gate)
          : stageValidatedInvestigationIndex(
              canonical.investigationsDirectory,
              prepared.value.reportIds
            )
      )
    );
}

/**
 * Staging combines workspace index entries into a pending snapshot, so the
 * workspace index must match the authoritative Markdown. A missing index
 * keeps the staging transaction's own diagnosis; an invalid or stale
 * projection stops staging with the check/sync-index recovery instead of
 * staging entries drifted from the current sources.
 */
async function stageFreshnessFailure(
  investigationsDirectory: string,
  indexPath: string
): Promise<InvestigationIndexStageFailure | null> {
  const persisted = await loadInvestigationIndex({ investigationsDirectory });
  if (persisted.status === "error") {
    if (
      persisted.diagnostics.some(
        (diagnostic) => diagnostic.code === "state-index.index-missing"
      )
    )
      return null;
    return invalidIndexStageFailure(indexPath, persisted.diagnostics);
  }
  const stale = await investigationIndexStale(
    investigationsDirectory,
    persisted.value
  );
  return stale ? staleStageFailure(indexPath) : null;
}

function invalidIndexStageFailure(
  indexPath: string,
  diagnostics: readonly StateIndexDiagnostic[]
): InvestigationIndexStageFailure {
  return {
    kind: "operation",
    result: {
      changed: false,
      diagnostics: [...diagnostics],
      indexPath,
      namespace: "investigation-report",
      selectedIds: [],
      state: "workspace-index-invalid",
      status: "error"
    }
  };
}

function staleStageFailure(indexPath: string): InvestigationIndexStageFailure {
  return {
    kind: "operation",
    result: {
      changed: false,
      diagnostics: [staleStageDiagnostic(indexPath)],
      indexPath,
      namespace: "investigation-report",
      selectedIds: [],
      state: "index-stale",
      status: "error"
    }
  };
}

function staleStageDiagnostic(indexPath: string): StateIndexDiagnostic {
  return {
    code: "state-index.index-stale",
    message:
      "the workspace derived index is stale relative to the current formal report sources; " +
      "run check to diagnose the collection, run sync-index to publish the current index, " +
      "then retry stage-index",
    path: indexPath,
    stateId: null
  };
}

function stageLocationFailure(
  indexPath: string,
  errors: readonly string[]
): InvestigationIndexStageFailure {
  const diagnostics = errors.map((message) => ({
    code: investigationStageDiagnosticCodes.locationInvalid,
    message,
    path: indexPath,
    stateId: null
  }));
  return {
    kind: "operation",
    result: {
      changed: false,
      diagnostics,
      indexPath,
      namespace: "investigation-report",
      selectedIds: [],
      state: "index-path-invalid",
      status: "error"
    }
  };
}

function stageValidatedInvestigationIndex(
  investigationsDirectory: string,
  reportIds: readonly string[]
): ResultAsync<InvestigationIndexStageSuccess, InvestigationIndexStageFailure> {
  const indexPath = path.join(
    investigationsDirectory,
    investigationIndexFileName
  );
  const runtime = createStateIndexRuntime({
    definition: createInvestigationStateIndexDefinition(),
    indexPath: investigationIndexFileName,
    resolveSelectedIds: resolveInvestigationStageSelectors,
    root: investigationsDirectory
  });
  return ResultAsync.fromSafePromise(
    runtime.stageSelectedEntries(reportIds)
  ).andThen((result) => {
    const mapped = withDisplayIndexPath(result, indexPath);
    return mapped.status === "error"
      ? err({ kind: "operation" as const, result: mapped })
      : ok(mapped);
  });
}

function withDisplayIndexPath(
  result: StateIndexEntryStageResult,
  indexPath: string
): InvestigationIndexStageResult {
  return {
    ...result,
    diagnostics: result.diagnostics.map((diagnostic) => ({
      ...diagnostic,
      path:
        diagnostic.path === investigationIndexFileName
          ? indexPath
          : diagnostic.path
    })),
    indexPath
  };
}
