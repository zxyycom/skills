import * as v from "valibot";
import {
  createStateIndexSchema,
  stateIndexSchemaVersion,
  stateIndexTextSchema
} from "../../index-runtime/src/index.ts";

export const supportedLanguages = [
  "rust",
  "typescript",
  "javascript",
  "python",
  "go",
  "java",
  "csharp"
] as const;

export const unregisteredPolicies = ["ignore", "warn", "error"] as const;
export const reviewTriggerPolicies = ["warn", "error"] as const;
export const caseStatuses = ["active", "planned"] as const;
export const verificationModes = ["automated", "review", "exempt"] as const;
export const sourceMarkerRoles = ["main", "derived", "exempt"] as const;
export const reviewResults = ["pass", "findings", "blocked"] as const;
export const testEvidenceDiagnosticCategories = [
  "catalog",
  "config",
  "discovery",
  "git",
  "index",
  "inventory",
  "mapping",
  "review"
] as const;
export const testEvidenceDiagnosticSeverities = ["error", "warning"] as const;

export const testEntryInventorySchemaVersion = 1 as const;
export const regexCollectorConfigSchemaVersion = 1 as const;
export const testEvidenceLedgerConfigSchemaVersion = 4 as const;
export const testEvidenceReportSchemaVersion = 3 as const;
export const testEvidenceIndexSchemaVersion = stateIndexSchemaVersion;
export const testEvidenceIndexDefinitionVersion = 2 as const;
export const testEvidenceIndexNamespace = "test-evidence" as const;
export const defaultTestEvidenceLedgerConfigPath = ".test-evidence.json";
export const defaultTestEvidenceCatalogPath = "docs/testing/cases.md";
export const defaultTestEvidenceIndexPath =
  "docs/testing/test-evidence-index.json";

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

export const testEvidenceDiagnosticSchema = v.strictObject({
  blocking: v.boolean(),
  caseId: v.optional(nonEmptyStringSchema),
  category: v.picklist(testEvidenceDiagnosticCategories),
  code: nonEmptyStringSchema,
  column: v.optional(positiveIntegerSchema),
  detectorId: v.optional(nonEmptyStringSchema),
  line: v.optional(positiveIntegerSchema),
  message: nonEmptyStringSchema,
  path: v.optional(nonEmptyStringSchema),
  severity: v.picklist(testEvidenceDiagnosticSeverities)
});

export const testEntrySchema = v.strictObject({
  column: positiveIntegerSchema,
  detectorIds: v.pipe(
    v.array(nonEmptyStringSchema),
    v.minLength(1, "must include at least one detector ID")
  ),
  id: nonEmptyStringSchema,
  language: nonEmptyStringSchema,
  line: positiveIntegerSchema,
  offset: nonNegativeIntegerSchema,
  path: nonEmptyStringSchema
});

export const testEntryMarkerSchema = v.strictObject({
  caseId: nonEmptyStringSchema,
  line: positiveIntegerSchema,
  offset: nonNegativeIntegerSchema,
  path: nonEmptyStringSchema,
  role: v.picklist(sourceMarkerRoles),
  targetEntryId: v.nullable(nonEmptyStringSchema)
});

export const testEntryInventorySchema = v.strictObject({
  diagnostics: v.array(testEvidenceDiagnosticSchema),
  entries: v.array(testEntrySchema),
  markers: v.array(testEntryMarkerSchema),
  schemaVersion: v.literal(testEntryInventorySchemaVersion)
});

export const regexDetectorSchema = v.strictObject({
  excludeGlobs: v.optional(v.array(nonEmptyStringSchema), []),
  flags: v.optional(
    v.pipe(
      v.string(),
      v.regex(/^(?!.*(.).*\1)[imsu]*$/, "must contain unique i, m, s, or u flags")
    ),
    "mu"
  ),
  id: nonEmptyStringSchema,
  includeGlobs: v.pipe(
    v.array(nonEmptyStringSchema),
    v.minLength(1, "must include at least one file glob")
  ),
  language: nonEmptyStringSchema,
  offsetGroup: v.optional(positiveIntegerSchema),
  pattern: nonEmptyStringSchema
});

export const regexCollectorConfigSchema = v.strictObject({
  builtinDetectors: v.optional(
    v.array(v.picklist(supportedLanguages)),
    [...supportedLanguages]
  ),
  excludeGlobs: v.optional(v.array(nonEmptyStringSchema), [
    "**/.*/**",
    "**/.git/**",
    "**/.venv/**",
    "**/build/**",
    "**/dist/**",
    "**/node_modules/**",
    "**/target/**",
    "**/vendor/**"
  ]),
  includeGlobs: v.optional(v.array(nonEmptyStringSchema), []),
  patterns: v.optional(v.array(regexDetectorSchema), []),
  schemaVersion: v.literal(regexCollectorConfigSchemaVersion)
});

