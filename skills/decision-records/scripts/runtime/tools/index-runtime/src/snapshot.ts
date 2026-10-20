/*
 * Synced TypeScript runtime; repository maintenance edits tools/index-runtime/src/snapshot.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/index-runtime/src/snapshot.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/index-runtime/src/snapshot.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
export {
  defineStateIndexDefinition,
  expectationOf,
  queryFieldDefinitionsOf
} from "./definition.ts";
export { canonicalizeStateIndex } from "./canonicalization.ts";
export {
  normalizeStateIndex,
  projectStateIndexState,
  readonlyStateIndexMetadata
} from "./projection.ts";
export { buildStateIndex } from "./snapshot-builder.ts";
export { parseStateIndex, serializeStateIndex } from "./snapshot-parser.ts";
