import type { DecisionRecordsCliIo } from "./cli-io.ts";
import { writeCliLine } from "./cli-output-writer.ts";
import { eventsByOwner } from "./cli-output-trace-events.ts";
import { traceLayers } from "./cli-output-trace-layers.ts";
import type {
  DecisionTraceResult,
  TraceEvent,
  TraceRelation
} from "./cli-output-trace-types.ts";
import { compareTraceText } from "./cli-output-trace-types.ts";
import { relationSummaryText } from "./cli-output-relation-evidence.ts";

export function printDecisionTextTrace(
  trace: DecisionTraceResult,
  io: DecisionRecordsCliIo
): void {
  printHeader(trace, io);
  const traceIds = new Set(trace.traceIds);
  const contextIds = new Set(trace.contextIds);
  const context: TraceRenderContext = {
    contextIds,
    ownedEvents: eventsByOwner(trace, traceIds, contextIds),
    trace,
    traceIds
  };
  printLayers(context, io);
  printCoverageBoundary(trace, io);
}

function printHeader(
  trace: DecisionTraceResult,
  io: DecisionRecordsCliIo
): void {
  writeCliLine(
    io.stdout,
    "TRACE anchor=[" +
      trace.anchorId +
      "] direction=" +
      trace.direction +
      " depth=" +
      trace.limits.depth +
      " complete=" +
      trace.coverage.complete +
      " records=" +
      Object.keys(trace.entries).length
  );
  writeCliLine(
    io.stdout,
    "Relations below only describe edges inside this trace slice; read the source Decision Markdown or use --json for complete direct relations."
  );
}

type TraceRenderContext = Readonly<{
  contextIds: ReadonlySet<string>;
  ownedEvents: ReadonlyMap<string, readonly TraceEvent[]>;
  trace: DecisionTraceResult;
  traceIds: ReadonlySet<string>;
}>;

function printLayers(
  context: TraceRenderContext,
  io: DecisionRecordsCliIo
): void {
  for (const [layer, ids] of traceLayers(
    context.trace,
    context.traceIds
  ).entries()) {
    writeCliLine(io.stdout, "");
    ids.forEach((id) => printTraceNode(context, layer, id, io));
  }
}

function printTraceNode(
  context: TraceRenderContext,
  layer: number,
  id: string,
  io: DecisionRecordsCliIo
): void {
  const entry = context.trace.entries[id];
  if (entry === undefined) return;
  writeCliLine(
    io.stdout,
    "L" +
      layer +
      "* [" +
      id +
      "] " +
      entry.status +
      "/" +
      entry.alignment +
      " " +
      entry.title
  );
  printRelations(context, id, io);
  (context.ownedEvents.get(id) ?? []).forEach((event) =>
    printTraceEvent(context, event, io)
  );
}

function printRelations(
  context: TraceRenderContext,
  id: string,
  io: DecisionRecordsCliIo
): void {
  printPredecessors(context.trace, id, io);
  printSuccessors(context.trace, id, context.traceIds, io);
}

function printPredecessors(
  trace: DecisionTraceResult,
  id: string,
  io: DecisionRecordsCliIo
): void {
  const relations = (trace.entries[id]?.relations ?? []).filter(
    (relation) => trace.entries[relation.target] !== undefined
  );
  if (relations.length === 0) return;
  writeCliLine(io.stdout, "  predecessors:");
  relations.forEach((relation) =>
    writeCliLine(io.stdout, "    " + relationText(id, relation))
  );
}

function printSuccessors(
  trace: DecisionTraceResult,
  id: string,
  traceIds: ReadonlySet<string>,
  io: DecisionRecordsCliIo
): void {
  const successors = directSuccessors(trace, id).sort(compareSuccessors);
  if (successors.length === 0) return;
  writeCliLine(io.stdout, "  successors:");
  successors.forEach(({ relation, sourceId }) => {
    const marker = traceIds.has(sourceId) ? "*" : "~";
    writeCliLine(
      io.stdout,
      "    " + marker + " " + relationText(sourceId, relation)
    );
  });
}

type Successor = Readonly<{ relation: TraceRelation; sourceId: string }>;

function directSuccessors(trace: DecisionTraceResult, id: string): Successor[] {
  return Object.entries(trace.entries).flatMap(([sourceId, source]) =>
    source.relations
      .filter((relation) => relation.target === id)
      .map((relation) => ({ relation, sourceId }))
  );
}

