import type {
  DecisionTraceResult,
  TraceEvent,
  TraceEventRelation
} from "./cli-output-trace-types.ts";
import { compareTraceText } from "./cli-output-trace-types.ts";

export function eventsByOwner(
  trace: DecisionTraceResult,
  traceIds: ReadonlySet<string>,
  contextIds: ReadonlySet<string>
): ReadonlyMap<string, readonly TraceEvent[]> {
  const grouped = new Map<string, TraceEvent[]>();
  for (const event of traceEvents(trace, traceIds, contextIds)) {
    const owner = eventOwner(event, traceIds, trace.entries);
    if (owner === undefined) continue;
    const owned = grouped.get(owner) ?? [];
    grouped.set(owner, [...owned, event]);
  }
  return grouped;
}

function traceEvents(
  trace: DecisionTraceResult,
  traceIds: ReadonlySet<string>,
  contextIds: ReadonlySet<string>
): readonly TraceEvent[] {
  const relations = selectedRelations(trace, traceIds, contextIds);
  const events = [
    ...splitEvents(relations),
    ...mergeEvents(relations),
    ...reallocationEvents(relations)
  ];
  return events.sort(compareEvents);
}

function selectedRelations(
  trace: DecisionTraceResult,
  traceIds: ReadonlySet<string>,
  contextIds: ReadonlySet<string>
): readonly TraceEventRelation[] {
  const selectedIds = new Set([...traceIds, ...contextIds]);
  return Object.entries(trace.entries).flatMap(([sourceId, entry]) =>
    entry.relations
      .filter((relation) => selectedIds.has(relation.target))
      .map((relation) => ({ ...relation, sourceId }))
  );
}

function splitEvents(relations: readonly TraceEventRelation[]): TraceEvent[] {
  const targets = new Set(
    relations
      .filter((relation) => relation.type === "拆分")
      .map((relation) => relation.target)
  );
  return [...targets].sort(compareTraceText).map((target) => ({
    kind: "split",
    recordIds: eventRecordIds(
      relations.filter(
        (relation) => relation.type === "拆分" && relation.target === target
      ),
      target,
      "source"
    )
  }));
}

function mergeEvents(relations: readonly TraceEventRelation[]): TraceEvent[] {
  const sources = new Set(
    relations
      .filter((relation) => relation.type === "归并")
      .map((relation) => relation.sourceId)
  );
  return [...sources].sort(compareTraceText).map((sourceId) => ({
    kind: "merge",
    recordIds: eventRecordIds(
      relations.filter(
        (relation) => relation.type === "归并" && relation.sourceId === sourceId
      ),
      sourceId,
      "target"
    )
  }));
}

function eventRecordIds(
  relations: readonly TraceEventRelation[],
  focalId: string,
  member: "source" | "target"
): readonly string[] {
  const memberIds = relations.map((relation) =>
    member === "source" ? relation.sourceId : relation.target
  );
  return [...new Set([...memberIds, focalId])].sort(compareTraceText);
}

function reallocationEvents(
  relations: readonly TraceEventRelation[]
): TraceEvent[] {
  return reallocationComponents(relations).map((recordIds) => ({
    kind: "reallocation",
    recordIds
  }));
}

function reallocationComponents(
  relations: readonly TraceEventRelation[]
): readonly (readonly string[])[] {
  const neighbors = reallocationNeighbors(relations);
  const visited = new Set<string>();
  return [...neighbors.keys()].sort(compareTraceText).flatMap((start) => {
    if (visited.has(start)) return [];
    return [reallocationComponent(start, neighbors, visited)];
  });
}

function reallocationNeighbors(
  relations: readonly TraceEventRelation[]
): ReadonlyMap<string, ReadonlySet<string>> {
  const neighbors = new Map<string, Set<string>>();
  for (const relation of relations.filter(
    (candidate) => candidate.type === "重划"
  )) {
    addNeighbor(neighbors, relation.sourceId, relation.target);
    addNeighbor(neighbors, relation.target, relation.sourceId);
  }
  return neighbors;
}

function addNeighbor(
  neighbors: Map<string, Set<string>>,
  id: string,
  neighbor: string
): void {
  const current = neighbors.get(id) ?? new Set<string>();
  current.add(neighbor);
  neighbors.set(id, current);
}

function reallocationComponent(
  start: string,
  neighbors: ReadonlyMap<string, ReadonlySet<string>>,
  visited: Set<string>
): readonly string[] {
  const component = new Set<string>([start]);
  const queue = [start];
  visited.add(start);
  for (const id of queue) {
    for (const next of neighbors.get(id) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      component.add(next);
      queue.push(next);
    }
  }
  return [...component].sort(compareTraceText);
}

function eventOwner(
  event: TraceEvent,
  traceIds: ReadonlySet<string>,
  entries: DecisionTraceResult["entries"]
): string | undefined {
  const traceMembers = event.recordIds
    .filter((id) => traceIds.has(id))
    .sort(compareTraceText);
  if (traceMembers.length === 0) return undefined;
  const semanticOwner = eventSemanticOwner(event, entries);
  return semanticOwner !== undefined && traceIds.has(semanticOwner)
    ? semanticOwner
    : traceMembers[0];
}

function eventSemanticOwner(
  event: TraceEvent,
  entries: DecisionTraceResult["entries"]
): string | undefined {
  if (event.kind === "split") return splitTarget(event, entries);
  if (event.kind === "merge") return mergeSource(event, entries);
  return undefined;
}

function splitTarget(
  event: TraceEvent,
  entries: DecisionTraceResult["entries"]
): string | undefined {
  return event.recordIds.find((id) =>
    Object.values(entries).some((entry) =>
      entry.relations.some(
        (relation) => relation.type === "拆分" && relation.target === id
      )
    )
  );
}

function mergeSource(
  event: TraceEvent,
  entries: DecisionTraceResult["entries"]
): string | undefined {
  return event.recordIds.find((id) =>
    entries[id]?.relations.some((relation) => relation.type === "归并")
  );
}

function compareEvents(left: TraceEvent, right: TraceEvent): number {
  return left.kind === right.kind
    ? compareTraceText(
        left.recordIds.join("\u0000"),
        right.recordIds.join("\u0000")
      )
    : compareTraceText(left.kind, right.kind);
}
