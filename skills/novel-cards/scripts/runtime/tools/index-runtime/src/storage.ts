/*
 * Synced TypeScript runtime; repository maintenance edits tools/index-runtime/src/storage.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/index-runtime/src/storage.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/index-runtime/src/storage.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/novel-cards
 * Rebuild: bun run sync:novel-cards-cli
 */
export { resolveIndexPath } from "./index-path.ts";
export {
  loadCurrentStateIndex,
  loadStateIndex,
  loadStateIndexAtResolvedPath
} from "./storage-load.ts";
export { syncStateIndex } from "./storage-sync.ts";
