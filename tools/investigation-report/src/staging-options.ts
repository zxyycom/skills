import path from "node:path";
import { err, ok, type Result } from "neverthrow";
import type { StateIndexDiagnostic } from "../../index-runtime/src/index.ts";
import { parseInvestigationStageOptions } from "./options.ts";
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
import type {
  InvestigationStageResult,
  InvestigationStageScope
} from "./types.ts";

export type InvestigationStageFailure = Readonly<{
  kind: "invalid-options" | "operation";
  result: Extract<InvestigationStageResult, { status: "error" }>;
}>;
export type PreparedInvestigationStage = Readonly<{
  indexPath: string;
  reportIds: string[];
  resolved: ResolvedInvestigationsDirectory;
  scope: InvestigationStageScope;
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

export function prepareInvestigationStage(
  input: unknown
): Result<PreparedInvestigationStage, InvestigationStageFailure> {
  const parsed = parseInvestigationStageOptions(input);
  if (parsed.isErr())
    return invalidOptionsFailure(
      defaultInvestigationIndexPath(),
      parsed.error,
      requestedStageScope(input)
    );
  const scope = parsed.value.scope ?? "all";
  const indexPath = investigationIndexPathForOptions(parsed.value);
  const resolved = resolveInvestigationsDirectory(
    parsed.value.workspaceRoot,
    parsed.value.investigationsDir
  );
  const reportIds = validateStageReportIds(parsed.value.reportIds);
  if (resolved.isErr() || reportIds.isErr())
    return invalidLocationOrSelection(indexPath, scope, resolved, reportIds);
  return ok({
    indexPath,
    reportIds: reportIds.value,
    resolved: resolved.value,
    scope
  });
}

function requestedStageScope(input: unknown): InvestigationStageScope {
  if (
    typeof input === "object" &&
    input !== null &&
    "scope" in input &&
    (input.scope === "all" ||
      input.scope === "index" ||
      input.scope === "domain")
  ) {
    return input.scope;
  }
  return "all";
}

function invalidOptionsFailure(
  indexPath: string,
  messages: readonly string[],
  scope: InvestigationStageScope = "all"
): Result<never, InvestigationStageFailure> {
  return err(
    stageFailure(
      "invalid-options",
      failedStage(
        indexPath,
        diagnosticsFromMessages(
          investigationStageDiagnosticCodes.optionsInvalid,
          messages,
          indexPath
        ),
        scope
      )
    )
  );
}

function invalidLocationOrSelection(
  indexPath: string,
  scope: InvestigationStageScope,
  resolved: ReturnType<typeof resolveInvestigationsDirectory>,
  reportIds: ReturnType<typeof validateStageReportIds>
): Result<never, InvestigationStageFailure> {
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
        scope,
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
        "stage requires at least one Investigation ID"
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
  scope: InvestigationStageScope,
  state: "index-path-invalid" | "selection-invalid" = "selection-invalid"
): Extract<InvestigationStageResult, { changed: false; status: "error" }> {
  return {
    changed: false,
    diagnostics,
    indexPath,
    namespace: investigationIndexNamespace,
    scope,
    selectedIds: [],
    state,
    status: "error"
  };
}

function stageFailure(
  kind: InvestigationStageFailure["kind"],
  result: Extract<InvestigationStageResult, { status: "error" }>
): InvestigationStageFailure {
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
