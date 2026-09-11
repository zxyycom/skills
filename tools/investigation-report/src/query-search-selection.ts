import { err, ok, type Result } from "neverthrow";
import { resolveInvestigationSelector } from "./investigation-selector.ts";
import type { InvestigationIndexQueryOptions } from "./types.ts";
import type { InvestigationSnapshotEntry, PreparedSearch } from "./query.ts";

export function selectSearchEntries(
  entries: readonly InvestigationSnapshotEntry[],
  prepared: PreparedSearch
): Result<InvestigationSnapshotEntry[], string[]> {
  const related = relatedInvestigationIds(entries, {
    direction: prepared.validated.direction,
    relatedTo: prepared.validated.relatedTo,
    relationType: prepared.validated.relationType
  });
  if (related.isErr()) return err(related.error);
  const ids = related.value;
  return ok(
    entries.filter(
      ({ id, state }) =>
        prepared.validated.states(state) && (ids === null || ids.has(id))
    )
  );
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
  if (query.relatedTo === undefined) return ok(null);
  const target = relatedTarget(entries, query.relatedTo);
  if (target.isErr()) return err(target.error);
  const ids = new Set<string>();
  const matches = relationTypeMatcher(query.relationType);
  addPredecessors(ids, target.value, query.direction, matches);
  addSuccessors(ids, entries, target.value.id, query.direction, matches);
  return ok(ids);
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

function addPredecessors(
  ids: Set<string>,
  target: InvestigationSnapshotEntry,
  direction: RelationQuery["direction"],
  matches: (type: InvestigationIndexQueryOptions["relationType"]) => boolean
): void {
  if (
    direction !== "predecessors" &&
    direction !== "both" &&
    direction !== undefined
  )
    return;
  for (const relation of target.state.relations)
    if (matches(relation.type)) ids.add(relation.target);
}

function addSuccessors(
  ids: Set<string>,
  entries: readonly InvestigationSnapshotEntry[],
  targetId: string,
  direction: RelationQuery["direction"],
  matches: (type: InvestigationIndexQueryOptions["relationType"]) => boolean
): void {
  if (
    direction !== "successors" &&
    direction !== "both" &&
    direction !== undefined
  )
    return;
  for (const entry of entries)
    if (
      entry.state.relations.some(
        (relation) => relation.target === targetId && matches(relation.type)
      )
    )
      ids.add(entry.id);
}
