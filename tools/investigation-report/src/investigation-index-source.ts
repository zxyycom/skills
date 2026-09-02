import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
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
import { parseInvestigationReport } from "./markdown.ts";
import {
  investigationIndexFileName,
  isInvestigationId,
  reportPathForInvestigationId
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

const investigationSourceReadConcurrency = 32;

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
  if (layout.errors.length > 0) {
    throw new Error(layout.errors.join("; "));
  }
  return layout.reportIds;
}

export async function inspectInvestigationCollectionLayout(
  investigationsDirectory: string
): Promise<InvestigationCollectionLayout> {
  const candidateErrors: string[] = [];
  const candidateIds: string[] = [];
  const errors: string[] = [];
  const reportIds: string[] = [];
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
  const context = { candidateErrors, candidateIds, errors, reportIds };
  for (const entry of rootEntries) {
    inspectInvestigationRootEntry(entry, context);
  }
  const identityConflicts = hasCandidateFormalIdentityConflict(
    reportIds,
    candidateIds
  );
  return {
    candidateErrors: uniqueSorted([...candidateErrors, ...identityConflicts]),
    candidateIds: candidateIds.sort(compareText),
    errors: uniqueSorted([...errors, ...identityConflicts]),
    reportIds: reportIds.sort(compareText)
  };
}

type InvestigationLayoutContext = Pick<
  InvestigationCollectionLayout,
  "candidateErrors" | "candidateIds" | "errors" | "reportIds"
>;

function inspectInvestigationRootEntry(
  entry: Dirent<string>,
  context: InvestigationLayoutContext
): void {
  if (inspectReservedRootEntry(entry, context.errors)) return;
  if (entry.isSymbolicLink()) {
    const error = `${entry.name} must not be a symbolic link`;
    context.errors.push(error);
    if (isReservedInvestigationCandidateFileName(entry.name)) {
      context.candidateErrors.push(error);
    }
    return;
  }
  inspectInvestigationMarkdownEntry(entry, context);
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

function inspectInvestigationMarkdownEntry(
  entry: Dirent<string>,
  context: InvestigationLayoutContext
): void {
  if (!entry.isFile()) {
    context.errors.push(
      `${entry.name} is not allowed at the investigation root`
    );
    return;
  }
  const candidateId = investigationCandidateIdFromFileName(entry.name);
  if (candidateId !== null) {
    context.candidateIds.push(candidateId);
    return;
  }
  if (isReservedInvestigationCandidateFileName(entry.name)) {
    const error = `${entry.name} must use the reserved _candidate.<investigation-id> file name`;
    context.candidateErrors.push(error);
    context.errors.push(error);
    return;
  }
  if (!isInvestigationId(entry.name)) {
    context.errors.push(
      `${entry.name} must be a root-level Investigation ID Markdown file`
    );
    return;
  }
  context.reportIds.push(entry.name);
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
      parseInvestigationReport(source.text, source.id)
    );
    if (built.status === "invalid") {
      errors.push(...built.errors);
    } else {
      states.push(built.state);
    }
  }
  if (errors.length > 0) {
    throw new Error(uniqueSorted(errors).join("; "));
  }
  return createInvestigationStateSnapshot(sources, states);
}

export function createInvestigationStateSnapshot(
  sources: readonly InvestigationSource[],
  states: readonly InvestigationIndexState[]
): StateSnapshot<InvestigationIndexState, InvestigationIndexMetadata> {
  const prepared = prepareInvestigationSources(sources);
  const sourceIds = new Set(prepared.sources.map((source) => source.id));
  const statesById = new Map<string, InvestigationIndexState>();
  for (const [index, state] of states.entries()) {
    const id = sources[index]?.id;
    if (id === undefined) {
      throw new Error("investigation state has no matching source");
    }
    if (statesById.has(id)) {
      throw new Error(
        `investigation state ${id} has a duplicate state projection`
      );
    }
    if (!sourceIds.has(id)) {
      throw new Error(`investigation state ${id} has no matching source`);
    }
    statesById.set(id, state);
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
        source.id === right[index]?.id && source.text === right[index]?.text
    )
  );
}

export async function readInvestigationSources(
  investigationsDirectory: string,
  reportIds: readonly string[],
  signal?: AbortSignal
): Promise<InvestigationSource[]> {
  const sources: InvestigationSource[] = [];
  for (
    let offset = 0;
    offset < reportIds.length;
    offset += investigationSourceReadConcurrency
  ) {
    if (signal?.aborted === true) {
      throw new Error("investigation source read was aborted");
    }
    const batch = reportIds.slice(
      offset,
      offset + investigationSourceReadConcurrency
    );
    sources.push(
      ...(await Promise.all(
        batch.map(
          async (id) =>
            await readInvestigationSource(investigationsDirectory, id)
        )
      ))
    );
  }
  return sources;
}

async function readInvestigationCollection(
  investigationsDirectory: string,
  signal?: AbortSignal
): Promise<InvestigationSource[]> {
  const layout = await inspectInvestigationCollectionLayout(
    investigationsDirectory
  );
  if (layout.errors.length > 0) {
    throw new Error(layout.errors.join("; "));
  }
  return await readInvestigationSources(
    investigationsDirectory,
    layout.reportIds,
    signal
  );
}

async function readInvestigationSource(
  investigationsDirectory: string,
  id: string
): Promise<InvestigationSource> {
  if (!isInvestigationId(id)) {
    throw new Error(`invalid Investigation ID ${id}`);
  }
  try {
    return {
      id,
      text: await fs.readFile(
        reportPathForInvestigationId(investigationsDirectory, id),
        "utf8"
      )
    };
  } catch (error) {
    throw new Error(
      `failed to read investigation report ${id}: ${errorText(error)}`,
      { cause: error }
    );
  }
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
