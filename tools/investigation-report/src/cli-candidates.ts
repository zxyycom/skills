import { discardInvestigationCandidate } from "./candidate-discard.ts";
import {
  listInvestigationCandidates,
  showInvestigationCandidate
} from "./candidate.ts";
import type { InvestigationReportCliIo, ParsedCli } from "./cli-contract.ts";
import { printCandidateReadiness } from "./cli-candidate-readiness.ts";
import { cliInvalid, printResultErrors, writeLine } from "./cli-io.ts";
import {
  assertAllowedOptions,
  assertNoPositionals,
  has,
  location
} from "./cli-parser.ts";

export async function runDiscardCandidate(
  input: ParsedCli,
  io: InvestigationReportCliIo
): Promise<number> {
  const problem = assertAllowedOptions(input, [
    "root",
    "investigations-dir",
    "delete-owned-resources",
    "delete-recorded-candidate"
  ]);
  const [id] = input.positionals;
  if (problem !== null || id === undefined || input.positionals.length !== 1) {
    return cliInvalid(
      problem ??
        "discard-candidate requires exactly one Investigation selector",
      io
    );
  }
  const discarded = await discardInvestigationCandidate({
    ...location(input.values),
    deleteOwnedResources: has(input.values, "delete-owned-resources"),
    deleteRecordedCandidate: has(input.values, "delete-recorded-candidate"),
    id
  });
  if (discarded.errors.length > 0) {
    printResultErrors({
      diagnostics: discarded.diagnostics,
      errors: discarded.errors,
      exitCode: 1,
      io,
      title: discarded.changed
        ? "Investigation candidate discard committed, but cleanup failed:"
        : "Investigation candidate discard failed:"
    });
    return 1;
  }
  writeLine(
    io.stdout,
    discardedResourceOwnerMessage("Investigation candidate", discarded)
  );
  return 0;
}

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
    printCandidateReadiness(candidate, io);
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
  io.stdout(result.candidate.markdown ?? "");
  printCandidateReadiness(result.candidate, io);
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
