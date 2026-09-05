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
  type InvestigationSearchOptions,
  type InvestigationIndexStageOptions,
  type InvestigationIndexSyncOptions,
  type InvestigationRelation,
  type InvestigationRelationSetOptions,
  type InvestigationReportDiscardOptions,
  type InvestigationReportCheckOptions,
  type InvestigationReportShowOptions,
  type InvestigationReportTraceOptions
} from "./types.ts";
import { normalizeInvestigationIdInput } from "./report-path.ts";
import { normalizeInvestigationRelationSummary } from "./relation-summary.ts";

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
      summary: v.optional(requiredStringSchema),
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
const investigationIndexSyncOptionsSchema = v.strictObject({
  ...locationFields,
  mode: v.optional(v.picklist(["check", "write"])),
  selectors: optionalStringArraySchema
});
const investigationIndexStageOptionsSchema = v.strictObject({
  ...locationFields,
  reportIds: requiredStringArraySchema
});
const investigationIndexQueryOptionsSchema = v.strictObject({
  direction: v.optional(
    v.picklist(
      ["predecessors", "successors", "both"],
      "must be predecessors, successors, or both"
    )
  ),
  formedAtFrom: optionalStringSchema,
  formedAtTo: optionalStringSchema,
  ...locationFields,
  limit: optionalNumberSchema,
  offset: optionalNumberSchema,
  relatedTo: optionalStringSchema,
  relationType: v.optional(
    v.picklist(
      investigationRelationTypes,
      "must be a known investigation relation type"
    )
  ),
  tags: optionalStringArraySchema
});
const investigationSearchOptionsSchema = v.strictObject({
  direction: v.optional(
    v.picklist(
      ["predecessors", "successors", "both"],
      "must be predecessors, successors, or both"
    )
  ),
  formedAtFrom: optionalStringSchema,
  formedAtTo: optionalStringSchema,
  in: v.optional(v.picklist(["content", "metadata"])),
  ...locationFields,
  limit: optionalNumberSchema,
  match: v.optional(v.picklist(["all", "any", "phrase"])),
  query: requiredStringSchema,
  relatedTo: optionalStringSchema,
  relationType: v.optional(v.picklist(investigationRelationTypes)),
  tags: optionalStringArraySchema
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
  summary: v.optional(requiredStringSchema),
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
  return parseOptions(investigationCandidateCreateOptionsSchema, input).andThen(
    normalizeCandidateCreateOptions
  );
}
export function parseInvestigationCandidateListOptions(
  input: unknown
): Result<InvestigationCandidateListOptions, string[]> {
  return parseOptions(investigationCandidateListOptionsSchema, input);
}
export function parseInvestigationCandidateShowOptions(
  input: unknown
): Result<InvestigationCandidateShowOptions, string[]> {
  return parseOptions(investigationCandidateShowOptionsSchema, input).map(
    (options) => ({ ...options, id: normalizeCompatibleId(options.id) })
  );
}
export function parseInvestigationCandidatePublishOptions(
  input: unknown
): Result<InvestigationCandidatePublishOptions, string[]> {
  return parseOptions(investigationCandidatePublishOptionsSchema, input).map(
    (options) => ({ ...options, ids: options.ids.map(normalizeCompatibleId) })
  );
}
export function parseInvestigationCandidateDiscardOptions(
  input: unknown
): Result<InvestigationCandidateDiscardOptions, string[]> {
  return parseOptions(investigationCandidateDiscardOptionsSchema, input).map(
    (options) => ({ ...options, id: normalizeCompatibleId(options.id) })
  );
}
export function parseInvestigationReportCheckOptions(
  input: unknown
): Result<InvestigationReportCheckOptions, string[]> {
  return parseOptions(investigationReportCheckOptionsSchema, input).map(
    (options) => ({
      ...options,
      ...(options.ids === undefined
        ? {}
        : { ids: options.ids.map(normalizeCompatibleId) })
    })
  );
}
export function parseInvestigationIndexSyncOptions(
  input: unknown
): Result<InvestigationIndexSyncOptions, string[]> {
  return parseOptions(investigationIndexSyncOptionsSchema, input);
}
export function parseInvestigationIndexStageOptions(
  input: unknown
): Result<InvestigationIndexStageOptions, string[]> {
  return parseOptions(investigationIndexStageOptionsSchema, input).map(
    (options) => ({
      ...options,
      reportIds: options.reportIds.map(normalizeCompatibleId)
    })
  );
}
export function parseInvestigationIndexQueryOptions(
  input: unknown
): Result<InvestigationIndexQueryOptions, string[]> {
  return parseOptions(investigationIndexQueryOptionsSchema, input);
}
export function parseInvestigationSearchOptions(
  input: unknown
): Result<InvestigationSearchOptions, string[]> {
  return parseOptions(investigationSearchOptionsSchema, input);
}
export function parseInvestigationReportShowOptions(
  input: unknown
): Result<InvestigationReportShowOptions, string[]> {
  return parseOptions(investigationReportShowOptionsSchema, input).map(
    (options) => ({ ...options, id: normalizeCompatibleId(options.id) })
  );
}
export function parseInvestigationReportTraceOptions(
  input: unknown
): Result<InvestigationReportTraceOptions, string[]> {
  return parseOptions(investigationReportTraceOptionsSchema, input).map(
    (options) => ({ ...options, id: normalizeCompatibleId(options.id) })
  );
}
export function parseInvestigationRelationSetOptions(
  input: unknown
): Result<InvestigationRelationSetOptions, string[]> {
  return parseOptions(investigationRelationSetOptionsSchema, input).andThen(
    normalizeRelationSetOptions
  );
}
export function parseInvestigationReportDiscardOptions(
  input: unknown
): Result<InvestigationReportDiscardOptions, string[]> {
  return parseOptions(investigationReportDiscardOptionsSchema, input).map(
    (options) => ({ ...options, id: normalizeCompatibleId(options.id) })
  );
}

function normalizeCompatibleId(value: string): string {
  return normalizeInvestigationIdInput(value) ?? value;
}

function normalizeRelationSetOptions(
  options: v.InferOutput<typeof investigationRelationSetOptionsSchema>
): Result<InvestigationRelationSetOptions, string[]> {
  try {
    return ok({
      ...options,
      replacements: options.replacements.map((replacement) => ({
        ...replacement,
        relations: normalizeCompatibleRelations(replacement.relations),
        source: normalizeCompatibleId(replacement.source)
      }))
    });
  } catch (error) {
    return err([
      error instanceof Error ? error.message : "invalid relation summary"
    ]);
  }
}

function normalizeCandidateCreateOptions(
  options: v.InferOutput<typeof investigationCandidateCreateOptionsSchema>
): Result<InvestigationCandidateCreateOptions, string[]> {
  try {
    return ok({
      ...options,
      id: normalizeCompatibleId(options.id),
      relations: normalizeCompatibleRelations(options.relations)
    });
  } catch (error) {
    return err([
      error instanceof Error ? error.message : "invalid relation summary"
    ]);
  }
}

function normalizeCompatibleRelations(
  relations: readonly InvestigationRelation[]
): InvestigationRelation[] {
  return relations.map((relation) => {
    const summary =
      relation.summary === undefined
        ? undefined
        : normalizeInvestigationRelationSummary(relation.summary);
    return {
      type: relation.type,
      target: normalizeCompatibleId(relation.target),
      ...(summary === null || summary === undefined ? {} : { summary })
    };
  });
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
