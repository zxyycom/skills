import {
  expectationOf,
  keyDefinitionsOf,
  sameKeyDefinitions,
  validateStateIndexDefinition
} from "./definition.ts";
import { canonicalizeStateIndex } from "./canonicalization.ts";
import { diagnostic, errorText } from "./diagnostics.ts";
import { cloneAndFreezeTypedJsonObject } from "./frozen-json.ts";
import {
  normalizeStateIndex,
  validateCompleteStateIndex
} from "./projection.ts";
import type {
  JsonObject,
  StateIndex,
  StateIndexDefinition,
  StateIndexExpectation,
  StateIndexResult
} from "./types.ts";
import { validateStateIndexValue } from "./validation.ts";

export function parseStateIndex<
  State extends object,
  Metadata extends JsonObject
>(options: {
  definition: StateIndexDefinition<State, Metadata>;
  expectation: StateIndexExpectation;
  sourcePath: string;
  text: string;
}): StateIndexResult<StateIndex<State, Metadata>>;
export function parseStateIndex(options: {
  definition?: undefined;
  expectation: StateIndexExpectation;
  sourcePath: string;
  text: string;
}): StateIndexResult<StateIndex>;
export function parseStateIndex<
  State extends object,
  Metadata extends JsonObject
>(options: {
  definition?: StateIndexDefinition<State, Metadata>;
  expectation: StateIndexExpectation;
  sourcePath: string;
  text: string;
}): StateIndexResult<StateIndex | StateIndex<State, Metadata>> {
  if (options.definition !== undefined) {
    const definitionErrors = validateStateIndexDefinition(options.definition);
    if (definitionErrors.length > 0) {
      return {
        diagnostics: [diagnostic({
          code: "state-index.definition-invalid",
          message: definitionErrors.join("; "),
          path: options.sourcePath
        })],
        status: "error",
        value: null
      };
    }
    const definitionExpectation = expectationOf(options.definition);
    if (
      definitionExpectation.namespace !== options.expectation.namespace
      || definitionExpectation.definitionVersion !== options.expectation.definitionVersion
    ) {
      return {
        diagnostics: [diagnostic({
          code: "state-index.definition-mismatch",
          message: "parse expectation does not match the runtime definition",
          path: options.sourcePath
        })],
        status: "error",
        value: null
      };
    }
  }

  let value: unknown;
  try {
    value = JSON.parse(options.text);
  } catch (error) {
    return {
      diagnostics: [diagnostic({
        code: "state-index.json-invalid",
        message: errorText(error),
        path: options.sourcePath
      })],
      status: "error",
      value: null
    };
  }

  const validated = validateStateIndexValue(
    value,
    options.expectation,
    options.sourcePath
  );
  if (validated.index === null) {
    return { diagnostics: validated.diagnostics, status: "error", value: null };
  }

  if (
    options.definition !== undefined
    && !sameKeyDefinitions(
      validated.index.keyDefinitions,
      keyDefinitionsOf(options.definition)
    )
  ) {
    return {
      diagnostics: [diagnostic({
        code: "state-index.definition-mismatch",
        message: "index key definitions do not match the runtime definition",
        path: options.sourcePath
      })],
      status: "error",
      value: null
    };
  }

  if (options.definition === undefined) {
    return {
      diagnostics: [],
      status: "ok",
      // The validated schema output retains nested member order. Freeze a
      // detached copy without invoking domain parsers on the fast-open path.
      value: cloneAndFreezeTypedJsonObject(validated.index, false)
    };
  }
  const normalized = normalizeStateIndex(
    validated.index,
    options.definition,
    options.sourcePath
  );
  if (normalized.status === "error") {
    return normalized;
  }
  return validateCompleteStateIndex(
    options.definition,
    normalized.value,
    options.sourcePath
  );
}

export function serializeStateIndex<
  State extends object,
  Metadata extends JsonObject
>(
  index: StateIndex<State, Metadata>,
  definition: StateIndexDefinition<State, Metadata>
): string {
  return `${JSON.stringify(canonicalizeStateIndex(index, definition), null, 2)}\n`;
}
