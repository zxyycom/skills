/*
 * Synced TypeScript runtime; repository maintenance edits tools/index-runtime/src/canonicalization.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/index-runtime/src/canonicalization.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/index-runtime/src/canonicalization.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/novel-cards
 * Rebuild: bun run sync:novel-cards-cli
 */
import {
  canonicalizeTypedJsonObject,
  cloneAndFreezeTypedJsonObject,
  freezeObject
} from "./frozen-json.ts";
import { compareIndexText } from "./ordering.ts";
import { sameRecordMembers } from "./record.ts";
import { stateIndexSchemaVersion } from "./schemas.ts";
import type {
  JsonObject,
  StateIndex,
  StateIndexDefinition,
  StateSourceRevision
} from "./types.ts";

export function canonicalizeStateIndex<
  State extends object = JsonObject,
  Metadata extends JsonObject = JsonObject
>(
  index: StateIndex<State, Metadata>,
  definition?: StateIndexDefinition<State, Metadata>
): StateIndex<State, Metadata> {
  const metadata = canonicalizeTypedJsonObject(index.metadata);
  const entries = freezeObject(
    Object.fromEntries(
      Object.entries(index.entries)
        .sort(([left], [right]) => compareIndexText(left, right))
        .map(([id, state]) => [
          id,
          definition?.fieldOrder === "definition"
            ? cloneAndFreezeTypedJsonObject(state, false)
            : canonicalizeTypedJsonObject(state)
        ])
    )
  );
  const sourceRevision = canonicalizeStateSourceRevision(index.sourceRevision);
  if (definition?.fieldOrder === "definition") {
    return freezeObject({
      schemaVersion: stateIndexSchemaVersion,
      namespace: index.namespace,
      definitionVersion: index.definitionVersion,
      metadata,
      sourceRevision,
      entries
    });
  }
  return freezeObject({
    definitionVersion: index.definitionVersion,
    entries,
    metadata,
    namespace: index.namespace,
    schemaVersion: stateIndexSchemaVersion,
    sourceRevision
  });
}

export function canonicalizeStateSourceRevision(
  sourceRevision: StateSourceRevision
): StateSourceRevision {
  return freezeObject({
    entries: freezeObject(
      Object.fromEntries(
        Object.entries(sourceRevision.entries).sort(([left], [right]) =>
          compareIndexText(left, right)
        )
      )
    ),
    metadata: sourceRevision.metadata
  });
}

export function sameStateSourceRevision(
  left: StateSourceRevision,
  right: StateSourceRevision
): boolean {
  return (
    left.metadata === right.metadata &&
    sameRecordMembers(left.entries, right.entries) &&
    Object.entries(left.entries).every(
      ([id, revision]) => right.entries[id] === revision
    )
  );
}
