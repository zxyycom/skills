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
