import * as v from "valibot";
import { isDecisionRelativePath } from "./decision-path.ts";

const nonEmptyStringSchema = v.pipe(
  v.string("must be a non-empty string"),
  v.check((value) => value.trim().length > 0, "must be a non-empty string")
);
const decisionPathSchema = v.pipe(
  v.string("must be a relative decision path"),
  v.check(isDecisionRelativePath, "must be a relative decision path")
);
const decisionIndexEntrySchema = v.strictObject(
  {
    background: nonEmptyStringSchema,
    decision: nonEmptyStringSchema,
    path: decisionPathSchema,
    purpose: nonEmptyStringSchema,
    title: nonEmptyStringSchema
  }
);
export const decisionIndexSchema = v.strictObject(
  {
    current: v.array(decisionIndexEntrySchema, "must be an array"),
    schemaVersion: v.literal(2, "must be 2")
  }
);

export type DecisionIndex = v.InferOutput<typeof decisionIndexSchema>;
export type DecisionIndexEntry = DecisionIndex["current"][number];

function formatIssue(issue: v.InferIssue<typeof decisionIndexSchema>): {
  message: string;
  path: string | null;
} {
  const rawPath = v.getDotPath(issue);
  const message = issue.type === "strict_object" && issue.expected === "never"
    ? rawPath?.startsWith("current.")
      ? "must contain only path, title, purpose, background, and decision"
      : "must contain only schemaVersion and current"
    : issue.message;
  return {
    message,
    path: rawPath?.replace(/^current\.(\d+)/, "current[$1]") ?? null
  };
}

export function parseDecisionIndex(
  indexText: string,
  indexRelativePath: string,
  errors: string[]
): DecisionIndex | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(indexText);
  } catch (error) {
    errors.push(
      indexRelativePath
      + " must contain valid JSON: "
      + (error instanceof Error ? error.message : String(error))
    );
    return null;
  }

  const result = v.safeParse(decisionIndexSchema, parsed);
  if (!result.success) {
    errors.push(...result.issues.map((issue) => {
      const formatted = formatIssue(issue);
      return formatted.path
        ? `${indexRelativePath} ${formatted.path} ${formatted.message}`
        : `${indexRelativePath} ${formatted.message}`;
    }));
    return null;
  }

  const seenPaths = new Set<string>();
  for (const entry of result.output.current) {
    if (seenPaths.has(entry.path)) {
      errors.push(indexRelativePath + " repeats current decision " + entry.path);
      return null;
    }
    seenPaths.add(entry.path);
  }

  return result.output;
}
