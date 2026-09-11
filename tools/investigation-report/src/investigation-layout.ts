import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import { hasCandidateFormalIdentityConflict } from "./candidate-path.ts";
import { inspectInvestigationLayoutEntry } from "./investigation-layout-entry.ts";
import {
  compareText,
  duplicateValues,
  uniqueSorted
} from "./investigation-layout-support.ts";
import type { InvestigationSource } from "./types.ts";

export type InvestigationCollectionLayout = Readonly<{
  candidateErrors: string[];
  candidateIds: string[];
  errors: string[];
  reportIds: string[];
}>;

export async function inspectInvestigationCollectionLayout(
  investigationsDirectory: string
): Promise<InvestigationCollectionLayout> {
  const scan = {
    candidateErrors: [] as string[],
    candidateIds: [] as string[],
    errors: [] as string[],
    formalSources: [] as InvestigationSource[]
  };
  const rootEntries = await readRootEntries(investigationsDirectory);
  for (const entry of rootEntries)
    await inspectInvestigationLayoutEntry(entry, investigationsDirectory, scan);
  return finalizedLayout(scan);
}

async function readRootEntries(
  investigationsDirectory: string
): Promise<Dirent<string>[]> {
  try {
    const entries = await fs.readdir(investigationsDirectory, {
      withFileTypes: true
    });
    return entries.sort((left, right) => compareText(left.name, right.name));
  } catch (error) {
    throw new Error(
      `investigation root could not be read: ${errorText(error)}`,
      { cause: error }
    );
  }
}

function finalizedLayout(
  scan: Readonly<{
    candidateErrors: readonly string[];
    candidateIds: readonly string[];
    errors: readonly string[];
    formalSources: readonly InvestigationSource[];
  }>
): InvestigationCollectionLayout {
  const reportIds = scan.formalSources.map((source) => source.id);
  const identityConflicts = hasCandidateFormalIdentityConflict(
    reportIds,
    scan.candidateIds
  );
  const duplicateErrors = duplicateValues(reportIds).map(
    (id) => `Investigation ID occurs in more than one source path: ${id}`
  );
  return {
    candidateErrors: uniqueSorted([
      ...scan.candidateErrors,
      ...identityConflicts
    ]),
    candidateIds: uniqueSorted(scan.candidateIds),
    errors: uniqueSorted([
      ...scan.errors,
      ...duplicateErrors,
      ...identityConflicts
    ]),
    reportIds: uniqueSorted(reportIds)
  };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "unavailable error detail";
}
