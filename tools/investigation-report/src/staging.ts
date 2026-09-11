import path from "node:path";
import { err, errAsync, ok, ResultAsync } from "neverthrow";
import {
  createStateIndexRuntime,
  type StateIndexEntryStageResult
} from "../../index-runtime/src/index.ts";
import {
  createInvestigationStateIndexDefinition,
  investigationIndexFileName
} from "./investigation-state-index.ts";
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
      stageValidatedInvestigationIndex(
        canonical.investigationsDirectory,
        prepared.value.reportIds
      )
    );
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
