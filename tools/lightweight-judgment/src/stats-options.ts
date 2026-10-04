import path from "node:path";
import * as v from "valibot";
import { fail } from "./failure.ts";
import { parseTags, tagKeySchema } from "./local-metadata.ts";
import { callStatuses, type CallStatus } from "./call-schema.ts";
import type { ParsedArguments } from "./options.ts";

export const numericFields = [
  "elapsedMs",
  "inputTokens",
  "outputTokens",
  "requestBytes",
  "responseBytes",
  "questionCount"
] as const;
export type NumericField = (typeof numericFields)[number];
export const groupFields = [
  "endpoint",
  "requestModel",
  "responseModel",
  "status",
  "errorKind",
  "runId"
] as const;
export type GroupField = (typeof groupFields)[number] | `tag:${string}`;
export type Bucket = Readonly<{
  field: NumericField;
  boundaries: readonly number[];
}>;
export type StatisticsOptions = Readonly<{
  config?: string;
  database?: string;
  filters: StatisticsFilters;
  tags: Readonly<Record<string, string>>;
  groups: readonly GroupField[];
  buckets: readonly Bucket[];
  percentiles: readonly number[];
  maxRows: number;
}>;
export type StatisticsFilters = Readonly<{
  endpoint?: string;
  requestModel?: string;
  responseModel?: string;
  status?: CallStatus;
  runId?: string;
  from?: string;
  to?: string;
}>;
export const statisticsFlags = [
  "config",
  "database",
  "from",
  "to",
  "endpoint",
  "request-model",
  "response-model",
  "status",
  "run-id",
  "group-by",
  "percentiles",
  "max-rows"
] as const;

