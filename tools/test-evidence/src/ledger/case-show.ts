import * as v from "valibot";
import {
  readLedgerCaseSource,
  type ParsedLedgerCaseSource
} from "./case-source.ts";
import {
  createInvalidTestEvidenceOptionsDiagnostic,
  createTestEvidenceDiagnostic
} from "./diagnostics.ts";
import {
  openTestEvidenceLedgerIndex,
  type OpenedTestEvidenceLedgerIndex
} from "./index-reader.ts";
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

type ShowCaseLookup =
  | {
      diagnostics: TestEvidenceDiagnostic[];
      failure: null;
      opened: OpenedTestEvidenceLedgerIndex;
      source: ParsedLedgerCaseSource;
    }
  | {
      diagnostics: [];
      failure: TestEvidenceCaseShowResult;
      opened: null;
      source: null;
    };

export async function showTestEvidenceCase(
  options: ShowTestEvidenceCaseOptions
): Promise<TestEvidenceCaseShowResult> {
  const parsedOptions = v.safeParse(showTestEvidenceCaseOptionsSchema, options);
  if (!parsedOptions.success) {
    return showFailure([
      createInvalidTestEvidenceOptionsDiagnostic(parsedOptions.issues)
    ]);
  }

  const lookup = await lookupShowCase(parsedOptions.output);
  if (lookup.failure !== null) {
    return lookup.failure;
  }

  const resolvedTests = resolveCaseTests({
    caseId: lookup.source.id,
    entities: lookup.opened.revisionSource.entityIndex.value.entities,
    sourcePath: lookup.source.path,
    testIds: lookup.source.case.testIds
  });
  if (resolvedTests.diagnostics.length > 0) {
    return showFailure([...lookup.diagnostics, ...resolvedTests.diagnostics]);
  }

  const revisionDiagnostics = await showRevisionDiagnostics({
    caseId: parsedOptions.output.caseId,
    opened: lookup.opened,
    source: lookup.source,
    workspaceRoot: parsedOptions.output.workspaceRoot
  });
  if (revisionDiagnostics !== null) {
    return showFailure([...lookup.diagnostics, ...revisionDiagnostics]);
  }

  return v.parse(testEvidenceCaseShowResultSchema, {
    case: lookup.source.case,
    diagnostics: lookup.diagnostics,
    indexPath: testEvidenceLedgerIndexPath,
    ledgerPath: testEvidenceLedgerPath,
    markdown: lookup.source.normalizedMarkdown,
    schemaVersion: testEvidenceLedgerSchemaVersion,
    tests: resolvedTests.tests
  });
}

async function lookupShowCase(
  options: ShowTestEvidenceCaseOptions
): Promise<ShowCaseLookup> {
  const opened = await openTestEvidenceLedgerIndex(options.workspaceRoot);
  if (opened.opened === null) {
    return lookupFailure(opened.diagnostics);
  }
  const found = opened.opened.reader.get(options.caseId);
  if (found.status === "error") {
    return lookupFailure([
      ...opened.diagnostics,
      ...mapStateIndexDiagnostics(found.diagnostics)
    ]);
  }
  if (found.value === null) {
    return lookupFailure([
      ...opened.diagnostics,
      missingCaseDiagnostic(options.caseId)
    ]);
  }
  const source = await readLedgerCaseSource(
    options.workspaceRoot,
    found.value.state.sourcePath
  );
  if (source.value === null) {
    return lookupFailure([...opened.diagnostics, ...source.diagnostics]);
  }
  if (source.value.id !== options.caseId) {
    return lookupFailure([
      ...opened.diagnostics,
      staleCaseDiagnostic(options.caseId, found.value.state.sourcePath)
    ]);
  }
  return {
    diagnostics: opened.diagnostics,
    failure: null,
    opened: opened.opened,
    source: source.value
  };
}

function lookupFailure(
  diagnostics: readonly TestEvidenceDiagnostic[]
): ShowCaseLookup {
  return {
    diagnostics: [],
    failure: showFailure(diagnostics),
    opened: null,
    source: null
  };
}

async function showRevisionDiagnostics(options: {
  caseId: string;
  opened: OpenedTestEvidenceLedgerIndex;
  source: ParsedLedgerCaseSource;
  workspaceRoot: string;
}): Promise<TestEvidenceDiagnostic[] | null> {
  const currentRevision = await readTestEvidenceLedgerRevision(
    options.workspaceRoot
  );
  if (currentRevision.source === null) {
    return currentRevision.diagnostics;
  }
  const stable = sameTargetTestEvidenceLedgerRevision({
    caseId: options.caseId,
    current: currentRevision.source.sourceRevision,
    observedFingerprint: options.source.fingerprint,
    opened: options.opened.revisionSource.sourceRevision
  });
  return stable
    ? null
    : [sourceChangedDiagnostic(options.caseId, options.source.path)];
}

function missingCaseDiagnostic(caseId: string): TestEvidenceDiagnostic {
  return createTestEvidenceDiagnostic({
    caseId,
    category: "query",
    code: "query.case-missing",
    message: `Test evidence Case does not exist: ${caseId}`,
    severity: "error"
  });
}

function staleCaseDiagnostic(
  caseId: string,
  sourcePath: string
): TestEvidenceDiagnostic {
  return createTestEvidenceDiagnostic({
    caseId,
    category: "index",
    code: "state-index.index-stale",
    message: `${testEvidenceLedgerIndexPath} no longer locates ${caseId} in ${sourcePath}`,
    path: testEvidenceLedgerIndexPath,
    severity: "error"
  });
}

function sourceChangedDiagnostic(
  caseId: string,
  sourcePath: string
): TestEvidenceDiagnostic {
  return createTestEvidenceDiagnostic({
    caseId,
    category: "index",
    code: "state-index.source-changed",
    message:
      "the entity index or target Case changed while composing the show result; retry after the source is stable",
    path: sourcePath,
    severity: "error"
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
