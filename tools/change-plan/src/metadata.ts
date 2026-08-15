import { randomUUID } from "node:crypto";
import type { Stats } from "node:fs";
import fs, { type FileHandle } from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
import { changePlanMetadataName } from "./types.ts";

const revisionSchema = v.pipe(
  v.string("must be a string"),
  v.nonEmpty("must not be empty"),
  v.regex(/^\S+$/, "must not contain whitespace")
);

export const changePlanMetadataSchema = v.variant("stage", [
  v.strictObject({
    stage: v.literal("draft")
  }),
  v.strictObject({
    baseCommit: revisionSchema,
    stage: v.literal("plan")
  })
]);

export type ChangePlanMetadata = v.InferOutput<typeof changePlanMetadataSchema>;

export type ChangePlanMetadataErrorCode =
  | "invalid"
  | "invalid-path"
  | "io"
  | "missing";

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
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function schemaIssueMessage(issue: v.BaseIssue<unknown>): string {
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
      "io",
      `cannot inspect ${changePlanMetadataName}: ${errorMessage(error)}`
    );
  }
}

async function requireRegularMetadataFile(metadataPath: string): Promise<void> {
  const metadataStat = await lstatMetadata(metadataPath);
  if (metadataStat === null) {
    throw new ChangePlanMetadataError(
      "missing",
      `${changePlanMetadataName} is required for active changes`
    );
  }
  if (metadataStat.isSymbolicLink()) {
    throw new ChangePlanMetadataError(
      "invalid-path",
      `${changePlanMetadataName} must not be a symbolic link`
    );
  }
  if (!metadataStat.isFile()) {
    throw new ChangePlanMetadataError(
      "invalid-path",
      `${changePlanMetadataName} must be a regular file`
    );
  }
}

async function readMetadataValue(changeDirectory: string): Promise<unknown> {
  const metadataPath = path.join(changeDirectory, changePlanMetadataName);
  await requireRegularMetadataFile(metadataPath);

  let contents: string;
  try {
    contents = await fs.readFile(metadataPath, "utf8");
  } catch (error) {
    throw new ChangePlanMetadataError(
      "io",
      `cannot read ${changePlanMetadataName}: ${errorMessage(error)}`
    );
  }

  try {
    return JSON.parse(contents) as unknown;
  } catch (error) {
    throw new ChangePlanMetadataError(
      "invalid",
      `invalid ${changePlanMetadataName} JSON: ${errorMessage(error)}`
    );
  }
}

async function writeMetadataFile(
  metadataPath: string,
  contents: string,
  mode: number | undefined
): Promise<void> {
  const tempPath = `${metadataPath}.${randomUUID()}.tmp`;
  let tempFile: FileHandle | null = null;
  let ownsTempPath = false;
  try {
    tempFile = await fs.open(tempPath, "wx", mode);
    ownsTempPath = true;
    await tempFile.writeFile(contents, "utf8");
    if (mode !== undefined) {
      await tempFile.chmod(mode);
    }
    await tempFile.sync();
    await tempFile.close();
    tempFile = null;
    await fs.rename(tempPath, metadataPath);
    ownsTempPath = false;
  } finally {
    if (tempFile !== null) {
      await tempFile.close().catch(() => undefined);
    }
    if (ownsTempPath) {
      await fs.unlink(tempPath).catch(() => undefined);
    }
  }
}

export function parseChangePlanMetadata(value: unknown): ChangePlanMetadata {
  const parsed = v.safeParse(changePlanMetadataSchema, value);
  if (!parsed.success) {
    throw new ChangePlanMetadataError(
      "invalid",
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
  return parseChangePlanMetadata(await readMetadataValue(changeDirectory));
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
      "invalid-path",
      `${changePlanMetadataName} must not be a symbolic link`
    );
  }
  if (metadataStat !== null && !metadataStat.isFile()) {
    throw new ChangePlanMetadataError(
      "invalid-path",
      `${changePlanMetadataName} must be a regular file`
    );
  }

  try {
    await writeMetadataFile(
      metadataPath,
      `${JSON.stringify(normalizedMetadata, null, 2)}\n`,
      metadataStat === null ? undefined : metadataStat.mode & 0o777
    );
  } catch (error) {
    throw new ChangePlanMetadataError(
      "io",
      `cannot write ${changePlanMetadataName}: ${errorMessage(error)}`
    );
  }
}
