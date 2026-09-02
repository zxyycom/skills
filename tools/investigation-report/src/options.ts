import { err, ok, type Result } from "neverthrow";
import * as v from "valibot";
import {
  investigationRelationTypes,
  type InvestigationCandidateCreateOptions,
  type InvestigationCandidateDiscardOptions,
  type InvestigationCandidateListOptions,
  type InvestigationCandidatePublishOptions,
  type InvestigationCandidateShowOptions,
  type InvestigationIndexQueryOptions,
  type InvestigationIndexStageOptions,
  type InvestigationIndexSyncOptions,
  type InvestigationRelationSetOptions,
  type InvestigationReportDiscardOptions,
  type InvestigationReportCheckOptions,
  type InvestigationReportShowOptions,
  type InvestigationReportTraceOptions
} from "./types.ts";

const requiredStringSchema = v.string("must be a string");
const optionalStringSchema = v.optional(v.string("must be a string"));
const optionalStringArraySchema = v.optional(
  v.array(v.string("must be an array of strings"))
);
const requiredStringArraySchema = v.array(
  v.string("must be an array of strings")
);
const optionalNumberSchema = v.optional(v.number("must be a number"));

const locationFields = {
  investigationsDir: optionalStringSchema,
  workspaceRoot: requiredStringSchema
};
const investigationCandidateCreateOptionsSchema = v.strictObject({
  formedAt: requiredStringSchema,
  id: requiredStringSchema,
  ...locationFields,
  question: requiredStringSchema,
  relations: v.array(
    v.strictObject({
      target: requiredStringSchema,
      type: v.picklist(
        investigationRelationTypes,
        "must be a known investigation relation type"
      )
    })
  ),
  tags: requiredStringArraySchema,
  title: requiredStringSchema
});
const investigationCandidateListOptionsSchema = v.strictObject(locationFields);
const investigationCandidateShowOptionsSchema = v.strictObject({
  id: requiredStringSchema,
  ...locationFields
});
const investigationCandidatePublishOptionsSchema = v.strictObject({
  ids: requiredStringArraySchema,
  ...locationFields,
  preflight: v.optional(v.boolean("must be a boolean"))
});
const investigationCandidateDiscardOptionsSchema = v.strictObject({
  deleteOwnedResources: v.optional(v.boolean("must be a boolean")),
  deleteRecordedCandidate: v.optional(v.boolean("must be a boolean")),
  id: requiredStringSchema,
  ...locationFields
});
const investigationReportCheckOptionsSchema = v.strictObject({
  ids: optionalStringArraySchema,
  ...locationFields
});
const investigationIndexSyncOptionsSchema = v.strictObject(locationFields);
const investigationIndexStageOptionsSchema = v.strictObject({
  ...locationFields,
  reportIds: requiredStringArraySchema
});
const investigationIndexQueryOptionsSchema = v.strictObject({
  formedAtFrom: optionalStringSchema,
  formedAtTo: optionalStringSchema,
  ...locationFields,
  limit: optionalNumberSchema,
  offset: optionalNumberSchema,
  relationType: v.optional(
    v.picklist(
      investigationRelationTypes,
      "must be a known investigation relation type"
    )
  ),
  tags: optionalStringArraySchema,
  text: optionalStringSchema
});
const investigationReportShowOptionsSchema = v.strictObject({
  id: requiredStringSchema,
  ...locationFields
});
const investigationReportTraceOptionsSchema = v.strictObject({
  direction: v.optional(
    v.picklist(
      ["predecessors", "successors", "both"],
      "must be predecessors, successors, or both"
    )
  ),
  id: requiredStringSchema,
  ...locationFields,
  maxDepth: optionalNumberSchema
});
const relationSchema = v.strictObject({
  target: requiredStringSchema,
  type: v.picklist(
    investigationRelationTypes,
    "must be a known investigation relation type"
  )
});
const investigationRelationSetOptionsSchema = v.strictObject({
  ...locationFields,
  replacements: v.array(
    v.strictObject({
      relations: v.array(relationSchema),
      source: requiredStringSchema
    })
  )
});
const investigationReportDiscardOptionsSchema = v.strictObject({
  deleteOwnedResources: v.optional(v.boolean("must be a boolean")),
  deleteRecordedReport: v.optional(v.boolean("must be a boolean")),
  id: requiredStringSchema,
  ...locationFields
});

export function parseInvestigationCandidateCreateOptions(
  input: unknown
): Result<InvestigationCandidateCreateOptions, string[]> {
  return parseOptions(investigationCandidateCreateOptionsSchema, input);
}
export function parseInvestigationCandidateListOptions(
  input: unknown
): Result<InvestigationCandidateListOptions, string[]> {
  return parseOptions(investigationCandidateListOptionsSchema, input);
}
export function parseInvestigationCandidateShowOptions(
  input: unknown
): Result<InvestigationCandidateShowOptions, string[]> {
  return parseOptions(investigationCandidateShowOptionsSchema, input);
}
export function parseInvestigationCandidatePublishOptions(
  input: unknown
): Result<InvestigationCandidatePublishOptions, string[]> {
  return parseOptions(investigationCandidatePublishOptionsSchema, input);
}
export function parseInvestigationCandidateDiscardOptions(
  input: unknown
): Result<InvestigationCandidateDiscardOptions, string[]> {
  return parseOptions(investigationCandidateDiscardOptionsSchema, input);
}
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
export function parseInvestigationIndexStageOptions(
  input: unknown
): Result<InvestigationIndexStageOptions, string[]> {
  return parseOptions(investigationIndexStageOptionsSchema, input);
}
export function parseInvestigationIndexQueryOptions(
  input: unknown
): Result<InvestigationIndexQueryOptions, string[]> {
  return parseOptions(investigationIndexQueryOptionsSchema, input);
}
export function parseInvestigationReportShowOptions(
  input: unknown
): Result<InvestigationReportShowOptions, string[]> {
  return parseOptions(investigationReportShowOptionsSchema, input);
}
export function parseInvestigationReportTraceOptions(
  input: unknown
): Result<InvestigationReportTraceOptions, string[]> {
  return parseOptions(investigationReportTraceOptionsSchema, input);
}
export function parseInvestigationRelationSetOptions(
  input: unknown
): Result<InvestigationRelationSetOptions, string[]> {
  return parseOptions(investigationRelationSetOptionsSchema, input);
}
export function parseInvestigationReportDiscardOptions(
  input: unknown
): Result<InvestigationReportDiscardOptions, string[]> {
  return parseOptions(investigationReportDiscardOptionsSchema, input);
}

function parseOptions<Schema extends v.GenericSchema>(
  schema: Schema,
  input: unknown
): Result<v.InferOutput<Schema>, string[]> {
  const parsed = v.safeParse(schema, input);
  return parsed.success
    ? ok(parsed.output)
    : err(
        isOptionsObject(input)
          ? formatOptionIssues(parsed.issues)
          : ["options must be an object"]
      );
}

function isOptionsObject(
  input: unknown
): input is Readonly<Record<string, unknown>> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function formatOptionIssues(issues: readonly v.BaseIssue<unknown>[]): string[] {
  return uniqueSorted(
    issues.flatMap((issue) => {
      const issuePath = v.getDotPath(issue);
      if (issue.type === "strict_object" && issue.input !== undefined) {
        return [`${issuePath ?? "options"} is not a supported option`];
      }
      if (issue.type === "strict_object" && issue.input === undefined) {
        return [`${issuePath ?? "option"} is required`];
      }
      return [
        issuePath === null ? issue.message : `${issuePath} ${issue.message}`
      ];
    })
  );
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0
  );
}
