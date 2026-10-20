/*
 * Synced TypeScript runtime; repository maintenance edits tools/change-plan/src/change-deletion.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/change-plan/src/change-deletion.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/change-plan/src/change-deletion.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/change-plan
 * Rebuild: bun run sync:change-plan-cli
 */
export {
  ensureChangeTombstoneRoot,
  executePreparedChangeDeletion
} from "./change-deletion-execute.ts";
export { prepareChangeDeletion } from "./change-deletion-prepare.ts";
export type {
  ChangeDeletionExecution,
  ChangeDeletionOutcome,
  ChangeDeletionPreparation
} from "./change-deletion-types.ts";
