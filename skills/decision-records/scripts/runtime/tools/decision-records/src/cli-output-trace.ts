/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/cli-output-trace.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/cli-output-trace.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/cli-output-trace.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
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
    source: trace.source,
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
