import * as v from "valibot";
import {
  createStateIndexSchema,
  stateIndexSchemaVersion,
  stateIndexTextSchema
} from "../../index-runtime/src/index.ts";

export const verificationKinds = ["test", "check"] as const;
export const verificationEvidenceDiagnosticCategories = [
  "catalog",
  "config",
  "index"
] as const;
export const verificationEvidenceDiagnosticSeverities = [
  "error",
  "warning"
] as const;

export const verificationEvidenceConfigSchemaVersion = 1 as const;
export const verificationEvidenceReportSchemaVersion = 1 as const;
export const verificationEvidenceIndexSchemaVersion = stateIndexSchemaVersion;
export const verificationEvidenceIndexDefinitionVersion = 1 as const;
export const verificationEvidenceIndexNamespace =
  "verification-evidence" as const;

export const defaultVerificationEvidenceConfigPath =
  ".verification-evidence.json";
export const defaultVerificationEvidenceCatalogPath =
  "docs/verification/cases.md";
export const defaultVerificationEvidenceIndexPath =
  "docs/verification/verification-evidence-index.json";

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

export const verificationEvidenceIndexMetadataSchema = v.strictObject({});
export type VerificationEvidenceIndexMetadata = Record<string, never>;

export const verificationEvidenceDiagnosticSchema = v.strictObject({
  blocking: v.boolean(),
  caseId: v.optional(nonEmptyStringSchema),
  category: v.picklist(verificationEvidenceDiagnosticCategories),
  code: nonEmptyStringSchema,
  column: v.optional(positiveIntegerSchema),
  line: v.optional(positiveIntegerSchema),
  message: nonEmptyStringSchema,
  path: v.optional(nonEmptyStringSchema),
  severity: v.picklist(verificationEvidenceDiagnosticSeverities)
});

export const verificationEvidenceConfigSchema = v.strictObject({
  caseIdPattern: v.optional(
    nonEmptyStringSchema,
    "^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+){2,}-\\d{3}$"
  ),
  catalogPath: v.optional(
    nonEmptyStringSchema,
    defaultVerificationEvidenceCatalogPath
  ),
  indexPath: v.optional(
    nonEmptyStringSchema,
    defaultVerificationEvidenceIndexPath
  ),
  schemaVersion: v.literal(verificationEvidenceConfigSchemaVersion)
});

export const verificationEvidenceSummarySchema = v.strictObject({
  catalogCases: nonNegativeIntegerSchema,
  checkCases: nonNegativeIntegerSchema,
  testCases: nonNegativeIntegerSchema
});

export const verificationEvidenceReportSchema = v.strictObject({
  diagnostics: v.array(verificationEvidenceDiagnosticSchema),
  schemaVersion: v.literal(verificationEvidenceReportSchemaVersion),
  summary: verificationEvidenceSummarySchema
});

const verificationCaseStateFields = {
  endLine: positiveIntegerSchema,
  entries: v.pipe(
    v.array(nonEmptyStringSchema),
    v.minLength(1, "must include at least one entry")
  ),
  id: nonEmptyStringSchema,
  line: positiveIntegerSchema,
  summary: nonEmptyStringSchema,
  title: nonEmptyStringSchema,
  verification: v.picklist(verificationKinds)
};

export const verificationCaseStateSchema = v.strictObject(
  verificationCaseStateFields
);

export const verificationEvidenceQueryResultSchema = v.strictObject({
  cases: v.array(verificationCaseStateSchema),
  catalogPath: nonEmptyStringSchema,
  diagnostics: v.array(verificationEvidenceDiagnosticSchema),
  indexPath: nonEmptyStringSchema,
  limit: positiveIntegerSchema,
  offset: nonNegativeIntegerSchema,
  schemaVersion: v.literal(verificationEvidenceReportSchemaVersion),
  total: nonNegativeIntegerSchema
});

export const verificationCaseShowResultSchema = v.strictObject({
  case: v.nullable(verificationCaseStateSchema),
  catalogPath: nonEmptyStringSchema,
  diagnostics: v.array(verificationEvidenceDiagnosticSchema),
  indexPath: nonEmptyStringSchema,
  markdown: v.nullable(v.string()),
  schemaVersion: v.literal(verificationEvidenceReportSchemaVersion)
});

const verificationEvidenceIndexSyncStates = [
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

export const verificationEvidenceIndexSyncResultSchema = v.strictObject({
  catalogPath: nonEmptyStringSchema,
  changed: v.boolean(),
  diagnostics: v.array(verificationEvidenceDiagnosticSchema),
  indexPath: nonEmptyStringSchema,
  mode: v.picklist(["check", "write"]),
  schemaVersion: v.literal(verificationEvidenceReportSchemaVersion),
  state: v.picklist(verificationEvidenceIndexSyncStates),
  status: v.picklist(["ok", "error"])
});

const verificationEvidenceIndexKeysSchema = v.strictObject({
  search: v.tuple([stateIndexTextSchema]),
  verification: v.tuple([v.picklist(verificationKinds)])
});

export const verificationEvidenceStateIndexSchema = createStateIndexSchema({
  definitionVersion: verificationEvidenceIndexDefinitionVersion,
  keys: verificationEvidenceIndexKeysSchema,
  keyDefinitions: v.tuple([
    v.strictObject({
      mode: v.literal("text"),
      name: v.literal("search")
    }),
    v.strictObject({
      mode: v.literal("exact"),
      name: v.literal("verification")
    })
  ]),
  metadata: verificationEvidenceIndexMetadataSchema,
  namespace: verificationEvidenceIndexNamespace,
  sourceRevision: v.pipe(
    v.string("must be a string"),
    v.regex(
      /^sha256:[0-9a-f]{64}$/,
      "must be a sha256 verification-evidence source revision"
    )
  ),
  state: verificationCaseStateSchema
});

export type VerificationKind = (typeof verificationKinds)[number];
export type VerificationEvidenceDiagnosticCategory =
  (typeof verificationEvidenceDiagnosticCategories)[number];
export type VerificationEvidenceDiagnosticSeverity =
  (typeof verificationEvidenceDiagnosticSeverities)[number];
export type VerificationEvidenceDiagnostic = v.InferOutput<
  typeof verificationEvidenceDiagnosticSchema
>;
export type VerificationEvidenceConfig = v.InferOutput<
  typeof verificationEvidenceConfigSchema
>;
export type VerificationEvidenceSummary = v.InferOutput<
  typeof verificationEvidenceSummarySchema
>;
export type VerificationEvidenceReport = v.InferOutput<
  typeof verificationEvidenceReportSchema
>;
export type VerificationCaseState = v.InferOutput<
  typeof verificationCaseStateSchema
>;
export type VerificationEvidenceQueryResult = v.InferOutput<
  typeof verificationEvidenceQueryResultSchema
>;
export type VerificationCaseShowResult = v.InferOutput<
  typeof verificationCaseShowResultSchema
>;
export type VerificationEvidenceIndexSyncResult = v.InferOutput<
  typeof verificationEvidenceIndexSyncResultSchema
>;
export type VerificationEvidenceStateIndex = v.InferOutput<
  typeof verificationEvidenceStateIndexSchema
>;
