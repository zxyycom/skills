import fs from "node:fs/promises";
import path from "node:path";
import { investigationIdFromMarkdown } from "./markdown.ts";
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

export function candidatePathForInvestigationLocator(
  investigationsDirectory: string,
  locator: string
): string {
  if (!isInvestigationId(locator)) {
    throw new Error("candidate locator must use kebab-case text");
  }
  return path.join(
    investigationsDirectory,
    candidateFileNameForInvestigationId(locator)
  );
}

/**
 * Candidate filenames are storage locators. Read the declared frontmatter ID
 * rather than reconstructing identity from that locator.
 */
export async function findCandidatePathForInvestigationId(
  investigationsDirectory: string,
  id: string
): Promise<string | null> {
  const entries = await fs.readdir(investigationsDirectory, {
    withFileTypes: true
  });
  for (const entry of entries) {
    if (!entry.isFile() || entry.isSymbolicLink()) continue;
    if (investigationCandidateIdFromFileName(entry.name) === null) continue;
    const candidatePath = path.join(investigationsDirectory, entry.name);
    const markdown = await fs.readFile(candidatePath, "utf8");
    if (investigationIdFromMarkdown(markdown) === id) return candidatePath;
  }
  return null;
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
