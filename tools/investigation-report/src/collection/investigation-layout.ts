import path from "node:path";
import {
  forEachRecordText,
  recordReaderWorkerThreshold,
  type RecordReadResult
} from "../../../record-operations/src/reader/reader-batch.ts";
import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import { hasCandidateFormalIdentityConflict } from "../candidates/candidate-path.ts";
import {
  inspectInvestigationLayoutEntry,
  shouldReadInvestigationLayoutEntry,
  type InvestigationLayoutOptions,
  type InvestigationLayoutScan
} from "./investigation-layout-entry.ts";
import {
  compareText,
  duplicateValues,
  uniqueSorted
} from "./investigation-layout-support.ts";
import type { InvestigationSource } from "../types.ts";

export type InvestigationCollectionLayout = Readonly<{
  candidateErrors: string[];
  candidateIds: string[];
  candidateSources: InvestigationSource[];
  formalSources: InvestigationSource[];
  errors: string[];
  reportIds: string[];
}>;

export async function inspectInvestigationCollectionLayout(
  investigationsDirectory: string,
  options: InvestigationLayoutOptions = {}
): Promise<InvestigationCollectionLayout> {
  const scan: InvestigationLayoutScan = {
    candidateErrors: [],
    candidateIds: [],
    candidateSources: [],
    errors: [],
    formalSources: []
  };
  const rootEntries = await readRootEntries(investigationsDirectory);
  const sources = rootEntries.filter((entry) =>
    shouldReadInvestigationLayoutEntry(entry, options)
  );
  let acquiredSources: Map<string, RecordReadResult<string>> | undefined;
  if (sources.length >= recordReaderWorkerThreshold) {
    const results = new Map<string, RecordReadResult<string>>();
    const consume = (result: RecordReadResult<string>, index: number) => {
      results.set(sources[index]!.name, result);
    };
    if (options.preparation === undefined)
      await forEachRecordText(
        investigationsDirectory,
        sources.map((entry) => entry.name),
        consume
      );
    else
      await options.preparation.readMany(
        sources.map((entry) => path.join(investigationsDirectory, entry.name)),
        consume
      );
    acquiredSources = results;
  }
  for (const entry of rootEntries)
    await inspectInvestigationLayoutEntry(
      entry,
      investigationsDirectory,
      scan,
      options,
      acquiredSources?.get(entry.name)
    );
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
    candidateSources: readonly InvestigationSource[];
    errors: readonly string[];
    formalSources: readonly InvestigationSource[];
  }>
): InvestigationCollectionLayout {
  const reportIds = scan.formalSources.map((source) => source.id);
  const identityConflicts = hasCandidateFormalIdentityConflict(
    reportIds,
    scan.candidateIds
  );
  const duplicateErrors = [
    ...duplicateValues(reportIds),
    ...duplicateValues(scan.candidateIds)
  ].map((id) => `Investigation ID occurs in more than one source path: ${id}`);
  return {
    candidateErrors: uniqueSorted([
      ...scan.candidateErrors,
      ...identityConflicts
    ]),
    candidateIds: uniqueSorted(scan.candidateIds),
    candidateSources: [...scan.candidateSources],
    formalSources: [...scan.formalSources].sort((a, b) =>
      compareText(a.id, b.id)
    ),
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
