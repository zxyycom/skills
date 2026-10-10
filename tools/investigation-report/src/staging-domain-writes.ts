import path from "node:path";
import type {
  RevisionId,
  VersionControlFile,
  VersionControlRepository
} from "../../shared/src/version-control/index.ts";
import { investigationSourceRevision } from "./investigation-source-revision.ts";
import { investigationIdFromMarkdown } from "./markdown.ts";
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
  const currentPaths = selectedReportPaths(options.workspaceIndex, options);
  const baselinePaths = selectedReportPaths(options.baseline, options);
  let resourcePaths: string[];
  try {
    resourcePaths = await selectedResourcePaths(options);
  } catch (error) {
    return { status: "error", code: "version-control-failed", error };
  }
  let files: VersionControlFile[];
  try {
    files = await options.repository.readWorkspaceFiles([
      ...currentPaths,
      ...resourcePaths
    ]);
  } catch (error) {
    return { status: "error", code: "source-read-failed", error };
  }
  const filesByPath = new Map(files.map((file) => [file.path, file]));
  try {
    verifySelectedReportSources(options, filesByPath, currentPaths);
  } catch (error) {
    return { status: "error", code: "source-read-failed", error };
  }
  const writes: DomainWrite[] = [...baselinePaths]
    .filter((reportPath) => !currentPaths.has(reportPath))
    .map((reportPath) => ({ data: null, path: reportPath }));
  for (const reportPath of currentPaths)
    writes.push(filesByPath.get(reportPath)!);
  for (const resourcePath of resourcePaths)
    writes.push(
      filesByPath.get(resourcePath) ?? { data: null, path: resourcePath }
    );
  return { status: "ok", value: writes };
}

async function selectedResourcePaths(
  options: DomainWriteOptions
): Promise<string[]> {
  const ownerScopes = options.selectedIds.map((id) =>
    path.posix.join(
      options.investigationsScope,
      investigationResourcesDirectoryName,
      id
    )
  );
  const workspace = await options.repository.listWorkspaceFiles({
    pathScopes: ownerScopes
  });
  const baseline =
    options.revision === null
      ? []
      : await options.repository.listRevisionFiles(options.revision, {
          pathScopes: ownerScopes
        });
  return [...new Set([...workspace, ...baseline])]
    .filter((filePath) =>
      ownerScopes.some((scope) => filePath.startsWith(scope + "/"))
    )
    .sort(compareText);
}

function verifySelectedReportSources(
  options: DomainWriteOptions,
  filesByPath: ReadonlyMap<string, VersionControlFile>,
  currentPaths: ReadonlySet<string>
): void {
  for (const reportPath of currentPaths) {
    const file = filesByPath.get(reportPath);
    if (file === undefined)
      throw new Error("Selected report is missing: " + reportPath);
  }
  for (const id of options.selectedIds) {
    if (!hasEntry(options.workspaceIndex, id)) continue;
    const state = options.workspaceIndex.entries[id];
    const reportPath = path.posix.join(
      options.investigationsScope,
      state.sourcePath
    );
    const file = filesByPath.get(reportPath)!;
    const text = new TextDecoder("utf-8", { fatal: true }).decode(file.data);
    if (
      investigationIdFromMarkdown(text) !== id ||
      investigationSourceRevision([{ id, sourcePath: state.sourcePath, text }])
        .entries[id] !== options.workspaceIndex.sourceRevision.entries[id]
    )
      throw new Error(
        "Selected report changed from the published source: " + reportPath
      );
  }
}

function selectedReportPaths(
  index: InvestigationIndex | null,
  options: Pick<DomainWriteOptions, "investigationsScope" | "selectedIds">
): ReadonlySet<string> {
  const paths = new Set<string>();
  for (const id of options.selectedIds) {
    if (hasEntry(index, id))
      paths.add(
        path.posix.join(
          options.investigationsScope,
          index.entries[id].sourcePath
        )
      );
  }
  return paths;
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
