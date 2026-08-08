import * as v from "valibot";
import {
  createStateIndexSchema,
  createStateSourceRevisionSchema,
  stateIndexSchemaVersion,
  stateIndexTextSchema
} from "../../index-runtime/src/index.ts";
import { testEvidenceTopicIdPatternSource } from "./topic.ts";

export const testEvidenceDiagnosticCategories = [
  "catalog",
  "index"
] as const;
export const testEvidenceDiagnosticSeverities = [
  "error",
  "warning"
] as const;

export const testEvidenceReportSchemaVersion = 4 as const;
export const testEvidenceIndexSchemaVersion = stateIndexSchemaVersion;
export const testEvidenceIndexDefinitionVersion = 3 as const;
export const testEvidenceIndexNamespace =
  "test-evidence" as const;
export const testEvidenceTopicCatalogSchemaVersion = 1 as const;

export const testEvidenceCatalogPath =
  "docs/test-evidence";
export const testEvidenceIndexPath =
  "docs/test-evidence/test-evidence-index.json";
export const testEvidenceCaseIdPatternSource =
  "^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+){2,}-\\d{3}$";

const nonEmptyStringSchema = v.pipe(
  v.string("must be a string"),
  v.nonEmpty("must be a non-empty string")
);
const positiveIntegerSchema = v.pipe(
  v.number("must be a number"),
  v.integer("must be an integer"),
  v.minValue(1, "must be at least 1")
);
const nonNegativeIntegerSchema = v.pipe(
  v.number("must be a number"),
  v.integer("must be an integer"),
  v.minValue(0, "must be at least 0")
);
const testEvidenceCaseIdSchema = v.pipe(
  nonEmptyStringSchema,
  v.regex(
    new RegExp(testEvidenceCaseIdPatternSource, "u"),
    "must be a valid test evidence case id"
  )
);

const topicIdSchema = v.pipe(
  v.string("must be a string"),
  v.regex(
    new RegExp(testEvidenceTopicIdPatternSource, "u"),
    "must be a kebab-case topic id"
  )
);
const topicDescriptionSchema = v.pipe(
  v.string("must be a string"),
  v.check(
    (value) => {
      const length = Array.from(value).length;
      return length >= 4 && length <= 200;
    },
    "must contain 4 to 200 Unicode code points"
  ),
  v.regex(/^[^\r\n]*$/u, "must be a single line"),
  v.check(
    (value) => value.trim() === value,
    "must not have surrounding whitespace"
  )
);

export const testEvidenceTopicDefinitionSchema = v.strictObject({
  description: topicDescriptionSchema,
  id: topicIdSchema
});
export const testEvidenceTopicDefinitionsSchema = v.pipe(
  v.array(testEvidenceTopicDefinitionSchema),
  v.minLength(1, "must define at least one topic"),
  v.check(
    (topics) => new Set(topics.map((topic) => topic.id)).size === topics.length,
    "topic ids must be unique"
  ),
  v.check(
    (topics) => topics.every((topic, index) => (
      index === 0 || (topics[index - 1]?.id ?? "") < topic.id
    )),
    "topics must be sorted by id in ascending lexical order"
  )
);
export const testEvidenceTopicCatalogSchema = v.strictObject({
  schemaVersion: v.literal(testEvidenceTopicCatalogSchemaVersion),
  topics: testEvidenceTopicDefinitionsSchema
});

export const testEvidenceIndexMetadataSchema = v.strictObject({
  topics: testEvidenceTopicDefinitionsSchema
});

export const testEvidenceDiagnosticSchema = v.strictObject({
  blocking: v.boolean(),
  caseId: v.optional(nonEmptyStringSchema),
  category: v.picklist(testEvidenceDiagnosticCategories),
  code: nonEmptyStringSchema,
  column: v.optional(positiveIntegerSchema),
  line: v.optional(positiveIntegerSchema),
  message: nonEmptyStringSchema,
  path: v.optional(nonEmptyStringSchema),
  severity: v.picklist(testEvidenceDiagnosticSeverities)
});

export const testEvidenceSummarySchema = v.strictObject({
  testCases: nonNegativeIntegerSchema
});

export const testEvidenceReportSchema = v.strictObject({
  diagnostics: v.array(testEvidenceDiagnosticSchema),
  schemaVersion: v.literal(testEvidenceReportSchemaVersion),
  summary: testEvidenceSummarySchema,
  topics: v.array(testEvidenceTopicDefinitionSchema)
});

const testEvidenceCaseStateFields = {
  endLine: positiveIntegerSchema,
  entries: v.pipe(
    v.array(nonEmptyStringSchema),
    v.minLength(1, "must include at least one entry")
  ),
  id: testEvidenceCaseIdSchema,
  line: positiveIntegerSchema,
  sourcePath: nonEmptyStringSchema,
  summary: nonEmptyStringSchema,
  title: nonEmptyStringSchema
};

export const testEvidenceCaseStateSchema = v.strictObject(
  testEvidenceCaseStateFields
);

export const testEvidenceCaseIndexStateSchema = v.strictObject({
  ...testEvidenceCaseStateFields,
  searchText: nonEmptyStringSchema
});

