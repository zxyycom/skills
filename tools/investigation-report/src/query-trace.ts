import { resolveInvestigationSelector } from "./investigation-selector.ts";
import { traceInvestigationRelations } from "./relation-validation.ts";
import { compareText, traceFailure } from "./query-results.ts";
import type { LoadedInvestigationIndex } from "./query-index.ts";
import type {
  InvestigationIndexState,
  InvestigationReportTraceOptions,
  InvestigationReportTraceResult,
  InvestigationTraceEntry
} from "./types.ts";

type InvestigationTraceIndex = Extract<
  LoadedInvestigationIndex,
  { status: "ok" }
>["value"];

export type ValidatedInvestigationTraceOptions = Readonly<{
  direction: NonNullable<InvestigationReportTraceOptions["direction"]>;
  maxDepth: number | null;
  maxRecords: number;
}>;

export function normalizeInvestigationTraceOptions(
  options: InvestigationReportTraceOptions
):
  | { errors: readonly string[] }
  | { value: ValidatedInvestigationTraceOptions } {
  const maxDepth = defaultTraceDepth(options.maxDepth);
  const maxRecords = defaultTraceRecords(options.maxRecords);
  const errors = traceLimitErrors(maxDepth, maxRecords);
  if (errors.length > 0) return { errors };
  return {
    value: { direction: options.direction ?? "both", maxDepth, maxRecords }
  };
}

export function traceLoadedInvestigation(
  index: InvestigationTraceIndex,
  indexPath: string,
  selector: string,
  options: ValidatedInvestigationTraceOptions
): InvestigationReportTraceResult {
  const resolved = resolveInvestigationSelector(
    Object.entries(index.entries).map(([id, state]) => ({
      id,
      name: state.name
    })),
    selector
  );
  if (resolved.status === "error")
    return traceFailure(selector, indexPath, resolved.errors);
  const states = new Map(Object.entries(index.entries));
  const trace = traceInvestigationRelations(states, resolved.id, options);
  return {
    status: "ok",
    anchorId: resolved.id,
    direction: options.direction,
    limits: {
      depth: options.maxDepth ?? "all",
      maxRecords: options.maxRecords
    },
    coverage: trace.coverage,
    traceIds: trace.traceIds,
    contextIds: trace.contextIds,
    frontier: trace.frontier,
    ...traceBlockedEvent(trace.blockedEvent),
    entries: traceInvestigationEntries(states, [
      ...trace.traceIds,
      ...trace.contextIds
    ])
  };
}

function defaultTraceDepth(
  maxDepth: InvestigationReportTraceOptions["maxDepth"]
): number | null {
  return maxDepth === undefined ? 5 : maxDepth;
}

function defaultTraceRecords(
  maxRecords: InvestigationReportTraceOptions["maxRecords"]
): number {
  return maxRecords ?? 50;
}

function traceLimitErrors(
  maxDepth: number | null,
  maxRecords: number
): string[] {
  return [
    ...(validTraceMaxDepth(maxDepth)
      ? []
      : ["maxDepth must be a non-negative safe integer or null"]),
    ...(validTraceMaxRecords(maxRecords)
      ? []
      : ["maxRecords must be a positive safe integer"])
  ];
}

function validTraceMaxDepth(maxDepth: number | null): boolean {
  return maxDepth === null || (Number.isSafeInteger(maxDepth) && maxDepth >= 0);
}

function validTraceMaxRecords(maxRecords: number): boolean {
  return Number.isSafeInteger(maxRecords) && maxRecords > 0;
}

function traceBlockedEvent(
  blockedEvent: ReturnType<typeof traceInvestigationRelations>["blockedEvent"]
): Partial<
  Pick<
    Extract<InvestigationReportTraceResult, { status: "ok" }>,
    "blockedEvent"
  >
> {
  if (blockedEvent === undefined) return {};
  if (blockedEvent.kind === "reallocation")
    throw new Error("Investigation traces do not define reallocation events");
  return {
    blockedEvent: {
      kind: blockedEvent.kind,
      recordIds: blockedEvent.recordIds,
      requiredMaxRecords: blockedEvent.requiredMaxRecords
    }
  };
}

function traceInvestigationEntries(
  states: ReadonlyMap<string, InvestigationIndexState>,
  ids: readonly string[]
): Record<string, InvestigationTraceEntry> {
  const entries: Record<string, InvestigationTraceEntry> = {};
  for (const id of [...ids].sort(compareText)) {
    const state = states.get(id);
    if (state === undefined) continue;
    entries[id] = {
      title: state.title,
      formedAt: state.formedAt,
      question: state.question,
      tags: [...state.tags],
      relations: state.relations.map((relation) => ({ ...relation }))
    };
  }
  return entries;
}
