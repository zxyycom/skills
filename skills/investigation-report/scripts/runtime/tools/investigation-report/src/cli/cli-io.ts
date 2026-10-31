/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/cli/cli-io.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/cli/cli-io.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/cli/cli-io.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import process from "node:process";
import {
  genericInvestigationDiagnostic,
  renderInvestigationDiagnostic,
  type InvestigationDiagnostic
} from "../diagnostics.ts";
import type { InvestigationReportCliIo } from "./cli-contract.ts";

export function writeLine(writer: (text: string) => void, text: string): void {
  writer(`${text}\n`);
}

export function printWarnings(
  warnings: readonly string[],
  io: InvestigationReportCliIo
): void {
  if (warnings.length === 0) return;
  writeLine(io.stderr, "Investigation report warnings:");
  for (const warning of warnings) {
    writeLine(
      io.stderr,
      "- [investigation-report.warning] investigation report collection"
    );
    writeLine(io.stderr, `  reason: ${warning}`);
    writeLine(
      io.stderr,
      "  next: resolve the warning before relying on the affected collection state"
    );
  }
}

export const processInvestigationReportCliIo: InvestigationReportCliIo = {
  stderr: (text) => process.stderr.write(text),
  stdout: (text) => process.stdout.write(text)
};

export type ResultErrorOutput = Readonly<{
  diagnostics?: readonly InvestigationDiagnostic[];
  errors: readonly string[];
  exitCode: number;
  io: InvestigationReportCliIo;
  title: string;
  warnings?: readonly string[];
}>;

export function printResultErrors(output: ResultErrorOutput): number {
  printWarnings(output.warnings ?? [], output.io);
  writeLine(output.io.stderr, output.title);
  renderResultDiagnostics(
    fallbackDiagnostics(output.diagnostics ?? [], output.errors, output.title),
    output.io
  );
  return output.exitCode;
}

function renderResultDiagnostics(
  diagnostics: readonly InvestigationDiagnostic[],
  io: InvestigationReportCliIo
): void {
  for (const diagnostic of diagnostics) renderResultDiagnostic(diagnostic, io);
}

function renderResultDiagnostic(
  diagnostic: InvestigationDiagnostic,
  io: InvestigationReportCliIo
): void {
  for (const line of renderInvestigationDiagnostic(diagnostic))
    writeLine(io.stderr, `- ${line}`);
}

function fallbackDiagnostics(
  diagnostics: readonly InvestigationDiagnostic[],
  errors: readonly string[],
  title: string
): readonly InvestigationDiagnostic[] {
  if (diagnostics.length > 0 || errors.length === 0) return diagnostics;
  return [
    genericInvestigationDiagnostic({
      code: "investigation-report.operation-failed",
      reason: errors.join("; "),
      recovery: "correct the reported problem, then rerun the command",
      target: title.slice(0, -1)
    })
  ];
}

export function cliInvalid(
  error: string,
  io: InvestigationReportCliIo
): number {
  for (const line of renderInvestigationDiagnostic(
    genericInvestigationDiagnostic({
      code: "investigation-report.cli-invalid-arguments",
      reason: error,
      recovery: "correct the command arguments and retry",
      target: "command line"
    })
  ))
    writeLine(io.stderr, line);
  return 2;
}
