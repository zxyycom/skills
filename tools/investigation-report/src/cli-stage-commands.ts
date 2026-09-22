import { diagnosticFromStateIndexDiagnostic } from "./diagnostics.ts";
import { executeInvestigationStage } from "./staging.ts";
import type {
  InvestigationStageResult,
  InvestigationStageScope
} from "./types.ts";
import type { InvestigationReportCliIo, ParsedCli } from "./cli-contract.ts";
import { cliInvalid, printResultErrors, writeLine } from "./cli-io.ts";
import {
  assertAllowedOptions,
  assertSingleOptions,
  location,
  valuesOf
} from "./cli-parser.ts";

/**
 * Resolves the CLI scope selection without retaining partial state: absent
 * `--scope` means the default `all`, and any other value is reported as the
 * ordinary invalid-input path.
 */
function requestedStageScope(
  input: ParsedCli
): InvestigationStageScope | "invalid" {
  const scopeValues = valuesOf(input.values, "scope");
  const requested = scopeValues ?? [];
  if (requested.length === 0) return "all";
  const value = requested[0];
  if (value === "all" || value === "index" || value === "domain") {
    return value;
  }
  return "invalid";
}

export async function runStage(
  input: ParsedCli,
  io: InvestigationReportCliIo
): Promise<number> {
  const problem = assertAllowedOptions(input, [
    "root",
    "investigations-dir",
    "scope"
  ]);
  if (problem !== null) return cliInvalid(problem, io);
  const scopeProblem = assertSingleOptions(input, ["scope"]);
  if (scopeProblem !== null) return cliInvalid(scopeProblem, io);
  const scope = requestedStageScope(input);
  if (scope === "invalid") {
    return cliInvalid("stage --scope must be all, index, or domain", io);
  }
  const execution = await executeInvestigationStage({
    ...location(input.values),
    reportIds: input.positionals,
    scope
  });
  if (execution.isErr()) {
    printStageErrors(execution.error.result, io);
    return execution.error.kind === "invalid-options" ? 2 : 1;
  }
  printStageSuccess(execution.value, io);
  return 0;
}

function printStageSuccess(
  result: Extract<InvestigationStageResult, { status: "ok" }>,
  io: InvestigationReportCliIo
): void {
  writeLine(
    io.stdout,
    result.changed
      ? `Investigation pending snapshot staged (scope: ${result.scope}) for ${result.selectedIds.length} selected report(s), including ${result.indexPath}.`
      : `Investigation pending snapshot is unchanged (scope: ${result.scope}) for ${result.selectedIds.length} selected report(s), including ${result.indexPath}.`
  );
  writeLine(io.stdout, `state: ${result.state}; changed: ${result.changed}`);
  writeLine(io.stdout, `selected IDs: ${result.selectedIds.join(", ")}`);
  writeLine(
    io.stdout,
    `written paths: ${result.writtenPaths.join(", ") || "none"}`
  );
  writeLine(
    io.stdout,
    `preserved unrelated pending paths: ${result.preservedPendingPaths.join(", ") || "none"}; caller-owned paths: ${result.callerOwnedPaths.join(", ") || "none"}`
  );
  if (result.scope === "index") {
    writeLine(
      io.stdout,
      "Report Markdown and attached resources remain outside this operation."
    );
  }
}

function printStageErrors(
  result: Extract<InvestigationStageResult, { status: "error" }>,
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
