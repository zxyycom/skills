import { compareLexicalText } from "./canonicalization.ts";
import { createTestEvidenceDiagnostic } from "./diagnostics.ts";
import {
  testEntityIndexPath,
  type TestEntityIndex,
  type TestEvidenceDiagnostic,
  type TestEvidenceLedgerCase
} from "./schemas.ts";

export type ClosedTestEvidenceRelations = {
  relationCount: number;
  testToCaseIds: ReadonlyMap<string, readonly string[]>;
};

export type ClosedTestEvidenceRelationsResult =
  | {
      diagnostics: [];
      relations: ClosedTestEvidenceRelations;
    }
  | {
      diagnostics: TestEvidenceDiagnostic[];
      relations: null;
    };

export function validateClosedTestEvidenceRelations(
  entityIndex: TestEntityIndex,
  cases: readonly TestEvidenceLedgerCase[]
): ClosedTestEvidenceRelationsResult {
  const diagnostics: TestEvidenceDiagnostic[] = [];
  const knownTestIds = new Set(entityIndex.entities.map((entity) => entity.id));
  const testToCaseIds = new Map<string, string[]>();
  for (const testId of knownTestIds) {
    testToCaseIds.set(testId, []);
  }

  let relationCount = 0;
  for (const ledgerCase of cases) {
    relationCount += validateCaseRelations(
      ledgerCase,
      knownTestIds,
      testToCaseIds,
      diagnostics
    );
  }

  for (const [testId, caseIds] of testToCaseIds) {
    caseIds.sort(compareLexicalText);
    if (caseIds.length === 0) {
      diagnostics.push(unreferencedTestDiagnostic(testId));
    }
  }

  return diagnostics.length > 0
    ? { diagnostics, relations: null }
    : {
        diagnostics: [],
        relations: {
          relationCount,
          testToCaseIds
        }
      };
}

function validateCaseRelations(
  ledgerCase: TestEvidenceLedgerCase,
  knownTestIds: ReadonlySet<string>,
  testToCaseIds: Map<string, string[]>,
  diagnostics: TestEvidenceDiagnostic[]
): number {
  const seen = new Set<string>();
  if (ledgerCase.testIds.length === 0) {
    diagnostics.push(caseRelationDiagnostic(ledgerCase, undefined, "empty"));
  }
  let relationCount = 0;
  for (const testId of ledgerCase.testIds) {
    if (seen.has(testId)) {
      diagnostics.push(caseRelationDiagnostic(ledgerCase, testId, "duplicate"));
      continue;
    }
    seen.add(testId);
    if (!knownTestIds.has(testId)) {
      diagnostics.push(caseRelationDiagnostic(ledgerCase, testId, "unknown"));
      continue;
    }
    testToCaseIds.get(testId)?.push(ledgerCase.id);
    relationCount += 1;
  }
  return relationCount;
}

function caseRelationDiagnostic(
  ledgerCase: TestEvidenceLedgerCase,
  testId: string | undefined,
  kind: "duplicate" | "empty" | "unknown"
): TestEvidenceDiagnostic {
  const details = {
    duplicate: {
      code: "relation.duplicate",
      message: `${ledgerCase.id} -> ${testId} appears more than once`
    },
    empty: {
      code: "relation.tests-empty",
      message: `${ledgerCase.id} must reference at least one Test entity`
    },
    unknown: {
      code: "relation.test-unknown",
      message: `${ledgerCase.id} references unknown Test entity ${testId}`
    }
  }[kind];
  return createTestEvidenceDiagnostic({
    caseId: ledgerCase.id,
    category: "relation",
    ...details,
    path: ledgerCase.sourcePath,
    severity: "error",
    testId
  });
}

function unreferencedTestDiagnostic(testId: string): TestEvidenceDiagnostic {
  return createTestEvidenceDiagnostic({
    category: "relation",
    code: "relation.test-unreferenced",
    message: `Test entity ${testId} is not referenced by any Case`,
    path: testEntityIndexPath,
    severity: "error",
    testId
  });
}
