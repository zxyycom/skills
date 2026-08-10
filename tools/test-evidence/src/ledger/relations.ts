import { createTestEvidenceDiagnostic } from "./diagnostics.ts";
import type {
  TestEntityIndex,
  TestEvidenceDiagnostic,
  TestEvidenceLedgerCase
} from "./schemas.ts";

export type ClosedTestEvidenceRelations = {
  relationCount: number;
  testToCaseIds: ReadonlyMap<string, readonly string[]>;
};

export type ClosedTestEvidenceRelationsResult = {
  diagnostics: TestEvidenceDiagnostic[];
  relations: ClosedTestEvidenceRelations | null;
};

export function validateClosedTestEvidenceRelations(
  entityIndex: TestEntityIndex,
  cases: readonly TestEvidenceLedgerCase[]
): ClosedTestEvidenceRelationsResult {
  const diagnostics: TestEvidenceDiagnostic[] = [];
  const knownTestIds = new Set(
    entityIndex.entities.map((entity) => entity.id)
  );
  const testToCaseIds = new Map<string, string[]>();
  for (const testId of knownTestIds) {
    testToCaseIds.set(testId, []);
  }

  let relationCount = 0;
  for (const ledgerCase of cases) {
    const seen = new Set<string>();
    if (ledgerCase.testIds.length === 0) {
      diagnostics.push(createTestEvidenceDiagnostic({
        caseId: ledgerCase.id,
        category: "relation",
        code: "relation.tests-empty",
        message: `${ledgerCase.id} must reference at least one Test entity`,
        path: ledgerCase.sourcePath,
        severity: "error"
      }));
    }
    for (const testId of ledgerCase.testIds) {
      if (seen.has(testId)) {
        diagnostics.push(createTestEvidenceDiagnostic({
          caseId: ledgerCase.id,
          category: "relation",
          code: "relation.duplicate",
          message: `${ledgerCase.id} -> ${testId} appears more than once`,
          path: ledgerCase.sourcePath,
          severity: "error",
          testId
        }));
        continue;
      }
      seen.add(testId);
      if (!knownTestIds.has(testId)) {
        diagnostics.push(createTestEvidenceDiagnostic({
          caseId: ledgerCase.id,
          category: "relation",
          code: "relation.test-unknown",
          message: `${ledgerCase.id} references unknown Test entity ${testId}`,
          path: ledgerCase.sourcePath,
          severity: "error",
          testId
        }));
        continue;
      }
      testToCaseIds.get(testId)?.push(ledgerCase.id);
      relationCount += 1;
    }
  }

  for (const [testId, caseIds] of testToCaseIds) {
    caseIds.sort(compareText);
    if (caseIds.length === 0) {
      diagnostics.push(createTestEvidenceDiagnostic({
        category: "relation",
        code: "relation.test-unreferenced",
        message: `Test entity ${testId} is not referenced by any Case`,
        path: "docs/test-evidence/test-entity-index.json",
        severity: "error",
        testId
      }));
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

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
