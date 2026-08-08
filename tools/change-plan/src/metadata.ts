import type { Stats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
import { changePlanMetadataName } from "./types.ts";

const normalizedTextSchema = v.pipe(
  v.string("must be a string"),
  v.nonEmpty("must not be empty"),
  v.regex(
    /^\S(?:[\s\S]*\S)?$/,
    "must not start or end with whitespace"
  )
);

const revisionSchema = v.pipe(
  v.string("must be a string"),
  v.nonEmpty("must not be empty"),
  v.regex(/^\S+$/, "must not contain whitespace")
);

const nonNegativeSafeIntegerSchema = v.pipe(
  v.number("must be a number"),
  v.safeInteger("must be a safe integer"),
  v.minValue(0, "must not be negative")
);

const explicitShelfSchema = v.strictObject({
  atCommit: revisionSchema,
  reason: normalizedTextSchema,
  source: v.literal("explicit")
});

const gitDistanceShelfSchema = v.strictObject({
  atCommit: revisionSchema,
  changedLines: nonNegativeSafeIntegerSchema,
  commitCount: nonNegativeSafeIntegerSchema,
  source: v.literal("git-distance-v1")
});

const shelfSchema = v.variant("source", [
  explicitShelfSchema,
  gitDistanceShelfSchema
]);

export const changePlanMetadataSchema = v.variant("stage", [
  v.strictObject({
    schemaVersion: v.literal(1),
    stage: v.literal("draft")
  }),
  v.strictObject({
    baseCommit: v.nullable(revisionSchema),
    schemaVersion: v.literal(1),
    stage: v.literal("plan")
  }),
  v.strictObject({
    baseCommit: revisionSchema,
    schemaVersion: v.literal(1),
    stage: v.literal("implementation")
  }),
  v.strictObject({
    baseCommit: revisionSchema,
    schemaVersion: v.literal(1),
    shelf: shelfSchema,
    stage: v.literal("shelved")
  })
]);

export type ChangePlanMetadata = v.InferOutput<
  typeof changePlanMetadataSchema
>;

export type ChangePlanMetadataErrorCode =
  | "metadata-invalid-json"
  | "metadata-invalid-schema"
  | "metadata-not-found"
  | "metadata-not-regular-file"
  | "metadata-read-failed"
  | "metadata-symbolic-link"
  | "metadata-write-failed";

export class ChangePlanMetadataError extends Error {
  readonly code: ChangePlanMetadataErrorCode;

  constructor(code: ChangePlanMetadataErrorCode, message: string) {
    super(message);
    this.name = "ChangePlanMetadataError";
    this.code = code;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isMissingPathError(error: unknown): boolean {
  return error !== null
    && typeof error === "object"
    && "code" in error
    && error.code === "ENOENT";
}

function schemaIssueMessage(
  issue: v.InferIssue<typeof changePlanMetadataSchema>
): string {
  const issuePath = v.getDotPath(issue);
  return issuePath === null ? issue.message : `${issuePath}: ${issue.message}`;
}

async function lstatMetadata(metadataPath: string): Promise<Stats | null> {
  try {
    return await fs.lstat(metadataPath);
  } catch (error) {
    if (isMissingPathError(error)) {
      return null;
    }
    throw new ChangePlanMetadataError(
      "metadata-read-failed",
      `cannot inspect ${changePlanMetadataName}: ${errorMessage(error)}`
    );
  }
}

async function requireRegularMetadataFile(metadataPath: string): Promise<void> {
  const metadataStat = await lstatMetadata(metadataPath);
  if (metadataStat === null) {
    throw new ChangePlanMetadataError(
      "metadata-not-found",
      `${changePlanMetadataName} is required for active changes`
    );
  }
  if (metadataStat.isSymbolicLink()) {
    throw new ChangePlanMetadataError(
      "metadata-symbolic-link",
      `${changePlanMetadataName} must not be a symbolic link`
    );
  }
  if (!metadataStat.isFile()) {
    throw new ChangePlanMetadataError(
      "metadata-not-regular-file",
      `${changePlanMetadataName} must be a regular file`
    );
  }
}

export function parseChangePlanMetadata(value: unknown): ChangePlanMetadata {
  const parsed = v.safeParse(changePlanMetadataSchema, value);
  if (!parsed.success) {
    throw new ChangePlanMetadataError(
      "metadata-invalid-schema",
      `invalid ${changePlanMetadataName}: ${parsed.issues
        .map(schemaIssueMessage)
        .join("; ")}`
    );
  }
  return parsed.output;
}

export async function readChangePlanMetadata(
  changeDirectory: string
): Promise<ChangePlanMetadata> {
  const metadataPath = path.join(changeDirectory, changePlanMetadataName);
  await requireRegularMetadataFile(metadataPath);

  let contents: string;
  try {
    contents = await fs.readFile(metadataPath, "utf8");
  } catch (error) {
    throw new ChangePlanMetadataError(
      "metadata-read-failed",
      `cannot read ${changePlanMetadataName}: ${errorMessage(error)}`
    );
  }

  let value: unknown;
  try {
    value = JSON.parse(contents);
  } catch (error) {
    throw new ChangePlanMetadataError(
      "metadata-invalid-json",
      `invalid ${changePlanMetadataName} JSON: ${errorMessage(error)}`
    );
  }
  return parseChangePlanMetadata(value);
}

/** @internal Lifecycle persistence boundary; not part of the public API. */
export async function writeChangePlanMetadata(
  changeDirectory: string,
  metadata: ChangePlanMetadata
): Promise<void> {
  const normalizedMetadata = parseChangePlanMetadata(metadata);
  const metadataPath = path.join(changeDirectory, changePlanMetadataName);
  const metadataStat = await lstatMetadata(metadataPath);
  if (metadataStat?.isSymbolicLink()) {
    throw new ChangePlanMetadataError(
      "metadata-symbolic-link",
      `${changePlanMetadataName} must not be a symbolic link`
    );
  }
  if (metadataStat !== null && !metadataStat.isFile()) {
    throw new ChangePlanMetadataError(
      "metadata-not-regular-file",
      `${changePlanMetadataName} must be a regular file`
    );
  }

  try {
    await fs.writeFile(
      metadataPath,
      `${JSON.stringify(normalizedMetadata, null, 2)}\n`,
      "utf8"
    );
  } catch (error) {
    throw new ChangePlanMetadataError(
      "metadata-write-failed",
      `cannot write ${changePlanMetadataName}: ${errorMessage(error)}`
    );
  }
}
