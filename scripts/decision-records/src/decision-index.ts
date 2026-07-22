import * as v from "valibot";
import { isDecisionTimestamp } from "./decision-timestamp.ts";
import { isDecisionRelativePath } from "./decision-path.ts";
import { projectionTextIssue } from "./projection.ts";
import {
  decisionAlignments,
  decisionRelationTypes,
  decisionStatuses,
  type DecisionIndex,
  type DecisionIndexEntry
} from "./types.ts";

export type { DecisionIndex, DecisionIndexEntry } from "./types.ts";

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
    alignment: v.union([
      v.picklist(decisionAlignments, "must be aligned or unaligned"),
      v.null("must be aligned, unaligned, or null")
    ]),
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
    schemaVersion: v.literal(4, "must be 4")
  }
);

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
      message = "must contain only path, status, alignment, createdAt, title, purpose, "
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
  const records: DecisionIndexEntry[] = [];
  const seenPaths = new Set<string>();
  for (const [index, entry] of result.output.records.entries()) {
    if (seenPaths.has(entry.path)) {
      validationErrors.push(indexRelativePath + " repeats decision " + entry.path);
    }
    seenPaths.add(entry.path);

    if (!isDecisionTimestamp(entry.createdAt)) {
      validationErrors.push(
        indexRelativePath
        + " records[" + index + "].createdAt must be an RFC 3339 timestamp "
        + "precise to seconds with an explicit timezone"
      );
    }

    if (entry.status === "active") {
      if (entry.alignment === null) {
        validationErrors.push(
          indexRelativePath
          + " records[" + index
          + "].alignment must be aligned or unaligned when status is active"
        );
      } else {
        records.push({ ...entry, alignment: entry.alignment, status: "active" });
      }
    } else if (entry.alignment !== null) {
      validationErrors.push(
        indexRelativePath
        + " records[" + index + "].alignment must be null when status is archived"
      );
    } else {
      records.push({ ...entry, alignment: null, status: "archived" });
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
  return {
    records,
    schemaVersion: 4
  };
}
