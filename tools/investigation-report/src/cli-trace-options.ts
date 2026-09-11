import type { ParsedCli } from "./cli-contract.ts";
import { assertSingleOptions, valueOf } from "./cli-parser.ts";

export function traceCliOptions(input: ParsedCli):
  | { error: string }
  | {
      value: Readonly<{
        direction?: "predecessors" | "successors" | "both";
        maxDepth?: number | null;
        maxRecords?: number;
      }>;
    } {
  const repeated = assertSingleOptions(input, [
    "direction",
    "depth",
    "max-records",
    "json"
  ]);
  if (repeated !== null) return { error: repeated };
  const direction = valueOf(input.values, "direction");
  if (!isTraceDirection(direction))
    return { error: "--direction must be predecessors, successors, or both" };
  const depth = valueOf(input.values, "depth");
  const maxDepth = traceDepth(depth);
  if (maxDepth === undefined && depth !== undefined)
    return { error: "--depth must be a non-negative safe integer or all" };
  const maxRecordsValue = valueOf(input.values, "max-records");
  const maxRecords = traceMaxRecords(maxRecordsValue);
  if (maxRecords === undefined && maxRecordsValue !== undefined)
    return { error: "--max-records must be a positive safe integer" };
  return {
    value: {
      ...(direction === undefined ? {} : { direction }),
      ...(depth === undefined ? {} : { maxDepth }),
      ...(maxRecordsValue === undefined ? {} : { maxRecords })
    }
  };
}

function isTraceDirection(
  direction: string | undefined
): direction is "predecessors" | "successors" | "both" | undefined {
  return (
    direction === undefined ||
    direction === "predecessors" ||
    direction === "successors" ||
    direction === "both"
  );
}

function traceDepth(value: string | undefined): number | null | undefined {
  if (value === undefined || value === "all")
    return value === "all" ? null : undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function traceMaxRecords(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}
