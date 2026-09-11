import * as v from "valibot";
import { TaskGraphError } from "./errors.ts";

const positiveCanonicalIdSuffixPatternSource =
  "(?:(?!000000$)[0-9]{6}|[1-9][0-9]{6,15})";
export const taskIdPatternSource = `^task-${positiveCanonicalIdSuffixPatternSource}$`;
export const leaseIdPatternSource =
  "^lease-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$";
export const dictionaryKeyPatternSource =
  "^(?!(?:constructor|prototype|__proto__)$)[a-z][a-z0-9]*(?:-[a-z0-9]+)*$";
export const aliasPatternSource = "^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$";
export const timestampPatternSource =
  "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z$";

const unicodeLength = (value: string): number => Array.from(value).length;

const reservedObjectKeys = new Set(["__proto__", "constructor", "prototype"]);

export function findReservedOwnKey(
  input: unknown,
  path = "$",
  seen = new WeakSet<object>()
): { key: string; path: string } | null {
  if (input === null || typeof input !== "object" || seen.has(input))
    return null;
  seen.add(input);
  for (const key of Object.keys(input)) {
    if (reservedObjectKeys.has(key)) return { key, path };
    const found = findReservedOwnKey(
      (input as Record<string, unknown>)[key],
      Array.isArray(input) ? `${path}[${key}]` : `${path}.${key}`,
      seen
    );
    if (found !== null) return found;
  }
  return null;
}

export function rejectReservedOwnKey(
  input: unknown,
  code: "INDEX_INVALID" | "REQUEST_INVALID"
): void {
  const found = findReservedOwnKey(input);
  if (found === null) return;
  throw new TaskGraphError(
    code,
    `Reserved object key ${found.key} is not allowed`,
    {
      issues: [`${found.path}: reserved object key ${found.key} is not allowed`]
    }
  );
}

type BoundedTextConstraint = {
  maximum: number;
  minimum: number;
  pattern: string;
};

const boundedTextConstraints = new WeakMap<object, BoundedTextConstraint>();

export function boundedTextPattern(singleLine: boolean): string {
  const lineConstraint = singleLine ? "(?![\\s\\S]*[\\r\\n])" : "";
  return `^${lineConstraint}(?!\\s)(?:[\\s\\S]*\\S)?$`;
}

export function taskGraphJsonSchemaOverrideAction(context: {
  valibotAction: object;
}):
  | {
      type: "string";
      minLength: number;
      maxLength: number;
      pattern: string;
    }
  | undefined {
  const constraint = boundedTextConstraints.get(context.valibotAction);
  if (constraint === undefined) return undefined;
  return {
    type: "string",
    minLength: constraint.minimum,
    maxLength: constraint.maximum,
    pattern: constraint.pattern
  };
}

export function boundedText(
  label: string,
  minimum: number,
  maximum: number,
  options: { singleLine?: boolean } = {}
) {
  const constraint = {
    maximum,
    minimum,
    pattern: boundedTextPattern(options.singleLine === true)
  } satisfies BoundedTextConstraint;
  const runtimeConstraint = v.check(
    (value: string) =>
      unicodeLength(value) >= minimum &&
      unicodeLength(value) <= maximum &&
      value.trim() === value &&
      (options.singleLine !== true || !/[\r\n]/u.test(value)),
    `${label} must contain ${minimum} to ${maximum} Unicode code points, ` +
      "have no surrounding whitespace, and satisfy its line policy"
  );
  boundedTextConstraints.set(runtimeConstraint, constraint);
  return v.pipe(v.string(`${label} must be a string`), runtimeConstraint);
}

export const nonNegativeIntegerSchema = v.pipe(
  v.number("must be a number"),
  v.integer("must be an integer"),
  v.minValue(0, "must be non-negative"),
  v.maxValue(Number.MAX_SAFE_INTEGER, "must be a safe integer")
);
export const positiveIntegerSchema = v.pipe(
  nonNegativeIntegerSchema,
  v.minValue(1, "must be positive")
);
export function isCanonicalTaskId(value: string): boolean {
  const suffix = value.slice("task-".length);
  const number = Number(suffix);
  return (
    Number.isSafeInteger(number) &&
    number >= 1 &&
    `task-${String(number).padStart(6, "0")}` === value
  );
}
export const taskIdSchema = v.pipe(
  v.string("task id must be a string"),
  v.regex(new RegExp(taskIdPatternSource, "u"), "must be a canonical task id"),
  v.check(
    (value) => isCanonicalTaskId(value),
    "must contain a positive safe canonical task number"
  )
);
export const taskReferenceSchema = v.pipe(
  v.string("task reference must be a string"),
  v.regex(
    new RegExp(
      `^(?:task-${positiveCanonicalIdSuffixPatternSource}|@[a-z][a-z0-9]*(?:-[a-z0-9]+)*)$`,
      "u"
    ),
    "must be a canonical task id or apply alias"
  ),
  v.check(
    (value) => value.startsWith("@") || isCanonicalTaskId(value),
    "must contain a positive safe canonical task number or apply alias"
  )
);
export const dictionaryKeySchema = v.pipe(
  v.string("dictionary key must be a string"),
  v.regex(
    new RegExp(dictionaryKeyPatternSource, "u"),
    "must be a kebab-case dictionary key"
  ),
  v.maxLength(80, "dictionary key must be at most 80 characters")
);
export const timestampSchema = v.pipe(
  v.string("timestamp must be a string"),
  v.regex(
    new RegExp(timestampPatternSource, "u"),
    "must be a millisecond UTC RFC 3339 timestamp"
  ),
  v.check((value) => {
    const date = new Date(value);
    return !Number.isNaN(date.valueOf()) && date.toISOString() === value;
  }, "must be a real canonical UTC instant")
);
export const reasonSchema = boundedText("reason", 1, 1000);
export const referenceValueSchema = boundedText("reference", 1, 500);
export const referenceDictionarySchema = v.record(
  dictionaryKeySchema,
  referenceValueSchema
);
