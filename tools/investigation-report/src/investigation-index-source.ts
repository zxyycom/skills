import fs from "node:fs/promises";
import path from "node:path";
import type {
  StateSnapshot,
  StateSourceRevision
} from "../../index-runtime/src/index.ts";
import {
  investigationIdFromMarkdown,
  parseInvestigationReport
} from "./markdown.ts";
import { compareText, uniqueSorted } from "./investigation-layout-support.ts";
import { isInvestigationSourcePath } from "./report-path.ts";
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
