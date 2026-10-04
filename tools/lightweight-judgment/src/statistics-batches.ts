import type { DatabaseSync } from "node:sqlite";
import * as v from "valibot";
import { JudgmentFailure } from "./failure.ts";
import type { Selection, StatisticsRow } from "./statistics-data.ts";
import { distribution, type Distribution } from "./statistics-summary.ts";
import type { CallStatus } from "./call-schema.ts";

const count = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const contextSchema = v.strictObject({
  runId: v.string(),
  calls: count,
  distinctIndexes: count,
  firstCalls: count
});
type Context = Readonly<v.InferOutput<typeof contextSchema>>;
type FirstState =
  | "ambiguous"
  | "missing"
  | "filtered"
  | "unfinished"
  | "missing_elapsed"
  | "measured";
type Comparison = Readonly<{
  report: BatchReport;
  ambiguous: boolean;
  firstSelected: boolean;
  firstElapsed: number | null;
  laterValues: readonly (number | null)[];
  difference: number | null;
  ratio: number | null;
}>;
type Dimension = Readonly<{
  endpoint: string;
  requestModel: string;
  responseModel: string | null;
}>;
type FirstReport = Readonly<
  Dimension & { callId: string; status: CallStatus; elapsedMs: number | null }
>;
type Pair = Readonly<{ difference: number | null; ratio: number | null }>;
type BatchReport = Readonly<{
  runId: string;
  selectedCalls: number;
  totalCalls: number;
  partial: boolean;
  ambiguous: boolean;
  firstState: FirstState;
  first: FirstReport | null;
  selectedLaterCalls: number;
  laterMeasuredCalls: number;
  laterP50Ms: number | null;
  firstMinusLaterP50Ms: number | null;
  firstOverLaterP50: number | null;
  dimensions: readonly Dimension[];
}>;
type CrossRunMetrics = Readonly<{
  comparableRuns: number;
  firstElapsedMs: Distribution;
  laterElapsedMs: Distribution;
  firstMinusLaterP50Ms: Distribution;
  firstOverLaterP50: Distribution;
}>;
export type BatchStatistics = Readonly<
  CrossRunMetrics & {
    runs: number;
    unbatchedCalls: number;
    ambiguousRuns: number;
    batches: readonly BatchReport[];
  }
>;

