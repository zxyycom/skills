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
  prepareInvestigationStage,
  type InvestigationStageFailure
} from "./staging-options.ts";
import { resolveInvestigationStageSelectors } from "./staging-selectors.ts";
import { stageInvestigationDomain } from "./staging-domain.ts";
import { canonicalizeInvestigationsDirectory } from "./report-path.ts";
import type {
  InvestigationStageOptions,
  InvestigationStageResult,
  InvestigationStageScope,
  InvestigationStageSuccess
} from "./types.ts";

export type { InvestigationStageFailure } from "./staging-options.ts";

export async function stageInvestigationReports(
  options: InvestigationStageOptions
): Promise<InvestigationStageResult> {
  const executed = await executeInvestigationStage(options);
  return executed.match(
    (result) => result,
    (failure) => failure.result
  );
}

export function executeInvestigationStage(
  input: unknown
): ResultAsync<InvestigationStageSuccess, InvestigationStageFailure> {
  const prepared = prepareInvestigationStage(input);
  if (prepared.isErr()) return errAsync(prepared.error);
  return canonicalizeInvestigationsDirectory(prepared.value.resolved)
    .mapErr((errors) => stageLocationFailure(prepared.value, errors))
    .andThen((canonical) =>
      ResultAsync.fromSafePromise(
        stageFreshnessFailure(
          canonical.investigationsDirectory,
          prepared.value.indexPath
        )
      ).andThen((gate) =>
        gate !== null
          ? errAsync(gate)
          : stageValidatedInvestigationSelection({
              ...prepared.value,
              investigationsDirectory: canonical.investigationsDirectory
            })
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
): Promise<InvestigationStageFailure | null> {
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
): InvestigationStageFailure {
  return {
    kind: "operation",
    result: {
      changed: false,
      diagnostics: [...diagnostics],
      indexPath,
      namespace: "investigation-report",
      scope: "all",
      selectedIds: [],
      state: "workspace-index-invalid",
      status: "error"
    }
  };
}

function staleStageFailure(indexPath: string): InvestigationStageFailure {
  return {
    kind: "operation",
    result: {
      changed: false,
      diagnostics: [staleStageDiagnostic(indexPath)],
      indexPath,
      namespace: "investigation-report",
      scope: "all",
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
      "then retry stage",
    path: indexPath,
    stateId: null
  };
}

function stageLocationFailure(
  prepared: { indexPath: string; scope: InvestigationStageScope },
  errors: readonly string[]
): InvestigationStageFailure {
  const diagnostics = errors.map((message) => ({
    code: investigationStageDiagnosticCodes.locationInvalid,
    message,
    path: prepared.indexPath,
    stateId: null
  }));
  return {
    kind: "operation",
    result: {
      changed: false,
      diagnostics,
      indexPath: prepared.indexPath,
      namespace: "investigation-report",
      scope: prepared.scope,
      selectedIds: [],
      state: "index-path-invalid",
      status: "error"
    }
  };
}

function stageValidatedInvestigationSelection(prepared: {
  indexPath: string;
  investigationsDirectory: string;
  reportIds: readonly string[];
  scope: InvestigationStageScope;
}): ResultAsync<InvestigationStageSuccess, InvestigationStageFailure> {
  if (prepared.scope !== "index") {
    return ResultAsync.fromSafePromise(
      stageInvestigationDomain({
        investigationsDirectory: prepared.investigationsDirectory,
        reportIds: prepared.reportIds,
        scope: prepared.scope
      })
    ).andThen((result) =>
      result.status === "ok"
        ? ok(result)
        : errAsync({ kind: "operation" as const, result })
    );
  }
  const runtime = createStateIndexRuntime({
    definition: createInvestigationStateIndexDefinition(),
    indexPath: investigationIndexFileName,
    resolveSelectedIds: resolveInvestigationStageSelectors,
    root: prepared.investigationsDirectory
  });
  return ResultAsync.fromSafePromise(
    runtime.stageSelectedEntries(prepared.reportIds)
  ).andThen((result) => {
    const mapped = withDisplayIndexPath(result, prepared.indexPath);
    return mapped.status === "error"
      ? err({ kind: "operation" as const, result: mapped })
      : ok(mapped);
  });
}

function withDisplayIndexPath(
  result: StateIndexEntryStageResult,
  indexPath: string
): InvestigationStageResult {
  const scope = "index" as const;
  if (result.status === "error") {
    return {
      ...result,
      diagnostics: result.diagnostics.map((diagnostic) => ({
        ...diagnostic,
        path:
          diagnostic.path === investigationIndexFileName
            ? indexPath
            : diagnostic.path
      })),
      indexPath,
      scope
    };
  }
  return {
    callerOwnedPaths: [],
    changed: result.changed,
    diagnostics: result.diagnostics.map((diagnostic) => ({
      ...diagnostic,
      path:
        diagnostic.path === investigationIndexFileName
          ? indexPath
          : diagnostic.path
    })),
    indexPath,
    namespace: result.namespace,
    preservedPendingPaths: [],
    scope,
    selectedIds: result.selectedIds,
    state: result.state,
    status: "ok",
    writtenPaths: result.changed ? [indexPath] : []
  };
}
