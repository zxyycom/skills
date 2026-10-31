import {
  defineStateIndexDefinition,
  validateStateIndexDefinition
} from "../definition.ts";
import { failure } from "../diagnostics.ts";
import { createStateIndexReaderFromPrepared } from "../reader.ts";
import type { StateIndexReader } from "../runtime.ts";
import { loadPreparedStateIndex } from "../prepared/prepared.ts";
import type {
  JsonObject,
  StateIndexContext,
  StateIndexDefinition,
  StateIndexExpectation,
  StateIndexResult
} from "../types.ts";

export async function loadStateIndexReader<
  State extends object,
  Metadata extends JsonObject
>(options: {
  context: StateIndexContext;
  definition: StateIndexDefinition<State, Metadata>;
  expectation?: StateIndexExpectation;
  indexPath: string;
}): Promise<StateIndexResult<StateIndexReader<State, Metadata>>> {
  const definition = readerDefinition(options.definition, options.indexPath);
  if (definition.status === "error") return definition;
  const loaded = await loadPreparedStateIndex({
    ...options,
    definition: definition.value
  });
  return loaded.status === "error"
    ? loaded
    : createStateIndexReaderFromPrepared({
        definition: definition.value,
        context: options.context,
        prepared: loaded.value,
        indexPath: options.indexPath
      });
}

export async function loadCurrentStateIndexReader<
  State extends object,
  Metadata extends JsonObject
>(options: {
  context: StateIndexContext;
  definition: StateIndexDefinition<State, Metadata>;
  indexPath: string;
}): Promise<StateIndexResult<StateIndexReader<State, Metadata>>> {
  const definition = readerDefinition(options.definition, options.indexPath);
  if (definition.status === "error") return definition;
  const loaded = await loadPreparedStateIndex({
    current: true,
    ...options,
    definition: definition.value
  });
  return loaded.status === "error"
    ? loaded
    : createStateIndexReaderFromPrepared({
        definition: definition.value,
        context: options.context,
        prepared: loaded.value,
        indexPath: options.indexPath
      });
}

function readerDefinition<State extends object, Metadata extends JsonObject>(
  definition: StateIndexDefinition<State, Metadata>,
  indexPath: string
): StateIndexResult<StateIndexDefinition<State, Metadata>> {
  const errors = validateStateIndexDefinition(definition);
  return errors.length > 0
    ? failure("state-index.definition-invalid", errors.join("; "), {
        path: indexPath
      })
    : {
        diagnostics: [],
        status: "ok",
        value: defineStateIndexDefinition(definition)
      };
}
