/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/cli-output-trace-events.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/cli-output-trace-events.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/cli-output-trace-events.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import type {
  DecisionTraceResult,
  TraceEvent,
  TraceRenderRelations,
  TraceSuccessor,
  TraceEventRelation,
  OrderedEventEdge
} from "./cli-output-trace-types.ts";
import { compareTraceText } from "./cli-output-trace-types.ts";

type TraceEventMembers = Omit<TraceEvent, "relationsBySource">;

export function eventsByOwner(
  relations: TraceRenderRelations,
  traceIds: ReadonlySet<string>
): ReadonlyMap<string, readonly TraceEvent[]> {
  const grouped = new Map<string, TraceEvent[]>();
  for (const event of traceEvents(relations.selected)) {
    const owner = eventOwner(event, traceIds, relations);
    if (owner === undefined) continue;
    const owned = grouped.get(owner);
    const renderedEvent = {
      ...event,
      relationsBySource: contextEventRelations(event, relations)
    };
    if (owned === undefined) grouped.set(owner, [renderedEvent]);
    else owned.push(renderedEvent);
  }
  return grouped;
}

function traceEvents(
  relations: readonly TraceEventRelation[]
): readonly TraceEventMembers[] {
  return [
    ...groupedEvents(relations, "split"),
    ...groupedEvents(relations, "merge"),
    ...reallocationEvents(relations)
  ].sort(compareEvents);
}

/** One render-local edge pass supplies reverse lookup and historical owner facts. */
export function traceRenderRelations(
  trace: DecisionTraceResult
): TraceRenderRelations {
  const reverse = new Map<string, TraceSuccessor[]>();
  const selected: TraceEventRelation[] = [];
  const selectedIds = new Set([...trace.traceIds, ...trace.contextIds]);
  const contextIds = new Set<string>(trace.contextIds);
  const splitTargets = new Set<string>();
  const mergeSources = new Set<string>();
  const eventEdges = new Map<string, Map<string, EventTargetEdges>>();
  for (const [sourceId, entry] of Object.entries(trace.entries)) {
    for (const [order, relation] of entry.relations.entries()) {
      if (contextIds.has(sourceId))
        addContextEventEdge(eventEdges, sourceId, relation, order);
      if (relation.type === "拆分") splitTargets.add(relation.target);
      if (relation.type === "归并") mergeSources.add(sourceId);
      if (trace.entries[relation.target] === undefined) continue;
      const successors = reverse.get(relation.target);
      const successor = { relation, sourceId };
      if (successors === undefined) reverse.set(relation.target, [successor]);
      else successors.push(successor);
      if (selectedIds.has(relation.target))
        selected.push({ ...relation, sourceId });
    }
  }
  return { reverse, selected, splitTargets, mergeSources, eventEdges };
}

/** Preserve context edges even when a hand-built slice has overlapping events. */
function contextEventRelations(
  event: TraceEventMembers,
  relations: TraceRenderRelations
): TraceEvent["relationsBySource"] {
  const type =
    event.kind === "split" ? "拆分" : event.kind === "merge" ? "归并" : "重划";
  const sources = relations.eventEdges.get(type);
  const members = new Set(event.recordIds);
  const result = new Map<string, readonly TraceSuccessor["relation"][]>();
  for (const sourceId of event.recordIds) {
    const targets = sources?.get(sourceId);
    if (targets === undefined) continue;
    const selected = selectMemberEdges(targets, event.recordIds, members);
    result.set(
      sourceId,
      selected
        .sort((left, right) => left.order - right.order)
        .map(({ relation }) => relation)
    );
  }
  return result;
}

function groupedEvents(
  relations: readonly TraceEventRelation[],
  kind: "split" | "merge"
): TraceEventMembers[] {
  const groups = new Map<string, TraceEventRelation[]>();
  for (const relation of relations) {
    if (relation.type !== (kind === "split" ? "拆分" : "归并")) continue;
    const focalId = kind === "split" ? relation.target : relation.sourceId;
    const group = groups.get(focalId);
    if (group === undefined) groups.set(focalId, [relation]);
    else group.push(relation);
  }
  return [...groups]
    .sort(([left], [right]) => compareTraceText(left, right))
    .map(([focalId, edges]) => ({
      kind,
      recordIds: eventRecordIds(
        edges,
        focalId,
        kind === "split" ? "source" : "target"
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
): TraceEventMembers[] {
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
  event: TraceEventMembers,
  traceIds: ReadonlySet<string>,
  relations: TraceRenderRelations
): string | undefined {
  const traceMembers = event.recordIds
    .filter((id) => traceIds.has(id))
    .sort(compareTraceText);
  if (traceMembers.length === 0) return undefined;
  const semanticOwner = eventSemanticOwner(event, relations);
  return semanticOwner !== undefined && traceIds.has(semanticOwner)
    ? semanticOwner
    : traceMembers[0];
}

function eventSemanticOwner(
  event: TraceEventMembers,
  relations: TraceRenderRelations
): string | undefined {
  if (event.kind === "split")
    return event.recordIds.find((id) => relations.splitTargets.has(id));
  if (event.kind === "merge")
    return event.recordIds.find((id) => relations.mergeSources.has(id));
  return undefined;
}

function compareEvents(
  left: TraceEventMembers,
  right: TraceEventMembers
): number {
  return left.kind === right.kind
    ? compareTraceText(
        left.recordIds.join("\u0000"),
        right.recordIds.join("\u0000")
      )
    : compareTraceText(left.kind, right.kind);
}

type EventTargetEdges = Map<string, OrderedEventEdge[]>;

function addContextEventEdge(
  eventEdges: Map<string, Map<string, EventTargetEdges>>,
  sourceId: string,
  relation: TraceSuccessor["relation"],
  order: number
): void {
  if (
    relation.type !== "归并" &&
    relation.type !== "拆分" &&
    relation.type !== "重划"
  )
    return;
  let sources = eventEdges.get(relation.type);
  if (sources === undefined) {
    sources = new Map();
    eventEdges.set(relation.type, sources);
  }
  let targets = sources.get(sourceId);
  if (targets === undefined) {
    targets = new Map();
    sources.set(sourceId, targets);
  }
  const edges = targets.get(relation.target);
  if (edges === undefined) targets.set(relation.target, [{ relation, order }]);
  else edges.push({ relation, order });
}

function selectMemberEdges(
  targets: ReadonlyMap<string, readonly OrderedEventEdge[]>,
  recordIds: readonly string[],
  members: ReadonlySet<string>
): OrderedEventEdge[] {
  return targets.size < members.size
    ? [...targets].flatMap(([target, edges]) =>
        members.has(target) ? edges : []
      )
    : recordIds.flatMap((target) => targets.get(target) ?? []);
}
