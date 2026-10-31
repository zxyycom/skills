/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/query/output/trace-output.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/query/output/trace-output.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/query/output/trace-output.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import type {
  InvestigationRelation,
  InvestigationReportTraceSuccess
} from "../../types.ts";

type TraceRelationSource = Readonly<{
  id: string;
  relation: InvestigationRelation;
}>;

type TraceReverseRelations = ReadonlyMap<
  string,
  readonly TraceRelationSource[]
>;

type TraceEventMember = Readonly<{
  contextIds: ReadonlySet<string>;
  memberId: string;
  relation: InvestigationRelation;
  relationSourceId: string;
  trace: InvestigationReportTraceSuccess;
}>;

/** Renders one already-selected Investigation trace for terminal use. */
export function renderInvestigationTrace(
  trace: InvestigationReportTraceSuccess
): string {
  const lines = [
    `TRACE anchor=[${trace.anchorId}] direction=${trace.direction} depth=${trace.limits.depth} complete=${trace.coverage.complete} records=${trace.traceIds.length + trace.contextIds.length}`,
    "  Note: only relations within this trace slice are expanded; read source reports or use --json for complete direct relations.",
    ""
  ];
  const contextIds = new Set(trace.contextIds);
  const reverse = reverseTraceRelations(trace);
  const layers = traceLayers(trace, reverse);
  for (const [depth, ids] of layers.entries()) {
    for (const id of ids) {
      const entry = trace.entries[id];
      if (entry === undefined) continue;
      lines.push(`L${depth}* [${id}] ${entry.formedAt} ${entry.title}`);
      appendTraceNode(lines, trace, id, contextIds, reverse);
    }
  }
  appendTraceBoundary(lines, trace);
  return lines.join("\n");
}

function traceLayers(
  trace: InvestigationReportTraceSuccess,
  reverse: TraceReverseRelations
): ReadonlyMap<number, readonly string[]> {
  return groupTraceIdsByDepth(trace.traceIds, traceDepths(trace, reverse));
}

function traceDepths(
  trace: InvestigationReportTraceSuccess,
  reverse: TraceReverseRelations
): ReadonlyMap<string, number> {
  const traceIds = new Set(trace.traceIds);
  const depths = new Map<string, number>([[trace.anchorId, 0]]);
  const pending = [trace.anchorId];
  for (let index = 0; index < pending.length; index += 1) {
    const id = pending[index];
    if (id === undefined) continue;
    const depth = depths.get(id);
    if (depth === undefined) continue;
    addUnseenTraceIds(
      traceNeighbours(trace, id, traceIds, reverse),
      depth,
      depths,
      pending
    );
  }
  return depths;
}

function addUnseenTraceIds(
  nextIds: readonly string[],
  depth: number,
  depths: Map<string, number>,
  pending: string[]
): void {
  for (const nextId of nextIds) {
    if (depths.has(nextId)) continue;
    depths.set(nextId, depth + 1);
    pending.push(nextId);
  }
}

function groupTraceIdsByDepth(
  traceIds: readonly string[],
  depths: ReadonlyMap<string, number>
): ReadonlyMap<number, readonly string[]> {
  const layers = new Map<number, string[]>();
  for (const id of traceIds) {
    const depth = depths.get(id) ?? 0;
    const layer = layers.get(depth);
    if (layer === undefined) layers.set(depth, [id]);
    else layer.push(id);
  }
  for (const layer of layers.values()) layer.sort(compareText);
  return new Map([...layers.entries()].sort(([left], [right]) => left - right));
}

function traceNeighbours(
  trace: InvestigationReportTraceSuccess,
  id: string,
  traceIds: ReadonlySet<string>,
  reverse: TraceReverseRelations
): readonly string[] {
  const neighbours = new Set<string>();
  if (trace.direction !== "successors")
    addPredecessorNeighbours(
      trace.entries[id]?.relations ?? [],
      traceIds,
      neighbours
    );
  if (trace.direction !== "predecessors")
    addSuccessorNeighbours(reverse, id, traceIds, neighbours);
  return [...neighbours].sort(compareText);
}

function addPredecessorNeighbours(
  relations: readonly InvestigationRelation[],
  traceIds: ReadonlySet<string>,
  neighbours: Set<string>
): void {
  for (const relation of relations) {
    if (traceIds.has(relation.target)) neighbours.add(relation.target);
  }
}

function addSuccessorNeighbours(
  reverse: TraceReverseRelations,
  id: string,
  traceIds: ReadonlySet<string>,
  neighbours: Set<string>
): void {
  for (const source of reverse.get(id) ?? []) {
    if (traceIds.has(source.id)) neighbours.add(source.id);
  }
}

