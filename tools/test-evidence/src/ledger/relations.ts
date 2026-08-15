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
    const seen = new Set<string>();
    if (ledgerCase.testIds.length === 0) {
      diagnostics.push(
        createTestEvidenceDiagnostic({
          caseId: ledgerCase.id,
          category: "relation",
          code: "relation.tests-empty",
          message: `${ledgerCase.id} must reference at least one Test entity`,
          path: ledgerCase.sourcePath,
          severity: "error"
        })
      );
    }
    for (const testId of ledgerCase.testIds) {
      if (seen.has(testId)) {
        diagnostics.push(
          createTestEvidenceDiagnostic({
            caseId: ledgerCase.id,
            category: "relation",
            code: "relation.duplicate",
            message: `${ledgerCase.id} -> ${testId} appears more than once`,
            path: ledgerCase.sourcePath,
            severity: "error",
            testId
          })
        );
        continue;
      }
      seen.add(testId);
      if (!knownTestIds.has(testId)) {
        diagnostics.push(
          createTestEvidenceDiagnostic({
            caseId: ledgerCase.id,
            category: "relation",
            code: "relation.test-unknown",
            message: `${ledgerCase.id} references unknown Test entity ${testId}`,
            path: ledgerCase.sourcePath,
            severity: "error",
            testId
          })
        );
        continue;
      }
      testToCaseIds.get(testId)?.push(ledgerCase.id);
      relationCount += 1;
    }
  }

  for (const [testId, caseIds] of testToCaseIds) {
    caseIds.sort(compareLexicalText);
    if (caseIds.length === 0) {
      diagnostics.push(
        createTestEvidenceDiagnostic({
          category: "relation",
          code: "relation.test-unreferenced",
          message: `Test entity ${testId} is not referenced by any Case`,
          path: testEntityIndexPath,
          severity: "error",
          testId
        })
      );
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
