import type { InvestigationReportCliIo } from "./cli-contract.ts";
import { writeLine } from "./cli-io.ts";

export function printCandidateReadiness(
  candidate: Readonly<{
    errors: readonly string[];
    id: string;
    readiness: Readonly<{
      bodyReady: boolean;
      resourceReady: boolean;
      scaffoldValid: boolean;
    }>;
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
  writeLine(
    io.stderr,
    "  next: edit the candidate, inspect it with show-candidate, then run publish --preflight before publishing"
  );
}
