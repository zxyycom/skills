import path from "node:path";
import type {
  RevisionId,
  VersionControlFile,
  VersionControlRepository
} from "../../shared/src/version-control/index.ts";
import { hasEntry } from "../../index-runtime/src/index.ts";
import {
  domainSourceSelection,
  validateDomainReportSources,
  verifyDeletedDomainSources,
  type DomainSourceSelection
} from "./staging-domain-sources.ts";
import { prepareInvestigationResourceRoot } from "./resource-root.ts";
import { ownedInvestigationResourceIssues } from "./resource-file-validation.ts";
import { validateReferencedInvestigationResources } from "./resources.ts";
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

/** Acquisition facts shared by preparation and the write-before comparison. */
export type DomainWritesAcquisition = Readonly<{
  status: "ok";
  value: readonly DomainWrite[];
  sourceFiles: readonly VersionControlFile[];
  headResourcePaths: readonly string[];
}>;

export type DomainWritesResult = DomainWritesAcquisition | DomainWriteFailure;

export type DomainWriteOptions = Readonly<{
  baseline: InvestigationIndex | null;
  investigationsScope: string;
  repository: VersionControlRepository;
  revision: RevisionId | null;
  selectedIds: readonly string[];
  workspaceIndex: InvestigationIndex;
  sourceSelection?: DomainSourceSelection;
  headResourcePaths?: readonly string[];
  pendingFiles?: readonly VersionControlFile[];
}>;

/**
 * Prepares the selected domain writes from indexed report paths plus every
 * workspace-and-HEAD owner resource member of each selected report.
 */
export async function collectDomainWrites(
  options: DomainWriteOptions
): Promise<DomainWritesResult> {
  try {
    return await readDomainWrites(options);
  } catch (error) {
    return { status: "error", code: "source-read-failed", error };
  }
}

async function readDomainWrites(
  options: DomainWriteOptions
): Promise<DomainWritesAcquisition> {
  const selection =
    options.sourceSelection ??
    domainSourceSelection(options.workspaceIndex, options.selectedIds);
  const currentPaths = selectedReportPaths(options.workspaceIndex, options);
  const baselinePaths = selectedReportPaths(options.baseline, options);
  const resources = await selectedResourcePaths(options, selection);
  await validateDomainResources(options, selection, resources);
  const reportPaths = selectedReportPaths(options.workspaceIndex, {
    ...options,
    selectedIds: selection.reportIds
  });
  const sourceFiles = await options.repository.readWorkspaceFiles(
    [...reportPaths, ...resources.paths],
    options.pendingFiles === undefined
      ? {}
      : { pendingFiles: options.pendingFiles }
  );
  const filesByPath = new Map(sourceFiles.map((file) => [file.path, file]));
  validateDomainReportSources({
    files: filesByPath,
    index: options.workspaceIndex,
    investigationsScope: options.investigationsScope,
    selection
  });
  await verifyDeletedDomainSources(
    path.join(options.repository.rootDirectory, options.investigationsScope),
    selection,
    filesByPath,
    options.investigationsScope
  );
  return {
    status: "ok",
    value: domainWrites(
      currentPaths,
      baselinePaths,
      resources.ownerPaths,
      filesByPath
    ),
    sourceFiles,
    headResourcePaths: resources.headPaths
  };
}

function domainWrites(
  currentPaths: ReadonlySet<string>,
  baselinePaths: ReadonlySet<string>,
  ownerPaths: readonly string[],
  filesByPath: ReadonlyMap<string, VersionControlFile>
): DomainWrite[] {
  const writes: DomainWrite[] = [...baselinePaths]
    .filter((reportPath) => !currentPaths.has(reportPath))
    .map((reportPath) => ({ data: null, path: reportPath }));
  for (const reportPath of currentPaths)
    writes.push(filesByPath.get(reportPath)!);
  for (const resourcePath of ownerPaths)
    writes.push(
      filesByPath.get(resourcePath) ?? { data: null, path: resourcePath }
    );
  return writes;
}

type DomainResourcePaths = Readonly<{
  paths: readonly string[];
  ownerPaths: readonly string[];
  workspacePaths: readonly string[];
  headPaths: readonly string[];
}>;

async function selectedResourcePaths(
  options: DomainWriteOptions,
  selection: DomainSourceSelection
): Promise<DomainResourcePaths> {
  const ownerScopes = options.selectedIds.map((id) =>
    path.posix.join(
      options.investigationsScope,
      investigationResourcesDirectoryName,
      id
    )
  );
  const directPaths = selection.resourceIds.map((id) =>
    path.posix.join(
      options.investigationsScope,
      investigationResourcesDirectoryName,
      id
    )
  );
  const workspacePaths = await options.repository.listWorkspaceFiles({
    pathScopes: [...ownerScopes, ...directPaths]
  });
  const headPaths =
    options.headResourcePaths ??
    (options.revision === null
      ? []
      : await options.repository.listRevisionFiles(options.revision, {
          pathScopes: ownerScopes
        }));
  const ownerPaths = [...new Set([...workspacePaths, ...headPaths])]
    .filter((filePath) =>
      ownerScopes.some((scope) => filePath.startsWith(scope + "/"))
    )
    .sort(compareText);
  return {
    ownerPaths,
    workspacePaths,
    headPaths,
    paths: [...new Set([...ownerPaths, ...directPaths])].sort(compareText)
  };
}

async function validateDomainResources(
  options: DomainWriteOptions,
  selection: DomainSourceSelection,
  resources: DomainResourcePaths
): Promise<void> {
  const prefix =
    path.posix.join(
      options.investigationsScope,
      investigationResourcesDirectoryName
    ) + "/";
  const prepared = await prepareInvestigationResourceRoot(
    path.join(options.repository.rootDirectory, options.investigationsScope),
    {
      mode: "version-control",
      files: new Set(
        resources.workspacePaths
          .filter((filePath) => filePath.startsWith(prefix))
          .map((filePath) => filePath.slice(prefix.length))
      )
    }
  );
  if (prepared.status === "invalid")
    throw new Error(prepared.errors.join("; "));
  const ownerErrors =
    prepared.status === "ready"
      ? await ownedInvestigationResourceIssues(
          prepared,
          options.selectedIds,
          resources.ownerPaths.map((filePath) => filePath.slice(prefix.length))
        )
      : [];
  const directErrors = await validateReferencedInvestigationResources(
    path.join(options.repository.rootDirectory, options.investigationsScope),
    selection.resourceIds,
    undefined,
    prepared
  );
  const errors = [...ownerErrors, ...directErrors];
  if (errors.length > 0) throw new Error(errors.join("; "));
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
  options: DomainWriteOptions &
    Readonly<{
      writes: readonly DomainWrite[];
      sourceFiles?: readonly VersionControlFile[];
    }>
): Promise<string | null> {
  const current = await collectDomainWrites(options);
  if (current.status === "error") {
    return "the selected domain sources could not be reread before the pending write";
  }
  if (
    options.sourceFiles !== undefined &&
    !sameSourceFiles(options.sourceFiles, current.sourceFiles)
  )
    return "the selected sources or required owner bytes or representation changed before the pending write";
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

function sameSourceFiles(
  left: readonly VersionControlFile[],
  right: readonly VersionControlFile[]
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (file, index) =>
        file.path === right[index]?.path &&
        sameDomainWriteValue(file, right[index]!)
    )
  );
}
