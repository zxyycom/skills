/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/cli-stage-commands.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/cli-stage-commands.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/cli-stage-commands.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
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
        recovery: stageRecovery(diagnostic),
        target: result.indexPath
      })
    ),
    errors: [`selected IDs: ${result.selectedIds.join(", ") || "none"}`],
    exitCode: 1,
    io,
    title: `Investigation index entry staging failed (state: ${result.state}; changed: ${result.changed}):`
  });
}

function stageRecovery(
  diagnostic: import("../../index-runtime/src/index.ts").StateIndexDiagnostic
): string {
  if (diagnostic.code === "state-index.pending-recovery-failed")
    return "uniquely read the reported scope through the version-control API and explicitly reconcile it with the original expectation and target before retrying; stop and contact its owner if the scope cannot be uniquely read";
  const category =
    diagnostic.versionControl?.causeCategory ??
    diagnostic.filesystem?.causeCategory;
  switch (category) {
    case "access-denied":
      return "restore access required by the reported read or write operation and target, then rerun the selected stage without elevated privileges";
    case "tool-unavailable":
      return "restore the required version-control tool through the project environment setup, then rerun stage";
    case "busy":
      return "wait for the known concurrent operation to finish, then reread the current pending scope before retrying";
    case "command-failed":
      return "resolve the reported version-control read or object failure, then reread the current scope and rerun stage";
    default:
      if (diagnostic.filesystem !== undefined)
        return "inspect and resolve the reported filesystem read failure for its target, then reread the selected sources before rerunning stage";
      if (diagnostic.code === "state-index.pending-conflict")
        return "reread the current revision and complete pending scope, resolve the reported expectation drift, then rerun the selected stage";
      return "run scoped check for the reported source; correct it and explicitly sync-index when needed, then rerun the selected stage";
  }
}
