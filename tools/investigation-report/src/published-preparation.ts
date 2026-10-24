import fs from "node:fs/promises";
import path from "node:path";
import { readRecordText } from "../../record-operations/src/source.ts";
import { isDeepStrictEqual } from "node:util";
import type {
  StateIndex,
  StateSnapshot
} from "../../index-runtime/src/index.ts";
import {
  investigationIdFromMarkdown,
  parseInvestigationReport
} from "./markdown.ts";
import { buildInvestigationReportState } from "./report-validation.ts";
import { investigationSourceRevision } from "./investigation-source-revision.ts";
import { createInvestigationRelationContext } from "./relation-context.ts";
import { validateInvestigationRelationGraph } from "./relation-validation.ts";
import {
  validateInvestigationResourceOwnership,
  validateReferencedInvestigationResources
} from "./resources.ts";
import type {
  InvestigationIndexMetadata,
  InvestigationIndexState,
  InvestigationSource
} from "./types.ts";

export type PublishedInvestigationIndex = StateIndex<
  InvestigationIndexState,
  InvestigationIndexMetadata
>;
export type PublishedInvestigationSnapshot = StateSnapshot<
  InvestigationIndexState,
  InvestigationIndexMetadata
>;

/** Published projections prove graph/owner declarations, not current unrelated sources. */
export function publishedGraphErrors(
  states: ReadonlyMap<string, InvestigationIndexState>
): string[] {
  return [
    ...validateInvestigationRelationGraph(
      createInvestigationRelationContext(states)
    ),
    ...validateInvestigationResourceOwnership(
      [...states.values()].flatMap((state) => state.resourceIds),
      new Map(
        [...states].map(([id, state]) => [id, new Set(state.resourceIds)])
      )
    )
  ];
}

/** Direct neighbours and the complete split/merge events touched by this edit. */
export function publicationDependencyIds(
  states: ReadonlyMap<string, InvestigationIndexState>,
  selected: ReadonlySet<string>
): string[] {
  const ids = new Set(selected);
  const edges = [...states].flatMap(([source, state]) =>
    state.relations.map((relation) => ({ source, ...relation }))
  );
  const direct = edges.filter(
    (edge) => selected.has(edge.source) || selected.has(edge.target)
  );
  const splitTargets = new Set(
    direct.filter((edge) => edge.type === "拆分").map((edge) => edge.target)
  );
  const mergeSources = new Set(
    direct.filter((edge) => edge.type === "归并").map((edge) => edge.source)
  );
  for (const edge of direct) {
    ids.add(edge.source);
    ids.add(edge.target);
  }
  for (const edge of edges.filter((edge) =>
    touchesPublicationEvent(edge, splitTargets, mergeSources)
  )) {
    ids.add(edge.source);
    ids.add(edge.target);
  }
  for (const id of ids) {
    for (const resource of states.get(id)?.resourceIds ?? [])
      ids.add(resource.split("/")[0]!);
  }
  return [...ids].sort();
}

/** Reads exactly the declared paths; moves and identity drift require explicit sync. */
export async function readPublishedInvestigationDependencies(
  root: string,
  index: PublishedInvestigationIndex,
  ids: readonly string[],
  acquired: readonly InvestigationSource[] = []
): Promise<InvestigationSource[]> {
  const sources: InvestigationSource[] = [];
  const acquiredById = new Map(acquired.map((source) => [source.id, source]));
  const resourceIds = new Set<string>();
  for (const id of ids) {
    if (!Object.hasOwn(index.entries, id)) continue; // selected new candidates have no formal source
    const state = index.entries[id]!;
    const target = path.join(root, state.sourcePath);
    const entry = await fs.lstat(target);
    if (!entry.isFile() || entry.isSymbolicLink())
      throw new Error(
        `${state.sourcePath} must be a regular non-symbolic-link file`
      );
    const prior = acquiredById.get(id);
    const text =
      prior?.sourcePath === state.sourcePath
        ? prior.text
        : await readRecordText(root, state.sourcePath);
    const source = { id, sourcePath: state.sourcePath, text };
    validatePublishedDependency(index, state, source);
    sources.push(source);
    for (const resource of state.resourceIds) resourceIds.add(resource);
  }
  const errors = await validateReferencedInvestigationResources(root, [
    ...resourceIds
  ]);
  if (errors.length > 0) throw new Error(errors.join("; "));
  return sources;
}

/** Replaces only observed source revisions, retaining every unselected published entry. */
export function publicationSnapshot(
  baseline: PublishedInvestigationSnapshot,
  states: ReadonlyMap<string, InvestigationIndexState>,
  sources: readonly InvestigationSource[]
): PublishedInvestigationSnapshot {
  return {
    metadata: baseline.metadata,
    sourceRevision: {
      metadata: baseline.sourceRevision.metadata,
      entries: {
        ...baseline.sourceRevision.entries,
        ...investigationSourceRevision(sources).entries
      }
    },
    states: Object.fromEntries(states)
  };
}

function validatePublishedDependency(
  index: PublishedInvestigationIndex,
  state: InvestigationIndexState,
  source: InvestigationSource
): void {
  const { id, text } = source;
  const built = buildInvestigationReportState(
    id,
    parseInvestigationReport(text, id),
    state.sourcePath
  );
  if (
    investigationIdFromMarkdown(text) !== id ||
    built.status === "invalid" ||
    !isDeepStrictEqual(built.state, state) ||
    investigationSourceRevision([source]).entries[id] !==
      index.sourceRevision.entries[id]
  )
    throw new Error(
      `${id} selected report or required dependency differs from the published index source; run check and sync-index before retrying`
    );
}

function touchesPublicationEvent(
  edge: InvestigationIndexState["relations"][number] &
    Readonly<{ source: string }>,
  splitTargets: ReadonlySet<string>,
  mergeSources: ReadonlySet<string>
): boolean {
  if (edge.type === "拆分") return splitTargets.has(edge.target);
  return edge.type === "归并" && mergeSources.has(edge.source);
}
