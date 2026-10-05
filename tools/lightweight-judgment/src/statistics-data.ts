import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import * as v from "valibot";
import { JudgmentFailure } from "./failure.ts";
import { parseJson } from "./json.ts";
import {
  tagsSchema,
  runIdSchema,
  type LocalTags,
  type LocalMetadata
} from "./local-metadata.ts";
import { callStatuses } from "./call-schema.ts";
import type { StatisticsOptions } from "./stats-options.ts";

const integer = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const nullableInteger = v.nullable(integer);
const rowSchema = v.strictObject({
  id: v.string(),
  startedAt: v.string(),
  endpoint: v.string(),
  requestModel: v.string(),
  responseModel: v.nullable(v.string()),
  status: v.picklist(callStatuses),
  errorKind: v.nullable(v.string()),
  elapsedMs: nullableInteger,
  inputTokens: nullableInteger,
  outputTokens: nullableInteger,
  cost: v.nullable(v.pipe(v.number(), v.finite(), v.minValue(0))),
  questionCount: integer,
  requestBytes: nullableInteger,
  responseBytes: nullableInteger,
  runId: v.nullable(runIdSchema),
  runIndex: v.nullable(v.pipe(integer, v.minValue(1))),
  tagsJson: v.nullable(v.string())
});
export type StatisticsRow = Readonly<
  Omit<v.InferOutput<typeof rowSchema>, "tagsJson" | "runId" | "runIndex"> &
    LocalMetadata
>;
export type Selection = Readonly<{
  where: string;
  parameters: readonly SQLInputValue[];
}>;

const filterColumns = [
  { field: "endpoint", column: "endpoint", operator: "=" },
  { field: "requestModel", column: "request_model", operator: "=" },
  { field: "responseModel", column: "response_model", operator: "=" },
  { field: "status", column: "status", operator: "=" },
  { field: "runId", column: "run_id", operator: "=" },
  { field: "from", column: "started_at", operator: ">=" },
  { field: "to", column: "started_at", operator: "<" }
] as const;

export function selection(options: StatisticsOptions): Selection {
  const predicates: string[] = [];
  const parameters: SQLInputValue[] = [];
  for (const { field, column, operator } of filterColumns) {
    const value = options.filters[field];
    if (value === undefined) continue;
    predicates.push(`${column} ${operator} ?`);
    parameters.push(value);
  }
  for (const [key, value] of Object.entries(options.tags)) {
    predicates.push("json_extract(local_tags, ?) = ?");
    parameters.push(`$."${key}"`, value);
  }
  return {
    where: predicates.length === 0 ? "1" : predicates.join(" AND "),
    parameters
  };
}
function invalid(): never {
  throw new JudgmentFailure(
    "storage",
    "调用统计列存在非法值；请核对数据库完整性，stats 不跳过损坏记录。"
  );
}

function readRow(raw: unknown): StatisticsRow {
  const parsed = v.safeParse(rowSchema, raw);
  if (!parsed.success) return invalid();
  const { tagsJson, runId, runIndex, ...row } = parsed.output;
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(row.startedAt) ||
    !Number.isFinite(Date.parse(row.startedAt)) ||
    new Date(row.startedAt).toISOString() !== row.startedAt
  )
    invalid();
  const tags = decodeTags(tagsJson);
  if (runId === null && runIndex === null)
    return { ...row, runId: null, runIndex: null, tags };
  if (runId === null || runIndex === null) return invalid();
  return { ...row, runId, runIndex, tags };
}
function decodeTags(tagsJson: string | null): LocalTags {
  if (tagsJson === null) return Object.create(null);
  try {
    const parsed = v.safeParse(
      tagsSchema,
      parseJson(tagsJson, "storage", "local tags")
    );
    if (!parsed.success) return invalid();
    const tags: Record<string, string> = Object.create(null);
    for (const [key, value] of Object.entries(parsed.output)) tags[key] = value;
    return tags;
  } catch {
    return invalid();
  }
}

export function selectedRows(
  database: DatabaseSync,
  selected: Selection,
  maxRows: number
): readonly StatisticsRow[] {
  const count = database
    .prepare(`SELECT COUNT(*) AS count FROM calls WHERE ${selected.where}`)
    .get(...selected.parameters)?.count;
  if (typeof count !== "number" || !Number.isSafeInteger(count)) invalid();
  if (count > maxRows)
    throw new JudgmentFailure(
      "storage",
      "所选调用超过 --max-rows 资源预算；请缩小时间/筛选范围，或提高 --max-rows（内存随摘要行数增长）。未返回截断结果。"
    );
  const rows: StatisticsRow[] = [];
  // Only metadata is selected: request_json and response_body never cross the reader boundary.
  for (const row of database
    .prepare(`SELECT id, started_at AS startedAt, endpoint, request_model AS requestModel,
    response_model AS responseModel, status, error_kind AS errorKind, elapsed_ms AS elapsedMs,
    input_tokens AS inputTokens, output_tokens AS outputTokens, cost, question_count AS questionCount,
    run_id AS runId, run_index AS runIndex, local_tags AS tagsJson,
    request_bytes AS requestBytes, response_bytes AS responseBytes
    FROM calls WHERE ${selected.where} ORDER BY started_at, id`)
    .iterate(...selected.parameters))
    rows.push(readRow(row));
  return rows;
}
