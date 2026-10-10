import fs from "node:fs/promises";
import path from "node:path";
import {
  hasEntry,
  type StateIndex,
  type StateSnapshot,
  type StateSourceRevision
} from "../../index-runtime/src/index.ts";
import {
  investigationIdFromMarkdown,
  parseInvestigationReport
} from "./markdown.ts";
import { compareText, uniqueSorted } from "./investigation-layout-support.ts";
import { loadInvestigationIndex } from "./investigation-state-index.ts";
import { buildInvestigationReportState } from "./report-validation.ts";
import {
  investigationSourceRevision,
  prepareInvestigationSources
} from "./investigation-source-revision.ts";
import {
  inspectInvestigationCollectionLayout,
  type InvestigationCollectionLayout
} from "./investigation-layout.ts";
import type {
  InvestigationIndexMetadata,
  InvestigationIndexState,
  InvestigationSource
} from "./types.ts";

export { inspectInvestigationCollectionLayout };
export type { InvestigationCollectionLayout };

export async function discoverInvestigationReportIds(
  investigationsDirectory: string
): Promise<string[]> {
  const layout = await inspectInvestigationCollectionLayout(
    investigationsDirectory
  );
  if (layout.errors.length > 0) throw new Error(layout.errors.join("; "));
  return layout.reportIds;
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
  signal?: AbortSignal,
  loadedIndex?: Awaited<ReturnType<typeof loadInvestigationIndex>>
): Promise<InvestigationSource[]> {
  const requested = [...reportIds].sort(compareText);
  if (new Set(requested).size !== requested.length) {
    throw new Error("investigation sources must use unique Investigation IDs");
  }
  if (requested.length === 0) return [];
  const loaded =
    loadedIndex ?? (await loadInvestigationIndex({ investigationsDirectory }));
  const sources: InvestigationSource[] = [];
  const unresolved: string[] = [];
  for (const id of requested) {
    if (signal?.aborted === true)
      throw new Error("investigation source read was aborted");
    const source = await readIndexedInvestigationSource(
      investigationsDirectory,
      id,
      loaded.status === "ok" ? loaded.value : null
    );
    if (source === null) unresolved.push(id);
    else sources.push(source);
  }
  if (unresolved.length > 0) {
    // Only unknown or moved identities need source discovery. A local check
    // does not promote unrelated layout or document findings to global proof.
    const layout = await inspectInvestigationCollectionLayout(
      investigationsDirectory
    );
    sources.push(...resolveDiscoveredSources(layout, unresolved));
  }
  return sources.sort((a, b) => compareText(a.id, b.id));
}

function resolveDiscoveredSources(
  layout: InvestigationCollectionLayout,
  ids: readonly string[]
): InvestigationSource[] {
  return ids.map((id) => {
    const matches = layout.formalSources.filter((source) => source.id === id);
    if (matches.length !== 1)
      throw new Error(
        `Investigation ID does not resolve to one source path: ${id}`
      );
    return matches[0]!;
  });
}

async function readIndexedInvestigationSource(
  investigationsDirectory: string,
  id: string,
  index: StateIndex<InvestigationIndexState, InvestigationIndexMetadata> | null
): Promise<InvestigationSource | null> {
  if (!hasEntry(index, id)) return null;
  const state = index.entries[id];
  const target = path.join(investigationsDirectory, state.sourcePath);
  try {
    const entry = await fs.lstat(target);
    if (!entry.isFile() || entry.isSymbolicLink())
      throw new Error(
        `${state.sourcePath} must be a regular non-symbolic-link file`
      );
    const text = await fs.readFile(target, "utf8");
    return investigationIdFromMarkdown(text) === id
      ? { id, sourcePath: state.sourcePath, text }
      : null;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return null;
    throw error;
  }
}

async function readInvestigationCollection(
  investigationsDirectory: string,
  signal?: AbortSignal
): Promise<InvestigationSource[]> {
  const layout = await inspectInvestigationCollectionLayout(
    investigationsDirectory
  );
  if (layout.errors.length > 0) throw new Error(layout.errors.join("; "));
  if (signal?.aborted === true)
    throw new Error("investigation source read was aborted");
  return layout.formalSources;
}
