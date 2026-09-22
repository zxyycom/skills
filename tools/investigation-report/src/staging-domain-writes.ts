import fs from "node:fs/promises";
import path from "node:path";
import type {
  RevisionId,
  VersionControlRepository
} from "../../shared/src/version-control/index.ts";
import { hasEntry } from "../../index-runtime/src/index.ts";
import { investigationResourcesDirectoryName } from "./resource-reference.ts";
import {
  compareText,
  sameBytes,
  type InvestigationIndex
} from "./staging-domain-support.ts";

export type DomainWrite = Readonly<{ data: Uint8Array | null; path: string }>;

export type DomainWriteOptions = Readonly<{
  investigationsDirectory: string;
  investigationsScope: string;
  repository: VersionControlRepository;
  revision: RevisionId | null;
  selectedIds: readonly string[];
  workspaceIndex: InvestigationIndex;
}>;

/**
 * Prepares the selected domain writes: one Markdown write per selected report
 * (a baseline-only ID stages as a deletion) plus every workspace-and-HEAD
 * owner resource member of each selected report.
 */
export async function collectDomainWrites(
  options: DomainWriteOptions
): Promise<
  | { status: "ok"; value: DomainWrite[] }
  | { status: "error"; code: string; error: unknown }
> {
  const writes: DomainWrite[] = [];
  for (const id of options.selectedIds) {
    const report = await selectedReportWrite(options, id);
    if (report.status === "error") return report;
    writes.push(report.value);
    const resources = await ownerResourceWrites(options, id);
    if (resources.status === "error") return resources;
    writes.push(...resources.value);
  }
  return { status: "ok", value: writes };
}

async function selectedReportWrite(
  options: DomainWriteOptions,
  id: string
): Promise<
  | { status: "ok"; value: DomainWrite }
  | { status: "error"; code: string; error: unknown }
> {
  const reportPath = path.posix.join(options.investigationsScope, `${id}.md`);
  if (!hasEntry(options.workspaceIndex, id)) {
    return { status: "ok", value: { data: null, path: reportPath } };
  }
  const bytes = await readWorkspaceFileBytes(options.repository, reportPath);
  if (bytes.status === "error") {
    return {
      status: "error",
      code: "source-read-failed",
      error: bytes.error
    };
  }
  return { status: "ok", value: { data: bytes.value, path: reportPath } };
}

async function ownerResourceWrites(
  options: DomainWriteOptions,
  id: string
): Promise<
  | { status: "ok"; value: DomainWrite[] }
  | { status: "error"; code: string; error: unknown }
> {
  const ownerScope = path.posix.join(
    options.investigationsScope,
    investigationResourcesDirectoryName,
    id
  );
  const members = await ownerResourceMembers({
    ownerScope,
    repository: options.repository,
    revision: options.revision
  });
  if (members.status === "error") {
    return { status: "error", code: members.code, error: members.error };
  }
  const writes: DomainWrite[] = [];
  for (const member of members.value) {
    const bytes = await readWorkspaceFileBytesOrNull(
      options.repository,
      member
    );
    if (bytes.status === "error") {
      return {
        status: "error",
        code: "source-read-failed",
        error: bytes.error
      };
    }
    writes.push({ data: bytes.value, path: member });
  }
  return { status: "ok", value: writes };
}

/**
 * Rereads the selected report bytes and owner resource members immediately
 * before the pending replacement so injected drift between snapshot
 * preparation and the write stops the transaction with pending unchanged.
 */
export async function verifyDomainWrites(
  options: DomainWriteOptions & { writes: readonly DomainWrite[] }
): Promise<string | null> {
  const current = await collectDomainWrites(options);
  if (current.status === "error") {
    return "the selected domain sources could not be reread before the pending write";
  }
  if (current.value.length !== options.writes.length) {
    return "the selected owner resource members changed before the pending write";
  }
  for (const write of options.writes) {
    const verified = current.value.find(
      (candidate) => candidate.path === write.path
    );
    if (verified === undefined || !sameBytes(verified.data, write.data)) {
      return `${write.path} changed before the pending write`;
    }
  }
  return null;
}

async function ownerResourceMembers(options: {
  ownerScope: string;
  repository: VersionControlRepository;
  revision: RevisionId | null;
}): Promise<
  | { status: "ok"; value: string[] }
  | { status: "error"; code: string; error: unknown }
> {
  try {
    const workspace = (
      await options.repository.listWorkspaceFiles({
        pathScopes: [options.ownerScope]
      })
    ).filter((filePath) => filePath.startsWith(options.ownerScope + "/"));
    const revisionFiles =
      options.revision === null
        ? []
        : await options.repository.listRevisionFiles(options.revision, {
            pathScopes: [options.ownerScope]
          });
    return {
      status: "ok",
      value: [...new Set([...workspace, ...revisionFiles])].sort(compareText)
    };
  } catch (error) {
    return { status: "error", code: "version-control-failed", error };
  }
}

/**
 * Reads one workspace member for the pending target: absent members return
 * null so tracked-but-deleted owner resources stage as deletions, while
 * symlinks, non-regular entries, and unreadable bytes stop the transaction.
 */
async function readWorkspaceFileBytesOrNull(
  repository: VersionControlRepository,
  repositoryFilePath: string
): Promise<
  { status: "ok"; value: Buffer | null } | { status: "error"; error: unknown }
> {
  const read = await readWorkspaceFileBytes(repository, repositoryFilePath);
  if (read.status === "error") {
    if (
      read.error instanceof Error &&
      "code" in read.error &&
      read.error.code === "ENOENT"
    ) {
      return { status: "ok", value: null };
    }
    return read;
  }
  return { status: "ok", value: read.value };
}

async function readWorkspaceFileBytes(
  repository: VersionControlRepository,
  repositoryFilePath: string
): Promise<
  { status: "ok"; value: Buffer } | { status: "error"; error: unknown }
> {
  const filePath = path.join(
    repository.rootDirectory,
    ...repositoryFilePath.split("/")
  );
  try {
    const entry = await fs.lstat(filePath);
    if (entry.isSymbolicLink() || !entry.isFile()) {
      return {
        status: "error",
        error: new Error(
          "Investigation stage source must be a regular non-symlink file: " +
            path.basename(filePath)
        )
      };
    }
    return { status: "ok", value: await fs.readFile(filePath) };
  } catch (error) {
    return { status: "error", error };
  }
}
