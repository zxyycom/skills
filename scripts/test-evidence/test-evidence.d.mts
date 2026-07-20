export type ValidateTestEvidenceOptions = {
  configPath?: string;
  workspaceRoot: string;
};

export type ReviewTrigger = {
  caseId: string;
  paths: string[];
  reasons: string[];
};

export type TestEvidenceSummary = {
  activeAutomatedCases: number;
  catalogCases: number;
  derivedMarkers: number;
  discoveredTestEntries: number;
  discoveredTestFiles: number;
  exemptCases: number;
  exemptMarkers: number;
  exemptTestEntries: number;
  mainMarkers: number;
  plannedAutomatedCases: number;
  reviewCases: number;
  reviewTriggers: number;
  unregisteredTestEntries: number;
};

export type TestEvidenceReport = {
  errors: string[];
  reviewTriggers: ReviewTrigger[];
  summary: TestEvidenceSummary;
  warnings: string[];
};

export declare function runTestEvidenceCli(
  argv?: readonly string[]
): Promise<number>;

export declare function validateTestEvidence(
  options: ValidateTestEvidenceOptions
): Promise<TestEvidenceReport>;
