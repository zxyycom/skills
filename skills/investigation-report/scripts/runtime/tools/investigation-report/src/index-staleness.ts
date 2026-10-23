/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/index-staleness.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/index-staleness.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/index-staleness.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
export const persistedSnapshotBodyWarning =
  "The persisted Investigation index is stale; the metadata reflects the last published index snapshot while the body is read from the current investigation Markdown. Run sync-index to publish the current projection.";
