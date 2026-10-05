import path from "node:path";
import type {
  RevisionId,
  VersionControlFile,
  VersionControlRepository
} from "../../shared/src/version-control/index.ts";
import { hasEntry } from "../../index-runtime/src/index.ts";
import { investigationResourcesDirectoryName } from "./resource-reference.ts";
import {
  compareText,
  sameBytes,
  type InvestigationIndex
} from "./staging-domain-support.ts";

export type DomainWrite =
  | VersionControlFile
  | Readonly<{ data: null; path: string }>;

type DomainWriteFailure = Readonly<{
  status: "error";
  code: "source-read-failed" | "version-control-failed";
  error: unknown;
}>;

export type DomainWritesResult =
  | Readonly<{ status: "ok"; value: readonly DomainWrite[] }>
  | DomainWriteFailure;

export type DomainWriteOptions = Readonly<{
  baseline: InvestigationIndex | null;
  investigationsScope: string;
  repository: VersionControlRepository;
  revision: RevisionId | null;
  selectedIds: readonly string[];
  workspaceIndex: InvestigationIndex;
}>;

/**
 * Prepares the selected domain writes from indexed report paths plus every
 * workspace-and-HEAD owner resource member of each selected report.
 */
export async function collectDomainWrites(
  options: DomainWriteOptions
): Promise<DomainWritesResult> {
  const reports = await selectedReportWrites(options);
  if (reports.status === "error") return reports;
  const writes = [...reports.value];
  for (const id of options.selectedIds) {
    const resources = await ownerResourceWrites(options, id);
    if (resources.status === "error") return resources;
    writes.push(...resources.value);
  }
  return { status: "ok", value: writes };
}

/**
 * Plans removals for obsolete baseline paths and reads current report snapshots;
 * it does not modify pending or workspace files. Current paths of all selected
 * IDs take precedence over baseline removals, independent of selector order.
 */
async function selectedReportWrites(
  options: DomainWriteOptions
): Promise<DomainWritesResult> {
  const currentPaths = selectedReportPaths(options.workspaceIndex, options);
  const baselinePaths = selectedReportPaths(options.baseline, options);
  const writes: DomainWrite[] = [...baselinePaths]
    .filter((reportPath) => !currentPaths.has(reportPath))
    .map((reportPath) => ({ data: null, path: reportPath }));
  for (const reportPath of currentPaths) {
    const source = await readWorkspaceSource(options.repository, reportPath);
    if (source.status === "error") return source;
    if (source.value === null) {
      return {
        status: "error",
        code: "source-read-failed",
        error: new Error("Selected report is missing: " + reportPath)
      };
    }
    writes.push(source.value);
  }
  return { status: "ok", value: writes };
}

function selectedReportPaths(
  index: InvestigationIndex | null,
  options: Pick<DomainWriteOptions, "investigationsScope" | "selectedIds">
): ReadonlySet<string> {
  const paths = new Set<string>();
  for (const id of options.selectedIds) {
    if (hasEntry(index, id)) {
      paths.add(
        path.posix.join(
          options.investigationsScope,
          index.entries[id].sourcePath
        )
      );
    }
  }
  return paths;
}

async function ownerResourceWrites(
  options: DomainWriteOptions,
  id: string
): Promise<DomainWritesResult> {
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
    const source = await readWorkspaceSource(options.repository, member);
    if (source.status === "error") return source;
    writes.push(source.value ?? { data: null, path: member });
  }
  return { status: "ok", value: writes };
}

/**
 * Rereads selected source snapshots and owner resource members before pending
 * replacement; changes in membership, bytes, or representation stop the write.
 */
export async function verifyDomainWrites(
  options: DomainWriteOptions & Readonly<{ writes: readonly DomainWrite[] }>
): Promise<string | null> {
  const current = await collectDomainWrites(options);
  if (current.status === "error") {
    return "the selected domain sources could not be reread before the pending write";
  }
  if (current.value.length !== options.writes.length) {
    return "the selected owner resource members changed before the pending write";
  }
  const currentByPath = new Map(
    current.value.map((write) => [write.path, write])
  );
  for (const write of options.writes) {
    const verified = currentByPath.get(write.path);
    if (verified === undefined || !sameDomainWriteValue(write, verified)) {
      return `${write.path} changed before the pending write`;
    }
  }
  return null;
}

function sameDomainWriteValue(left: DomainWrite, right: DomainWrite): boolean {
  if (left.data === null || right.data === null) {
    return left.data === right.data;
  }
  return left.kind === right.kind && sameBytes(left.data, right.data);
}

async function ownerResourceMembers(
  options: Readonly<{
    ownerScope: string;
    repository: VersionControlRepository;
    revision: RevisionId | null;
  }>
): Promise<
  | Readonly<{ status: "ok"; value: readonly string[] }>
  | Readonly<{
      status: "error";
      code: "version-control-failed";
      error: unknown;
    }>
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

/** Reads source bytes and representation together; missing resources become deletions. */
async function readWorkspaceSource(
  repository: VersionControlRepository,
  repositoryFilePath: string
): Promise<
  | Readonly<{ status: "ok"; value: VersionControlFile | null }>
  | Readonly<{ status: "error"; code: "source-read-failed"; error: unknown }>
> {
  try {
    const file = await repository.readWorkspaceFile(repositoryFilePath);
    return { status: "ok", value: file };
  } catch (error) {
    return { status: "error", code: "source-read-failed", error };
  }
}
