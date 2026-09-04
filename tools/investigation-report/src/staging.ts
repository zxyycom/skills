import path from "node:path";
import { err, errAsync, ok, ResultAsync, type Result } from "neverthrow";
import {
  createStateIndexRuntime,
  type StateIndex,
  type StateIndexDiagnostic,
  type StateIndexEntryStageResult,
  type StateIndexResult
} from "../../index-runtime/src/index.ts";
import {
  createInvestigationStateIndexDefinition,
  investigationIndexFileName,
  investigationIndexNamespace
} from "./investigation-state-index.ts";
import { parseInvestigationIndexStageOptions } from "./options.ts";
import {
  canonicalizeInvestigationsDirectory,
  defaultInvestigationsDirectory,
  isInvestigationId,
  parseDatedInvestigationId,
  resolveInvestigationsDirectory,
  type ResolvedInvestigationsDirectory
} from "./report-path.ts";
import type {
  InvestigationIndexMetadata,
  InvestigationIndexState,
  InvestigationIndexStageOptions,
  InvestigationIndexStageResult
} from "./types.ts";

export type InvestigationIndexStageFailure = Readonly<{
  kind: "invalid-options" | "operation";
  result: InvestigationIndexStageError;
}>;
type InvestigationIndexStageSuccess = Extract<
  InvestigationIndexStageResult,
  { status: "ok" }
>;
type InvestigationIndexStageError = Extract<
  InvestigationIndexStageResult,
  { status: "error" }
>;
type InvestigationIndexStageUnchangedError = Extract<
  InvestigationIndexStageError,
  { changed: false }
>;
type PreparedInvestigationIndexStage = Readonly<{
  indexPath: string;
  reportIds: string[];
  resolved: ResolvedInvestigationsDirectory;
}>;

const investigationStageDiagnosticCodes = {
  locationInvalid: "investigation-report.stage-location-invalid",
  optionsInvalid: "investigation-report.stage-options-invalid",
  reportIdDuplicate: "investigation-report.stage-report-id-duplicate",
  reportIdInvalid: "investigation-report.stage-report-id-invalid",
  reportIdsEmpty: "investigation-report.stage-report-ids-empty"
} as const;
type InvestigationStageDiagnosticCode =
  (typeof investigationStageDiagnosticCodes)[keyof typeof investigationStageDiagnosticCodes];

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
  const prepared = prepareStage(input);
  if (prepared.isErr()) {
    return errAsync(prepared.error);
  }
  return canonicalizeInvestigationsDirectory(prepared.value.resolved)
    .mapErr((errors) =>
      stageFailure(
        "operation",
        failedStage(
          prepared.value.indexPath,
          diagnosticsFromMessages(
            investigationStageDiagnosticCodes.locationInvalid,
            errors,
            prepared.value.indexPath
          ),
          "index-path-invalid"
        )
      )
    )
    .andThen((canonical) =>
      stageValidatedInvestigationIndex(
        canonical.investigationsDirectory,
        prepared.value.reportIds
      )
    );
}

function prepareStage(
  input: unknown
): Result<PreparedInvestigationIndexStage, InvestigationIndexStageFailure> {
  const parsed = parseInvestigationIndexStageOptions(input);
  if (parsed.isErr()) {
    return err(
      stageFailure(
        "invalid-options",
        failedStage(
          defaultInvestigationIndexPath(),
          diagnosticsFromMessages(
            investigationStageDiagnosticCodes.optionsInvalid,
            parsed.error,
            defaultInvestigationIndexPath()
          )
        )
      )
    );
  }
  const resolved = resolveInvestigationsDirectory(
    parsed.value.workspaceRoot,
    parsed.value.investigationsDir
  );
  const validatedIds = validateReportIds(parsed.value.reportIds);
  const indexPath = investigationIndexPathForOptions(parsed.value);
  if (resolved.isErr() || validatedIds.isErr()) {
    return err(
      stageFailure(
        "invalid-options",
        failedStage(
          indexPath,
          [
            ...(resolved.isErr()
              ? diagnosticsFromMessages(
                  investigationStageDiagnosticCodes.locationInvalid,
                  resolved.error,
                  indexPath
                )
              : []),
            ...(validatedIds.isErr() ? validatedIds.error : [])
          ],
          resolved.isErr() ? "index-path-invalid" : "selection-invalid"
        )
      )
    );
  }
  return ok({
    indexPath,
    reportIds: validatedIds.value,
    resolved: resolved.value
  });
}

