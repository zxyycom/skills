import * as v from "valibot";
import { decisionTimestampPatternSource } from "./decision-index-json-schema.ts";
import { isDecisionRelativePath } from "./decision-path.ts";
import { projectionTextIssue } from "./projection.ts";
import {
  decisionRelationTypes,
  decisionStatuses
} from "./types.ts";

const nonEmptyStringSchema = v.pipe(
  v.string("must be a non-empty string"),
  v.check((value) => value.trim().length > 0, "must be a non-empty string")
);
const decisionPathSchema = v.pipe(
  v.string("must be a relative decision path"),
  v.check(isDecisionRelativePath, "must be a relative decision path")
);
const decisionRelationSchema = v.strictObject({
  target: decisionPathSchema,
  type: v.picklist(decisionRelationTypes, "must be a supported relationship type")
});
const decisionIndexEntrySchema = v.strictObject(
  {
    background: nonEmptyStringSchema,
    createdAt: nonEmptyStringSchema,
    decision: nonEmptyStringSchema,
    path: decisionPathSchema,
    purpose: nonEmptyStringSchema,
    relations: v.array(decisionRelationSchema, "must be an array"),
    status: v.picklist(decisionStatuses, "must be active or archived"),
    title: nonEmptyStringSchema
  }
);
export const decisionIndexSchema = v.strictObject(
  {
    records: v.array(decisionIndexEntrySchema, "must be an array"),
    schemaVersion: v.literal(3, "must be 3")
  }
);

export type DecisionIndex = v.InferOutput<typeof decisionIndexSchema>;
export type DecisionIndexEntry = DecisionIndex["records"][number];

const rfc3339TimestampPattern = new RegExp(decisionTimestampPatternSource);

function isRfc3339Timestamp(value: string): boolean {
  const match = value.match(rfc3339TimestampPattern);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[8] === undefined ? 0 : Number(match[8]);
  const offsetMinute = match[9] === undefined ? 0 : Number(match[9]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    && hour <= 23
    && minute <= 59
    && second <= 59
    && offsetHour <= 23
    && offsetMinute <= 59;
}

function formatIssue(issue: v.InferIssue<typeof decisionIndexSchema>): {
  message: string;
  path: string | null;
} {
  const rawPath = v.getDotPath(issue);
  let message = issue.message;
  if (issue.type === "strict_object" && issue.expected === "never") {
    if (rawPath?.match(/^records\.\d+\.relations\.\d+\./)) {
      message = "must contain only type and target";
    } else if (rawPath?.startsWith("records.")) {
      message = "must contain only path, status, createdAt, title, purpose, "
        + "background, decision, and relations";
    } else {
      message = "must contain only schemaVersion and records";
    }
  }

  return {
    message,
    path: rawPath
      ?.replace(/^records\.(\d+)/, "records[$1]")
      .replace(/\.relations\.(\d+)/, ".relations[$1]") ?? null
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

  const validationErrors: string[] = [];
  const seenPaths = new Set<string>();
  for (const [index, entry] of result.output.records.entries()) {
    if (seenPaths.has(entry.path)) {
      validationErrors.push(indexRelativePath + " repeats decision " + entry.path);
    }
    seenPaths.add(entry.path);

    if (!isRfc3339Timestamp(entry.createdAt)) {
      validationErrors.push(
        indexRelativePath
        + " records[" + index + "].createdAt must be an RFC 3339 timestamp "
        + "precise to seconds with an explicit timezone"
      );
    }

    for (const field of ["title", "purpose", "background", "decision"] as const) {
      const issue = projectionTextIssue(entry[field]);
      if (issue) {
        validationErrors.push(
          indexRelativePath + " records[" + index + "]." + field + " " + issue
        );
      }
    }

    const relationKeys = new Set<string>();
    for (const relation of entry.relations) {
      const key = relation.type + "\u0000" + relation.target;
      if (relationKeys.has(key)) {
        validationErrors.push(
          indexRelativePath
          + " records[" + index + "] repeats relationship "
          + relation.type + " target " + relation.target
        );
      }
      relationKeys.add(key);
    }
  }

  if (validationErrors.length > 0) {
    errors.push(...validationErrors);
    return null;
  }
  return result.output;
}
