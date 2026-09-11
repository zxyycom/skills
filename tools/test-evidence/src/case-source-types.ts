import type {
  TestEvidenceCase,
  TestEvidenceDiagnostic
} from "./core-schemas.ts";

export type CaseTextSource = Readonly<{ path: string; text: string }>;

export type IdentifiedCaseSource = CaseTextSource & {
  fingerprint: string;
  id: string;
  normalizedMarkdown: string;
  title: string;
};

export type ParsedCaseSource = IdentifiedCaseSource & {
  case: TestEvidenceCase;
};

export type CaseSourceResult<Value> =
  | { diagnostics: []; value: Value }
  | { diagnostics: TestEvidenceDiagnostic[]; value: null };
