/*
 * Synced TypeScript runtime; repository maintenance edits tools/index-runtime/src/storage/storage.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/index-runtime/src/storage/storage.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/index-runtime/src/storage/storage.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/test-evidence-review
 * Rebuild: bun run sync:test-evidence-cli
 */
export { resolveIndexPath } from "./index-path.ts";
export {
  loadCurrentStateIndex,
  loadStateIndex,
  loadStateIndexAtResolvedPath
} from "./storage-load.ts";
export { syncStateIndex } from "./storage-sync.ts";
export {
  loadCurrentStateIndexReader,
  loadStateIndexReader
} from "./storage-reader.ts";
