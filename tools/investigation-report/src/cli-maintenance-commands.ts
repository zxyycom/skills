import { discardInvestigationReport } from "./discard.ts";
import { diagnosticFromStateIndexDiagnostic } from "./diagnostics.ts";
import {
  renameInvestigationRecord,
  type InvestigationRenameResult
} from "./rename.ts";
import { executeInvestigationIndexStage } from "./staging.ts";
import {
  executeInvestigationIndexSync,
  executeInvestigationReportCheck,
  type InvestigationIndexSyncFailure,
  type InvestigationReportCheckFailure
} from "./validation.ts";
import { normalizeInvestigationIdInput } from "./report-path.ts";
import type {
  InvestigationIndexStageResult,
  InvestigationIndexSyncResult
} from "./types.ts";
import type { InvestigationReportCliIo, ParsedCli } from "./cli-contract.ts";
import {
  cliInvalid,
  printResultErrors,
  printWarnings,
  writeLine
} from "./cli-io.ts";
import {
  assertAllowedOptions,
  assertNoPositionals,
  has,
  location,
  valuesOf
} from "./cli-parser.ts";

export async function runCheck(
  input: ParsedCli,
  io: InvestigationReportCliIo
): Promise<number> {
  const problem =
    assertNoPositionals(input) ??
    assertAllowedOptions(input, ["root", "investigations-dir", "id"]);
  if (problem !== null) return cliInvalid(problem, io);
  const ids = valuesOf(input.values, "id");
  const execution = await executeInvestigationReportCheck({
    ...location(input.values),
    ...(ids === undefined ? {} : { ids })
  });
  if (execution.isErr()) return printCheckFailure(execution.error, io);
  const result = execution.value;
  printWarnings(result.warnings, io);
  writeLine(
    io.stdout,
    `Investigation report check passed (${result.selectedReportCount} of ${result.availableReportCount} reports checked${result.indexChecked ? "; full index current" : "; index not checked"}).`
  );
  return 0;
}

export async function runSync(
  input: ParsedCli,
  io: InvestigationReportCliIo
): Promise<number> {
  const problem =
    assertNoPositionals(input) ??
    assertAllowedOptions(input, [
      "root",
      "investigations-dir",
      "select",
      "write"
    ]);
  if (problem !== null) return cliInvalid(problem, io);
  const selectors = valuesOf(input.values, "select");
  const execution = await executeInvestigationIndexSync({
    ...location(input.values),
    ...(selectors === undefined ? {} : { selectors }),
    mode:
      selectors === undefined || has(input.values, "write") ? "write" : "check"
  });
  if (execution.isErr()) return printSyncFailure(execution.error, io);
  printSyncSuccess(execution.value, io);
  return 0;
}

function printCheckFailure(
  error: InvestigationReportCheckFailure,
  io: InvestigationReportCliIo
): number {
  return printResultErrors({
    diagnostics: error.result.diagnostics,
    errors: error.result.errors,
    exitCode: error.kind === "invalid-options" ? 2 : 1,
    io,
    title:
      error.kind === "invalid-options"
        ? "Invalid investigation report check options:"
        : "Investigation report check failed:",
    warnings: error.result.warnings
  });
}

function printSyncFailure(
  error: InvestigationIndexSyncFailure,
  io: InvestigationReportCliIo
): number {
  return printResultErrors({
    diagnostics: error.result.diagnostics,
    errors: error.result.errors,
    exitCode: error.kind === "invalid-options" ? 2 : 1,
    io,
    title:
      error.kind === "invalid-options"
        ? "Invalid investigation index synchronization options:"
        : "Investigation index synchronization failed:",
    warnings: error.result.warnings
  });
}

function printSyncSuccess(
  result: InvestigationIndexSyncResult,
  io: InvestigationReportCliIo
): void {
  printWarnings(result.warnings, io);
  if (result.scope === "selected") return printSelectedSyncSuccess(result, io);
  writeLine(
    io.stdout,
    result.changed
      ? `Investigation index synchronized (${result.reportCount} reports).`
      : `Investigation index is already current (${result.reportCount} reports).`
  );
}

function printSelectedSyncSuccess(
  result: InvestigationIndexSyncResult,
  io: InvestigationReportCliIo
): void {
  writeLine(
    io.stdout,
    `Selected Investigation selectors: ${result.selectors.join(", ")}.`
  );
  writeLine(
    io.stdout,
    result.changed
      ? `Published the complete Investigation index projection for resolved IDs: ${result.selectedIds.join(", ")}.`
      : `Resolved Investigation IDs are already current: ${result.selectedIds.join(", ")}.`
  );
}

export async function runDiscard(
  input: ParsedCli,
  io: InvestigationReportCliIo
): Promise<number> {
  const problem = assertAllowedOptions(input, [
    "root",
    "investigations-dir",
    "delete-owned-resources",
    "delete-recorded-report"
  ]);
  const [id] = input.positionals;
  if (problem !== null || id === undefined || input.positionals.length !== 1)
    return cliInvalid(
      problem ?? "discard requires exactly one Investigation selector",
      io
    );
  if (normalizeInvestigationIdInput(id) === null)
    return cliInvalid(
      `${id || "<empty>"} discard id must use an Investigation ID`,
      io
    );
  const result = await discardInvestigationReport({
    ...location(input.values),
    deleteOwnedResources: has(input.values, "delete-owned-resources"),
    deleteRecordedReport: has(input.values, "delete-recorded-report"),
    id
  });
  if (result.errors.length > 0)
    return printResultErrors({
      diagnostics: result.diagnostics,
      errors: result.errors,
      exitCode: 1,
      io,
      title: result.changed
        ? "Investigation report discard committed, but cleanup failed:"
        : "Investigation report discard failed:"
    });
  writeLine(
    io.stdout,
    discardedResourceOwnerMessage("Investigation report", result)
  );
  return 0;
}