function appendTraceNode(
  lines: string[],
  trace: InvestigationReportTraceSuccess,
  id: string,
  contextIds: ReadonlySet<string>,
  reverse: TraceReverseRelations
): void {
  const entry = trace.entries[id];
  if (entry === undefined) return;
  appendSplitSuccessors(lines, trace, id, contextIds, reverse);
  appendMergePredecessors(lines, trace, id, contextIds);
  appendRelations(lines, "predecessors", id, entry.relations, trace);
  appendSuccessors(lines, reverse, id);
}

function appendSplitSuccessors(
  lines: string[],
  trace: InvestigationReportTraceSuccess,
  id: string,
  contextIds: ReadonlySet<string>,
  reverse: TraceReverseRelations
): void {
  const successors = (reverse.get(id) ?? []).filter(
    ({ relation }) => relation.type === "拆分"
  );
  if (successors.length === 0) return;
  lines.push("  split-successors:");
  for (const source of successors)
    appendEventMember(lines, {
      contextIds,
      memberId: source.id,
      relation: source.relation,
      relationSourceId: source.id,
      trace
    });
}

function appendMergePredecessors(
  lines: string[],
  trace: InvestigationReportTraceSuccess,
  id: string,
  contextIds: ReadonlySet<string>
): void {
  const predecessors = (trace.entries[id]?.relations ?? []).filter(
    (relation) =>
      relation.type === "归并" && trace.entries[relation.target] !== undefined
  );
  if (predecessors.length === 0) return;
  lines.push("  merge-predecessors:");
  for (const relation of predecessors)
    appendEventMember(lines, {
      contextIds,
      memberId: relation.target,
      relation,
      relationSourceId: id,
      trace
    });
}

function appendRelations(
  lines: string[],
  label: "predecessors" | "successors",
  sourceId: string,
  relations: readonly InvestigationRelation[],
  trace: InvestigationReportTraceSuccess
): void {
  const relevant = relations.filter(
    (relation) =>
      relation.type !== "拆分" &&
      relation.type !== "归并" &&
      trace.entries[relation.target] !== undefined
  );
  if (relevant.length === 0) return;
  lines.push(`  ${label}:`);
  for (const relation of relevant)
    lines.push(
      `    ${sourceId} --${relation.type}--> ${relation.target}${relationSummary(relation)}`
    );
}

function appendSuccessors(
  lines: string[],
  reverse: TraceReverseRelations,
  id: string
): void {
  const successors = (reverse.get(id) ?? []).filter(
    ({ relation }) => relation.type !== "拆分" && relation.type !== "归并"
  );
  if (successors.length === 0) return;
  lines.push("  successors:");
  for (const source of successors)
    lines.push(
      `    ${source.id} --${source.relation.type}--> ${id}${relationSummary(source.relation)}`
    );
}

function reverseTraceRelations(
  trace: InvestigationReportTraceSuccess
): TraceReverseRelations {
  const reverse = new Map<string, TraceRelationSource[]>();
  // 固定 source 顺序后追加原 relation 顺序，使反向 bucket 保持终端输出契约。
  const entries = Object.entries(trace.entries).sort(([left], [right]) =>
    compareText(left, right)
  );
  for (const [id, entry] of entries) {
    for (const relation of entry.relations) {
      if (trace.entries[relation.target] === undefined) continue;
      const sources = reverse.get(relation.target);
      const source = { id, relation };
      if (sources === undefined) reverse.set(relation.target, [source]);
      else sources.push(source);
    }
  }
  return reverse;
}

function appendEventMember(lines: string[], member: TraceEventMember): void {
  const entry = member.trace.entries[member.memberId];
  if (entry === undefined) return;
  const state = member.contextIds.has(member.memberId)
    ? "~ context"
    : "* trace  ";
  lines.push(
    `    ${state} [${member.memberId}] ${entry.formedAt} ${entry.title}`
  );
  lines.push(
    `        ${member.relationSourceId} --${member.relation.type}--> ${member.relation.target}${relationSummary(member.relation)}`
  );
}

function appendTraceBoundary(
  lines: string[],
  trace: InvestigationReportTraceSuccess
): void {
  if (trace.coverage.complete) return;
  lines.push(
    "",
    `BOUNDARY: coverage=incomplete stoppedBy=${trace.coverage.stoppedBy.join(",")}`
  );
  for (const frontier of trace.frontier)
    lines.push(
      `  frontier from=[${frontier.fromId}] direction=${frontier.direction} reason=${frontier.reason} next=[${frontier.nextIds.join(", ")}]`
    );
  if (trace.blockedEvent !== undefined)
    lines.push(
      `  blocked-event kind=${trace.blockedEvent.kind} records=[${trace.blockedEvent.recordIds.join(", ")}] required-max-records=${trace.blockedEvent.requiredMaxRecords}`
    );
}

function relationSummary(relation: InvestigationRelation): string {
  return relation.summary === undefined
    ? " [无摘要]"
    : ` ${JSON.stringify(relation.summary)}`;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
