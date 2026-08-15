import {
  canonicalizeTypedJsonObject,
  cloneAndFreezeTypedJsonObject,
  freezeObject
} from "./frozen-json.ts";
import {
  compareDefinitionKeyNames,
  compareIndexText,
  compareStateIndexKeyScalars
} from "./ordering.ts";
import { freezeStateIndexKeyMap } from "./key-values.ts";
import { sameRecordMembers } from "./record.ts";
import { stateIndexSchemaVersion } from "./schemas.ts";
import type {
  JsonObject,
  StateIndex,
  StateIndexDefinition,
  StateIndexStoredEntry,
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
  const keyOrder =
    definition?.fieldOrder === "definition"
      ? new Map(
          definition.keyStrategies.map((strategy, index) => [
            strategy.name,
            index
          ])
        )
      : undefined;
  const keyDefinitions = [...index.keyDefinitions]
    .sort((left, right) =>
      keyOrder === undefined
        ? compareIndexText(left.name, right.name)
        : compareDefinitionKeyNames(left.name, right.name, keyOrder)
    )
    .map(({ name, mode }) => freezeObject({ name, mode }));
  const entries = freezeObject(
    Object.fromEntries(
      Object.entries(index.entries)
        .sort(([left], [right]) => compareIndexText(left, right))
        .map(([id, entry]) => [id, canonicalizeStoredEntry(entry, keyOrder)])
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
      keyDefinitions: freezeObject(keyDefinitions),
      entries
    });
  }
  return freezeObject({
    definitionVersion: index.definitionVersion,
    entries,
    keyDefinitions: freezeObject(keyDefinitions),
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

function canonicalizeStoredEntry<State extends object>(
  entry: StateIndexStoredEntry<State>,
  keyOrder?: ReadonlyMap<string, number>
): StateIndexStoredEntry<State> {
  const keyEntries = Object.entries(entry.keys)
    .sort(([left], [right]) =>
      keyOrder === undefined
        ? compareIndexText(left, right)
        : compareDefinitionKeyNames(left, right, keyOrder)
    )
    .map(
      ([name, values]) =>
        [name, [...values].sort(compareStateIndexKeyScalars)] as const
    );
  return freezeObject({
    keys: freezeStateIndexKeyMap(Object.fromEntries(keyEntries)),
    state:
      keyOrder === undefined
        ? canonicalizeTypedJsonObject(entry.state)
        : cloneAndFreezeTypedJsonObject(entry.state, false)
  });
}