function runCohorts(
  rows: readonly StatisticsRow[]
): ReadonlyMap<string, readonly StatisticsRow[]> {
  const runs = new Map<string, StatisticsRow[]>();
  for (const row of rows) {
    if (row.runId === null) continue;
    const run = runs.get(row.runId);
    if (run === undefined) runs.set(row.runId, [row]);
    else run.push(row);
  }
  return runs;
}
function runContexts(
  database: DatabaseSync,
  selected: Selection
): ReadonlyMap<string, Context> {
  const contexts = new Map<string, Context>();
  for (const raw of database
    .prepare(`SELECT run_id AS runId, COUNT(*) AS calls, COUNT(DISTINCT run_index) AS distinctIndexes,
    SUM(CASE WHEN run_index = 1 THEN 1 ELSE 0 END) AS firstCalls FROM calls
    WHERE run_id IN (SELECT run_id FROM calls WHERE ${selected.where}) GROUP BY run_id`)
    .iterate(...selected.parameters)) {
    const parsed = v.safeParse(contextSchema, raw);
    if (!parsed.success)
      throw new JudgmentFailure(
        "storage",
        "批次上下文存在非法元数据；请检查数据库完整性。"
      );
    contexts.set(parsed.output.runId, parsed.output);
  }
  return contexts;
}
function firstState(
  context: Context,
  first: StatisticsRow | undefined,
  ambiguous: boolean
): FirstState {
  if (ambiguous) {
    return "ambiguous";
  }
  if (context.firstCalls === 0) {
    return "missing";
  }
  if (first === undefined) {
    return "filtered";
  }
  if (first.status === "started" || first.status === "response_received") {
    return "unfinished";
  }
  if (first.elapsedMs === null) {
    return "missing_elapsed";
  }
  return "measured";
}
function endedElapsed(row: StatisticsRow): number | null {
  return row.status === "started" || row.status === "response_received"
    ? null
    : row.elapsedMs;
}
function dimensions(calls: readonly StatisticsRow[]): readonly Dimension[] {
  const result = new Map<string, Dimension>();
  for (const row of calls) {
    const dimension = {
      endpoint: row.endpoint,
      requestModel: row.requestModel,
      responseModel: row.responseModel
    };
    result.set(JSON.stringify(dimension), dimension);
  }
  return [...result]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value);
}
function pair(first: number | null, later: number | null): Pair {
  if (first === null || later === null)
    return { difference: null, ratio: null };
  return {
    difference: first - later,
    ratio: later === 0 ? null : first / later
  };
}
function firstReport(first: StatisticsRow | undefined): FirstReport | null {
  if (first === undefined) return null;
  return {
    callId: first.id,
    status: first.status,
    endpoint: first.endpoint,
    requestModel: first.requestModel,
    responseModel: first.responseModel,
    elapsedMs: first.elapsedMs
  };
}
function compareRun(
  runId: string,
  calls: readonly StatisticsRow[],
  context: Context
): Comparison {
  const ambiguous =
    context.calls !== context.distinctIndexes || context.firstCalls > 1;
  const first = calls.find((row) => row.runIndex === 1);
  const later = calls.filter(
    (row) => row.runIndex !== null && row.runIndex > 1
  );
  const state = firstState(context, first, ambiguous);
  let firstElapsed: number | null = null;
  if (state === "measured" && first !== undefined) {
    firstElapsed = first.elapsedMs;
  }
  const laterValues = later.map(endedElapsed);
  const knownLater = laterValues
    .filter((value) => value !== null)
    .sort((a, b) => a - b);
  const p50 = knownLater[Math.ceil(knownLater.length / 2) - 1] ?? null;
  const comparison = pair(firstElapsed, p50);
  const report: BatchReport = {
    runId,
    selectedCalls: calls.length,
    totalCalls: context.calls,
    partial: calls.length !== context.calls,
    ambiguous,
    firstState: state,
    first: firstReport(first),
    selectedLaterCalls: later.length,
    laterMeasuredCalls: knownLater.length,
    laterP50Ms: p50,
    firstMinusLaterP50Ms: comparison.difference,
    firstOverLaterP50: comparison.ratio,
    dimensions: dimensions(calls)
  };
  return {
    report,
    ambiguous,
    firstSelected: first !== undefined,
    firstElapsed,
    laterValues,
    ...comparison
  };
}
function comparisons(
  runs: ReadonlyMap<string, readonly StatisticsRow[]>,
  contexts: ReadonlyMap<string, Context>
): readonly Comparison[] {
  return [...runs]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([runId, calls]) => {
      const context = contexts.get(runId);
      if (context === undefined)
        throw new JudgmentFailure(
          "storage",
          "批次上下文缺失；请检查数据库完整性。"
        );
      return compareRun(runId, calls, context);
    });
}
function crossRunMetrics(
  batches: readonly Comparison[],
  percentiles: readonly number[]
): CrossRunMetrics {
  const firstValues: (number | null)[] = [];
  const laterValues: (number | null)[] = [];
  const differences: number[] = [];
  const ratios: number[] = [];
  for (const batch of batches) {
    if (batch.ambiguous) continue;
    if (batch.firstSelected) firstValues.push(batch.firstElapsed);
    for (const value of batch.laterValues) laterValues.push(value);
    if (batch.difference !== null) differences.push(batch.difference);
    if (batch.ratio !== null) ratios.push(batch.ratio);
  }
  return {
    comparableRuns: differences.length,
    firstElapsedMs: distribution(firstValues, percentiles),
    laterElapsedMs: distribution(laterValues, percentiles),
    firstMinusLaterP50Ms: distribution(differences, percentiles, false),
    firstOverLaterP50: distribution(ratios, percentiles, false)
  };
}
export function batchStatistics(
  database: DatabaseSync,
  rows: readonly StatisticsRow[],
  selected: Selection,
  version: 1 | 2,
  percentiles: readonly number[]
): BatchStatistics {
  const runs = runCohorts(rows);
  const contexts =
    version === 2 && runs.size > 0
      ? runContexts(database, selected)
      : new Map<string, Context>();
  const batches = comparisons(runs, contexts);
  return {
    runs: runs.size,
    unbatchedCalls: rows.filter((row) => row.runId === null).length,
    ambiguousRuns: batches.filter((batch) => batch.ambiguous).length,
    ...crossRunMetrics(batches, percentiles),
    batches: batches.map((batch) => batch.report)
  };
}
