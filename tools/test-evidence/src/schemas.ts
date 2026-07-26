import * as v from "valibot";
import {
  createStateIndexSchema,
  stateIndexSchemaVersion,
  stateIndexTextSchema
} from "../../index-runtime/src/index.ts";

export const testEvidenceDiagnosticCategories = [
  "catalog",
  "config",
  "index"
] as const;
export const testEvidenceDiagnosticSeverities = [
  "error",
  "warning"
] as const;

export const testEvidenceConfigSchemaVersion = 1 as const;
export const testEvidenceReportSchemaVersion = 1 as const;
export const testEvidenceIndexSchemaVersion = stateIndexSchemaVersion;
export const testEvidenceIndexDefinitionVersion = 1 as const;
export const testEvidenceIndexNamespace =
  "test-evidence" as const;

export const defaultTestEvidenceConfigPath =
  ".test-evidence.json";
export const defaultTestEvidenceCatalogPath =
  "docs/test-evidence/cases.md";
export const defaultTestEvidenceIndexPath =
  "docs/test-evidence/test-evidence-index.json";

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

export const testEvidenceIndexMetadataSchema = v.strictObject({});
export type TestEvidenceIndexMetadata = Record<string, never>;

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

export const testEvidenceConfigSchema = v.strictObject({
  caseIdPattern: v.optional(
    nonEmptyStringSchema,
    "^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+){2,}-\\d{3}$"
  ),
  catalogPath: v.optional(
    nonEmptyStringSchema,
    defaultTestEvidenceCatalogPath
  ),
  indexPath: v.optional(
    nonEmptyStringSchema,
    defaultTestEvidenceIndexPath
  ),
  schemaVersion: v.literal(testEvidenceConfigSchemaVersion)
});

export const testEvidenceSummarySchema = v.strictObject({
  testCases: nonNegativeIntegerSchema
});

export const testEvidenceReportSchema = v.strictObject({
  diagnostics: v.array(testEvidenceDiagnosticSchema),
  schemaVersion: v.literal(testEvidenceReportSchemaVersion),
  summary: testEvidenceSummarySchema
});

const testEvidenceCaseStateFields = {
  endLine: positiveIntegerSchema,
  entries: v.pipe(
    v.array(nonEmptyStringSchema),
    v.minLength(1, "must include at least one entry")
  ),
  id: nonEmptyStringSchema,
  line: positiveIntegerSchema,
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
  total: nonNegativeIntegerSchema
});

export const testEvidenceCaseShowResultSchema = v.strictObject({
  case: v.nullable(testEvidenceCaseStateSchema),
  catalogPath: nonEmptyStringSchema,
  diagnostics: v.array(testEvidenceDiagnosticSchema),
  indexPath: nonEmptyStringSchema,
  markdown: v.nullable(v.string()),
  schemaVersion: v.literal(testEvidenceReportSchemaVersion)
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
  status: v.picklist(["ok", "error"])
});

const testEvidenceIndexKeysSchema = v.strictObject({
  search: v.tuple([stateIndexTextSchema])
});

export const testEvidenceStateIndexSchema = createStateIndexSchema({
  definitionVersion: testEvidenceIndexDefinitionVersion,
  keys: testEvidenceIndexKeysSchema,
  keyDefinitions: v.tuple([
    v.strictObject({
      mode: v.literal("text"),
      name: v.literal("search")
    })
  ]),
  metadata: testEvidenceIndexMetadataSchema,
  namespace: testEvidenceIndexNamespace,
  sourceRevision: v.pipe(
    v.string("must be a string"),
    v.regex(
      /^sha256:[0-9a-f]{64}$/,
      "must be a sha256 test-evidence source revision"
    )
  ),
  state: testEvidenceCaseIndexStateSchema
});

export type TestEvidenceDiagnosticCategory =
  (typeof testEvidenceDiagnosticCategories)[number];
export type TestEvidenceDiagnosticSeverity =
  (typeof testEvidenceDiagnosticSeverities)[number];
export type TestEvidenceDiagnostic = v.InferOutput<
  typeof testEvidenceDiagnosticSchema
>;
export type TestEvidenceConfig = v.InferOutput<
  typeof testEvidenceConfigSchema
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
export type TestEvidenceIndexSyncResult = v.InferOutput<
  typeof testEvidenceIndexSyncResultSchema
>;
export type TestEvidenceStateIndex = v.InferOutput<
  typeof testEvidenceStateIndexSchema
>;
