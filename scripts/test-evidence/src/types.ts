export const supportedLanguages = [
  "rust",
  "typescript",
  "javascript",
  "python",
  "go",
  "java",
  "csharp"
] as const;

export const unregisteredPolicies = ["ignore", "warn", "error"] as const;
export const reviewTriggerPolicies = ["warn", "error"] as const;
export const caseStatuses = ["active", "planned"] as const;
export const verificationModes = ["automated", "review", "exempt"] as const;
export const sourceMarkerRoles = ["main", "derived", "exempt"] as const;
export const reviewResults = ["pass", "findings", "blocked"] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number];
export type UnregisteredPolicy = (typeof unregisteredPolicies)[number];
export type ReviewTriggerPolicy = (typeof reviewTriggerPolicies)[number];
export type CaseStatus = (typeof caseStatuses)[number];
export type VerificationMode = (typeof verificationModes)[number];
export type SourceMarkerRole = (typeof sourceMarkerRoles)[number];
export type ReviewResult = (typeof reviewResults)[number];

export type TestEvidenceConfig = {
  caseIdPattern: string;
  catalogPath: string;
  ignoreGlobs: string[];
  includeGlobs: string[];
  languages: SupportedLanguage[];
  reviewMaxAgeDays?: number;
  reviewTriggers: ReviewTriggerPolicy;
  schemaVersion: 2;
  unregisteredTestEntries: UnregisteredPolicy;
};

export type SourceMarker = {
  attachedEntryOffset: number | null;
  id: string;
  line: number;
  offset: number;
  relativePath: string;
  role: SourceMarkerRole;
};

export type TestEntry = {
  column: number;
  language: SupportedLanguage;
  line: number;
  offset: number;
};

export type SourceFile = {
  markers: SourceMarker[];
  relativePath: string;
  testEntries: TestEntry[];
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
