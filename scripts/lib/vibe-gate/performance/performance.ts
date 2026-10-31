export const quickGatePerformanceBudget = Object.freeze({
  totalWallClockMs: 30_000,
  p90Ms: 10_000,
  meanMs: 5_000
});

export type GatePerformanceInput = Readonly<{
  enforceBudget: boolean;
  totalWallClockMs: number | null;
  checkDurations:
    | readonly Readonly<{
        checkId: string;
        durationMs: number | null;
      }>[]
    | null;
}>;

type GatePerformanceMetric = keyof typeof quickGatePerformanceBudget;
type GateCheckDurationIssue =
  | "check-durations-missing"
  | "check-duration-invalid";
type GatePerformanceIssue =
  | "wall-clock-missing"
  | "wall-clock-invalid"
  | GateCheckDurationIssue;

export type GatePerformanceReport = Readonly<{
  enforceBudget: boolean;
  passed: boolean;
  status: "available" | "unavailable" | "invalid";
  totalWallClockMs: number | null;
  sampleCount: number;
  meanMs: number | null;
  p90Ms: number | null;
  issues: readonly GatePerformanceIssue[];
  violations: readonly Readonly<{
    metric: GatePerformanceMetric;
    actualMs: number;
    limitMs: number;
  }>[];
}>;

type GateCheckDurationStatistics = Readonly<{
  sampleCount: number;
  meanMs: number | null;
  p90Ms: number | null;
  issue: GateCheckDurationIssue | null;
}>;

/** 原生实际执行样本的校验与统计独立于墙钟和预算策略。 */
function summarizeGateCheckDurations(
  checkDurations: GatePerformanceInput["checkDurations"]
): GateCheckDurationStatistics {
  const samples: number[] = [];
  let invalidCheckDuration = false;
  for (const { durationMs } of checkDurations ?? []) {
    // Native null means the Check never entered execution, not a zero-duration sample.
    if (durationMs === null) continue;
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      invalidCheckDuration = true;
    } else samples.push(durationMs);
  }
  const sampleCount = samples.length;
  const issue = invalidCheckDuration
    ? "check-duration-invalid"
    : sampleCount === 0
      ? "check-durations-missing"
      : null;
  if (issue !== null) {
    return { sampleCount, meanMs: null, p90Ms: null, issue };
  }
  samples.sort((left, right) => left - right);
  // Incremental mean avoids overflow when all input measurements are finite.
  const meanMs = samples.reduce(
    (mean, sample, index) => mean + (sample - mean) / (index + 1),
    0
  );
  const p90Ms = samples[Math.ceil(sampleCount * 0.9) - 1]!;
  return { sampleCount, meanMs, p90Ms, issue: null };
}

/** Evaluate this invocation's native measurements; never infer durations from receipts. */
export function evaluateGatePerformance(
  input: GatePerformanceInput
): GatePerformanceReport {
  const issues: GatePerformanceIssue[] = [];
  const wall = input.totalWallClockMs;
  const totalWallClockMs =
    wall !== null && Number.isFinite(wall) && wall >= 0 ? wall : null;
  if (wall === null) issues.push("wall-clock-missing");
  else if (totalWallClockMs === null) issues.push("wall-clock-invalid");

  const statistics = summarizeGateCheckDurations(input.checkDurations);
  if (statistics.issue !== null) issues.push(statistics.issue);
  const { sampleCount, meanMs, p90Ms } = statistics;

  const status =
    (wall !== null && totalWallClockMs === null) ||
    statistics.issue === "check-duration-invalid"
      ? "invalid"
      : issues.length > 0
        ? "unavailable"
        : "available";
  const measurements = { totalWallClockMs, p90Ms, meanMs };
  const violations: GatePerformanceReport["violations"][number][] = [];
  for (const metric of ["totalWallClockMs", "p90Ms", "meanMs"] as const) {
    const actualMs = measurements[metric];
    const limitMs = quickGatePerformanceBudget[metric];
    if (actualMs !== null && actualMs >= limitMs) {
      violations.push({ metric, actualMs, limitMs });
    }
  }
  return {
    enforceBudget: input.enforceBudget,
    passed:
      !input.enforceBudget ||
      (status === "available" && violations.length === 0),
    status,
    totalWallClockMs,
    sampleCount,
    meanMs,
    p90Ms,
    issues,
    violations
  };
}
