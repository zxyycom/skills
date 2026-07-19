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
export const caseStatuses = ["active", "planned"] as const;
export const verificationModes = ["automated", "review", "exempt"] as const;
export const sourceMarkerRoles = ["main", "derived", "exempt"] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number];
export type UnregisteredPolicy = (typeof unregisteredPolicies)[number];
export type CaseStatus = (typeof caseStatuses)[number];
export type VerificationMode = (typeof verificationModes)[number];
export type SourceMarkerRole = (typeof sourceMarkerRoles)[number];

export type TestEvidenceConfig = {
  caseIdPattern: string;
  catalogPath: string;
  ignoreGlobs: string[];
  includeGlobs: string[];
  languages: SupportedLanguage[];
  schemaVersion: 1;
  unregisteredTestFiles: UnregisteredPolicy;
};

export type SourceMarker = {
  id: string;
  line: number;
  relativePath: string;
  role: SourceMarkerRole;
};

export type SourceFile = {
  detectedLanguages: SupportedLanguage[];
  markers: SourceMarker[];
  relativePath: string;
};

export type TestEvidenceSummary = {
  activeAutomatedCases: number;
  catalogCases: number;
  derivedMarkers: number;
  discoveredTestFiles: number;
  exemptCases: number;
  exemptMarkers: number;
  exemptTestFiles: number;
  mainMarkers: number;
  plannedAutomatedCases: number;
  reviewCases: number;
  unregisteredTestFiles: number;
};

export type TestEvidenceReport = {
  errors: string[];
  summary: TestEvidenceSummary;
  warnings: string[];
};
