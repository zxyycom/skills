import type { DecisionRecordsCliIo } from "./cli-io.ts";
import { writeCliLine } from "./cli-output-writer.ts";
import { printDecisionTextTrace } from "./cli-output-trace-text.ts";
import type { DecisionTraceResult } from "./cli-output-trace-types.ts";

/**
 * Renders the already selected Decision trace. It does not load an index or
 * invoke selection; each renderer only consumes the completed query result.
 */
export function printDecisionTrace(
  trace: DecisionTraceResult,
  json: boolean,
  io: DecisionRecordsCliIo
): void {
  if (json) {
    writeCliLine(io.stdout, JSON.stringify(jsonTrace(trace), null, 2));
    return;
  }
  printDecisionTextTrace(trace, io);
}

function jsonTrace(trace: DecisionTraceResult): object {
  return {
    status: "ok",
    anchorId: trace.anchorId,
    direction: trace.direction,
    limits: trace.limits,
    coverage: trace.coverage,
    traceIds: trace.traceIds,
    contextIds: trace.contextIds,
    frontier: trace.frontier,
    ...(trace.blockedEvent === undefined
      ? {}
      : { blockedEvent: trace.blockedEvent }),
    entries: trace.entries
  };
}
