/*
 * Synced TypeScript runtime; repository maintenance edits tools/index-runtime/src/staging.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/index-runtime/src/staging.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/index-runtime/src/staging.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
export {
  stageSelectedIndexEntries,
  stageSelectedIndexEntriesWithRepository
} from "./staging-operation.ts";
export type { StateIndexEntrySelectionResolver } from "./staging-operation.ts";