function time(value: string | undefined, flag: string): string | undefined {
  if (value === undefined) return undefined;
  const parsed = new Date(value);
  const canonical = Number.isFinite(parsed.getTime())
    ? parsed.toISOString()
    : undefined;
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value) ||
    canonical === undefined ||
    canonical !== value.replace(/Z$/u, value.includes(".") ? "Z" : ".000Z")
  )
    fail("input", flag, "需要有效 UTC ISO 时间 YYYY-MM-DDTHH:mm:ss[.sss]Z");
  return canonical;
}
function repeated(value: unknown): readonly string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string"))
    fail("input", "arguments", "需要重复字符串参数");
  return value;
}
function group(value: string): GroupField {
  const known = groupFields.find((field) => field === value);
  if (known !== undefined) return known;
  if (value.startsWith("tag:")) {
    if (!v.is(tagKeySchema, value.slice(4)))
      fail(
        "input",
        "--group-by",
        "tag:<key> 的标签键须匹配 [A-Za-z_][A-Za-z0-9_.-]{0,63}（1–64字符）"
      );
    return `tag:${value.slice(4)}`;
  }
  return fail("input", "--group-by", "未知分组字段");
}
function numbers(value: string, field: string): readonly number[] {
  const parts = value.split(",");
  if (
    parts.length > 100 ||
    parts.some(
      (item) =>
        !/^(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(item) ||
        !Number.isFinite(Number(item))
    )
  )
    fail("input", field, "需要最多100个逗号分隔非负有限数值");
  const result = parts.map(Number);
  if (
    result.some(
      (item, index) => index > 0 && item <= (result[index - 1] ?? item)
    )
  )
    fail("input", field, "数值须严格递增");
  return result;
}
function bucket(value: string): Bucket {
  const at = value.indexOf("=");
  const field = numericFields.find((item) => item === value.slice(0, at));
  if (at < 1 || field === undefined)
    fail("input", "--bucket", "需要 numericField=递增边界");
  return { field, boundaries: numbers(value.slice(at + 1), "--bucket") };
}

type StatsValues = Readonly<
  Partial<Record<(typeof statisticsFlags)[number], string>>
>;
type RawStats = Readonly<{
  values: StatsValues;
  tags: readonly string[];
  buckets: readonly string[];
}>;

function statisticsArguments(parsed: ParsedArguments): RawStats {
  const allowed = new Set<string>([...statisticsFlags, "tag", "bucket"]);
  if (Object.keys(parsed.values).some((key) => !allowed.has(key)))
    fail("input", "stats arguments", "未知参数或参数缺值");
  if (parsed.positionals.length !== 1 || parsed.positionals[0] !== "stats")
    fail("input", "stats arguments", "不接受额外位置参数");
  rejectDuplicateArguments(parsed.tokens);
  const values: Partial<Record<(typeof statisticsFlags)[number], string>> = {};
  for (const key of statisticsFlags) {
    const value = parsed.values[key];
    if (typeof value === "string") values[key] = value;
  }
  return {
    values,
    tags: repeated(parsed.values.tag),
    buckets: repeated(parsed.values.bucket)
  };
}
function rejectDuplicateArguments(
  tokens: readonly (
    | { kind: "option"; name: string }
    | { kind: "positional" | "option-terminator" }
  )[]
): void {
  const seen = new Set<string>();
  for (const token of tokens) {
    if (
      token.kind !== "option" ||
      token.name === "tag" ||
      token.name === "bucket"
    )
      continue;
    if (seen.has(token.name)) fail("input", "stats arguments", "重复参数");
    seen.add(token.name);
  }
}
function databaseSource(
  values: StatsValues,
  home: string
): { config?: string; database?: string } {
  if (values.database === undefined)
    return values.config === undefined ? {} : { config: values.config };
  if (values.config !== undefined)
    fail("input", "stats arguments", "--database 与 --config 恰选一种");
  if (values.database.length === 0) fail("input", "--database", "路径不能为空");
  return {
    database: values.database.startsWith("~/")
      ? path.resolve(home, values.database.slice(2))
      : path.resolve(values.database)
  };
}
function filters(values: StatsValues): StatisticsOptions["filters"] {
  const from = time(values.from, "--from");
  const to = time(values.to, "--to");
  if (from !== undefined && to !== undefined) {
    if (from >= to) fail("input", "--from/--to", "需要 from < to");
  }
  const status = callStatuses.find((item) => item === values.status);
  if (values.status !== undefined && status === undefined) {
    fail("input", "--status", "未知调用状态");
  }
  return {
    endpoint: values.endpoint,
    requestModel: values["request-model"],
    responseModel: values["response-model"],
    runId: values["run-id"],
    status,
    from,
    to
  };
}
function grouping(value: string | undefined): readonly GroupField[] {
  const groups = value === undefined ? [] : value.split(",").map(group);
  if (groups.length > 8 || new Set(groups).size !== groups.length)
    fail("input", "--group-by", "最多8个唯一分组字段");
  return groups;
}
function buckets(values: readonly string[]): readonly Bucket[] {
  const result = values.map(bucket);
  if (new Set(result.map((item) => item.field)).size !== result.length)
    fail("input", "--bucket", "每个数值字段只接受一组边界");
  return result;
}
function percentiles(value: string | undefined): readonly number[] {
  const result = numbers(value ?? "50,90,95,99", "--percentiles");
  if (result.some((item) => item <= 0 || item > 100))
    fail("input", "--percentiles", "分位数须 >0 且 <=100");
  return result;
}
function rowBudget(value: string | undefined): number {
  const text = value ?? "100000";
  if (!/^[1-9]\d*$/u.test(text) || !Number.isSafeInteger(Number(text)))
    fail("input", "--max-rows", "需要正安全整数");
  return Number(text);
}
export function parseStatisticsOptions(
  parsed: ParsedArguments,
  home: string
): StatisticsOptions {
  const raw = statisticsArguments(parsed);
  return {
    ...databaseSource(raw.values, home),
    filters: filters(raw.values),
    tags: parseTags(raw.tags),
    groups: grouping(raw.values["group-by"]),
    buckets: buckets(raw.buckets),
    percentiles: percentiles(raw.values.percentiles),
    maxRows: rowBudget(raw.values["max-rows"])
  };
}
