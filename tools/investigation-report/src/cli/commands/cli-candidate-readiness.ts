import type { InvestigationReportCliIo } from "../cli-contract.ts";
import type { InvestigationCandidateReadiness } from "../../types.ts";
import { writeLine } from "../cli-io.ts";

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
