/*
 * Synced TypeScript runtime; repository maintenance edits tools/index-runtime/src/snapshot/snapshot.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/index-runtime/src/snapshot/snapshot.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/index-runtime/src/snapshot/snapshot.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/test-evidence-review
 * Rebuild: bun run sync:test-evidence-cli
 */
export {
  defineStateIndexDefinition,
  expectationOf,
  queryFieldDefinitionsOf
} from "../definition.ts";
export { canonicalizeStateIndex } from "../protocol/canonicalization.ts";
export {
  normalizeStateIndex,
  projectStateIndexState,
  readonlyStateIndexMetadata
} from "../protocol/projection.ts";
export { buildStateIndex } from "./snapshot-builder.ts";
export { parseStateIndex, serializeStateIndex } from "./snapshot-parser.ts";
