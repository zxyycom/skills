import { fail } from "./failure.ts";
import * as v from "valibot";
import { record } from "./json.ts";

export type LocalTags = Readonly<Record<string, string>>;
export type LocalMetadata = Readonly<
  ({ runId: string; runIndex: number } | { runId: null; runIndex: null }) & {
    tags: LocalTags;
  }
>;
export const runIdSchema = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(128),
  v.regex(/^[^\s\p{Cc}]*$/u)
);
export const tagKeySchema = v.pipe(
  v.string(),
  v.regex(/^[A-Za-z_][A-Za-z0-9_.-]{0,63}$/u)
);
const tagValueSchema = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(256),
  v.regex(/^[^\p{Cc}]*$/u)
);
// A custom record boundary preserves legal prototype-named keys; generic record
// parsers can discard them. Consumers always receive an own-property dictionary.
export const tagsSchema = v.custom<LocalTags>(
  (value) =>
    record(value) &&
    Object.keys(value).length <= 32 &&
    Object.entries(value).every(
      ([key, item]) => v.is(tagKeySchema, key) && v.is(tagValueSchema, item)
    )
);

export function parseTags(values: readonly string[]): LocalTags {
  const tags: Record<string, string> = Object.create(null);
  for (const text of values) {
    const at = text.indexOf("=");
    const key = text.slice(0, at);
    const value = text.slice(at + 1);
    if (
      at < 1 ||
      !v.is(tagsSchema, { [key]: value }) ||
      Object.hasOwn(tags, key)
    )
      fail(
        "input",
        "--tag",
        "需要唯一 key=value，键最长64字符，值1–256字符且无控制字符"
      );
    tags[key] = value;
  }
  if (values.length > 32) fail("input", "--tag", "最多32个标签");
  return tags;
}

export function localMetadata(
  runId: string | undefined,
  index: string | undefined,
  tags: readonly string[]
): LocalMetadata {
  if ((runId === undefined) !== (index === undefined))
    fail("input", "--run-id/--run-index", "必须成对提供");
  const parsedId = parseRunId(runId);
  const parsedIndex = parseRunIndex(index);
  const parsedTags = parseTags(tags);
  if (parsedId === null || parsedIndex === null)
    return { runId: null, runIndex: null, tags: parsedTags };
  return { runId: parsedId, runIndex: parsedIndex, tags: parsedTags };
}

function parseRunId(runId: string | undefined): string | null {
  if (runId === undefined) return null;
  if (!v.is(runIdSchema, runId))
    fail("input", "--run-id", "需要1–128字符且无空白或控制字符");
  return runId;
}
function parseRunIndex(index: string | undefined): number | null {
  if (index === undefined) return null;
  if (!/^[1-9]\d*$/u.test(index) || !Number.isSafeInteger(Number(index)))
    fail("input", "--run-index", "需要从1开始的安全正整数");
  return Number(index);
}
