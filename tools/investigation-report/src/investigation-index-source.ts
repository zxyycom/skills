import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  StateSnapshot,
  StateSourceRevision
} from "../../index-runtime/src/index.ts";
import { sanitizeInvestigationDiagnosticText } from "./diagnostics.ts";
import {
  hasCandidateFormalIdentityConflict,
  investigationCandidateIdFromFileName,
  isReservedInvestigationCandidateFileName
} from "./candidate-path.ts";
import {
  investigationIdFromMarkdown,
  parseInvestigationReport
} from "./markdown.ts";
import {
  investigationIndexFileName,
  isInvestigationSourcePath
} from "./report-path.ts";
import { buildInvestigationReportState } from "./report-validation.ts";
import { investigationResourcesDirectoryName } from "./resource-reference.ts";
import {
  investigationSourceRevision,
  prepareInvestigationSources
} from "./investigation-source-revision.ts";
import type {
  InvestigationIndexMetadata,
  InvestigationIndexState,
  InvestigationSource
} from "./types.ts";

export type InvestigationCollectionLayout = Readonly<{
  candidateErrors: string[];
  candidateIds: string[];
  errors: string[];
  reportIds: string[];
}>;

export async function discoverInvestigationReportIds(
  investigationsDirectory: string
): Promise<string[]> {
  const layout = await inspectInvestigationCollectionLayout(
    investigationsDirectory
  );
  if (layout.errors.length > 0) throw new Error(layout.errors.join("; "));
  return layout.reportIds;
}

export async function inspectInvestigationCollectionLayout(
  investigationsDirectory: string
): Promise<InvestigationCollectionLayout> {
  const candidateErrors: string[] = [];
  const candidateIds: string[] = [];
  const errors: string[] = [];
  const formalSources: InvestigationSource[] = [];
  let rootEntries: Dirent<string>[];
  try {
    rootEntries = await fs.readdir(investigationsDirectory, {
      withFileTypes: true
    });
  } catch (error) {
    throw new Error(
      `investigation root could not be read: ${errorText(error)}`,
      { cause: error }
    );
  }
  rootEntries.sort((left, right) => compareText(left.name, right.name));
  for (const entry of rootEntries) {
    await inspectInvestigationRootEntry(
      entry,
      investigationsDirectory,
      candidateIds,
      candidateErrors,
      errors,
      formalSources
    );
  }
  const reportIds = formalSources.map((source) => source.id);
  const duplicateIds = duplicateValues(reportIds);
  for (const id of duplicateIds) {
    errors.push(`Investigation ID occurs in more than one source path: ${id}`);
  }
  const identityConflicts = hasCandidateFormalIdentityConflict(
    reportIds,
    candidateIds
  );
  return {
    candidateErrors: uniqueSorted([...candidateErrors, ...identityConflicts]),
    candidateIds: uniqueSorted(candidateIds),
    errors: uniqueSorted([...errors, ...identityConflicts]),
    reportIds: uniqueSorted(reportIds)
  };
}

async function inspectInvestigationRootEntry(
  entry: Dirent<string>,
  investigationsDirectory: string,
  candidateIds: string[],
  candidateErrors: string[],
  errors: string[],
  formalSources: InvestigationSource[]
): Promise<void> {
  if (inspectReservedRootEntry(entry, errors)) return;
  if (entry.isSymbolicLink()) {
    const error = `${entry.name} must not be a symbolic link`;
    errors.push(error);
    if (isReservedInvestigationCandidateFileName(entry.name)) {
      candidateErrors.push(error);
    }
    return;
  }
  if (!entry.isFile()) {
    errors.push(`${entry.name} is not allowed at the investigation root`);
    return;
  }
  const candidateId = investigationCandidateIdFromFileName(entry.name);
  if (candidateId !== null) {
    candidateIds.push(candidateId);
    return;
  }
  if (isReservedInvestigationCandidateFileName(entry.name)) {
    const error = `${entry.name} must use the reserved _candidate.<investigation-id> file name`;
    candidateErrors.push(error);
    errors.push(error);
    return;
  }
  if (!isInvestigationSourcePath(entry.name)) {
    errors.push(
      `${entry.name} must be a root-level Investigation Markdown source path`
    );
    return;
  }
  const sourcePath = entry.name;
  try {
    const text = await fs.readFile(
      path.join(investigationsDirectory, sourcePath),
      "utf8"
    );
    const id = investigationIdFromMarkdown(text);
    if (id === null) {
      errors.push(
        `${sourcePath} must declare a valid frontmatter Investigation ID`
      );
      return;
    }
    formalSources.push({ id, sourcePath, text });
  } catch (error) {
    errors.push(`${sourcePath} could not be read: ${errorText(error)}`);
  }
}

function inspectReservedRootEntry(
  entry: Dirent<string>,
  errors: string[]
): boolean {
  if (entry.name === investigationResourcesDirectoryName) {
    if (entry.isSymbolicLink() || !entry.isDirectory()) {
      errors.push(
        `${investigationResourcesDirectoryName} must be a directory and not a symbolic link`
      );
    }
    return true;
  }
  if (entry.name === investigationIndexFileName) {
    if (entry.isSymbolicLink() || !entry.isFile()) {
      errors.push(
        `${investigationIndexFileName} must be a regular non-symbolic-link file`
      );
    }
    return true;
  }
  return false;
}

