import * as v from "valibot";
import {
  createStateIndexSchema,
  createStateSourceRevisionSchema,
  stateIndexQueryMaximumLimit,
  stateIndexSchemaVersion,
  stateIndexTextSchema
} from "../../../index-runtime/src/index.ts";
import { isStrictlyAscendingLexical } from "./canonicalization.ts";

export const testEvidenceLedgerSchemaVersion = 5 as const;
export const testEvidenceLedgerDefinitionVersion = 4 as const;
export const testEvidenceLedgerNamespace = "test-evidence" as const;
export const testEntityIndexSchemaVersion = 1 as const;

export const testEvidenceLedgerPath = "docs/test-evidence";
export const testEvidenceCasesPath = "docs/test-evidence/cases";
export const testEntityIndexPath = "docs/test-evidence/test-entity-index.json";
export const testEvidenceLedgerIndexPath =
  "docs/test-evidence/test-evidence-index.json";

export const testEvidenceCaseIdPatternSource =
  "^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+){2,}-\\d{3}$";
export const testEvidenceTagPatternSource = "^[a-z0-9]+(?:-[a-z0-9]+)*$";
export const testEvidenceCaseFilePatternSource =
  "^[a-z0-9]+(?:-[a-z0-9]+)*\\.md$";

export const testEvidenceDiagnosticCategories = [
  "entity-index",
  "case",
  "relation",
  "index",
  "query"
] as const;
export const testEvidenceDiagnosticSeverities = ["error", "warning"] as const;

const nonEmptyStringSchema = v.pipe(
  v.string("must be a string"),
  v.nonEmpty("must be a non-empty string")
);
const normalizedSingleLineSchema = v.pipe(
  nonEmptyStringSchema,
  v.regex(/^[^\r\n]*$/u, "must be a single line"),
  v.check(
    (value) => value.trim() === value,
    "must not have surrounding whitespace"
  )
);
const positiveIntegerSchema = v.pipe(
  v.number("must be a number"),
  v.integer("must be an integer"),
  v.safeInteger("must be a safe integer"),
  v.minValue(1, "must be at least 1")
);
const nonNegativeIntegerSchema = v.pipe(
  v.number("must be a number"),
  v.integer("must be an integer"),
  v.safeInteger("must be a safe integer"),
  v.minValue(0, "must be at least 0")
);
export const testEvidenceQueryLimitSchema = v.pipe(
  positiveIntegerSchema,
  v.maxValue(
    stateIndexQueryMaximumLimit,
    `must not exceed ${stateIndexQueryMaximumLimit}`
  )
);
export const testEvidenceQueryOffsetSchema = nonNegativeIntegerSchema;

