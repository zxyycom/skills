import { err, errAsync, ok, ResultAsync } from "neverthrow";
import {
  createStateIndexRuntime,
  type StateIndexEntryStageResult
} from "../../index-runtime/src/index.ts";
import { investigationIndexFileName } from "./investigation-state-index.ts";
import {
  investigationStageDiagnosticCodes,
  prepareInvestigationStage,
  type InvestigationStageFailure
} from "./staging-options.ts";
import { resolveInvestigationStageSelectors } from "./staging-selectors.ts";
import { stageInvestigationDomain } from "./staging-domain.ts";
import { createInvestigationStageIndexDefinition } from "./staging-domain-index.ts";
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
      stageValidatedInvestigationSelection({
        ...prepared.value,
        investigationsDirectory: canonical.investigationsDirectory
      })
    );
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
    definition: createInvestigationStageIndexDefinition(),
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
