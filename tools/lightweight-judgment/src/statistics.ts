import { openStatisticsDatabase } from "./call-database.ts";
import { callSchemaVersion } from "./call-schema.ts";
import { JudgmentFailure } from "./failure.ts";
import type { StatisticsOptions } from "./stats-options.ts";
import { selectedRows, selection } from "./statistics-data.ts";
import {
  grouped,
  summarize,
  type StatisticsSummary,
  type StatisticsGroup
} from "./statistics-summary.ts";
import { batchStatistics, type BatchStatistics } from "./statistics-batches.ts";

// Internal serialization model, not a separately versioned SDK contract.
export type StatisticsResult = Readonly<{
  database: string;
  schemaVersion: typeof callSchemaVersion;
  method: Readonly<{
    snapshot: "single-read-transaction";
    time: "UTC-started-at-[from,to)";
    quantiles: "nearest-rank-ceil(p/100*n)";
    elapsed: "client-send-through-full-response-and-validation-excluding-log-finish;not-TTFT-or-process-wall-time";
    repetitions: "retained";
    tokens: "request-level-service-reported-null-not-zero";
    cost: "service-reported-endpoint-isolated-unspecified-unit";
    batchOrder: "caller-provided-index-not-inferred-send-order-or-cold-start";
    maxRows: number;
  }>;
  filters: StatisticsOptions["filters"] &
    Readonly<{ tags: StatisticsOptions["tags"] }>;
  percentiles: readonly number[];
  groupBy: StatisticsOptions["groups"];
  summary: StatisticsSummary;
  groups: readonly StatisticsGroup[];
  batchComparison: BatchStatistics;
}>;

export function statistics(
  file: string,
  options: StatisticsOptions
): StatisticsResult {
  const database = openStatisticsDatabase(file);
  try {
    const selected = selection(options);
    const rows = selectedRows(database, selected, options.maxRows);
    return {
      database: file,
      schemaVersion: callSchemaVersion,
      method: {
        snapshot: "single-read-transaction",
        time: "UTC-started-at-[from,to)",
        quantiles: "nearest-rank-ceil(p/100*n)",
        elapsed:
          "client-send-through-full-response-and-validation-excluding-log-finish;not-TTFT-or-process-wall-time",
        repetitions: "retained",
        tokens: "request-level-service-reported-null-not-zero",
        cost: "service-reported-endpoint-isolated-unspecified-unit",
        batchOrder:
          "caller-provided-index-not-inferred-send-order-or-cold-start",
        maxRows: options.maxRows
      },
      filters: { ...options.filters, tags: options.tags },
      percentiles: [...options.percentiles],
      groupBy: [...options.groups],
      summary: summarize(rows, options),
      groups: grouped(rows, options),
      batchComparison: batchStatistics(
        database,
        rows,
        selected,
        options.percentiles
      )
    };
  } catch (error) {
    if (error instanceof JudgmentFailure) throw error;
    throw new JudgmentFailure(
      "storage",
      "无法完成只读统计；请检查数据库完整性、权限、锁占用及可用资源。未返回空集或截断结果。"
    );
  } finally {
    try {
      database.exec("ROLLBACK");
    } finally {
      database.close();
    }
  }
}