export const testEvidenceLedgerConfigSchema = v.strictObject({
  caseIdPattern: v.optional(
    nonEmptyStringSchema,
    "^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+){2,}-\\d{3}$"
  ),
  catalogPath: v.optional(nonEmptyStringSchema, defaultTestEvidenceCatalogPath),
  indexPath: v.optional(
    nonEmptyStringSchema,
    defaultTestEvidenceIndexPath
  ),
  reviewMaxAgeDays: v.optional(positiveIntegerSchema),
  reviewTriggers: v.optional(v.picklist(reviewTriggerPolicies), "warn"),
  schemaVersion: v.literal(testEvidenceLedgerConfigSchemaVersion),
  unregisteredTestEntries: v.optional(v.picklist(unregisteredPolicies), "warn")
});

export const reviewTriggerSchema = v.strictObject({
  caseId: nonEmptyStringSchema,
  paths: v.array(nonEmptyStringSchema),
  reasons: v.array(nonEmptyStringSchema)
});

export const testEvidenceSummarySchema = v.strictObject({
  activeAutomatedCases: nonNegativeIntegerSchema,
  catalogCases: nonNegativeIntegerSchema,
  derivedMarkers: nonNegativeIntegerSchema,
  discoveredTestEntries: nonNegativeIntegerSchema,
  discoveredTestFiles: nonNegativeIntegerSchema,
  exemptCases: nonNegativeIntegerSchema,
  exemptMarkers: nonNegativeIntegerSchema,
  exemptTestEntries: nonNegativeIntegerSchema,
  mainMarkers: nonNegativeIntegerSchema,
  plannedAutomatedCases: nonNegativeIntegerSchema,
  reviewCases: nonNegativeIntegerSchema,
  reviewTriggers: nonNegativeIntegerSchema,
  unregisteredTestEntries: nonNegativeIntegerSchema
});

export const testEvidenceReportSchema = v.strictObject({
  diagnostics: v.array(testEvidenceDiagnosticSchema),
  reviewTriggers: v.array(reviewTriggerSchema),
  schemaVersion: v.literal(testEvidenceReportSchemaVersion),
  summary: testEvidenceSummarySchema
});

export const testEvidenceSourceMarkerViewSchema = v.strictObject({
  attached: v.boolean(),
  entryColumn: v.nullable(positiveIntegerSchema),
  entryLine: v.nullable(positiveIntegerSchema),
  markerLine: positiveIntegerSchema,
  path: nonEmptyStringSchema,
  role: v.picklist(sourceMarkerRoles)
});

export const testEvidenceSourceEntryViewSchema = v.strictObject({
  column: positiveIntegerSchema,
  detectorIds: v.array(nonEmptyStringSchema),
  id: nonEmptyStringSchema,
  language: nonEmptyStringSchema,
  line: positiveIntegerSchema,
  markers: v.array(v.strictObject({
    caseId: nonEmptyStringSchema,
    markerLine: positiveIntegerSchema,
    role: v.picklist(sourceMarkerRoles)
  })),
  path: nonEmptyStringSchema
});

export const testEvidenceLastReviewViewSchema = v.strictObject({
  at: nonEmptyStringSchema,
  commit: nonEmptyStringSchema,
  result: v.picklist(reviewResults)
});

export const testEvidenceCaseViewSchema = v.strictObject({
  codePath: v.nullable(nonEmptyStringSchema),
  contract: v.array(nonEmptyStringSchema),
  id: nonEmptyStringSchema,
  lastReview: v.nullable(testEvidenceLastReviewViewSchema),
  line: positiveIntegerSchema,
  proves: v.array(nonEmptyStringSchema),
  reason: v.array(nonEmptyStringSchema),
  review: v.array(nonEmptyStringSchema),
  risk: v.array(nonEmptyStringSchema),
  scope: v.array(nonEmptyStringSchema),
  sourceMarkers: v.array(testEvidenceSourceMarkerViewSchema),
  status: v.nullable(v.picklist(caseStatuses)),
  title: v.string(),
  trigger: v.nullable(reviewTriggerSchema),
  valid: v.boolean(),
  verification: v.nullable(v.picklist(verificationModes))
});

const testEvidenceCaseStateFields = {
  codePath: v.nullable(nonEmptyStringSchema),
  endLine: positiveIntegerSchema,
  id: nonEmptyStringSchema,
  lastReview: v.nullable(testEvidenceLastReviewViewSchema),
  line: positiveIntegerSchema,
  scope: v.array(nonEmptyStringSchema),
  status: v.picklist(caseStatuses),
  summary: nonEmptyStringSchema,
  title: nonEmptyStringSchema,
  verification: v.picklist(verificationModes)
};

export const testEvidenceCaseStateSchema = v.strictObject({
  ...testEvidenceCaseStateFields,
  trigger: v.nullable(reviewTriggerSchema)
});

const testEvidencePersistedCaseStateSchema = v.strictObject({
  ...testEvidenceCaseStateFields,
  trigger: v.null()
});