export const testEvidenceQueryResultSchema = v.strictObject({
  cases: v.array(testEvidenceCaseStateSchema),
  catalogPath: nonEmptyStringSchema,
  diagnostics: v.array(testEvidenceDiagnosticSchema),
  indexPath: nonEmptyStringSchema,
  limit: positiveIntegerSchema,
  offset: nonNegativeIntegerSchema,
  schemaVersion: v.literal(testEvidenceReportSchemaVersion),
  topics: v.array(testEvidenceTopicDefinitionSchema),
  total: nonNegativeIntegerSchema
});

export const testEvidenceCaseShowResultSchema = v.strictObject({
  case: v.nullable(testEvidenceCaseStateSchema),
  catalogPath: nonEmptyStringSchema,
  diagnostics: v.array(testEvidenceDiagnosticSchema),
  indexPath: nonEmptyStringSchema,
  markdown: v.nullable(v.string()),
  schemaVersion: v.literal(testEvidenceReportSchemaVersion),
  topic: v.nullable(testEvidenceTopicDefinitionSchema)
});

export const testEvidenceTopicsResultSchema = v.strictObject({
  catalogPath: nonEmptyStringSchema,
  diagnostics: v.array(testEvidenceDiagnosticSchema),
  schemaVersion: v.literal(testEvidenceReportSchemaVersion),
  topics: v.array(testEvidenceTopicDefinitionSchema)
});

const testEvidenceIndexSyncStates = [
  "current",
  "unchanged",
  "written",
  "index-invalid",
  "index-missing",
  "index-path-invalid",
  "index-read-failed",
  "index-stale",
  "index-write-failed",
  "source-invalid"
] as const;

export const testEvidenceIndexSyncResultSchema = v.strictObject({
  catalogPath: nonEmptyStringSchema,
  changed: v.boolean(),
  diagnostics: v.array(testEvidenceDiagnosticSchema),
  indexPath: nonEmptyStringSchema,
  mode: v.picklist(["check", "write"]),
  schemaVersion: v.literal(testEvidenceReportSchemaVersion),
  state: v.picklist(testEvidenceIndexSyncStates),
  status: v.picklist(["ok", "error"]),
  topics: v.array(testEvidenceTopicDefinitionSchema)
});

const testEvidenceIndexKeysSchema = v.strictObject({
  search: v.tuple([stateIndexTextSchema]),
  topic: v.tuple([stateIndexTextSchema])
});
const testEvidenceSourceFingerprintSchema = v.pipe(
  v.string("must be a string"),
  v.regex(
    /^sha256:[0-9a-f]{64}$/u,
    "must be a sha256 test-evidence source fingerprint"
  )
);

export const testEvidenceStateIndexSchema = createStateIndexSchema({
  definitionVersion: testEvidenceIndexDefinitionVersion,
  id: testEvidenceCaseIdSchema,
  keys: testEvidenceIndexKeysSchema,
  keyDefinitions: v.tuple([
    v.strictObject({
      mode: v.literal("text"),
      name: v.literal("search")
    }),
    v.strictObject({
      mode: v.literal("exact"),
      name: v.literal("topic")
    })
  ]),
  metadata: testEvidenceIndexMetadataSchema,
  namespace: testEvidenceIndexNamespace,
  sourceRevision: createStateSourceRevisionSchema({
    fingerprint: testEvidenceSourceFingerprintSchema,
    id: testEvidenceCaseIdSchema
  }),
  state: testEvidenceCaseIndexStateSchema
});

export type TestEvidenceDiagnosticCategory =
  (typeof testEvidenceDiagnosticCategories)[number];
export type TestEvidenceDiagnosticSeverity =
  (typeof testEvidenceDiagnosticSeverities)[number];
export type TestEvidenceDiagnostic = v.InferOutput<
  typeof testEvidenceDiagnosticSchema
>;
export type TestEvidenceTopicDefinition = v.InferOutput<
  typeof testEvidenceTopicDefinitionSchema
>;
export type TestEvidenceTopicCatalog = v.InferOutput<
  typeof testEvidenceTopicCatalogSchema
>;
export type TestEvidenceIndexMetadata = v.InferOutput<
  typeof testEvidenceIndexMetadataSchema
>;
export type TestEvidenceSummary = v.InferOutput<
  typeof testEvidenceSummarySchema
>;
export type TestEvidenceReport = v.InferOutput<
  typeof testEvidenceReportSchema
>;
export type TestEvidenceCaseState = v.InferOutput<
  typeof testEvidenceCaseStateSchema
>;
export type TestEvidenceCaseIndexState = v.InferOutput<
  typeof testEvidenceCaseIndexStateSchema
>;
export type TestEvidenceQueryResult = v.InferOutput<
  typeof testEvidenceQueryResultSchema
>;
export type TestEvidenceCaseShowResult = v.InferOutput<
  typeof testEvidenceCaseShowResultSchema
>;
export type TestEvidenceTopicsResult = v.InferOutput<
  typeof testEvidenceTopicsResultSchema
>;
export type TestEvidenceIndexSyncResult = v.InferOutput<
  typeof testEvidenceIndexSyncResultSchema
>;
export type TestEvidenceStateIndex = v.InferOutput<
  typeof testEvidenceStateIndexSchema
>;