export async function readInvestigationSourceRevision(
  investigationsDirectory: string,
  signal?: AbortSignal
): Promise<StateSourceRevision> {
  return investigationSourceRevision(
    await readInvestigationCollection(investigationsDirectory, signal)
  );
}

export async function readInvestigationStateSnapshot(
  investigationsDirectory: string,
  signal?: AbortSignal
): Promise<StateSnapshot<InvestigationIndexState, InvestigationIndexMetadata>> {
  return buildInvestigationStateSnapshot(
    await readInvestigationCollection(investigationsDirectory, signal)
  );
}

export function buildInvestigationStateSnapshot(
  sources: readonly InvestigationSource[]
): StateSnapshot<InvestigationIndexState, InvestigationIndexMetadata> {
  const errors: string[] = [];
  const states: InvestigationIndexState[] = [];
  for (const source of sources) {
    const built = buildInvestigationReportState(
      source.id,
      parseInvestigationReport(source.text, source.id),
      source.sourcePath
    );
    if (built.status === "invalid") errors.push(...built.errors);
    else states.push(built.state);
  }
  if (errors.length > 0) throw new Error(uniqueSorted(errors).join("; "));
  return createInvestigationStateSnapshot(sources, states);
}

export function createInvestigationStateSnapshot(
  sources: readonly InvestigationSource[],
  states: readonly InvestigationIndexState[]
): StateSnapshot<InvestigationIndexState, InvestigationIndexMetadata> {
  const prepared = prepareInvestigationSources(sources);
  const statesById = new Map<string, InvestigationIndexState>();
  for (const [index, state] of states.entries()) {
    const source = sources[index];
    if (source === undefined)
      throw new Error("investigation state has no matching source");
    if (statesById.has(source.id)) {
      throw new Error(
        `investigation state ${source.id} has a duplicate state projection`
      );
    }
    if (state.sourcePath !== source.sourcePath) {
      throw new Error(
        `investigation state ${source.id} source path does not match its source`
      );
    }
    statesById.set(source.id, state);
  }
  if (statesById.size !== prepared.sources.length) {
    throw new Error("every investigation source must have a state projection");
  }
  return {
    metadata: prepared.metadata,
    sourceRevision: prepared.revision,
    states: Object.fromEntries(
      prepared.sources.map((source) => [source.id, statesById.get(source.id)!])
    )
  };
}

export function sameInvestigationSources(
  left: readonly InvestigationSource[],
  right: readonly InvestigationSource[]
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (source, index) =>
        source.id === right[index]?.id &&
        source.sourcePath === right[index]?.sourcePath &&
        source.text === right[index]?.text
    )
  );
}

export async function readInvestigationSources(
  investigationsDirectory: string,
  reportIds: readonly string[],
  signal?: AbortSignal
): Promise<InvestigationSource[]> {
  const requested = [...reportIds].sort(compareText);
  if (new Set(requested).size !== requested.length) {
    throw new Error("investigation sources must use unique Investigation IDs");
  }
  const sources = await formalInvestigationSources(
    investigationsDirectory,
    signal
  );
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  return requested.map((id) => {
    const source = sourceById.get(id);
    if (source === undefined)
      throw new Error(
        `Investigation ID does not resolve to a source path: ${id}`
      );
    return source;
  });
}

async function readInvestigationCollection(
  investigationsDirectory: string,
  signal?: AbortSignal
): Promise<InvestigationSource[]> {
  const layout = await inspectInvestigationCollectionLayout(
    investigationsDirectory
  );
  if (layout.errors.length > 0) throw new Error(layout.errors.join("; "));
  return await readInvestigationSources(
    investigationsDirectory,
    layout.reportIds,
    signal
  );
}

async function formalInvestigationSources(
  investigationsDirectory: string,
  signal?: AbortSignal
): Promise<InvestigationSource[]> {
  const entries = await fs.readdir(investigationsDirectory, {
    withFileTypes: true
  });
  const sources: InvestigationSource[] = [];
  for (const entry of entries.sort((left, right) =>
    compareText(left.name, right.name)
  )) {
    if (!entry.isFile() || !isInvestigationSourcePath(entry.name)) continue;
    if (signal?.aborted === true)
      throw new Error("investigation source read was aborted");
    const sourcePath = entry.name;
    const text = await fs.readFile(
      path.join(investigationsDirectory, sourcePath),
      "utf8"
    );
    const id = investigationIdFromMarkdown(text);
    if (id === null)
      throw new Error(
        `${sourcePath} must declare a valid frontmatter Investigation ID`
      );
    sources.push({ id, sourcePath, text });
  }
  if (new Set(sources.map((source) => source.id)).size !== sources.length) {
    throw new Error(
      "Investigation IDs must be unique across formal source paths"
    );
  }
  return sources;
}

function duplicateValues(values: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].filter(([, count]) => count > 1).map(([value]) => value);
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function errorText(error: unknown): string {
  return sanitizeInvestigationDiagnosticText(error);
}
