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

export type SupportedLanguage = (typeof supportedLanguages)[number];
export type UnregisteredPolicy = (typeof unregisteredPolicies)[number];

export type TestEvidenceConfig = {
  caseIdPattern: string;
  catalogPath: string;
  ignoreGlobs: string[];
  includeGlobs: string[];
  languages: SupportedLanguage[];
  schemaVersion: 1;
  unregisteredTestFiles: UnregisteredPolicy;
};

export type SourceMarkerKind = "case" | "supports" | "test-exempt";

export type SourceMarker = {
  id: string | null;
  kind: SourceMarkerKind;
  line: number;
  reason: string | null;
  relativePath: string;
};

export type SourceFile = {
  detectedLanguages: SupportedLanguage[];
  markers: SourceMarker[];
  relativePath: string;
};

export type TestEvidenceSummary = {
  catalogCases: number;
  discoveredTestFiles: number;
  exemptTestFiles: number;
  implementedCases: number;
  plannedCases: number;
  primaryMarkers: number;
  supportingMarkers: number;
  unregisteredTestFiles: number;
};

export type TestEvidenceReport = {
  errors: string[];
  summary: TestEvidenceSummary;
  warnings: string[];
};
