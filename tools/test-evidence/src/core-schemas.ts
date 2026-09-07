import * as v from "valibot";
import {
  createStateIndexSchema,
  createStateSourceRevisionSchema,
  stateIndexQueryMaximumLimit
} from "../../index-runtime/src/index.ts";

export const testEvidenceSchemaVersion = 6 as const;
export const testEvidenceDefinitionVersion = 6 as const;
export const testEvidenceNamespace = "test-evidence" as const;
export const testEvidencePath = "docs/test-evidence" as const;
export const testEvidenceCasesPath = "docs/test-evidence/cases" as const;
export const testEvidenceIndexPath =
  "docs/test-evidence/test-evidence-index.json" as const;
export const testEvidenceCaseIdPatternSource =
  "^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+){2,}-\\d{3}$";
export const testEvidenceCaseIdSchema = v.pipe(
  v.string(),
  v.regex(new RegExp(testEvidenceCaseIdPatternSource, "u"))
);
export const testEvidenceTestIdSchema = v.pipe(
  v.string(),
  v.minLength(1),
  v.check(
    (value) =>
      !/[\s`]/u.test(value) &&
      Array.from({ length: value.length }, (_, index) =>
        value.charCodeAt(index)
      ).every((code) => code > 31 && code !== 127),
    "must be a non-empty token without whitespace, backticks, or control characters"
  )
);
export const testEvidenceTagSchema = v.pipe(
  v.string(),
  v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)
);
export const fingerprintSchema = v.pipe(
  v.string(),
  v.regex(/^sha256:[0-9a-f]{64}$/u)
);
const text = v.pipe(
  v.string(),
  v.minLength(1),
  v.regex(/^[^\r\n]*$/u),
  v.check((value) => value.trim() === value)
);
const sorted = <T>(schema: v.BaseSchema<unknown, T, v.BaseIssue<unknown>>) =>
  v.pipe(
    v.array(schema),
    v.check(
      (values) =>
        new Set(values).size === values.length &&
        values.every(
          (value, index) =>
            index === 0 || String(values[index - 1]) < String(value)
        )
    )
  );
export const testEvidenceCaseSchema = v.strictObject({
  id: testEvidenceCaseIdSchema,
  title: text,
  sourcePath: v.pipe(
    v.string(),
    v.regex(/^cases\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u)
  ),
  testIds: v.pipe(sorted(testEvidenceTestIdSchema), v.minLength(1)),
  tags: sorted(testEvidenceTagSchema),
  contract: v.pipe(v.array(text), v.minLength(1)),
  proves: v.pipe(v.array(text), v.minLength(1))
});
export const testEvidenceCaseIndexStateSchema = v.strictObject({
  title: text,
  sourcePath: v.pipe(
    v.string(),
    v.regex(/^cases\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u)
  ),
  tags: sorted(testEvidenceTagSchema),
  testIds: v.pipe(sorted(testEvidenceTestIdSchema), v.minLength(1))
});
export const testEvidenceIndexMetadataSchema = v.strictObject({});
export const testEvidenceStateIndexSchema = createStateIndexSchema({
  definitionVersion: testEvidenceDefinitionVersion,
  id: testEvidenceCaseIdSchema,
  metadata: testEvidenceIndexMetadataSchema,
  namespace: testEvidenceNamespace,
  sourceRevision: createStateSourceRevisionSchema({
    fingerprint: fingerprintSchema,
    id: testEvidenceCaseIdSchema
  }),
  state: testEvidenceCaseIndexStateSchema
});
export const expectedSourceSchema = v.strictObject({
  projectId: text,
  scopeId: text,
  revision: text
});
export const snapshotSchema = v.strictObject({
  schemaVersion: v.literal(2),
  source: expectedSourceSchema,
  completeness: v.picklist(["complete", "partial"]),
  entities: v.pipe(
    v.array(
      v.strictObject({
        id: testEvidenceTestIdSchema,
        name: text,
        locators: v.pipe(sorted(text), v.minLength(1))
      })
    ),
    v.check((entities) =>
      entities.every(
        (entity, index) => index === 0 || entities[index - 1].id < entity.id
      )
    )
  )
});
export const testEvidenceDiagnosticSchema = v.strictObject({
  blocking: v.boolean(),
  category: v.picklist(["case", "snapshot", "reference", "index", "query"]),
  code: v.pipe(v.string(), v.minLength(1)),
  message: v.pipe(v.string(), v.minLength(1)),
  path: v.optional(v.string()),
  caseId: v.optional(testEvidenceCaseIdSchema),
  testId: v.optional(testEvidenceTestIdSchema)
});
export const testEvidenceReferenceResultSchema = v.strictObject({
  schemaVersion: v.literal(testEvidenceSchemaVersion),
  status: v.picklist(["ok", "error"]),
  state: v.picklist([
    "valid",
    "case-invalid",
    "snapshot-invalid",
    "snapshot-incomplete",
    "source-mismatch",
    "references-invalid"
  ]),
  expectedSource: v.nullable(expectedSourceSchema),
  observedSource: v.nullable(expectedSourceSchema),
  snapshotFingerprint: v.nullable(fingerprintSchema),
  checkedCaseIds: v.array(testEvidenceCaseIdSchema),
  checkedReferenceCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
  diagnostics: v.array(testEvidenceDiagnosticSchema)
});
export const queryLimitSchema = v.pipe(
  v.number(),
  v.integer(),
  v.safeInteger(),
  v.minValue(1),
  v.maxValue(stateIndexQueryMaximumLimit)
);
export const queryOffsetSchema = v.pipe(
  v.number(),
  v.integer(),
  v.safeInteger(),
  v.minValue(0)
);
const sourceRevisionSchema = createStateSourceRevisionSchema({
  fingerprint: fingerprintSchema,
  id: testEvidenceCaseIdSchema
});
const indexedCaseSchema = v.strictObject({
  id: testEvidenceCaseIdSchema,
  title: text,
  sourcePath: v.pipe(
    v.string(),
    v.regex(/^cases\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u)
  ),
  tags: sorted(testEvidenceTagSchema),
  testIds: v.pipe(sorted(testEvidenceTestIdSchema), v.minLength(1))
});
export const testEvidenceReportSchema = v.strictObject({
  schemaVersion: v.literal(testEvidenceSchemaVersion),
  diagnostics: v.array(testEvidenceDiagnosticSchema),
  casePath: v.literal(testEvidenceCasesPath),
  indexPath: v.literal(testEvidenceIndexPath),
  sourceRevision: v.nullable(sourceRevisionSchema),
  summary: v.strictObject({
    cases: v.pipe(v.number(), v.integer(), v.minValue(0)),
    tags: v.pipe(v.number(), v.integer(), v.minValue(0)),
    references: v.pipe(v.number(), v.integer(), v.minValue(0))
  })
});
export const testEvidenceQueryResultSchema = v.strictObject({
  schemaVersion: v.literal(testEvidenceSchemaVersion),
  source: v.literal("index"),
  currentness: v.literal("unchecked"),
  diagnostics: v.array(testEvidenceDiagnosticSchema),
  cases: v.array(indexedCaseSchema),
  total: v.pipe(v.number(), v.integer(), v.minValue(0)),
  limit: queryLimitSchema,
  offset: queryOffsetSchema
});
export const testEvidenceTagsResultSchema = v.strictObject({
  schemaVersion: v.literal(testEvidenceSchemaVersion),
  source: v.literal("index"),
  currentness: v.literal("unchecked"),
  diagnostics: v.array(testEvidenceDiagnosticSchema),
  tags: v.array(
    v.strictObject({
      tag: testEvidenceTagSchema,
      caseCount: v.pipe(v.number(), v.integer(), v.minValue(0))
    })
  )
});
export const testEvidenceShowResultSchema = v.strictObject({
  schemaVersion: v.literal(testEvidenceSchemaVersion),
  diagnostics: v.array(testEvidenceDiagnosticSchema),
  case: v.nullable(testEvidenceCaseSchema),
  markdown: v.nullable(v.string()),
  indexPath: v.literal(testEvidenceIndexPath)
});
const previewSchema = v.strictObject({
  column: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0))),
  line: v.pipe(v.number(), v.integer(), v.minValue(1)),
  preview: v.string(),
  ranges: v.array(
    v.strictObject({
      start: v.pipe(v.number(), v.integer(), v.minValue(0)),
      end: v.pipe(v.number(), v.integer(), v.minValue(0))
    })
  )
});
export const testEvidenceSearchResultSchema = v.strictObject({
  schemaVersion: v.literal(testEvidenceSchemaVersion),
  diagnostics: v.array(testEvidenceDiagnosticSchema),
  sourceRevision: v.nullable(sourceRevisionSchema),
  cases: v.array(
    v.strictObject({
      ...indexedCaseSchema.entries,
      previews: v.array(previewSchema)
    })
  ),
  total: v.pipe(v.number(), v.integer(), v.minValue(0)),
  limit: queryLimitSchema,
  offset: queryOffsetSchema
});
export const testEvidenceSyncResultSchema = v.strictObject({
  schemaVersion: v.literal(testEvidenceSchemaVersion),
  status: v.picklist(["ok", "error"]),
  state: v.picklist([
    "current",
    "unchanged",
    "written",
    "index-invalid",
    "index-missing",
    "index-path-invalid",
    "index-read-failed",
    "index-stale",
    "index-write-failed",
    "selected-baseline-invalid",
    "selected-id-missing",
    "selection-invalid",
    "collection-changed",
    "scoped-stale",
    "unselected-changes",
    "source-invalid"
  ]),
  changed: v.boolean(),
  diagnostics: v.array(testEvidenceDiagnosticSchema),
  indexPath: v.literal(testEvidenceIndexPath),
  sourceRevision: v.nullable(sourceRevisionSchema),
  selectedIds: v.optional(v.array(testEvidenceCaseIdSchema))
});
const runtimeIndexDiagnosticSchema = v.strictObject({
  code: v.pipe(v.string(), v.minLength(1)),
  message: v.pipe(v.string(), v.minLength(1)),
  path: v.nullable(v.string()),
  stateId: v.nullable(v.string()),
  filesystem: v.optional(
    v.strictObject({
      causeCategory: v.picklist(["access-denied", "not-found", "unknown"]),
      detail: v.nullable(v.string()),
      operation: v.string(),
      target: v.nullable(v.string())
    })
  ),
  versionControl: v.optional(
    v.strictObject({
      causeCategory: v.picklist([
        "access-denied",
        "busy",
        "command-failed",
        "not-repository",
        "revision-unavailable",
        "tool-unavailable",
        "unknown"
      ]),
      detail: v.nullable(v.string()),
      operation: v.nullable(v.string()),
      target: v.nullable(v.string())
    })
  )
});
export const testEvidenceStageResultSchema = v.strictObject({
  status: v.picklist(["ok", "error"]),
  state: v.picklist([
    "staged",
    "unchanged",
    "collection-changed",
    "definition-invalid",
    "index-path-invalid",
    "operation-aborted",
    "pending-conflict",
    "pending-write-failed",
    "revision-index-invalid",
    "revision-read-failed",
    "selection-invalid",
    "target-invalid",
    "workspace-index-invalid",
    "pending-recovery-failed"
  ]),
  changed: v.optional(v.nullable(v.boolean())),
  diagnostics: v.array(
    v.union([testEvidenceDiagnosticSchema, runtimeIndexDiagnosticSchema])
  ),
  indexPath: v.optional(v.string()),
  namespace: v.optional(v.literal(testEvidenceNamespace)),
  selectedIds: v.optional(v.array(testEvidenceCaseIdSchema)),
  pending: v.optional(
    v.strictObject({
      outcome: v.picklist(["no-change", "partial-or-unknown"]),
      scope: v.string()
    })
  )
});
export type TestEvidenceDiagnostic = v.InferOutput<
  typeof testEvidenceDiagnosticSchema
>;
export type TestEvidenceCase = v.InferOutput<typeof testEvidenceCaseSchema>;
export type TestEvidenceCaseIndexState = v.InferOutput<
  typeof testEvidenceCaseIndexStateSchema
>;
export type TestEvidenceIndexMetadata = v.InferOutput<
  typeof testEvidenceIndexMetadataSchema
>;
export type TestEvidenceSnapshot = v.InferOutput<typeof snapshotSchema>;
export type ExpectedSource = v.InferOutput<typeof expectedSourceSchema>;
