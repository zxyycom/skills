/*
 * Synced TypeScript runtime; repository maintenance edits tools/test-evidence/src/case-source.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/test-evidence/src/case-source.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/test-evidence/src/case-source.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/test-evidence-review
 * Rebuild: bun run sync:test-evidence-cli
 */
export {
  caseSourceFingerprint,
  identifyCaseSource,
  normalizeCaseMarkdown
} from "./case-source-identity.ts";
export { parseCaseSource } from "./case-source-parser.ts";
export type {
  CaseSourceResult,
  CaseTextSource,
  IdentifiedCaseSource,
  ParsedCaseSource
} from "./case-source-types.ts";
