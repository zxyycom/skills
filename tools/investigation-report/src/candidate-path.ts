import path from "node:path";
import { isInvestigationId } from "./report-path.ts";

export const investigationCandidateFilePrefix = "_candidate.";

export function candidateFileNameForInvestigationId(id: string): string {
  return `${investigationCandidateFilePrefix}${id}`;
}

export function candidatePathForInvestigationId(
  investigationsDirectory: string,
  id: string
): string {
  return path.join(
    investigationsDirectory,
    candidateFileNameForInvestigationId(id)
  );
}

export function investigationCandidateIdFromFileName(
  fileName: string
): string | null {
  if (!fileName.startsWith(investigationCandidateFilePrefix)) return null;
  const id = fileName.slice(investigationCandidateFilePrefix.length);
  return isInvestigationId(id) ? id : null;
}

export function isReservedInvestigationCandidateFileName(
  fileName: string
): boolean {
  return fileName.startsWith(investigationCandidateFilePrefix);
}

export function hasCandidateFormalIdentityConflict(
  reportIds: readonly string[],
  candidateIds: readonly string[]
): string[] {
  const formal = new Set(reportIds);
  return candidateIds
    .filter((id) => formal.has(id))
    .map(
      (id) =>
        `${id} exists as both a formal investigation report and an authoring candidate`
    );
}
