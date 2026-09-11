import type {
  RelationGraph,
  RelationGraphTraceDirection
} from "./relations.ts";

/** The direction of one concrete relation expansion during trace selection. */
export type RelationGraphTraceExpansionDirection =
  | "predecessors"
  | "successors";

export type RelationGraphTraceSelectionOptions = {
  direction: RelationGraphTraceDirection;
  maxDepth: number | null;
  maxRecords: number;
};

export type RelationGraphTraceEventKind =
  | "ordinary"
  | "split"
  | "merge"
  | "reallocation";

/**
 * A domain-defined unit that must be admitted together when its direct
 * relation is crossed. `traceIds` are the direct traversal targets; all other
 * `recordIds` close the domain event as non-recursive context.
 */
export type RelationGraphTraceAdmissionUnit<Id extends string> = {
  kind: RelationGraphTraceEventKind;
  recordIds: readonly Id[];
  traceIds: readonly Id[];
};

export type RelationGraphTraceFrontier<Id extends string> = {
  fromId: Id;
  direction: RelationGraphTraceExpansionDirection;
  reason: "depth" | "max-records";
  nextIds: readonly Id[];
};

export type RelationGraphTraceBlockedEvent<Id extends string> = {
  kind: Exclude<RelationGraphTraceEventKind, "ordinary">;
  recordIds: readonly Id[];
  requiredMaxRecords: number;
};

export type RelationGraphTraceSelection<Id extends string> = {
  blockedEvent?: RelationGraphTraceBlockedEvent<Id>;
  contextIds: readonly Id[];
  coverage: {
    complete: boolean;
    stoppedBy: readonly ("depth" | "max-records")[];
  };
  frontier: readonly RelationGraphTraceFrontier<Id>[];
  traceIds: readonly Id[];
};

export type RelationGraphTraceAdmissionAdapter<
  Id extends string,
  Type extends string
> = (request: {
  direction: RelationGraphTraceExpansionDirection;
  fromId: Id;
  graph: RelationGraph<Id, Type>;
}) => readonly RelationGraphTraceAdmissionUnit<Id>[];
