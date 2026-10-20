/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/staging-domain-writes.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/staging-domain-writes.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/staging-domain-writes.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import {
  validateDomainResources,
  domainResourceInspectionFailure
} from "./staging-domain-resources.ts";
import path from "node:path";
import { hasEntry } from "../../index-runtime/src/index.ts";
import type {
  RevisionId,
  VersionControlFile,
  VersionControlRepository
} from "../../shared/src/version-control/index.ts";
import {
  readPendingSnapshot,
  type PendingFileUpdate,
  type PendingSnapshot
} from "../../shared/src/version-control/pending-snapshot.ts";
import { investigationResourcesDirectoryName } from "./resource-reference.ts";
import {
  validateDomainReportSources,
  verifyDeletedDomainSources,
  type DomainSourceSelection
} from "./staging-domain-sources.ts";
import {
  compareText,
  sameBytes,
  type InvestigationIndex
} from "./staging-domain-support.ts";

export type DomainWrite = PendingFileUpdate;
export type DomainWriteFailure = Readonly<{
  status: "error";
  code: "source-read-failed" | "pending-read-failed";
  error: unknown;
}>;

/** Immutable request and resolved HEAD facts; all mutable facts belong to one acquisition. */
export type DomainAcquisitionRequest = Readonly<{
  baseline: InvestigationIndex | null;
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
    input.revision === null
      ? []
      : await input.repository.listRevisionFiles(input.revision, {
          pathScopes: ownerScopes
        });
  return {
    baseline: input.baseline,
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

/** Membership and complete pending facts are fresh before any phase source bytes are read. */
export async function acquireDomainPhase(
  request: DomainAcquisitionRequest
): Promise<DomainPhaseResult> {
  let resources: DomainResourcePaths;
  try {
    resources = await selectedResourcePaths(request);
  } catch (error) {
    return { status: "error", code: "source-read-failed", error };
  }
  const reportPaths = selectedReportPaths(
    request.workspaceIndex,
    request.sourceSelection.reportIds,
    request.investigationsScope
  );
  const baselinePaths = selectedReportPaths(
    request.baseline,
    request.selectedIds,
    request.investigationsScope
  );
  try {
    const pending = await readPendingSnapshot(request.repository, {
      pathScope: request.investigationsScope,
      contentPaths: [...reportPaths, ...baselinePaths, ...resources.paths]
    });
    return {
      status: "ok",
      value: { resources, reportPaths, baselinePaths, pending }
    };
  } catch (error) {
    return { status: "error", code: "pending-read-failed", error };
  }
}

/** Resource validation precedes this phase's source-byte acquisition. */
export async function collectDomainWrites(
  request: DomainAcquisitionRequest,
  phase: DomainPhaseFacts
): Promise<DomainWritesResult> {
  const { resources, reportPaths, baselinePaths, pending } = phase;
  try {
    await validateDomainResources(request, resources);
    const sourceFiles = await request.repository.readWorkspaceFiles(
      [...reportPaths, ...resources.paths],
      { pendingFiles: pending.members }
    );
    const filesByPath = new Map(sourceFiles.map((file) => [file.path, file]));
    validateDomainReportSources({
      files: filesByPath,
      index: request.workspaceIndex,
      investigationsScope: request.investigationsScope,
      selection: request.sourceSelection
    });
    await verifyDeletedDomainSources(
      path.join(request.repository.rootDirectory, request.investigationsScope),
      request.sourceSelection,
      filesByPath,
      request.investigationsScope
    );
    return {
      status: "ok",
      pending,
      sourceFiles,
      value: domainWrites(
        selectedReportPaths(
          request.workspaceIndex,
          request.selectedIds,
          request.investigationsScope
        ),
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

export type DomainResourcePaths = Readonly<{
  paths: readonly string[];
  ownerPaths: readonly string[];
  workspacePaths: readonly string[];
}>;
async function selectedResourcePaths(
  request: DomainAcquisitionRequest
): Promise<DomainResourcePaths> {
  const prefix =
    path.posix.join(
      request.investigationsScope,
      investigationResourcesDirectoryName
    ) + "/";
  const ownerScopes = request.selectedIds.map((id) => prefix + id);
  const directPaths = request.sourceSelection.resourceIds.map(
    (id) => prefix + id
  );
  const workspacePaths = await request.repository.listWorkspaceFiles({
    pathScopes: [...ownerScopes, ...directPaths]
  });
  const selected = new Set(request.selectedIds);
  const ownerPaths = [
    ...new Set([...workspacePaths, ...request.headResourcePaths])
  ]
    .filter((filePath) => {
      if (!filePath.startsWith(prefix)) return false;
      const relative = filePath.slice(prefix.length);
      const separator = relative.indexOf("/");
      return separator > 0 && selected.has(relative.slice(0, separator));
    })
    .sort(compareText);
  return {
    ownerPaths,
    workspacePaths,
    paths: [...new Set([...ownerPaths, ...directPaths])].sort(compareText)
  };
}

function selectedReportPaths(
  index: InvestigationIndex | null,
  selectedIds: readonly string[],
  scope: string
): ReadonlySet<string> {
  if (index === null) return new Set();
  return new Set(
    selectedIds
      .filter((id) => hasEntry(index, id))
      .map((id) => path.posix.join(scope, index.entries[id].sourcePath))
  );
}

export type DomainWritesVerification =
  | Readonly<{ status: "ok" }>
  | Readonly<{ status: "drift"; reason: string }>
  | DomainWriteFailure;
/** Pure phase comparison preserves acquisition failures rather than disguising them as byte drift. */
export function verifyDomainWrites(
  expected: DomainWritesAcquisition,
  current: DomainWritesResult
): DomainWritesVerification {
  if (current.status === "error") return current;
  if (current.value.length !== expected.value.length)
    return {
      status: "drift",
      reason:
        "the selected owner resource members changed before the pending write"
    };
  if (!sameSourceFiles(expected.sourceFiles, current.sourceFiles))
    return {
      status: "drift",
      reason:
        "the selected sources or required owner bytes or representation changed before the pending write"
    };
  const byPath = new Map(current.value.map((write) => [write.path, write]));
  for (const write of expected.value) {
    const verified = byPath.get(write.path);
    if (verified === undefined || !sameDomainWriteValue(write, verified))
      return {
        status: "drift",
        reason: `${write.path} changed before the pending write`
      };
  }
  return { status: "ok" };
}
function sameDomainWriteValue(left: DomainWrite, right: DomainWrite): boolean {
  return left.data === null || right.data === null
    ? left.data === right.data
    : left.kind === right.kind && sameBytes(left.data, right.data);
}
function sameSourceFiles(
  left: readonly VersionControlFile[],
  right: readonly VersionControlFile[]
): boolean {
  return (
    left.length === right.length &&
    left.every((file, index) => {
      const current = right[index];
      return (
        current !== undefined &&
        file.path === current.path &&
        sameDomainWriteValue(file, current)
      );
    })
  );
}
