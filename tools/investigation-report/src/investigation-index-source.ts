import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import type {
  StateSnapshot,
  StateSourceRevision
} from "../../index-runtime/src/index.ts";
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
  for (const entry of rootEntries) {
    if (entry.name === investigationResourcesDirectoryName) {
      if (entry.isSymbolicLink() || !entry.isDirectory()) {
        errors.push(
          `${investigationResourcesDirectoryName} must be a directory and not a symbolic link`
        );
      }
      continue;
    }
    if (entry.name === investigationIndexFileName) {
      if (entry.isSymbolicLink() || !entry.isFile()) {
        errors.push(
          `${investigationIndexFileName} must be a regular non-symbolic-link file`
        );
      }
      continue;
    }
    if (entry.isSymbolicLink()) {
      errors.push(`${entry.name} must not be a symbolic link`);
      continue;
    }
    if (!entry.isFile()) {
      errors.push(`${entry.name} is not allowed at the investigation root`);
      continue;
    }
    if (!isInvestigationId(entry.name)) {
      errors.push(
        `${entry.name} must be a root-level Investigation ID Markdown file`
      );
      continue;
    }
    reportIds.push(entry.name);
  }
  return {
    errors: uniqueSorted(errors),
    reportIds: reportIds.sort(compareText)
  };
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
  return error instanceof Error ? error.message : String(error);
}
