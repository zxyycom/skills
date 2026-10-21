/*
 * Synced TypeScript runtime; repository maintenance edits tools/index-runtime/src/index.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/index-runtime/src/index.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/index-runtime/src/index.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
export { sameStateSourceRevision } from "./canonicalization.ts";
export {
  buildStateIndex,
  canonicalizeStateIndex,
  defineStateIndexDefinition,
  expectationOf,
  parseStateIndex,
  queryFieldDefinitionsOf,
  serializeStateIndex
} from "./snapshot.ts";
export { findStateIndexEntry, queryStateIndex } from "./query.ts";
export {
  createStateIndexReader,
  createStateIndexRuntime,
  type StateIndexAllQuery,
  type StateIndexQueryOptions,
  type StateIndexReader,
  type StateIndexRuntime
} from "./runtime.ts";
export {
  loadCurrentStateIndex,
  loadCurrentStateIndexReader,
  loadStateIndex,
  loadStateIndexReader,
  syncStateIndex
} from "./storage.ts";
export {
  stageSelectedIndexEntries,
  type StateIndexEntrySelectionResolver
} from "./staging.ts";
export {
  sameStateIndexCollectionMetadata,
  validateStateIndexSelectedIds,
  type StateIndexSelectedIdsResult
} from "./selection.ts";
export { hasEntry, selectTargetSnapshot } from "./staging-selection.ts";
export { buildStateIndexFromSnapshot } from "./snapshot-builder.ts";
export type {
  JsonObject,
  JsonPrimitive,
  JsonValue,
  DeepReadonly,
  ReadonlyJsonObject,
  ReadonlyJsonValue,
  StateIndex,
  StateIndexContext,
  StateIndexDefinition,
  StateIndexDiagnostic,
  StateIndexEachPathSegment,
  StateIndexEntry,
  StateIndexEntryStageResult,
  StateIndexExpectation,
  StateIndexFilesystemDiagnostic,
  StateIndexFilter,
  StateIndexKeyMode,
  StateIndexKeyScalar,
  StateIndexPendingMutation,
  StateIndexProjectionContext,
  StateIndexQuery,
  StateIndexQueryField,
  StateIndexQueryFieldDefinition,
  StateIndexQueryOutput,
  StateIndexQuerySource,
  StateIndexQueryValue,
  StateIndexRangeScalar,
  StateIndexResult,
  StateIndexSort,
  StateIndexStatePathSegment,
  StateIndexSyncMode,
  StateIndexSyncScope,
  StateIndexSyncResult,
  StateIndexVersionControlDiagnostic,
  ReadonlyStateIndex,
  StateRecord,
  StateSnapshot,
  StateSourceRevision
} from "./types.ts";
export { isJsonObject, isJsonValue } from "./json.ts";
export {
  createStateIndexSchema,
  createStateSourceRevisionSchema,
  isStateIndexKeyName,
  isStateIndexNamespace,
  isStateIndexText,
  stateIndexFilterSchema,
  stateIndexIdSchema,
  stateIndexKeyNameSchema,
  stateIndexKeyScalarSchema,
  stateIndexNamespaceSchema,
  stateIndexQueryDefaultLimit,
  stateIndexQueryMaximumLimit,
  stateIndexQuerySchema,
  stateIndexRangeScalarSchema,
  stateIndexRevisionSchema,
  stateIndexSchema,
  stateIndexSchemaVersion,
  stateIndexSortSchema,
  stateSourceRevisionSchema,
  stateIndexTextSchema
} from "./schemas.ts";
