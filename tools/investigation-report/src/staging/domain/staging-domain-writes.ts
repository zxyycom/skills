import { validatePendingDomainDependencies } from "./staging-domain-pending-dependencies.ts";
import {
  selectedReportPaths,
  type DomainResourcePaths
} from "./staging-domain-membership.ts";
import {
  validateDomainResources,
  domainResourceInspectionFailure
} from "./staging-domain-resources.ts";
import path from "node:path";
import type {
  RevisionId,
  VersionControlFile,
  VersionControlRepository
} from "../../../../shared/src/version-control/index.ts";
import {
  type PendingFileUpdate,
  type PendingSnapshot
} from "../../../../shared/src/version-control/pending-snapshot.ts";
import { investigationResourcesDirectoryName } from "../../resources/resource-reference.ts";
import {
  validateDomainReportSources,
  type DomainSourceSelection
} from "./staging-domain-sources.ts";
import type { InvestigationIndex } from "./staging-domain-support.ts";

export type DomainWrite = PendingFileUpdate;
export type DomainWriteFailure = Readonly<{
  status: "error";
  code: "source-read-failed" | "pending-read-failed";
  error: unknown;
}>;

/** Immutable request and resolved HEAD facts; all mutable facts belong to one acquisition. */
export type DomainAcquisitionRequest = Readonly<{
  baseline: InvestigationIndex | null;
  pendingIndex: InvestigationIndex | null;
  pendingReportPaths: ReadonlyMap<string, readonly string[]>;
  pendingResourcePaths: readonly string[];
  scope: "all" | "domain" | "index";
  investigationsScope: string;
  repository: VersionControlRepository;
  selectedIds: readonly string[];
  sourceSelection: DomainSourceSelection;
  workspaceIndex: InvestigationIndex;
  headResourcePaths: readonly string[];
}>;
export type DomainWriteRequestInput = Omit<
  DomainAcquisitionRequest,
  "headResourcePaths"
> &
  Readonly<{ revision: RevisionId | null }>;

export async function prepareDomainAcquisitionRequest(
  input: DomainWriteRequestInput
): Promise<DomainAcquisitionRequest> {
  const ownerScopes = input.selectedIds.map((id) =>
    path.posix.join(
      input.investigationsScope,
      investigationResourcesDirectoryName,
      id
    )
  );
  const headResourcePaths =
    input.revision === null || input.scope === "index"
      ? []
      : await input.repository.listRevisionFiles(input.revision, {
          pathScopes: ownerScopes
        });
  return {
    baseline: input.baseline,
    pendingIndex: input.pendingIndex,
    pendingReportPaths: input.pendingReportPaths,
    pendingResourcePaths: input.pendingResourcePaths,
    scope: input.scope,
    investigationsScope: input.investigationsScope,
    repository: input.repository,
    selectedIds: input.selectedIds,
    sourceSelection: input.sourceSelection,
    workspaceIndex: input.workspaceIndex,
    headResourcePaths
  };
}

export type DomainWritesAcquisition = Readonly<{
  status: "ok";
  value: readonly DomainWrite[];
  sourceFiles: readonly VersionControlFile[];
  pending: PendingSnapshot;
}>;
export type DomainWritesResult = DomainWritesAcquisition | DomainWriteFailure;

export type DomainPhaseFacts = Readonly<{
  resources: DomainResourcePaths;
  reportPaths: ReadonlySet<string>;
  baselinePaths: ReadonlySet<string>;
  pending: PendingSnapshot;
}>;
export type DomainPhaseResult =
  | Readonly<{ status: "ok"; value: DomainPhaseFacts }>
  | DomainWriteFailure;

/** Resource validation precedes this phase's source-byte acquisition. */
export async function collectDomainWrites(
  request: DomainAcquisitionRequest,
  phase: DomainPhaseFacts
): Promise<DomainWritesResult> {
  const { resources, baselinePaths, pending } = phase;
  try {
    if (request.scope === "index")
      return { status: "ok", value: [], sourceFiles: [], pending };
    await validateDomainResources(request, resources);
    const { sourceFiles, filesByPath, currentReportPaths } =
      await readValidatedDomainSources(request, phase);
    if (request.scope === "all")
      validatePendingDomainDependencies(request, pending, filesByPath);
    return {
      status: "ok",
      pending,
      sourceFiles,
      value: domainWrites(
        currentReportPaths,
        baselinePaths,
        resources.ownerPaths,
        filesByPath
      )
    };
  } catch (error) {
    return {
      status: "error",
      code: "source-read-failed",
      error: domainResourceInspectionFailure(
        error,
        request.repository.rootDirectory
      )
    };
  }
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

function validateOldReportLocations(
  baselinePaths: ReadonlySet<string>,
  currentReportPaths: ReadonlySet<string>,
  filesByPath: ReadonlyMap<string, VersionControlFile>
): void {
  for (const oldPath of baselinePaths) {
    if (!currentReportPaths.has(oldPath) && filesByPath.has(oldPath))
      throw new Error(
        `Selected old report location still exists in workspace: ${oldPath}; run scoped check and sync-index before retrying stage`
      );
  }
}

async function readValidatedDomainSources(
  request: DomainAcquisitionRequest,
  phase: DomainPhaseFacts
): Promise<
  Readonly<{
    sourceFiles: readonly VersionControlFile[];
    filesByPath: ReadonlyMap<string, VersionControlFile>;
    currentReportPaths: ReadonlySet<string>;
  }>
> {
  const { reportPaths, baselinePaths, resources, pending } = phase;
  const sourceFiles = await request.repository.readWorkspaceFiles(
    [...new Set([...reportPaths, ...baselinePaths, ...resources.paths])],
    { pendingFiles: pending.members }
  );
  const filesByPath = new Map(sourceFiles.map((file) => [file.path, file]));
  const currentReportPaths = selectedReportPaths(
    request.workspaceIndex,
    request.selectedIds,
    request.investigationsScope
  );
  validateOldReportLocations(baselinePaths, currentReportPaths, filesByPath);
  validateDomainReportSources({
    files: filesByPath,
    index: request.workspaceIndex,
    investigationsScope: request.investigationsScope,
    selection: request.sourceSelection
  });
  return { sourceFiles, filesByPath, currentReportPaths };
}
