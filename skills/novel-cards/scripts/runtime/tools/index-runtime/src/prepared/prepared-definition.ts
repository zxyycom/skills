/*
 * Synced TypeScript runtime; repository maintenance edits tools/index-runtime/src/prepared/prepared-definition.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/index-runtime/src/prepared/prepared-definition.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/index-runtime/src/prepared/prepared-definition.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/novel-cards
 * Rebuild: bun run sync:novel-cards-cli
 */
import {
  defineStateIndexDefinition,
  validateStateIndexDefinition
} from "../definition.ts";
import { failure } from "../diagnostics.ts";
import type {
  JsonObject,
  StateIndexDefinition,
  StateIndexResult
} from "../types.ts";

export function preparationDefinition<
  State extends object,
  Metadata extends JsonObject
>(
  options: Readonly<{
    definition: StateIndexDefinition<State, Metadata>;
    indexPath: string;
  }>
): StateIndexResult<StateIndexDefinition<State, Metadata>> {
  const errors = validateStateIndexDefinition(options.definition);
  return errors.length > 0
    ? failure("state-index.definition-invalid", errors.join("; "), {
        path: options.indexPath
      })
    : {
        diagnostics: [],
        status: "ok",
        value: defineStateIndexDefinition(options.definition)
      };
}

export function sameDefinition<
  State extends object,
  Metadata extends JsonObject
>(
  left: StateIndexDefinition<State, Metadata>,
  right: StateIndexDefinition<State, Metadata>
): boolean {
  return (
    left.namespace === right.namespace &&
    left.definitionVersion === right.definitionVersion &&
    left.fieldOrder === right.fieldOrder &&
    left.parseMetadata === right.parseMetadata &&
    left.parseState === right.parseState &&
    left.validateIndex === right.validateIndex &&
    left.read === right.read &&
    left.readRevision === right.readRevision &&
    validateStateIndexDefinition(right).length === 0 &&
    JSON.stringify(left.queryFields) ===
      JSON.stringify(defineStateIndexDefinition(right).queryFields)
  );
}
