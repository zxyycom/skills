import type { DecisionTraceSuccess } from "./decision-query-contract.ts";

export type DecisionTraceResult = Omit<DecisionTraceSuccess, "status">;
export type TraceRelation =
  DecisionTraceResult["entries"][string]["relations"][number];
export type TraceEventRelation = TraceRelation & Readonly<{ sourceId: string }>;
export type TraceEvent = Readonly<{
  kind: "merge" | "reallocation" | "split";
  recordIds: readonly string[];
  relationsBySource: ReadonlyMap<string, readonly TraceRelation[]>;
}>;

/** Stable UTF-16 code-unit order, matching trace selection ordering. */
export function compareTraceText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export type TraceSuccessor = Readonly<{
  relation: TraceRelation;
  sourceId: string;
}>;
export type OrderedEventEdge = Readonly<{
  relation: TraceRelation;
  order: number;
}>;
export type TraceRenderRelations = Readonly<{
  reverse: ReadonlyMap<string, readonly TraceSuccessor[]>;
  selected: readonly TraceEventRelation[];
  splitTargets: ReadonlySet<string>;
  mergeSources: ReadonlySet<string>;
  eventEdges: ReadonlyMap<
    string,
    ReadonlyMap<string, ReadonlyMap<string, readonly OrderedEventEdge[]>>
  >;
}>;
