/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/query/query-trace.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/query/query-trace.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/query/query-trace.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import { resolveInvestigationSelector } from "../collection/investigation-selector.ts";
import { traceInvestigationRelations } from "../relations/relation-validation.ts";
import { compareText, traceFailure } from "./query-results.ts";
import type { InvestigationRelationContext } from "../relations/relation-context.ts";
import type {
  InvestigationIndexState,
  InvestigationReportTraceOptions,
  InvestigationReportTraceResult,
  InvestigationTraceEntry
} from "../types.ts";

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
  context: InvestigationRelationContext,
  indexPath: string,
  selector: string,
  options: ValidatedInvestigationTraceOptions
): InvestigationReportTraceResult {
  const resolved = resolveInvestigationSelector(
    context.entries.map(({ id, state }) => ({
      id,
      name: state.name
    })),
    selector
  );
  if (resolved.status === "error")
    return traceFailure(selector, indexPath, resolved.errors);
  const graphErrors = context.errors();
  if (graphErrors.length > 0)
    return traceFailure(selector, indexPath, graphErrors);
  const trace = traceInvestigationRelations(context, resolved.id, options);
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
    entries: traceInvestigationEntries(context.graph().states, [
      ...trace.traceIds,
      ...trace.contextIds
    ]),
    warnings: []
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
    if (state === undefined)
      throw new Error(`validated investigation trace member is missing: ${id}`);
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
