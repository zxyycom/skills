import { errAsync, ok, ResultAsync } from "neverthrow";
import {
  investigationStageDiagnosticCodes,
  prepareInvestigationStage,
  type InvestigationStageFailure
} from "./staging-options.ts";
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
