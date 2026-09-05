import { canonicalizeStateIndex } from "./canonicalization.ts";
import { errorText, failure, diagnostic } from "./diagnostics.ts";
import {
  canonicalizeTypedJsonObject,
  cloneAndFreezeTypedJsonObject,
  deeplyReadonlyFrozenValue,
  readonlyFrozenStateIndex
} from "./frozen-json.ts";
import { isJsonObject } from "./json.ts";
import { materializeStateIndexEntry } from "./query-fields.ts";
import { isStateIndexText, stateIndexSchemaVersion } from "./schemas.ts";
import type {
  DeepReadonly,
  JsonObject,
  StateIndex,
  StateIndexDefinition,
  StateIndexProjectionContext,
  StateIndexResult
} from "./types.ts";

export function projectStateIndexState<
  State extends object,
  Metadata extends JsonObject
>(
  definition: StateIndexDefinition<State, Metadata>,
  input: unknown,
  context: StateIndexProjectionContext<Metadata>
): StateIndexResult<State> {
  if (!isStateIndexText(context.id)) {
    return failure("state-index.id-invalid", "state id must be valid text", {
      stateId: typeof context.id === "string" ? context.id : null
    });
  }
  if (!isJsonObject(input)) {
    return failure(
      "state-index.state-invalid",
      "state must be a JSON object containing only finite JSON values",
      { stateId: context.id }
    );
  }
  let state: State;
  try {
    state = definition.parseState(input, context);
  } catch (error) {
    return failure("state-index.state-parse-failed", errorText(error), {
      stateId: context.id
    });
  }
  if (!isJsonObject(state)) {
    return failure(
      "state-index.state-parse-invalid",
      "parseState must return a JSON object containing only finite JSON values",
      { stateId: context.id }
    );
  }
  const frozen = cloneAndFreezeTypedJsonObject(state, false);
  const extracted = materializeStateIndexEntry(definition, context.id, frozen);
  return extracted.status === "error"
    ? extracted
    : { diagnostics: [], status: "ok", value: frozen };
}

export function normalizeStateIndex<
  State extends object,
  Metadata extends JsonObject
>(
  index: StateIndex,
  definition: StateIndexDefinition<State, Metadata>,
  sourcePath: string
): StateIndexResult<StateIndex<State, Metadata>> {
  const parsedMetadata = parseStateIndexMetadata(
    definition,
    index.metadata,
    sourcePath
  );
  if (parsedMetadata.status === "error") return parsedMetadata;
  const metadata = canonicalizeTypedJsonObject(parsedMetadata.value);
  const states: Array<[string, State]> = [];
  for (const [id, input] of Object.entries(index.entries)) {
    const projected = projectStateIndexState(
      definition,
      input,
      createProjectionContext(id, metadata)
    );
    if (projected.status === "error") {
      return {
        diagnostics: projected.diagnostics.map((entry) => ({
          ...entry,
          path: entry.path ?? sourcePath,
          stateId: entry.stateId ?? id
        })),
        status: "error",
        value: null
      };
    }
    states.push([id, projected.value]);
  }
  return {
    diagnostics: [],
    status: "ok",
    value: canonicalizeStateIndex(
      {
        definitionVersion: index.definitionVersion,
        entries: Object.fromEntries(states),
        metadata,
        namespace: index.namespace,
        schemaVersion: stateIndexSchemaVersion,
        sourceRevision: index.sourceRevision
      },
      definition
    )
  };
}

export function parseStateIndexMetadata<
  State extends object,
  Metadata extends JsonObject
>(
  definition: StateIndexDefinition<State, Metadata>,
  input: unknown,
  sourcePath: string | null = null
): StateIndexResult<Metadata> {
  if (!isJsonObject(input)) {
    return failure(
      "state-index.metadata-invalid",
      "metadata must be a JSON object containing only finite JSON values",
      { path: sourcePath }
    );
  }
  let metadata: Metadata;
  try {
    metadata = definition.parseMetadata(input);
  } catch (error) {
    return failure("state-index.metadata-parse-failed", errorText(error), {
      path: sourcePath
    });
  }
  if (!isJsonObject(metadata)) {
    return failure(
      "state-index.metadata-parse-invalid",
      "parseMetadata must return a JSON object containing only finite JSON values",
      { path: sourcePath }
    );
  }
  return { diagnostics: [], status: "ok", value: metadata };
}

export function createProjectionContext<Metadata extends JsonObject>(
  id: string,
  metadata: Metadata
): StateIndexProjectionContext<Metadata> {
  return Object.freeze({ id, metadata: deeplyReadonlyFrozenValue(metadata) });
}

export function readonlyStateIndexMetadata<
  State extends object,
  Metadata extends JsonObject
>(index: StateIndex<State, Metadata>): DeepReadonly<Metadata> {
  return deeplyReadonlyFrozenValue(index.metadata);
}

export function validateCompleteStateIndex<
  State extends object,
  Metadata extends JsonObject
>(
  definition: StateIndexDefinition<State, Metadata>,
  index: StateIndex<State, Metadata>,
  sourcePath: string
): StateIndexResult<StateIndex<State, Metadata>> {
  if (definition.validateIndex === undefined) {
    return { diagnostics: [], status: "ok", value: index };
  }
  try {
    definition.validateIndex(readonlyFrozenStateIndex(index));
  } catch (error) {
    return {
      diagnostics: [
        diagnostic({
          code: "state-index.index-validation-failed",
          message: errorText(error),
          path: sourcePath
        })
      ],
      status: "error",
      value: null
    };
  }
  return { diagnostics: [], status: "ok", value: index };
}
