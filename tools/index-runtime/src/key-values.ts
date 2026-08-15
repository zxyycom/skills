import { freezeObject } from "./frozen-json.ts";
import { compareStateIndexKeyScalars } from "./ordering.ts";
import { isStateIndexText } from "./schemas.ts";
import type { StateIndexKeyDefinition, StateIndexKeyScalar } from "./types.ts";

export type StateIndexKeyValuesResult =
  | {
      status: "error";
      message: string;
    }
  | {
      status: "ok";
      values: StateIndexKeyScalar[];
    };

export function normalizeStateIndexKeyValues(
  input: unknown,
  mode: StateIndexKeyDefinition["mode"]
): StateIndexKeyValuesResult {
  if (input === undefined) {
    return { status: "ok", values: [] };
  }
  const inputs = Array.isArray(input) ? input : [input];
  const values: StateIndexKeyScalar[] = [];
  for (const value of inputs) {
    if (!isStateIndexKeyScalar(value)) {
      return {
        message:
          "derive must return a boolean, finite number, non-empty string, " +
          "or an array of them",
        status: "error"
      };
    }
    if (!keyValueMatchesMode(value, mode)) {
      return {
        message: `${mode} keys cannot contain ${typeof value} values`,
        status: "error"
      };
    }
    values.push(value);
  }
  return {
    status: "ok",
    values: [
      ...new Map(values.map((value) => [scalarIdentity(value), value])).values()
    ].sort(compareStateIndexKeyScalars)
  };
}

export function isStateIndexKeyScalar(
  value: unknown
): value is StateIndexKeyScalar {
  return (
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value)) ||
    (typeof value === "string" && isStateIndexText(value))
  );
}

export function keyValueMatchesMode(
  value: StateIndexKeyScalar,
  mode: StateIndexKeyDefinition["mode"]
): boolean {
  switch (mode) {
    case "exact":
      return true;
    case "range":
      return typeof value === "number" || typeof value === "string";
    case "text":
      return typeof value === "string";
  }
}

export function scalarIdentity(value: StateIndexKeyScalar): string {
  return `${typeof value}:${String(value)}`;
}

export function freezeStateIndexKeyMap(
  keys: Record<string, StateIndexKeyScalar[]>
): Record<string, StateIndexKeyScalar[]> {
  for (const values of Object.values(keys)) {
    freezeObject(values);
  }
  return freezeObject(keys);
}
