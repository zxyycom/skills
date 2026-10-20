/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/candidate.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/candidate.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/candidate.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
export {
  createInvestigationCandidate,
  createInvestigationCandidateFromCli
} from "./candidate-create.ts";
export {
  listInvestigationCandidates,
  showInvestigationCandidate
} from "./candidate-access.ts";
export { readInvestigationCandidate } from "./candidate-document.ts";
export { readCandidateAuthoringResourceReferences } from "./candidate-resource-references.ts";
export { serializeInvestigationCandidate } from "./candidate-format.ts";
