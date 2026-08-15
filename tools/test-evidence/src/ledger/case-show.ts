import * as v from "valibot";
import { readLedgerCaseSource } from "./case-source.ts";
import {
  createInvalidTestEvidenceOptionsDiagnostic,
  createTestEvidenceDiagnostic
} from "./diagnostics.ts";
import { openTestEvidenceLedgerIndex } from "./index-reader.ts";
import {
  readTestEvidenceLedgerRevision,
  sameTargetTestEvidenceLedgerRevision
} from "./ledger-source.ts";
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
import { mapStateIndexDiagnostics } from "./state-index.ts";

export async function showTestEvidenceCase(
  options: ShowTestEvidenceCaseOptions
): Promise<TestEvidenceCaseShowResult> {
  const parsedOptions = v.safeParse(showTestEvidenceCaseOptionsSchema, options);
  if (!parsedOptions.success) {
    return showFailure([
      createInvalidTestEvidenceOptionsDiagnostic(parsedOptions.issues)
    ]);
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
      ...opened.diagnostics,
      ...mapStateIndexDiagnostics(found.diagnostics)
    ]);
  }
  if (found.value === null) {
    return showFailure([
      ...opened.diagnostics,
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
    return showFailure([...opened.diagnostics, ...source.diagnostics]);
  }
  if (source.value.id !== parsedOptions.output.caseId) {
    return showFailure([
      ...opened.diagnostics,
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

  const resolvedTests = resolveCaseTests({
    caseId: source.value.id,
    entities: opened.opened.revisionSource.entityIndex.value.entities,
    sourcePath: source.value.path,
    testIds: source.value.case.testIds
  });
  if (resolvedTests.diagnostics.length > 0) {
    return showFailure([...opened.diagnostics, ...resolvedTests.diagnostics]);
  }

  const currentRevision = await readTestEvidenceLedgerRevision(
    parsedOptions.output.workspaceRoot
  );
  if (currentRevision.source === null) {
    return showFailure([...opened.diagnostics, ...currentRevision.diagnostics]);
  }
  if (
    !sameTargetTestEvidenceLedgerRevision({
      caseId: parsedOptions.output.caseId,
      current: currentRevision.source.sourceRevision,
      observedFingerprint: source.value.fingerprint,
      opened: opened.opened.revisionSource.sourceRevision
    })
  ) {
    return showFailure([
      ...opened.diagnostics,
      createTestEvidenceDiagnostic({
        caseId: parsedOptions.output.caseId,
        category: "index",
        code: "state-index.source-changed",
        message:
          "the entity index or target Case changed while composing the show result; retry after the source is stable",
        path: found.value.state.sourcePath,
        severity: "error"
      })
    ]);
  }

  return v.parse(testEvidenceCaseShowResultSchema, {
    case: source.value.case,
    diagnostics: opened.diagnostics,
    indexPath: testEvidenceLedgerIndexPath,
    ledgerPath: testEvidenceLedgerPath,
    markdown: source.value.normalizedMarkdown,
    schemaVersion: testEvidenceLedgerSchemaVersion,
    tests: resolvedTests.tests
  });
}

function resolveCaseTests(options: {
  caseId: string;
  entities: readonly TestEntity[];
  sourcePath: string;
  testIds: readonly string[];
}): {
  diagnostics: TestEvidenceDiagnostic[];
  tests: TestEntity[];
} {
  const entityById = new Map(
    options.entities.map((entity) => [entity.id, entity])
  );
  const diagnostics: TestEvidenceDiagnostic[] = [];
  const tests: TestEntity[] = [];
  for (const testId of options.testIds) {
    const entity = entityById.get(testId);
    if (entity === undefined) {
      diagnostics.push(
        createTestEvidenceDiagnostic({
          caseId: options.caseId,
          category: "relation",
          code: "relation.test-unknown",
          message: `${options.caseId} references unknown Test entity ${testId}`,
          path: options.sourcePath,
          severity: "error",
          testId
        })
      );
      continue;
    }
    tests.push({
      id: entity.id,
      name: entity.name,
      locators: [...entity.locators]
    });
  }
  return { diagnostics, tests };
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
