import type {
  TestEvidenceCaseView,
  TestEvidenceDiagnostic,
  TestEvidenceInspection,
  TestEvidenceQueryResult
} from "./types.ts";
import { testEvidenceReportSchemaVersion } from "./types.ts";

export function querySourceAvailable(
  inspection: TestEvidenceInspection
): boolean {
  return inspection.configurationValid
    && inspection.inventoryAvailable
    && inspection.catalogAvailable;
}

export function createQueryResult(
  inspection: TestEvidenceInspection,
  cases: readonly TestEvidenceCaseView[],
  additionalDiagnostics: readonly TestEvidenceDiagnostic[] = []
): TestEvidenceQueryResult {
  const diagnostics = [
    ...inspection.report.diagnostics.map((diagnostic) => ({
      ...diagnostic,
      blocking: false
    })),
    ...additionalDiagnostics
  ];
  return {
    cases: [...cases],
    diagnostics,
    incomplete: diagnostics.length > 0,
    reviewTriggers: inspection.report.reviewTriggers.filter((trigger) =>
      cases.some((entry) => entry.id === trigger.caseId)
    ),
    schemaVersion: testEvidenceReportSchemaVersion
  };
}

export function createQueryFailureResult(
  diagnostics: readonly TestEvidenceDiagnostic[]
): TestEvidenceQueryResult {
  return {
    cases: [],
    diagnostics: [...diagnostics],
    incomplete: true,
    reviewTriggers: [],
    schemaVersion: testEvidenceReportSchemaVersion
  };
}
