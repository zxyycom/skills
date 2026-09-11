import path from "node:path";
import { err, ok, type Result } from "neverthrow";
import type { StateIndexDiagnostic } from "../../index-runtime/src/index.ts";
import { parseInvestigationIndexStageOptions } from "./options.ts";
import {
  defaultInvestigationsDirectory,
  isInvestigationId,
  resolveInvestigationsDirectory,
  type ResolvedInvestigationsDirectory
} from "./report-path.ts";
import {
  investigationIndexFileName,
  investigationIndexNamespace
} from "./investigation-state-index.ts";
import type { InvestigationIndexStageResult } from "./types.ts";

export type InvestigationIndexStageFailure = Readonly<{
  kind: "invalid-options" | "operation";
  result: Extract<InvestigationIndexStageResult, { status: "error" }>;
}>;
export type PreparedInvestigationIndexStage = Readonly<{
  indexPath: string;
  reportIds: string[];
  resolved: ResolvedInvestigationsDirectory;
}>;

export const investigationStageDiagnosticCodes = {
  locationInvalid: "investigation-report.stage-location-invalid",
  optionsInvalid: "investigation-report.stage-options-invalid",
  reportIdDuplicate: "investigation-report.stage-report-id-duplicate",
  reportIdInvalid: "investigation-report.stage-report-id-invalid",
  reportIdsEmpty: "investigation-report.stage-report-ids-empty"
} as const;
type InvestigationStageDiagnosticCode =
  (typeof investigationStageDiagnosticCodes)[keyof typeof investigationStageDiagnosticCodes];

export function prepareInvestigationIndexStage(
  input: unknown
): Result<PreparedInvestigationIndexStage, InvestigationIndexStageFailure> {
  const parsed = parseInvestigationIndexStageOptions(input);
  if (parsed.isErr())
    return invalidOptionsFailure(defaultInvestigationIndexPath(), parsed.error);
  const indexPath = investigationIndexPathForOptions(parsed.value);
  const resolved = resolveInvestigationsDirectory(
    parsed.value.workspaceRoot,
    parsed.value.investigationsDir
  );
  const reportIds = validateStageReportIds(parsed.value.reportIds);
  if (resolved.isErr() || reportIds.isErr())
    return invalidLocationOrSelection(indexPath, resolved, reportIds);
  return ok({
    indexPath,
    reportIds: reportIds.value,
    resolved: resolved.value
  });
}

function invalidOptionsFailure(
  indexPath: string,
  messages: readonly string[]
): Result<never, InvestigationIndexStageFailure> {
  return err(
    stageFailure(
      "invalid-options",
      failedStage(
        indexPath,
        diagnosticsFromMessages(
          investigationStageDiagnosticCodes.optionsInvalid,
          messages,
          indexPath
        )
      )
    )
  );
}

function invalidLocationOrSelection(
  indexPath: string,
  resolved: ReturnType<typeof resolveInvestigationsDirectory>,
  reportIds: ReturnType<typeof validateStageReportIds>
): Result<never, InvestigationIndexStageFailure> {
  const diagnostics = [
    ...(resolved.isErr()
      ? diagnosticsFromMessages(
          investigationStageDiagnosticCodes.locationInvalid,
          resolved.error,
          indexPath
        )
      : []),
    ...(reportIds.isErr() ? reportIds.error : [])
  ];
  return err(
    stageFailure(
      "invalid-options",
      failedStage(
        indexPath,
        diagnostics,
        resolved.isErr() ? "index-path-invalid" : "selection-invalid"
      )
    )
  );
}

function validateStageReportIds(
  reportIds: readonly string[]
): Result<string[], StateIndexDiagnostic[]> {
  if (reportIds.length === 0)
    return err([
      stageDiagnostic(
        investigationStageDiagnosticCodes.reportIdsEmpty,
        "stage-index requires at least one Investigation ID"
      )
    ]);
  const diagnostics: StateIndexDiagnostic[] = [];
  const seen = new Set<string>();
  for (const id of reportIds) validateOneStageReportId(id, seen, diagnostics);
  return diagnostics.length > 0
    ? err(diagnostics)
    : ok([...seen].sort(compareText));
}

function validateOneStageReportId(
  id: string,
  seen: Set<string>,
  diagnostics: StateIndexDiagnostic[]
): void {
  if (!isInvestigationId(id)) {
    diagnostics.push(
      stageDiagnostic(
        investigationStageDiagnosticCodes.reportIdInvalid,
        `report selector ${JSON.stringify(id)} must use extensionless kebab-case text`,
        id
      )
    );
  } else if (seen.has(id)) {
    diagnostics.push(
      stageDiagnostic(
        investigationStageDiagnosticCodes.reportIdDuplicate,
        `report selector ${JSON.stringify(id)} appears more than once`,
        id
      )
    );
  } else seen.add(id);
}

function failedStage(
  indexPath: string,
  diagnostics: StateIndexDiagnostic[],
  state: "index-path-invalid" | "selection-invalid" = "selection-invalid"
): Extract<InvestigationIndexStageResult, { changed: false; status: "error" }> {
  return {
    changed: false,
    diagnostics,
    indexPath,
    namespace: investigationIndexNamespace,
    selectedIds: [],
    state,
    status: "error"
  };
}

function stageFailure(
  kind: InvestigationIndexStageFailure["kind"],
  result: Extract<InvestigationIndexStageResult, { status: "error" }>
): InvestigationIndexStageFailure {
  return { kind, result };
}

function diagnosticsFromMessages(
  code: InvestigationStageDiagnosticCode,
  messages: readonly string[],
  indexPath: string
): StateIndexDiagnostic[] {
  return messages.map((message) => ({
    code,
    message,
    path: indexPath,
    stateId: null
  }));
}

function stageDiagnostic(
  code: InvestigationStageDiagnosticCode,
  message: string,
  stateId: string | null = null
): StateIndexDiagnostic {
  return { code, message, path: null, stateId };
}

function defaultInvestigationIndexPath(): string {
  return path.join(defaultInvestigationsDirectory, investigationIndexFileName);
}

function investigationIndexPathForOptions(options: {
  investigationsDir?: string;
  workspaceRoot: string;
}): string {
  return path.resolve(
    options.workspaceRoot,
    options.investigationsDir ?? defaultInvestigationsDirectory,
    investigationIndexFileName
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