export const testEvidenceCaseIdSchema = v.pipe(
  nonEmptyStringSchema,
  v.regex(
    new RegExp(testEvidenceCaseIdPatternSource, "u"),
    "must be a valid test evidence Case ID"
  )
);
export const testEvidenceTagSchema = v.pipe(
  nonEmptyStringSchema,
  v.regex(
    new RegExp(testEvidenceTagPatternSource, "u"),
    "must be a kebab-case Tag"
  )
);
export const testEntityIdSchema = v.pipe(
  nonEmptyStringSchema,
  v.regex(
    /^(?!.*[\s`\u0000-\u001f\u007f]).+$/u,
    "must be a non-empty token without whitespace, backticks, or control characters"
  )
);
export const testEvidenceSourceFingerprintSchema = v.pipe(
  v.string("must be a string"),
  v.regex(/^sha256:[0-9a-f]{64}$/u, "must be a sha256 source fingerprint")
);

const sortedUniqueLocatorsSchema = v.pipe(
  v.array(normalizedSingleLineSchema),
  v.minLength(1, "must include at least one locator"),
  v.check(
    (values) => new Set(values).size === values.length,
    "locators must be unique"
  ),
  v.check(
    (values) => isStrictlyAscendingLexical(values),
    "locators must be sorted in ascending lexical order"
  )
);

export const testEntitySchema = v.strictObject({
  id: testEntityIdSchema,
  name: normalizedSingleLineSchema,
  locators: sortedUniqueLocatorsSchema
});

export const testEntityIndexSchema = v.strictObject({
  schemaVersion: v.literal(testEntityIndexSchemaVersion),
  sourceRevision: normalizedSingleLineSchema,
  entities: v.pipe(
    v.array(testEntitySchema),
    v.check(
      (entities) =>
        new Set(entities.map((entity) => entity.id)).size === entities.length,
      "entity ids must be unique"
    ),
    v.check(
      (entities) =>
        isStrictlyAscendingLexical(entities.map((entity) => entity.id)),
      "entities must be sorted by id in ascending lexical order"
    )
  )
});

export const testEntityIndexIdentitySchema = v.strictObject({
  schemaVersion: v.literal(testEntityIndexSchemaVersion),
  sourceRevision: normalizedSingleLineSchema,
  fingerprint: testEvidenceSourceFingerprintSchema
});

const sortedUniqueTestIdsSchema = v.pipe(
  v.array(testEntityIdSchema),
  v.minLength(1, "must reference at least one Test ID"),
  v.check(
    (values) => new Set(values).size === values.length,
    "Test IDs must be unique"
  ),
  v.check(
    (values) => isStrictlyAscendingLexical(values),
    "Test IDs must be sorted in ascending lexical order"
  )
);
const sortedUniqueTagsSchema = v.pipe(
  v.array(testEvidenceTagSchema),
  v.check(
    (values) => new Set(values).size === values.length,
    "Tags must be unique"
  ),
  v.check(
    (values) => isStrictlyAscendingLexical(values),
    "Tags must be sorted in ascending lexical order"
  )
);
const nonEmptyTextItemsSchema = v.pipe(
  v.array(normalizedSingleLineSchema),
  v.minLength(1, "must include at least one item")
);

export const testEvidenceLedgerCaseSchema = v.strictObject({
  id: testEvidenceCaseIdSchema,
  title: normalizedSingleLineSchema,
  sourcePath: v.pipe(
    nonEmptyStringSchema,
    v.regex(
      /^cases\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u,
      "must be cases/<semantic-slug>.md"
    )
  ),
  testIds: sortedUniqueTestIdsSchema,
  tags: sortedUniqueTagsSchema,
  contract: nonEmptyTextItemsSchema,
  proves: nonEmptyTextItemsSchema
});

export const testEvidenceLedgerCaseSummarySchema = v.strictObject({
  id: testEvidenceCaseIdSchema,
  title: normalizedSingleLineSchema,
  summary: normalizedSingleLineSchema,
  sourcePath: v.pipe(
    nonEmptyStringSchema,
    v.regex(/^cases\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u)
  ),
  testIds: sortedUniqueTestIdsSchema,
  tags: sortedUniqueTagsSchema
});

export const testEvidenceLedgerCaseIndexStateSchema = v.strictObject({
  title: normalizedSingleLineSchema,
  summary: normalizedSingleLineSchema,
  sourcePath: v.pipe(
    nonEmptyStringSchema,
    v.regex(/^cases\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u)
  ),
  testIds: sortedUniqueTestIdsSchema,
  tags: sortedUniqueTagsSchema,
  searchText: nonEmptyStringSchema
});

export const testEvidenceLedgerIndexMetadataSchema = v.strictObject({
  entityIndex: testEntityIndexIdentitySchema
});

const testEvidenceLedgerIndexKeysSchema = v.strictObject({
  search: v.tuple([stateIndexTextSchema]),
  tag: v.optional(
    v.pipe(
      v.array(testEvidenceTagSchema),
      v.minLength(1),
      v.check((values) => isStrictlyAscendingLexical(values))
    )
  ),
  test: v.pipe(
    v.array(testEntityIdSchema),
    v.minLength(1),
    v.check((values) => isStrictlyAscendingLexical(values))
  )
});

const baseTestEvidenceLedgerStateIndexSchema = createStateIndexSchema({
  definitionVersion: testEvidenceLedgerDefinitionVersion,
  id: testEvidenceCaseIdSchema,
  keys: testEvidenceLedgerIndexKeysSchema,
  keyDefinitions: v.tuple([
    v.strictObject({
      mode: v.literal("text"),
      name: v.literal("search")
    }),
    v.strictObject({
      mode: v.literal("exact"),
      name: v.literal("tag")
    }),
    v.strictObject({
      mode: v.literal("exact"),
      name: v.literal("test")
    })
  ]),
  metadata: testEvidenceLedgerIndexMetadataSchema,
  namespace: testEvidenceLedgerNamespace,
  sourceRevision: createStateSourceRevisionSchema({
    fingerprint: testEvidenceSourceFingerprintSchema,
    id: testEvidenceCaseIdSchema
  }),
  state: testEvidenceLedgerCaseIndexStateSchema
});

export const testEvidenceLedgerStateIndexSchema =
  baseTestEvidenceLedgerStateIndexSchema;

export const testEvidenceDiagnosticSchema = v.strictObject({
  blocking: v.boolean(),
  caseId: v.optional(testEvidenceCaseIdSchema),
  category: v.picklist(testEvidenceDiagnosticCategories),
  code: nonEmptyStringSchema,
  column: v.optional(positiveIntegerSchema),
  line: v.optional(positiveIntegerSchema),
  message: nonEmptyStringSchema,
  path: v.optional(nonEmptyStringSchema),
  severity: v.picklist(testEvidenceDiagnosticSeverities),
  testId: v.optional(testEntityIdSchema)
});

export const testEvidenceLedgerSummarySchema = v.strictObject({
  tests: nonNegativeIntegerSchema,
  cases: nonNegativeIntegerSchema,
  relations: nonNegativeIntegerSchema,
  tags: nonNegativeIntegerSchema
});

export const testEvidenceLedgerReportSchema = v.strictObject({
  diagnostics: v.array(testEvidenceDiagnosticSchema),
  entityIndex: v.nullable(testEntityIndexIdentitySchema),
  indexPath: v.literal(testEvidenceLedgerIndexPath),
  ledgerPath: v.literal(testEvidenceLedgerPath),
  schemaVersion: v.literal(testEvidenceLedgerSchemaVersion),
  sourceRevision: v.nullable(
    createStateSourceRevisionSchema({
      fingerprint: testEvidenceSourceFingerprintSchema,
      id: testEvidenceCaseIdSchema
    })
  ),
  summary: testEvidenceLedgerSummarySchema
});

const testEvidenceLedgerIndexSyncSuccessStates = [
  "current",
  "unchanged",
  "written"
] as const;
const testEvidenceLedgerIndexSyncErrorStates = [
  "index-invalid",
  "index-missing",
  "index-path-invalid",
  "index-read-failed",
  "index-stale",
  "index-write-failed",
  "source-invalid"
] as const;
const testEvidenceLedgerIndexCheckErrorStates = [
  "index-invalid",
  "index-missing",
  "index-path-invalid",
  "index-read-failed",
  "index-stale",
  "source-invalid"
] as const;
const testEvidenceLedgerIndexWriteErrorStates = [
  "index-path-invalid",
  "index-read-failed",
  "index-write-failed",
  "source-invalid"
] as const;
export const testEvidenceLedgerIndexSyncStates = [
  ...testEvidenceLedgerIndexSyncSuccessStates,
  ...testEvidenceLedgerIndexSyncErrorStates
] as const;

const testEvidenceLedgerIndexSyncResultBaseEntries = {
  entityIndex: v.nullable(testEntityIndexIdentitySchema),
  indexPath: v.literal(testEvidenceLedgerIndexPath),
  ledgerPath: v.literal(testEvidenceLedgerPath),
  schemaVersion: v.literal(testEvidenceLedgerSchemaVersion),
  sourceRevision: v.nullable(
    createStateSourceRevisionSchema({
      fingerprint: testEvidenceSourceFingerprintSchema,
      id: testEvidenceCaseIdSchema
    })
  )
};

export const testEvidenceLedgerIndexSyncResultSchema = v.union([
  v.strictObject({
    ...testEvidenceLedgerIndexSyncResultBaseEntries,
    changed: v.literal(false),
    diagnostics: v.tuple([]),
    mode: v.literal("check"),
    state: v.literal("current"),
    status: v.literal("ok")
  }),
  v.strictObject({
    ...testEvidenceLedgerIndexSyncResultBaseEntries,
    changed: v.literal(false),
    diagnostics: v.tuple([]),
    mode: v.literal("write"),
    state: v.literal("unchanged"),
    status: v.literal("ok")
  }),
  v.strictObject({
    ...testEvidenceLedgerIndexSyncResultBaseEntries,
    changed: v.literal(true),
    diagnostics: v.tuple([]),
    mode: v.literal("write"),
    state: v.literal("written"),
    status: v.literal("ok")
  }),
  v.strictObject({
    ...testEvidenceLedgerIndexSyncResultBaseEntries,
    changed: v.literal(false),
    diagnostics: v.pipe(
      v.array(testEvidenceDiagnosticSchema),
      v.minLength(1, "must include at least one diagnostic")
    ),
    mode: v.literal("check"),
    state: v.picklist(testEvidenceLedgerIndexCheckErrorStates),
    status: v.literal("error")
  }),
  v.strictObject({
    ...testEvidenceLedgerIndexSyncResultBaseEntries,
    changed: v.literal(false),
    diagnostics: v.pipe(
      v.array(testEvidenceDiagnosticSchema),
      v.minLength(1, "must include at least one diagnostic")
    ),
    mode: v.literal("write"),
    state: v.picklist(testEvidenceLedgerIndexWriteErrorStates),
    status: v.literal("error")
  })
]);

export const testEvidenceCaseQueryResultSchema = v.strictObject({
  cases: v.array(testEvidenceLedgerCaseSummarySchema),
  diagnostics: v.array(testEvidenceDiagnosticSchema),
  indexPath: v.literal(testEvidenceLedgerIndexPath),
  ledgerPath: v.literal(testEvidenceLedgerPath),
  limit: testEvidenceQueryLimitSchema,
  offset: testEvidenceQueryOffsetSchema,
  schemaVersion: v.literal(testEvidenceLedgerSchemaVersion),
  total: nonNegativeIntegerSchema
});

const testEvidenceCaseShowResultBaseEntries = {
  indexPath: v.literal(testEvidenceLedgerIndexPath),
  ledgerPath: v.literal(testEvidenceLedgerPath),
  schemaVersion: v.literal(testEvidenceLedgerSchemaVersion)
};

export const testEvidenceCaseShowResultSchema = v.union([
  v.strictObject({
    ...testEvidenceCaseShowResultBaseEntries,
    case: testEvidenceLedgerCaseSchema,
    diagnostics: v.array(testEvidenceDiagnosticSchema),
    markdown: v.string(),
    tests: v.pipe(
      v.array(testEntitySchema),
      v.minLength(1, "must include at least one Test entity")
    )
  }),
  v.strictObject({
    ...testEvidenceCaseShowResultBaseEntries,
    case: v.null(),
    diagnostics: v.pipe(
      v.array(testEvidenceDiagnosticSchema),
      v.minLength(1, "must include at least one diagnostic")
    ),
    markdown: v.null(),
    tests: v.tuple([])
  })
]);

export const testEvidenceTestQueryItemSchema = v.strictObject({
  id: testEntityIdSchema,
  name: normalizedSingleLineSchema,
  locators: sortedUniqueLocatorsSchema,
  caseIds: v.pipe(
    v.array(testEvidenceCaseIdSchema),
    v.check(
      (values) => new Set(values).size === values.length,
      "Case IDs must be unique"
    ),
    v.check(
      (values) => isStrictlyAscendingLexical(values),
      "Case IDs must be sorted in ascending lexical order"
    )
  )
});

export const testEvidenceTestQueryResultSchema = v.strictObject({
  diagnostics: v.array(testEvidenceDiagnosticSchema),
  indexPath: v.literal(testEvidenceLedgerIndexPath),
  ledgerPath: v.literal(testEvidenceLedgerPath),
  limit: testEvidenceQueryLimitSchema,
  offset: testEvidenceQueryOffsetSchema,
  schemaVersion: v.literal(testEvidenceLedgerSchemaVersion),
  tests: v.array(testEvidenceTestQueryItemSchema),
  total: nonNegativeIntegerSchema
});

const workspaceRootSchema = nonEmptyStringSchema;
const queryTextSchema = v.pipe(
  nonEmptyStringSchema,
  v.check(
    (value) => value.trim().length > 0,
    "must contain a non-whitespace character"
  )
);

export const validateTestEvidenceLedgerOptionsSchema = v.strictObject({
  workspaceRoot: workspaceRootSchema
});
export const syncTestEvidenceLedgerIndexOptionsSchema = v.strictObject({
  workspaceRoot: workspaceRootSchema,
  mode: v.picklist(["check", "write"])
});
export const queryTestEvidenceCasesOptionsSchema = v.strictObject({
  workspaceRoot: workspaceRootSchema,
  testId: v.optional(testEntityIdSchema),
  tag: v.optional(testEvidenceTagSchema),
  query: v.optional(queryTextSchema),
  limit: v.optional(testEvidenceQueryLimitSchema),
  offset: v.optional(testEvidenceQueryOffsetSchema)
});
export const showTestEvidenceCaseOptionsSchema = v.strictObject({
  workspaceRoot: workspaceRootSchema,
  caseId: testEvidenceCaseIdSchema
});
export const queryTestEntitiesOptionsSchema = v.strictObject({
  workspaceRoot: workspaceRootSchema,
  query: v.optional(queryTextSchema),
  limit: v.optional(testEvidenceQueryLimitSchema),
  offset: v.optional(testEvidenceQueryOffsetSchema)
});

export type TestEvidenceDiagnosticCategory =
  (typeof testEvidenceDiagnosticCategories)[number];
export type TestEvidenceDiagnosticSeverity =
  (typeof testEvidenceDiagnosticSeverities)[number];
export type TestEvidenceDiagnostic = v.InferOutput<
  typeof testEvidenceDiagnosticSchema
>;
export type TestEntity = v.InferOutput<typeof testEntitySchema>;
export type TestEntityIndex = v.InferOutput<typeof testEntityIndexSchema>;
export type TestEntityIndexIdentity = v.InferOutput<
  typeof testEntityIndexIdentitySchema
>;
export type TestEvidenceLedgerCase = v.InferOutput<
  typeof testEvidenceLedgerCaseSchema
>;
export type TestEvidenceLedgerCaseSummary = v.InferOutput<
  typeof testEvidenceLedgerCaseSummarySchema
>;
export type TestEvidenceLedgerCaseIndexState = v.InferOutput<
  typeof testEvidenceLedgerCaseIndexStateSchema
>;
export type TestEvidenceLedgerIndexMetadata = v.InferOutput<
  typeof testEvidenceLedgerIndexMetadataSchema
>;
export type TestEvidenceLedgerStateIndex = v.InferOutput<
  typeof testEvidenceLedgerStateIndexSchema
>;
export type TestEvidenceLedgerSummary = v.InferOutput<
  typeof testEvidenceLedgerSummarySchema
>;
export type TestEvidenceLedgerReport = v.InferOutput<
  typeof testEvidenceLedgerReportSchema
>;
export type TestEvidenceLedgerIndexSyncResult = v.InferOutput<
  typeof testEvidenceLedgerIndexSyncResultSchema
>;
export type TestEvidenceCaseQueryResult = v.InferOutput<
  typeof testEvidenceCaseQueryResultSchema
>;
export type TestEvidenceCaseShowResult = v.InferOutput<
  typeof testEvidenceCaseShowResultSchema
>;
export type TestEvidenceTestQueryItem = v.InferOutput<
  typeof testEvidenceTestQueryItemSchema
>;
export type TestEvidenceTestQueryResult = v.InferOutput<
  typeof testEvidenceTestQueryResultSchema
>;
export type ValidateTestEvidenceLedgerOptions = v.InferOutput<
  typeof validateTestEvidenceLedgerOptionsSchema
>;
export type SyncTestEvidenceLedgerIndexOptions = v.InferOutput<
  typeof syncTestEvidenceLedgerIndexOptionsSchema
>;
export type QueryTestEvidenceCasesOptions = v.InferOutput<
  typeof queryTestEvidenceCasesOptionsSchema
>;
export type ShowTestEvidenceCaseOptions = v.InferOutput<
  typeof showTestEvidenceCaseOptionsSchema
>;
export type QueryTestEntitiesOptions = v.InferOutput<
  typeof queryTestEntitiesOptionsSchema
>;

export { stateIndexQueryMaximumLimit, stateIndexSchemaVersion };
