import type { TestEvidenceCaseShowResult } from "./test-evidence-case-show-result.types.mjs";
import type { TestEvidenceIndexSyncResult } from "./test-evidence-index-sync-result.types.mjs";
import type { TestEvidenceQueryResult } from "./test-evidence-query-result.types.mjs";
import type { TestEvidenceReport } from "./test-evidence-report.types.mjs";
import type { TestEvidenceStateIndex } from "./test-evidence-state-index.types.mjs";
import type { TestEvidenceTopicCatalog } from "./test-evidence-topic-catalog.types.mjs";
import type { TestEvidenceTopicsResult } from "./test-evidence-topics-result.types.mjs";

export type StandardOutputSchema<T> = {
  readonly "~standard": {
    readonly types?: { readonly input: unknown; readonly output: T };
    readonly validate: (value: unknown) => unknown;
  };
};

export type ValidateTestEvidenceOptions = {
  workspaceRoot: string;
};

export type QueryTestEvidenceOptions = {
  limit?: number;
  offset?: number;
  query?: string;
  topic?: string;
  workspaceRoot: string;
};

export type ListTestEvidenceTopicsOptions = {
  workspaceRoot: string;
};

export type ShowTestEvidenceCaseOptions = {
  caseId: string;
  workspaceRoot: string;
};

export type SyncTestEvidenceIndexOptions = {
  mode: "check" | "write";
  workspaceRoot: string;
};

export type TestEvidenceCaseState =
  TestEvidenceQueryResult["cases"][number];

export type {
  TestEvidenceCaseShowResult,
  TestEvidenceIndexSyncResult,
  TestEvidenceQueryResult,
  TestEvidenceReport,
  TestEvidenceStateIndex,
  TestEvidenceTopicCatalog,
  TestEvidenceTopicsResult
};

export declare const testEvidenceCaseShowResultSchema:
  StandardOutputSchema<TestEvidenceCaseShowResult>;
export declare const testEvidenceIndexSyncResultSchema:
  StandardOutputSchema<TestEvidenceIndexSyncResult>;
export declare const testEvidenceQueryResultSchema:
  StandardOutputSchema<TestEvidenceQueryResult>;
export declare const testEvidenceReportSchema:
  StandardOutputSchema<TestEvidenceReport>;
export declare const testEvidenceStateIndexSchema:
  StandardOutputSchema<TestEvidenceStateIndex>;
export declare const testEvidenceTopicCatalogSchema:
  StandardOutputSchema<TestEvidenceTopicCatalog>;
export declare const testEvidenceTopicsResultSchema:
  StandardOutputSchema<TestEvidenceTopicsResult>;

export declare function listTestEvidenceTopics(
  options: ListTestEvidenceTopicsOptions
): Promise<TestEvidenceTopicsResult>;

export declare function queryTestEvidence(
  options: QueryTestEvidenceOptions
): Promise<TestEvidenceQueryResult>;

export declare function showTestEvidenceCase(
  options: ShowTestEvidenceCaseOptions
): Promise<TestEvidenceCaseShowResult>;

export declare function syncTestEvidenceIndex(
  options: SyncTestEvidenceIndexOptions
): Promise<TestEvidenceIndexSyncResult>;

export declare function validateTestEvidence(
  options: ValidateTestEvidenceOptions
): Promise<TestEvidenceReport>;

export declare function runTestEvidenceCatalogCli(
  argv?: readonly string[]
): Promise<number>;
