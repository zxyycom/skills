/*
 * Synced TypeScript runtime; repository maintenance edits tools/index-runtime/src/snapshot-parser.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/index-runtime/src/snapshot-parser.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/index-runtime/src/snapshot-parser.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/novel-cards
 * Rebuild: bun run sync:novel-cards-cli
 */
import { types as utilTypes } from "node:util";
import type { MaterializedStateIndexEntry } from "./query-fields.ts";
import { expectationOf, validateStateIndexDefinition } from "./definition.ts";
import { canonicalizeStateIndex } from "./canonicalization.ts";
import { diagnostic, errorText } from "./diagnostics.ts";
import {
  normalizeStateIndex,
  validateCompleteStateIndex
} from "./projection.ts";
import type {
  JsonObject,
  JsonValue,
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
  materializedEntries?: MaterializedStateIndexEntry<State>[];
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
    options.sourcePath,
    options.materializedEntries
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
    value: freezeOwnedEnvelope(validated.index)
  };
}

// 固定 schema 已验证本次文本解码产生的 JSON，并且未引入外部引用。
// 此处在领域 callback 前原地冻结；callback 的返回对象仍由归一化层复制隔离。
function freezeOwnedEnvelope<Value extends JsonValue>(value: Value): Value {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freezeOwnedEnvelope(child);
    Object.freeze(value);
  }
  return value;
}

/** True only for an immutable own ordering value, captured before normalization. */
export function hasStableOwnFieldOrder(definition: object): boolean {
  if (utilTypes.isProxy(definition)) return false;
  const fieldOrder = Object.getOwnPropertyDescriptor(definition, "fieldOrder");
  return (
    Object.isFrozen(definition) &&
    fieldOrder !== undefined &&
    "value" in fieldOrder &&
    fieldOrder.writable === false
  );
}

/** Internal serialization of the same-stage, already canonical frozen result. */
export function serializeCanonicalStateIndex<
  State extends object,
  Metadata extends JsonObject
>(index: StateIndex<State, Metadata>): string {
  return `${JSON.stringify(index, null, 2)}\n`;
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
