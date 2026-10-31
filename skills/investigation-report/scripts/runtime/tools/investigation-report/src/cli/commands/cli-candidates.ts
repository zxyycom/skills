/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/cli/commands/cli-candidates.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/cli/commands/cli-candidates.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/cli/commands/cli-candidates.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import {
  listInvestigationCandidates,
  showInvestigationCandidate
} from "../../candidates/candidate.ts";
import type { InvestigationReportCliIo, ParsedCli } from "../cli-contract.ts";
import {
  printCandidateReadiness,
  printCandidateReadinessSummary
} from "./cli-candidate-readiness.ts";
import {
  cliInvalid,
  printResultErrors,
  printWarnings,
  writeLine
} from "../cli-io.ts";
import {
  assertAllowedOptions,
  assertNoPositionals,
  location
} from "../cli-parser.ts";

export async function runCandidates(
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
  const result = await listInvestigationCandidates(location(input.values));
  if (result.status === "error") {
    return printResultErrors({
      diagnostics: result.diagnostics,
      errors: result.errors,
      exitCode: 1,
      io,
      title: "Investigation candidate list failed:",
      warnings: result.warnings
    });
  }
  printWarnings(result.warnings, io);
  if (result.candidates.length === 0) {
    writeLine(io.stdout, "No investigation candidates found.");
    return 0;
  }
  writeLine(
    io.stdout,
    `Investigation candidates (${result.candidates.length}):`
  );
  for (const candidate of result.candidates) {
    writeLine(
      io.stdout,
      `${candidate.id} scaffold=${candidate.readiness.scaffoldValid} body=${candidate.readiness.bodyReady} resources=${candidate.readiness.resourceReady}`
    );
  }
  return 0;
}

export async function runShowCandidate(
  input: ParsedCli,
  io: InvestigationReportCliIo
): Promise<number> {
  const problem = assertAllowedOptions(input, ["root", "investigations-dir"]);
  const [id] = input.positionals;
  if (problem !== null || id === undefined || input.positionals.length !== 1) {
    return cliInvalid(
      problem ?? "show-candidate requires exactly one Investigation selector",
      io
    );
  }
  const result = await showInvestigationCandidate({
    ...location(input.values),
    id
  });
  if (result.status === "error") {
    return printResultErrors({
      diagnostics: result.diagnostics,
      errors: result.errors,
      exitCode: 1,
      io,
      title: "Investigation candidate show failed:",
      warnings: result.warnings
    });
  }
  printCandidateReadinessSummary(result.candidate.readiness, io);
  io.stdout(result.candidate.markdown ?? "");
  printCandidateReadiness(result.candidate, io);
  return 0;
}