export async function runRename(
  input: ParsedCli,
  io: InvestigationReportCliIo
): Promise<number> {
  const selectors = renameSelectors(input);
  if (typeof selectors === "string") return cliInvalid(selectors, io);
  const result = await renameInvestigationRecord({
    ...location(input.values),
    preflight: has(input.values, "preflight"),
    renameRecordedCandidate: has(input.values, "rename-recorded-candidate"),
    renameRecordedReport: has(input.values, "rename-recorded-report"),
    source: selectors.source,
    target: selectors.target
  });
  return printRenameResult(result, io);
}

type RenameSelectors = Readonly<{ source: string; target: string }>;

function renameSelectors(input: ParsedCli): RenameSelectors | string {
  const problem = assertAllowedOptions(input, [
    "root",
    "investigations-dir",
    "preflight",
    "rename-recorded-report",
    "rename-recorded-candidate"
  ]);
  if (problem !== null) return problem;
  return exactlyTwoRenameSelectors(input.positionals);
}

function exactlyTwoRenameSelectors(
  positionals: readonly string[]
): RenameSelectors | string {
  const [source, target] = positionals;
  if (source === undefined || target === undefined || positionals.length !== 2)
    return "rename requires one source selector and one target name or ID";
  return { source, target };
}

function printRenameResult(
  result: InvestigationRenameResult,
  io: InvestigationReportCliIo
): number {
  if (result.status !== "ok") return printRenameFailure(result, io);
  printRenameSuccess(result, io);
  return 0;
}

function printRenameFailure(
  result: InvestigationRenameResult,
  io: InvestigationReportCliIo
): number {
  return printResultErrors({
    diagnostics: result.diagnostics,
    errors: result.errors,
    exitCode: 1,
    io,
    title:
      result.status === "attention"
        ? "Investigation rename needs confirmation:"
        : "Investigation rename failed:"
  });
}

function printRenameSuccess(
  result: InvestigationRenameResult,
  io: InvestigationReportCliIo
): void {
  const plan = result.plan;
  if (plan === null) return;
  const outcome = renameOutcome(result);
  writeLine(
    io.stdout,
    `Investigation rename ${outcome}: ${plan.oldId} -> ${plan.newId}`
  );
  writeLine(io.stdout, `old name: ${plan.oldName}; new name: ${plan.newName}`);
  writeLine(
    io.stdout,
    `old sourcePath: ${plan.oldSourcePath}; new sourcePath: ${plan.newSourcePath}`
  );
  writeLine(
    io.stdout,
    `affected relations: candidate ${plan.affectedCandidateRelationCount}, formal ${plan.affectedEstablishedRelationCount}; resource references: ${plan.affectedResourceReferenceCount}; owner moved: ${plan.resourceOwnerMoved}`
  );
}

function renameOutcome(result: InvestigationRenameResult): string {
  if (result.plan === null) return "no-change";
  if (result.changed || result.plan.outcome === "preflight")
    return result.plan.outcome;
  return "no-change";
}

export async function runStage(
  input: ParsedCli,
  io: InvestigationReportCliIo
): Promise<number> {
  const problem = assertAllowedOptions(input, ["root", "investigations-dir"]);
  if (problem !== null) return cliInvalid(problem, io);
  const execution = await executeInvestigationIndexStage({
    ...location(input.values),
    reportIds: input.positionals
  });
  if (execution.isErr()) {
    printStageErrors(execution.error.result, io);
    return execution.error.kind === "invalid-options" ? 2 : 1;
  }
  printStageSuccess(execution.value, io);
  return 0;
}

function discardedResourceOwnerMessage(
  label: string,
  discarded: { deletedResourceIds: readonly string[]; id: string }
): string {
  const deleted =
    discarded.deletedResourceIds.length === 0
      ? ""
      : `; deleted ${discarded.deletedResourceIds.length} owned resource(s)`;
  return `${label} discarded: ${discarded.id}${deleted}.`;
}
function printStageSuccess(
  result: Extract<InvestigationIndexStageResult, { status: "ok" }>,
  io: InvestigationReportCliIo
): void {
  writeLine(
    io.stdout,
    result.changed
      ? `Investigation index entries staged for ${result.selectedIds.length} selected report(s) in ${result.indexPath}.`
      : `Investigation index entries are unchanged for ${result.selectedIds.length} selected report(s) in ${result.indexPath}.`
  );
  writeLine(io.stdout, `state: ${result.state}; changed: ${result.changed}`);
  writeLine(io.stdout, `selected IDs: ${result.selectedIds.join(", ")}`);
  writeLine(
    io.stdout,
    "Report Markdown and attached resources remain outside this operation."
  );
}
function printStageErrors(
  result: Extract<InvestigationIndexStageResult, { status: "error" }>,
  io: InvestigationReportCliIo
): void {
  printResultErrors({
    diagnostics: result.diagnostics.map((diagnostic) =>
      diagnosticFromStateIndexDiagnostic(diagnostic, {
        ...(result.pending === undefined
          ? {}
          : {
              mutation: {
                outcome: result.pending.outcome,
                scope: result.pending.scope
              }
            }),
        recovery:
          "correct the reported staging problem, then retry the selected index update",
        target: result.indexPath
      })
    ),
    errors: [`selected IDs: ${result.selectedIds.join(", ") || "none"}`],
    exitCode: 1,
    io,
    title: `Investigation index entry staging failed (state: ${result.state}; changed: ${result.changed}):`
  });
}