function compareSuccessors(left: Successor, right: Successor): number {
  return left.sourceId === right.sourceId
    ? compareTraceText(
        relationText(left.sourceId, left.relation),
        relationText(right.sourceId, right.relation)
      )
    : compareTraceText(left.sourceId, right.sourceId);
}

function relationText(sourceId: string, relation: TraceRelation): string {
  return (
    "[" +
    sourceId +
    "] --" +
    relation.type +
    "--> [" +
    relation.target +
    "]: " +
    relationSummaryText(relation.summary)
  );
}

function printTraceEvent(
  context: TraceRenderContext,
  event: TraceEvent,
  io: DecisionRecordsCliIo
): void {
  writeCliLine(io.stdout, "  " + eventLabel(event) + ":");
  event.recordIds.forEach((id) => printEventMember(context, event, id, io));
}

function eventLabel(event: TraceEvent): string {
  return event.kind === "split"
    ? "split-successors"
    : event.kind === "merge"
      ? "merge-predecessors"
      : "reallocation";
}

function printEventMember(
  context: TraceRenderContext,
  event: TraceEvent,
  id: string,
  io: DecisionRecordsCliIo
): void {
  const entry = context.trace.entries[id];
  if (entry === undefined) return;
  const marker = context.traceIds.has(id)
    ? "*"
    : context.contextIds.has(id)
      ? "~"
      : "?";
  writeCliLine(
    io.stdout,
    "    " +
      marker +
      " [" +
      id +
      "] " +
      (marker === "*" ? "trace" : "context") +
      " " +
      entry.status +
      "/" +
      entry.alignment +
      " " +
      entry.title
  );
  printContextEventRelations(context, event, id, io);
}

function printContextEventRelations(
  context: TraceRenderContext,
  event: TraceEvent,
  id: string,
  io: DecisionRecordsCliIo
): void {
  if (!context.contextIds.has(id)) return;
  eventRelations(context.trace, event, id).forEach((relation) =>
    writeCliLine(io.stdout, "      " + relationText(id, relation))
  );
}

function eventRelations(
  trace: DecisionTraceResult,
  event: TraceEvent,
  id: string
): readonly TraceRelation[] {
  const entry = trace.entries[id];
  if (entry === undefined) return [];
  const related = new Set(event.recordIds);
  const relationType = eventRelationType(event);
  return entry.relations.filter((relation) =>
    isEventRelation(relation, relationType, related)
  );
}

function isEventRelation(
  relation: TraceRelation,
  relationType: "归并" | "拆分" | "重划",
  related: ReadonlySet<string>
): boolean {
  return relation.type === relationType && related.has(relation.target);
}

function eventRelationType(event: TraceEvent): "归并" | "拆分" | "重划" {
  return event.kind === "merge"
    ? "归并"
    : event.kind === "split"
      ? "拆分"
      : "重划";
}

function printCoverageBoundary(
  trace: DecisionTraceResult,
  io: DecisionRecordsCliIo
): void {
  if (trace.coverage.complete) return;
  writeCliLine(io.stdout, "");
  writeCliLine(
    io.stdout,
    "coverage: incomplete stoppedBy=" + trace.coverage.stoppedBy.join(",")
  );
  printFrontier(trace, io);
  printBlockedEvent(trace, io);
}

function printFrontier(
  trace: DecisionTraceResult,
  io: DecisionRecordsCliIo
): void {
  if (trace.frontier.length === 0) return;
  writeCliLine(io.stdout, "frontier:");
  trace.frontier.forEach((frontier) =>
    writeCliLine(
      io.stdout,
      "  - [" +
        frontier.fromId +
        "] direction=" +
        frontier.direction +
        " reason=" +
        frontier.reason +
        " next=[" +
        frontier.nextIds.join(", ") +
        "]"
    )
  );
}

function printBlockedEvent(
  trace: DecisionTraceResult,
  io: DecisionRecordsCliIo
): void {
  const event = trace.blockedEvent;
  if (event === undefined) return;
  writeCliLine(io.stdout, "blockedEvent:");
  writeCliLine(io.stdout, "  kind: " + event.kind);
  writeCliLine(io.stdout, "  recordIds: [" + event.recordIds.join(", ") + "]");
  writeCliLine(io.stdout, "  requiredMaxRecords: " + event.requiredMaxRecords);
}
