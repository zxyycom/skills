/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/cli-candidate-readiness.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/cli-candidate-readiness.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/cli-candidate-readiness.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import type { InvestigationReportCliIo } from "./cli-contract.ts";
import type { InvestigationCandidateReadiness } from "./types.ts";
import { diagnosticFromError } from "./diagnostics.ts";
import { printResultErrors, writeLine } from "./cli-io.ts";

export function printCandidateReadiness(
  candidate: Readonly<{
    errors: readonly string[];
    id: string;
    readiness: InvestigationCandidateReadiness;
  }>,
  io: InvestigationReportCliIo
): void {
  if (
    candidate.readiness.scaffoldValid &&
    candidate.readiness.bodyReady &&
    candidate.readiness.resourceReady
  )
    return;
  writeLine(io.stderr, `Investigation candidate readiness: ${candidate.id}`);
  if (!candidate.readiness.scaffoldValid)
    writeLine(io.stderr, "- scaffold: incomplete or invalid");
  if (!candidate.readiness.bodyReady)
    writeLine(io.stderr, "- body: incomplete");
  if (!candidate.readiness.resourceReady)
    writeLine(io.stderr, "- resources: need attention");
  for (const error of candidate.errors) writeLine(io.stderr, `- ${error}`);
}

export function printCandidateReadinessSummary(
  readiness: InvestigationCandidateReadiness,
  io: InvestigationReportCliIo
): void {
  writeLine(io.stdout, `scaffoldValid: ${readiness.scaffoldValid}`);
  writeLine(io.stdout, `bodyReady: ${readiness.bodyReady}`);
  writeLine(io.stdout, `resourceReady: ${readiness.resourceReady}`);
}

export function printCandidatePreflightUnavailable(
  id: string,
  error: unknown,
  io: InvestigationReportCliIo
): void {
  writeLine(
    io.stdout,
    "Candidate publish preflight: unavailable (candidate remains created)."
  );
  printResultErrors({
    diagnostics: [
      diagnosticFromError({
        code: "investigation-report.candidate-preflight-unavailable",
        error,
        reason:
          "the candidate was created but its auxiliary publish preflight could not complete",
        recovery:
          "keep the created candidate, restore collection access, then inspect it or run publish --preflight; do not rerun new",
        target: id
      })
    ],
    errors: [],
    exitCode: 0,
    io,
    title: "Auxiliary candidate preflight unavailable:"
  });
}
