/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/query-search-selection.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/query-search-selection.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/query-search-selection.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import { err, ok, type Result } from "neverthrow";
import { resolveInvestigationSelector } from "./investigation-selector.ts";
import type {
  InvestigationRelationContext,
  InvestigationRelationGraph
} from "./relation-context.ts";
import type {
  InvestigationFilterRelation,
  InvestigationSearchFilters,
  InvestigationIndexQueryOptions
} from "./types.ts";
import type { InvestigationSnapshotEntry, PreparedSearch } from "./query.ts";

export type InvestigationSearchSelection = Readonly<{
  entries: readonly InvestigationSnapshotEntry[];
  filters: InvestigationSearchFilters;
  filterRelations: ReadonlyMap<
    string,
    readonly InvestigationFilterRelation[]
  > | null;
}>;

export function selectSearchEntries(
  context: InvestigationRelationContext,
  prepared: PreparedSearch
): Result<InvestigationSearchSelection, string[]> {
  const query = prepared.validated;
  let filters = query.filters;
  let resolvedQuery: RelationQuery = query;
  if (query.relatedTo !== undefined) {
    const target = relatedTarget(context.entries, query.relatedTo);
    if (target.isErr()) return err(target.error);
    resolvedQuery = {
      ...query,
      relatedTo: target.value.id,
      direction: query.direction ?? "both"
    };
    filters = {
      ...filters,
      relatedTo: target.value.id,
      direction: query.direction ?? "both"
    };
  }
  const relations = filterRelationsByEntry(context, resolvedQuery);
  if (relations.isErr()) return err(relations.error);
  return ok({
    entries: context.entries.filter(
      ({ id, state }) =>
        query.states(state) &&
        (relations.value === null || relations.value.has(id))
    ),
    filters,
    filterRelations: relations.value
  });
}

type RelationQuery = Readonly<{
  direction?: "predecessors" | "successors" | "both";
  relatedTo?: string;
  relationType?: InvestigationIndexQueryOptions["relationType"];
}>;

/** Computes direct neighbors from the exact snapshot used by the enclosing query. */
export function relatedInvestigationIds(
  context: InvestigationRelationContext,
  query: RelationQuery
): Result<ReadonlySet<string> | null, string[]> {
  const relations = filterRelationsByEntry(context, query);
  if (relations.isErr()) return err(relations.error);
  return ok(relations.value === null ? null : new Set(relations.value.keys()));
}

/** Projects every edge that made a returned record match a relation condition. */
export function filterRelationsByEntry(
  context: InvestigationRelationContext,
  query: RelationQuery
): Result<
  ReadonlyMap<string, readonly InvestigationFilterRelation[]> | null,
  string[]
> {
  if (query.relatedTo === undefined)
    return filterTypeOnlyRelations(context, query.relationType);
  return filterRelationsForRelatedTarget(context, query.relatedTo, query);
}

function filterTypeOnlyRelations(
  context: InvestigationRelationContext,
  relationType: InvestigationIndexQueryOptions["relationType"] | undefined
): Result<
  ReadonlyMap<string, readonly InvestigationFilterRelation[]> | null,
  string[]
> {
  if (relationType === undefined) return ok(null);
  const relations = new Map<string, InvestigationFilterRelation[]>();
  for (const [source, edges] of context.graph().edgesBySource)
    for (const edge of edges)
      if (edge.type === relationType)
        addRelation(relations, source, relationProjection(edge));
  return ok(normalizeRelationMap(relations));
}

function filterRelationsForRelatedTarget(
  context: InvestigationRelationContext,
  relatedTo: string,
  query: RelationQuery
): Result<
  ReadonlyMap<string, readonly InvestigationFilterRelation[]> | null,
  string[]
> {
  const target = relatedTarget(context.entries, relatedTo);
  if (target.isErr()) return err(target.error);
  const relations = new Map<string, InvestigationFilterRelation[]>();
  const direction = query.direction ?? "both";
  const graph = context.graph();
  if (direction !== "successors") {
    appendNeighborRelations(
      relations,
      graph.edgesBySource.get(target.value.id) ?? [],
      query.relationType,
      "predecessors"
    );
  }
  if (direction !== "predecessors") {
    appendNeighborRelations(
      relations,
      graph.edgesByTarget.get(target.value.id) ?? [],
      query.relationType,
      "successors"
    );
  }
  return ok(normalizeRelationMap(relations));
}

function appendNeighborRelations(
  relations: Map<string, InvestigationFilterRelation[]>,
  edges: InvestigationRelationGraph["edges"],
  relationType: RelationQuery["relationType"],
  direction: "predecessors" | "successors"
): void {
  for (const edge of edges) {
    if (relationType !== undefined && edge.type !== relationType) continue;
    addRelation(
      relations,
      direction === "predecessors" ? edge.target : edge.source,
      relationProjection(edge)
    );
  }
}

function relationProjection(
  relation: InvestigationRelationGraph["edges"][number]
): InvestigationFilterRelation {
  return {
    sourceId: relation.source,
    target: relation.target,
    type: relation.type,
    ...(relation.summary === undefined ? {} : { summary: relation.summary })
  };
}

function addRelation(
  relations: Map<string, InvestigationFilterRelation[]>,
  id: string,
  relation: InvestigationFilterRelation
): void {
  const current = relations.get(id) ?? [];
  if (
    !current.some(
      (item) =>
        item.sourceId === relation.sourceId &&
        item.type === relation.type &&
        item.target === relation.target
    )
  ) {
    current.push(relation);
    relations.set(id, current);
  }
}

function normalizeRelationMap(
  relations: ReadonlyMap<string, readonly InvestigationFilterRelation[]>
): ReadonlyMap<string, readonly InvestigationFilterRelation[]> {
  return new Map(
    [...relations.entries()].map(([id, values]) => [
      id,
      [...values].sort(
        (left, right) =>
          compareText(left.sourceId, right.sourceId) ||
          compareText(left.type, right.type) ||
          compareText(left.target, right.target)
      )
    ])
  );
}

function relatedTarget(
  entries: readonly InvestigationSnapshotEntry[],
  relatedTo: string
): Result<InvestigationSnapshotEntry, string[]> {
  const resolved = resolveInvestigationSelector(
    entries.map(({ id, state }) => ({ id, name: state.name })),
    relatedTo
  );
  if (resolved.status === "error") return err(resolved.errors);
  const target = entries.find((entry) => entry.id === resolved.id);
  return target === undefined
    ? err([`${relatedTo} investigation report does not exist`])
    : ok(target);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
