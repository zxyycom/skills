import { err, ok, type Result } from "neverthrow";
import { resolveInvestigationSelector } from "./investigation-selector.ts";
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
  entries: readonly InvestigationSnapshotEntry[],
  prepared: PreparedSearch
): Result<InvestigationSearchSelection, string[]> {
  const query = prepared.validated;
  let filters = query.filters;
  let resolvedQuery: RelationQuery = query;
  if (query.relatedTo !== undefined) {
    const target = relatedTarget(entries, query.relatedTo);
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
  const relations = filterRelationsByEntry(entries, resolvedQuery);
  if (relations.isErr()) return err(relations.error);
  return ok({
    entries: entries.filter(
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
  entries: readonly InvestigationSnapshotEntry[],
  query: RelationQuery
): Result<ReadonlySet<string> | null, string[]> {
  const relations = filterRelationsByEntry(entries, query);
  if (relations.isErr()) return err(relations.error);
  return ok(relations.value === null ? null : new Set(relations.value.keys()));
}

/** Projects every edge that made a returned record match a relation condition. */
export function filterRelationsByEntry(
  entries: readonly InvestigationSnapshotEntry[],
  query: RelationQuery
): Result<
  ReadonlyMap<string, readonly InvestigationFilterRelation[]> | null,
  string[]
> {
  if (query.relatedTo === undefined)
    return filterTypeOnlyRelations(entries, query.relationType);
  return filterRelationsForRelatedTarget(entries, query.relatedTo, query);
}

function filterTypeOnlyRelations(
  entries: readonly InvestigationSnapshotEntry[],
  relationType: InvestigationIndexQueryOptions["relationType"] | undefined
): Result<
  ReadonlyMap<string, readonly InvestigationFilterRelation[]> | null,
  string[]
> {
  if (relationType === undefined) return ok(null);
  const relations = new Map<string, InvestigationFilterRelation[]>();
  appendTypeOnlyRelations(
    entries,
    relationTypeMatcher(relationType),
    relations
  );
  return ok(normalizeRelationMap(relations));
}

function filterRelationsForRelatedTarget(
  entries: readonly InvestigationSnapshotEntry[],
  relatedTo: string,
  query: RelationQuery
): Result<
  ReadonlyMap<string, readonly InvestigationFilterRelation[]> | null,
  string[]
> {
  const target = relatedTarget(entries, relatedTo);
  if (target.isErr()) return err(target.error);
  const relations = new Map<string, InvestigationFilterRelation[]>();
  const matching = relationTypeMatcher(query.relationType);
  const direction = query.direction ?? "both";
  if (direction !== "successors")
    appendPredecessorRelations(target.value, matching, relations);
  if (direction !== "predecessors")
    appendSuccessorRelations(entries, target.value.id, matching, relations);
  return ok(normalizeRelationMap(relations));
}

function appendTypeOnlyRelations(
  entries: readonly InvestigationSnapshotEntry[],
  matching: (type: InvestigationIndexQueryOptions["relationType"]) => boolean,
  relations: Map<string, InvestigationFilterRelation[]>
): void {
  for (const entry of entries)
    for (const relation of entry.state.relations)
      if (matching(relation.type))
        addRelation(
          relations,
          entry.id,
          relationProjection(entry.id, relation)
        );
}

function appendPredecessorRelations(
  target: InvestigationSnapshotEntry,
  matching: (type: InvestigationIndexQueryOptions["relationType"]) => boolean,
  relations: Map<string, InvestigationFilterRelation[]>
): void {
  for (const relation of target.state.relations)
    if (matching(relation.type))
      addRelation(
        relations,
        relation.target,
        relationProjection(target.id, relation)
      );
}

function appendSuccessorRelations(
  entries: readonly InvestigationSnapshotEntry[],
  targetId: string,
  matching: (type: InvestigationIndexQueryOptions["relationType"]) => boolean,
  relations: Map<string, InvestigationFilterRelation[]>
): void {
  for (const entry of entries)
    for (const relation of entry.state.relations)
      if (relation.target === targetId && matching(relation.type))
        addRelation(
          relations,
          entry.id,
          relationProjection(entry.id, relation)
        );
}

function relationProjection(
  sourceId: string,
  relation: InvestigationSnapshotEntry["state"]["relations"][number]
): InvestigationFilterRelation {
  return {
    sourceId,
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

function relationTypeMatcher(
  relationType: InvestigationIndexQueryOptions["relationType"] | undefined
): (type: InvestigationIndexQueryOptions["relationType"]) => boolean {
  return (type) => relationType === undefined || type === relationType;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
