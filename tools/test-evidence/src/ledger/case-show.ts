import * as v from "valibot";
import { readLedgerCaseSource } from "./case-source.ts";
import { createTestEvidenceDiagnostic } from "./diagnostics.ts";
import { readTestEvidenceLedgerRevision } from "./ledger-source.ts";
import {
  openTestEvidenceLedgerIndex,
  sameTargetRevision
} from "./query.ts";
import {
  showTestEvidenceCaseOptionsSchema,
  testEvidenceCaseShowResultSchema,
  testEvidenceLedgerIndexPath,
  testEvidenceLedgerPath,
  testEvidenceLedgerSchemaVersion,
  type ShowTestEvidenceCaseOptions,
  type TestEntity,
  type TestEvidenceCaseShowResult,
  type TestEvidenceDiagnostic
} from "./schemas.ts";

export async function showTestEvidenceCase(
  options: ShowTestEvidenceCaseOptions
): Promise<TestEvidenceCaseShowResult> {
  const parsedOptions = v.safeParse(
    showTestEvidenceCaseOptionsSchema,
    options
  );
  if (!parsedOptions.success) {
    return showFailure([createTestEvidenceDiagnostic({
      category: "query",
      code: "query.options-invalid",
      message: `Invalid ledger API options: ${parsedOptions.issues.map((issue) => issue.message).join("; ")}`,
      severity: "error"
    })]);
  }

  const opened = await openTestEvidenceLedgerIndex(
    parsedOptions.output.workspaceRoot
  );
  if (opened.opened === null) {
    return showFailure(opened.diagnostics);
  }
  const found = opened.opened.reader.get(parsedOptions.output.caseId);
  if (found.status === "error") {
    return showFailure([
      ...opened.opened.diagnostics,
      ...found.diagnostics.map((entry) => createTestEvidenceDiagnostic({
        caseId: entry.stateId ?? undefined,
        category: "index",
        code: entry.code,
        message: entry.message,
        path: entry.path ?? testEvidenceLedgerIndexPath,
        severity: "error"
      }))
    ]);
  }
  if (found.value === null) {
    return showFailure([
      ...opened.opened.diagnostics,
      createTestEvidenceDiagnostic({
        caseId: parsedOptions.output.caseId,
        category: "query",
        code: "query.case-missing",
        message: `Test evidence Case does not exist: ${parsedOptions.output.caseId}`,
        severity: "error"
      })
    ]);
  }

  const source = await readLedgerCaseSource(
    parsedOptions.output.workspaceRoot,
    found.value.state.sourcePath
  );
  if (source.value === null) {
    return showFailure([
      ...opened.opened.diagnostics,
      ...source.diagnostics
    ]);
  }
  if (source.value.id !== parsedOptions.output.caseId) {
    return showFailure([
      ...opened.opened.diagnostics,
      createTestEvidenceDiagnostic({
        caseId: parsedOptions.output.caseId,
        category: "index",
        code: "state-index.index-stale",
        message: `${testEvidenceLedgerIndexPath} no longer locates ${parsedOptions.output.caseId} in ${found.value.state.sourcePath}`,
        path: testEvidenceLedgerIndexPath,
        severity: "error"
      })
    ]);
  }

  const entityById = new Map(
    opened.opened.revisionSource.entityIndex.value.entities.map(
      (entity) => [entity.id, entity]
    )
  );
  const tests: TestEntity[] = [];
  const relationDiagnostics: TestEvidenceDiagnostic[] = [];
  for (const testId of source.value.case.testIds) {
    const entity = entityById.get(testId);
    if (entity === undefined) {
      relationDiagnostics.push(createTestEvidenceDiagnostic({
        caseId: source.value.id,
        category: "relation",
        code: "relation.test-unknown",
        message: `${source.value.id} references unknown Test entity ${testId}`,
        path: source.value.path,
        severity: "error",
        testId
      }));
      continue;
    }
    tests.push({
      id: entity.id,
      name: entity.name,
      locators: [...entity.locators]
    });
  }
  if (relationDiagnostics.length > 0) {
    return showFailure([
      ...opened.opened.diagnostics,
      ...relationDiagnostics
    ]);
  }

  const currentRevision = await readTestEvidenceLedgerRevision(
    parsedOptions.output.workspaceRoot
  );
  if (currentRevision.source === null) {
    return showFailure([
      ...opened.opened.diagnostics,
      ...currentRevision.diagnostics
    ]);
  }
  if (!sameTargetRevision({
    caseId: parsedOptions.output.caseId,
    current: currentRevision.source.sourceRevision,
    observedFingerprint: source.value.fingerprint,
    opened: opened.opened.revisionSource.sourceRevision
  })) {
    return showFailure([
      ...opened.opened.diagnostics,
      createTestEvidenceDiagnostic({
        caseId: parsedOptions.output.caseId,
        category: "index",
        code: "state-index.source-changed",
        message: "the entity index or target Case changed while composing the show result; retry after the source is stable",
        path: found.value.state.sourcePath,
        severity: "error"
      })
    ]);
  }

  return v.parse(testEvidenceCaseShowResultSchema, {
    case: source.value.case,
    diagnostics: opened.opened.diagnostics,
    indexPath: testEvidenceLedgerIndexPath,
    ledgerPath: testEvidenceLedgerPath,
    markdown: source.value.normalizedMarkdown,
    schemaVersion: testEvidenceLedgerSchemaVersion,
    tests
  });
}

function showFailure(
  diagnostics: readonly TestEvidenceDiagnostic[]
): TestEvidenceCaseShowResult {
  return v.parse(testEvidenceCaseShowResultSchema, {
    case: null,
    diagnostics: [...diagnostics],
    indexPath: testEvidenceLedgerIndexPath,
    ledgerPath: testEvidenceLedgerPath,
    markdown: null,
    schemaVersion: testEvidenceLedgerSchemaVersion,
    tests: []
  });
}
