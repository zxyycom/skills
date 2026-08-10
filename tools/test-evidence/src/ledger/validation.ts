import path from "node:path";
import * as v from "valibot";
import {
  createTestEvidenceDiagnostic,
  sortUniqueTestEvidenceDiagnostics
} from "./diagnostics.ts";
import {
  emptyTestEvidenceLedgerSummary,
  readTestEvidenceLedgerSource
} from "./ledger-source.ts";
import { syncLoadedTestEvidenceLedgerIndex } from "./state-index.ts";
import {
  testEvidenceLedgerIndexPath,
  testEvidenceLedgerPath,
  testEvidenceLedgerReportSchema,
  testEvidenceLedgerSchemaVersion,
  validateTestEvidenceLedgerOptionsSchema,
  type TestEvidenceLedgerReport,
  type ValidateTestEvidenceLedgerOptions
} from "./schemas.ts";

export async function validateTestEvidenceLedger(
  options: ValidateTestEvidenceLedgerOptions
): Promise<TestEvidenceLedgerReport> {
  const parsedOptions = v.safeParse(
    validateTestEvidenceLedgerOptionsSchema,
    options
  );
  if (!parsedOptions.success) {
    return v.parse(testEvidenceLedgerReportSchema, {
      diagnostics: [createTestEvidenceDiagnostic({
        category: "query",
        code: "query.options-invalid",
        message: `Invalid ledger API options: ${parsedOptions.issues.map((issue) => issue.message).join("; ")}`,
        severity: "error"
      })],
      entityIndex: null,
      indexPath: testEvidenceLedgerIndexPath,
      ledgerPath: testEvidenceLedgerPath,
      schemaVersion: testEvidenceLedgerSchemaVersion,
      sourceRevision: null,
      summary: emptyTestEvidenceLedgerSummary()
    });
  }

  const workspaceRoot = path.resolve(parsedOptions.output.workspaceRoot);
  const source = await readTestEvidenceLedgerSource(workspaceRoot);
  const diagnostics = [...source.diagnostics];
  if (source.source !== null) {
    const synchronized = await syncLoadedTestEvidenceLedgerIndex({
      mode: "check",
      source: source.source,
      workspaceRoot
    });
    diagnostics.push(...synchronized.diagnostics);
  }

  return v.parse(testEvidenceLedgerReportSchema, {
    diagnostics: sortUniqueTestEvidenceDiagnostics(diagnostics),
    entityIndex: source.entityIndex === null
      ? null
      : { ...source.entityIndex.identity },
    indexPath: testEvidenceLedgerIndexPath,
    ledgerPath: testEvidenceLedgerPath,
    schemaVersion: testEvidenceLedgerSchemaVersion,
    sourceRevision: source.source === null
      ? null
      : {
        entries: { ...source.source.snapshot.sourceRevision.entries },
        metadata: source.source.snapshot.sourceRevision.metadata
      },
    summary: { ...source.summary }
  });
}
