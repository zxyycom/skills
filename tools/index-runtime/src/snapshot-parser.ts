import { expectationOf, validateStateIndexDefinition } from "./definition.ts";
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
  expectation?: StateIndexExpectation;
  sourcePath: string;
  text: string;
}): StateIndexResult<StateIndex<State, Metadata>> {
  const definitionErrors = validateStateIndexDefinition(options.definition);
  if (definitionErrors.length > 0) {
    return {
      diagnostics: [
        diagnostic({
          code: "state-index.definition-invalid",
          message: definitionErrors.join("; "),
          path: options.sourcePath
        })
      ],
      status: "error",
      value: null
    };
  }
  const expectation = options.expectation ?? expectationOf(options.definition);
  const definitionExpectation = expectationOf(options.definition);
  if (
    expectation.namespace !== definitionExpectation.namespace ||
    expectation.definitionVersion !== definitionExpectation.definitionVersion
  ) {
    return {
      diagnostics: [
        diagnostic({
          code: "state-index.definition-mismatch",
          message: "parse expectation does not match the runtime definition",
          path: options.sourcePath
        })
      ],
      status: "error",
      value: null
    };
  }
  const envelope = parseStateIndexEnvelope({
    expectation,
    sourcePath: options.sourcePath,
    text: options.text
  });
  if (envelope.status === "error") return envelope;
  const normalized = normalizeStateIndex(
    envelope.value,
    options.definition,
    options.sourcePath
  );
  if (normalized.status === "error") return normalized;
  return validateCompleteStateIndex(
    options.definition,
    normalized.value,
    options.sourcePath
  );
}

/** @internal Generic envelope parsing used only to reject unavailable snapshots cheaply. */
export function parseStateIndexEnvelope(options: {
  expectation: StateIndexExpectation;
  sourcePath: string;
  text: string;
}): StateIndexResult<StateIndex> {
  let value: unknown;
  try {
    value = JSON.parse(options.text);
  } catch (error) {
    return {
      diagnostics: [
        diagnostic({
          code: "state-index.json-invalid",
          message: errorText(error),
          path: options.sourcePath
        })
      ],
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
  return {
    diagnostics: [],
    status: "ok",
    value: cloneAndFreezeTypedJsonObject(validated.index, false)
  };
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
