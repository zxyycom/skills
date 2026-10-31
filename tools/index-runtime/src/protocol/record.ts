import * as v from "valibot";

const encodedKeyPrefix = ":";

export function isPlainRecord(
  value: unknown
): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return (
    (prototype === Object.prototype || prototype === null) &&
    Object.getOwnPropertySymbols(value).length === 0
  );
}

export function sameRecordMembers(
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>
): boolean {
  const leftKeys = Object.keys(left);
  return (
    leftKeys.length === Object.keys(right).length &&
    leftKeys.every((key) => Object.hasOwn(right, key))
  );
}

export function createSafeRecordSchema<
  const KeySchema extends v.GenericSchema<string, string>,
  const ValueSchema extends v.GenericSchema,
  const Message extends string
>(keySchema: KeySchema, valueSchema: ValueSchema, message: Message) {
  const encodedKeySchema = v.pipe(
    v.string(),
    v.transform(decodeRecordKey),
    keySchema,
    v.transform(encodeRecordKey)
  );
  const schema = v.record(keySchema, valueSchema, message);
  const runtimeRecordSchema = v.record(encodedKeySchema, valueSchema, message);
  const decodeKeys = v.transform(
    (record: v.InferOutput<typeof runtimeRecordSchema>) =>
      mapRecordKeys(record, decodeRecordKey)
  );
  const runtimeSchema = v.pipe(
    v.custom<Record<string, v.InferInput<ValueSchema>>>(isPlainRecord, message),
    v.transform((record) => mapRecordKeys(record, encodeRecordKey)),
    runtimeRecordSchema,
    decodeKeys
  );

  // Valibot 1.4.2's record parser intentionally skips prototype-sensitive keys.
  // The runtime pipeline encodes them before parsing, while the returned record
  // pipeline keeps propertyNames/additionalProperties visible to JSON Schema
  // conversion. This adapter binds those views and only restores caller-facing
  // issue paths; it does not reimplement Valibot parsing.
  const run = runtimeSchema["~run"].bind(runtimeSchema);
  Object.defineProperty(schema, "~run", {
    configurable: true,
    enumerable: true,
    value: (...args: Parameters<typeof run>): ReturnType<typeof run> =>
      runAndRestoreSafeRecordIssuePaths(run, args),
    writable: true
  });
  return schema;
}

function mapRecordKeys<RecordValue extends object>(
  record: RecordValue,
  map: (key: string) => string
): Record<string, RecordValue[Extract<keyof RecordValue, string>]> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [map(key), value])
  );
}

function encodeRecordKey(key: string): string {
  return `${encodedKeyPrefix}${key}`;
}

function decodeRecordKey(key: string): string {
  return key.slice(encodedKeyPrefix.length);
}

function restoreSafeRecordIssuePaths<Dataset extends { issues?: unknown[] }>(
  dataset: Dataset,
  originalRecord: unknown
): Dataset {
  for (const issue of dataset.issues ?? [])
    restoreSafeRecordIssuePath(issue, originalRecord);
  return dataset;
}

function restoreSafeRecordIssuePath(
  issue: unknown,
  originalRecord: unknown
): void {
  if (typeof issue !== "object" || issue === null) return;
  const pathItem = (issue as { path?: unknown[] }).path?.[0];
  if (typeof pathItem !== "object" || pathItem === null) return;
  const item = pathItem as { key?: unknown; type?: unknown };
  if (item.type !== "object" || typeof item.key !== "string") return;
  const originalKey = decodeRecordKey(item.key);
  Reflect.set(pathItem, "key", originalKey);
  restoreIssueInput(pathItem, originalRecord, originalKey);
}

function runAndRestoreSafeRecordIssuePaths<
  Run extends (...args: never[]) => { issues?: unknown[] }
>(run: Run, args: Parameters<Run>): ReturnType<Run> {
  const originalRecord = (args[0] as unknown as { value: unknown }).value;
  return restoreSafeRecordIssuePaths(
    run(...args),
    originalRecord
  ) as ReturnType<Run>;
}

function restoreIssueInput(
  pathItem: object,
  originalRecord: unknown,
  originalKey: string
): void {
  if (
    !isPlainRecord(originalRecord) ||
    !Object.hasOwn(originalRecord, originalKey)
  )
    return;
  Reflect.set(pathItem, "input", originalRecord);
  Reflect.set(pathItem, "value", originalRecord[originalKey]);
}