function validateReportIds(
  reportIds: readonly string[]
): Result<string[], StateIndexDiagnostic[]> {
  if (reportIds.length === 0) {
    return err([
      stageDiagnostic(
        investigationStageDiagnosticCodes.reportIdsEmpty,
        "stage-index requires at least one Investigation ID"
      )
    ]);
  }
  const diagnostics: StateIndexDiagnostic[] = [];
  const seen = new Set<string>();
  for (const value of reportIds) {
    const id = value;
    if (!isInvestigationId(id)) {
      diagnostics.push(
        stageDiagnostic(
          investigationStageDiagnosticCodes.reportIdInvalid,
          `report selector ${JSON.stringify(value)} must use extensionless kebab-case text`,
          value
        )
      );
      continue;
    }
    if (seen.has(id)) {
      diagnostics.push(
        stageDiagnostic(
          investigationStageDiagnosticCodes.reportIdDuplicate,
          `report selector ${JSON.stringify(id)} appears more than once`,
          id
        )
      );
      continue;
    }
    seen.add(id);
  }
  return diagnostics.length > 0
    ? err(diagnostics)
    : ok([...seen].sort(compareText));
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
      ? err(stageFailure("operation", mapped))
      : ok(mapped);
  });
}

function resolveInvestigationStageSelectors(
  options: Readonly<{
    baseline: StateIndex<
      InvestigationIndexState,
      InvestigationIndexMetadata
    > | null;
    selectedIds: readonly string[];
    workspace: StateIndex<InvestigationIndexState, InvestigationIndexMetadata>;
  }>
): StateIndexResult<string[]> {
  const entries = new Map<string, string>();
  for (const index of [options.baseline, options.workspace]) {
    if (index === null) continue;
    for (const [id, entry] of Object.entries(index.entries)) {
      entries.set(id, entry.state.name);
    }
  }
  const resolved: string[] = [];
  const diagnostics: StateIndexDiagnostic[] = [];
  for (const selector of options.selectedIds) {
    const dated = parseDatedInvestigationId(selector);
    if (dated !== null) {
      resolved.push(dated.id);
      continue;
    }
    const matches = [...entries]
      .filter(([, name]) => name === selector)
      .map(([id]) => id)
      .sort(compareText);
    if (matches.length === 0) {
      diagnostics.push(
        stageDiagnostic(
          investigationStageDiagnosticCodes.reportIdInvalid,
          `report name ${JSON.stringify(selector)} is absent from both indexes`,
          selector
        )
      );
    } else if (matches.length > 1) {
      diagnostics.push(
        stageDiagnostic(
          investigationStageDiagnosticCodes.reportIdInvalid,
          `report name ${JSON.stringify(selector)} is ambiguous; choose one standard ID: ${matches.join(", ")}`,
          selector
        )
      );
    } else {
      resolved.push(matches[0]!);
    }
  }
  return diagnostics.length === 0
    ? { diagnostics: [], status: "ok", value: resolved }
    : { diagnostics, status: "error", value: null };
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
        diagnostic.path === null
          ? null
          : diagnostic.path === investigationIndexFileName
            ? indexPath
            : diagnostic.path
    })),
    indexPath
  };
}

function failedStage(
  indexPath: string,
  diagnostics: StateIndexDiagnostic[],
  state: InvestigationIndexStageUnchangedError["state"] = "selection-invalid"
): InvestigationIndexStageUnchangedError {
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
  result: InvestigationIndexStageError
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
