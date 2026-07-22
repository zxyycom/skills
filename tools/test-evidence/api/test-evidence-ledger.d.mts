import type { TestEntryInventory } from "./test-entry-inventory.types.mjs";
import type { TestEvidenceInspection } from "./test-evidence-inspection.types.mjs";
import type { TestEvidenceLedgerConfig } from "./test-evidence-ledger-config.types.mjs";
import type { TestEvidenceQueryResult } from "./test-evidence-query-result.types.mjs";
import type { TestEvidenceReport } from "./test-evidence-report.types.mjs";

export type StandardOutputSchema<T> = {
  readonly "~standard": {
    readonly types?: { readonly input: unknown; readonly output: T };
    readonly validate: (value: unknown) => unknown;
  };
};

export type ValidateTestEvidenceLedgerOptions = {
  config?: unknown;
  configPath?: string;
  inventory: unknown;
  inventorySource?: string;
  workspaceRoot: string;
};

export type ParsedTestEntryInventory = {
  diagnostics: TestEvidenceReport["diagnostics"];
  inventory: TestEntryInventory | null;
};

export type TestEvidenceCaseView = TestEvidenceInspection["cases"][number];
export type TestEvidenceDiagnostic = TestEvidenceReport["diagnostics"][number];
export type TestEvidenceSummary = TestEvidenceReport["summary"];

export type {
  TestEntryInventory,
  TestEvidenceInspection,
  TestEvidenceLedgerConfig,
  TestEvidenceQueryResult,
  TestEvidenceReport
};

export declare const testEntryInventorySchema: StandardOutputSchema<TestEntryInventory>;
export declare const testEvidenceInspectionSchema: StandardOutputSchema<TestEvidenceInspection>;
export declare const testEvidenceLedgerConfigSchema: StandardOutputSchema<unknown>;
export declare const testEvidenceQueryResultSchema: StandardOutputSchema<TestEvidenceQueryResult>;
export declare const testEvidenceReportSchema: StandardOutputSchema<TestEvidenceReport>;

export declare function parseTestEntryInventory(
  value: unknown,
  source?: string
): ParsedTestEntryInventory;

export declare function inspectTestEvidenceLedger(
  options: ValidateTestEvidenceLedgerOptions
): Promise<TestEvidenceInspection>;

export declare function validateTestEvidenceLedger(
  options: ValidateTestEvidenceLedgerOptions
): Promise<TestEvidenceReport>;

export declare function runTestEvidenceLedgerCli(
  argv?: readonly string[]
): Promise<number>;