export const testEvidenceInspectionSchema = v.strictObject({
  cases: v.array(testEvidenceCaseViewSchema),
  catalogAvailable: v.boolean(),
  catalogPath: nonEmptyStringSchema,
  configPath: nonEmptyStringSchema,
  configurationValid: v.boolean(),
  indexCurrent: v.boolean(),
  indexPath: nonEmptyStringSchema,
  inventoryAvailable: v.boolean(),
  report: testEvidenceReportSchema,
  schemaVersion: v.literal(testEvidenceReportSchemaVersion),
  sourceEntries: v.array(testEvidenceSourceEntryViewSchema)
});

export const testEvidenceQueryResultSchema = v.strictObject({
  cases: v.array(testEvidenceCaseStateSchema),
  catalogPath: nonEmptyStringSchema,
  diagnostics: v.array(testEvidenceDiagnosticSchema),
  incomplete: v.boolean(),
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
  "review-triggered": v.optional(v.tuple([v.literal(true)])),
  search: v.tuple([stateIndexTextSchema]),
  status: v.tuple([v.picklist(caseStatuses)]),
  verification: v.tuple([v.picklist(verificationModes)])
});

export const testEvidenceStateIndexSchema = createStateIndexSchema({
  definitionVersion: testEvidenceIndexDefinitionVersion,
  keys: testEvidenceIndexKeysSchema,
  keyDefinitions: v.tuple([
    v.strictObject({
      mode: v.literal("exact"),
      name: v.literal("review-triggered")
    }),
    v.strictObject({
      mode: v.literal("text"),
      name: v.literal("search")
    }),
    v.strictObject({
      mode: v.literal("exact"),
      name: v.literal("status")
    }),
    v.strictObject({
      mode: v.literal("exact"),
      name: v.literal("verification")
    })
  ]),
  namespace: testEvidenceIndexNamespace,
  sourceRevision: v.pipe(
    v.string("must be a string"),
    v.regex(
      /^sha256:[0-9a-f]{64}$/,
      "must be a sha256 test-evidence source revision"
    )
  ),
  state: testEvidencePersistedCaseStateSchema
});

export type SupportedLanguage = (typeof supportedLanguages)[number];
export type UnregisteredPolicy = (typeof unregisteredPolicies)[number];
export type ReviewTriggerPolicy = (typeof reviewTriggerPolicies)[number];
export type CaseStatus = (typeof caseStatuses)[number];
export type VerificationMode = (typeof verificationModes)[number];
export type SourceMarkerRole = (typeof sourceMarkerRoles)[number];
export type ReviewResult = (typeof reviewResults)[number];
export type TestEvidenceDiagnosticCategory =
  (typeof testEvidenceDiagnosticCategories)[number];
export type TestEvidenceDiagnosticSeverity =
  (typeof testEvidenceDiagnosticSeverities)[number];
export type TestEvidenceDiagnostic = v.InferOutput<
  typeof testEvidenceDiagnosticSchema
>;
export type TestEntry = v.InferOutput<typeof testEntrySchema>;
export type TestEntryMarker = v.InferOutput<typeof testEntryMarkerSchema>;
export type TestEntryInventory = v.InferOutput<typeof testEntryInventorySchema>;
export type RegexDetector = v.InferOutput<typeof regexDetectorSchema>;
export type RegexCollectorConfig = v.InferOutput<
  typeof regexCollectorConfigSchema
>;
export type TestEvidenceLedgerConfig = v.InferOutput<
  typeof testEvidenceLedgerConfigSchema
>;
export type ReviewTrigger = v.InferOutput<typeof reviewTriggerSchema>;
export type TestEvidenceSummary = v.InferOutput<
  typeof testEvidenceSummarySchema
>;
export type TestEvidenceReport = v.InferOutput<typeof testEvidenceReportSchema>;
export type TestEvidenceSourceMarkerView = v.InferOutput<
  typeof testEvidenceSourceMarkerViewSchema
>;
export type TestEvidenceSourceEntryView = v.InferOutput<
  typeof testEvidenceSourceEntryViewSchema
>;
export type TestEvidenceLastReviewView = v.InferOutput<
  typeof testEvidenceLastReviewViewSchema
>;
export type TestEvidenceCaseView = v.InferOutput<
  typeof testEvidenceCaseViewSchema
>;
export type TestEvidenceCaseState = v.InferOutput<
  typeof testEvidenceCaseStateSchema
>;
export type TestEvidenceCaseShowResult = v.InferOutput<
  typeof testEvidenceCaseShowResultSchema
>;
export type TestEvidenceInspection = v.InferOutput<
  typeof testEvidenceInspectionSchema
>;
export type TestEvidenceQueryResult = v.InferOutput<
  typeof testEvidenceQueryResultSchema
>;
export type TestEvidenceIndexSyncResult = v.InferOutput<
  typeof testEvidenceIndexSyncResultSchema
>;
export type TestEvidenceStateIndex = v.InferOutput<
  typeof testEvidenceStateIndexSchema
>;
