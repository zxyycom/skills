import { err, ok, type Result } from "neverthrow";
import * as v from "valibot";
import {
  investigationReportStatuses,
  type InvestigationIndexQueryOptions,
  type InvestigationIndexSyncOptions,
  type InvestigationReportCheckOptions
} from "./types.ts";

const requiredStringSchema = v.string("must be a string");
const optionalStringSchema = v.optional(v.string("must be a string"));
const optionalStringArraySchema = v.optional(v.array(
  v.string("must be a string"),
  "must be an array of strings"
));

const investigationReportCheckOptionsSchema = v.strictObject({
  categories: optionalStringArraySchema,
  investigationsDir: optionalStringSchema,
  paths: optionalStringArraySchema,
  workspaceRoot: requiredStringSchema
});

const investigationIndexSyncOptionsSchema = v.strictObject({
  investigationsDir: optionalStringSchema,
  workspaceRoot: requiredStringSchema
});

const investigationIndexQueryOptionsSchema = v.strictObject({
  categories: optionalStringArraySchema,
  investigationsDir: optionalStringSchema,
  latestReportAtFrom: optionalStringSchema,
  latestReportAtTo: optionalStringSchema,
  limit: v.optional(v.number("must be an integer")),
  offset: v.optional(v.number("must be a non-negative integer")),
  paths: optionalStringArraySchema,
  statuses: v.optional(v.array(
    v.picklist(
      investigationReportStatuses,
      "must be a known investigation status"
    ),
    "must be an array of investigation statuses"
  )),
  text: optionalStringSchema,
  workspaceRoot: requiredStringSchema
});

export function parseInvestigationReportCheckOptions(
  input: unknown
): Result<InvestigationReportCheckOptions, string[]> {
  return parseOptions(investigationReportCheckOptionsSchema, input);
}

export function parseInvestigationIndexSyncOptions(
  input: unknown
): Result<InvestigationIndexSyncOptions, string[]> {
  return parseOptions(investigationIndexSyncOptionsSchema, input);
}

export function parseInvestigationIndexQueryOptions(
  input: unknown
): Result<InvestigationIndexQueryOptions, string[]> {
  return parseOptions(investigationIndexQueryOptionsSchema, input);
}

function parseOptions<Schema extends v.GenericSchema>(
  schema: Schema,
  input: unknown
): Result<v.InferOutput<Schema>, string[]> {
  const parsed = v.safeParse(schema, input);
  return parsed.success
    ? ok(parsed.output)
    : err(isOptionsObject(input)
      ? formatOptionIssues(parsed.issues)
      : ["options must be an object"]);
}

function isOptionsObject(
  input: unknown
): input is Readonly<Record<string, unknown>> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function formatOptionIssues(
  issues: readonly v.BaseIssue<unknown>[]
): string[] {
  return uniqueSorted(issues.flatMap((issue) => {
    const issuePath = v.getDotPath(issue);
    if (issue.type === "strict_object" && issue.input !== undefined) {
      return [`${issuePath ?? "options"} is not a supported option`];
    }
    if (issue.type === "strict_object" && issue.input === undefined) {
      return [`${issuePath ?? "option"} is required`];
    }
    if (issue.type === "picklist" && issuePath?.startsWith("statuses.") === true) {
      const message = `unknown investigation status: ${String(issue.input)}`;
      return [`${issuePath} ${message}`];
    }
    return [issuePath === null ? issue.message : `${issuePath} ${issue.message}`];
  }));
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
