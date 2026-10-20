/*
 * Synced TypeScript runtime; repository maintenance edits tools/test-evidence/src/case-source-types.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/test-evidence/src/case-source-types.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/test-evidence/src/case-source-types.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/test-evidence-review
 * Rebuild: bun run sync:test-evidence-cli
 */
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
