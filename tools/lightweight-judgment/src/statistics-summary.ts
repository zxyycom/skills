import { JudgmentFailure } from "./failure.ts";
import { match, P } from "ts-pattern";
import type { StatisticsRow } from "./statistics-data.ts";
import type { CallStatus } from "./call-schema.ts";
import {
  type StatisticsOptions,
  groupFields,
  type Bucket,
  type NumericField,
  type GroupField
} from "./stats-options.ts";

export type Distribution = Readonly<{
  count: number;
  missing: number;
  sum: number | null;
  mean: number | null;
  min: number | null;
  max: number | null;
  percentiles: Readonly<Record<string, number | null>>;
}>;
type Histogram = Readonly<{
  field: NumericField;
  missing: number;
  intervals: readonly Readonly<{
    lowerInclusive: number | null;
    upperExclusive: number | null;
    count: number;
  }>[];
}>;
type EndpointCost = Readonly<{
  endpoint: string;
  unit: "service-reported-unspecified";
  distribution: Distribution;
}>;
export type StatisticsSummary = Readonly<{
  calls: number;
  statuses: Readonly<Record<CallStatus, number>>;
  errors: readonly Readonly<{ kind: string; count: number }>[];
  unfinished: number;
  metrics: Readonly<Record<NumericField, Distribution>>;
  reportedCostByEndpoint: readonly EndpointCost[];
  buckets: readonly Histogram[];
}>;
type GroupKey = Readonly<Record<string, string | null>>;
export type StatisticsGroup = Readonly<{
  key: GroupKey;
  summary: StatisticsSummary;
}>;

function add(sum: number, value: number, integer: boolean): number {
  const result = sum + value;
  if (!Number.isFinite(result) || (integer && !Number.isSafeInteger(result)))
    throw new JudgmentFailure(
      "storage",
      "统计聚合超出安全数值范围；请缩小统计窗口，未输出不精确结果。"
    );
  return result;
}
function nearestRank(percentile: number, count: number): number {
  // Use the parsed number's canonical decimal value, not a binary floating
  // product that can sit just above an exact integer rank (e.g. p7 of 100).
  const [mantissa = "", exponent = "0"] = String(percentile).split("e");
  const [whole = "", fraction = ""] = mantissa.split(".");
  const power = Number(exponent) - fraction.length;
  let numerator = BigInt(whole + fraction);
  let denominator = 100n;
  if (power >= 0) numerator *= 10n ** BigInt(power);
  else denominator *= 10n ** BigInt(-power);
  return Number((BigInt(count) * numerator + denominator - 1n) / denominator);
}
export function distribution(
  values: readonly (number | null)[],
  percentiles: readonly number[],
  integer = true
): Distribution {
  const known = values.filter((value) => value !== null).sort((a, b) => a - b);
  const sum = known.reduce((total, value) => add(total, value, integer), 0);
  const quantiles: Record<string, number | null> = Object.create(null);
  for (const percentile of percentiles)
    quantiles[String(percentile)] =
      known.length === 0
        ? null
        : (known[nearestRank(percentile, known.length) - 1] ?? null);
  return {
    count: known.length,
    missing: values.length - known.length,
    sum: known.length === 0 ? null : sum,
    mean: known.length === 0 ? null : sum / known.length,
    min: known[0] ?? null,
    max: known.at(-1) ?? null,
    percentiles: quantiles
  };
}
function histogram(rows: readonly StatisticsRow[], bucket: Bucket): Histogram {
  const counts = Array.from({ length: bucket.boundaries.length + 1 }, () => 0);
  let missing = 0;
  for (const row of rows) {
    const value = row[bucket.field];
    if (value === null) {
      missing++;
      continue;
    }
    const index = bucket.boundaries.findIndex((boundary) => value < boundary);
    const at = index === -1 ? bucket.boundaries.length : index;
    counts[at] = (counts[at] ?? 0) + 1;
  }
  return {
    field: bucket.field,
    missing,
    intervals: counts.map((count, index) => ({
      lowerInclusive:
        index === 0 ? null : (bucket.boundaries[index - 1] ?? null),
      upperExclusive: bucket.boundaries[index] ?? null,
      count
    }))
  };
}
export function summarize(
  rows: readonly StatisticsRow[],
  options: StatisticsOptions
): StatisticsSummary {
  const countStatus = (status: CallStatus) =>
    rows.filter((row) => row.status === status).length;
  const statuses: Record<CallStatus, number> = {
    started: countStatus("started"),
    response_received: countStatus("response_received"),
    succeeded: countStatus("succeeded"),
    failed: countStatus("failed"),
    indeterminate: countStatus("indeterminate")
  };
  const errors = new Map<string, number>();
  for (const row of rows) {
    if (row.errorKind !== null) {
      errors.set(row.errorKind, (errors.get(row.errorKind) ?? 0) + 1);
    }
  }
  const metric = (field: NumericField) =>
    distribution(
      rows.map((row) => row[field]),
      options.percentiles
    );
  const metrics: Record<NumericField, Distribution> = {
    elapsedMs: metric("elapsedMs"),
    inputTokens: metric("inputTokens"),
    outputTokens: metric("outputTokens"),
    requestBytes: metric("requestBytes"),
    responseBytes: metric("responseBytes"),
    questionCount: metric("questionCount")
  };
  const endpoints = [...new Set(rows.map((row) => row.endpoint))].sort();
  return {
    calls: rows.length,
    statuses,
    errors: [...errors]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([kind, count]) => ({ kind, count })),
    unfinished: rows.filter(
      (row) => row.status === "started" || row.status === "response_received"
    ).length,
    metrics,
    reportedCostByEndpoint: endpointCosts(rows, endpoints, options),
    buckets: options.buckets.map((bucket) => histogram(rows, bucket))
  };
}
function endpointCosts(
  rows: readonly StatisticsRow[],
  endpoints: readonly string[],
  options: StatisticsOptions
): readonly EndpointCost[] {
  return endpoints.map((endpoint) => ({
    endpoint,
    unit: "service-reported-unspecified",
    distribution: distribution(
      rows.filter((row) => row.endpoint === endpoint).map((row) => row.cost),
      options.percentiles,
      false
    )
  }));
}
export function grouped(
  rows: readonly StatisticsRow[],
  options: StatisticsOptions
): readonly StatisticsGroup[] {
  if (options.groups.length === 0) return [];
  const groups = new Map<string, { key: GroupKey; rows: StatisticsRow[] }>();
  for (const row of rows) {
    const key: Record<string, string | null> = Object.create(null);
    for (const field of options.groups) key[field] = groupValue(row, field);
    const encoded = JSON.stringify(key);
    const existing = groups.get(encoded);
    if (existing === undefined) groups.set(encoded, { key, rows: [row] });
    else existing.rows.push(row);
  }
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, group]) => ({
      key: group.key,
      summary: summarize(group.rows, options)
    }));
}
function groupValue(row: StatisticsRow, field: GroupField): string | null {
  return match(field)
    .with(...groupFields, (fixed) => row[fixed])
    .with(P.string.startsWith("tag:"), (tag) => row.tags[tag.slice(4)] ?? null)
    .exhaustive();
}
