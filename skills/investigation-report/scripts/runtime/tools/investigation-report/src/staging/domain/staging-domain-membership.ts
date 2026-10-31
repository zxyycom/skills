/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/staging/domain/staging-domain-membership.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/staging/domain/staging-domain-membership.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/staging/domain/staging-domain-membership.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import type { PendingSnapshot } from "../../../../shared/src/version-control/pending-snapshot.ts";
import { readRecordStagePending } from "../../../../index-runtime/src/staging/record-staging.ts";
import path from "node:path";
import { hasEntry } from "../../../../index-runtime/src/index.ts";
import { investigationIndexFileName } from "../../index/investigation-state-index.ts";
import { investigationResourcesDirectoryName } from "../../resources/resource-reference.ts";
import {
  compareText,
  type InvestigationIndex
} from "./staging-domain-support.ts";
import type {
  DomainAcquisitionRequest,
  DomainPhaseResult
} from "./staging-domain-writes.ts";

/** Membership and complete pending facts are fresh before any phase source bytes are read. */
export async function acquireDomainPhase(
  request: DomainAcquisitionRequest,
  captured?: PendingSnapshot
): Promise<DomainPhaseResult> {
  let resources: DomainResourcePaths;
  try {
    resources =
      request.scope === "index"
        ? { paths: [], ownerPaths: [], workspacePaths: [] }
        : await selectedResourcePaths(request);
  } catch (error) {
    return { status: "error", code: "source-read-failed", error };
  }
  const reportPaths = selectedReportPaths(
    request.workspaceIndex,
    request.scope === "index" ? [] : request.sourceSelection.reportIds,
    request.investigationsScope
  );
  const baselinePaths = selectedBaselinePaths(request);
  try {
    validateSelectedPathOwnership(request, baselinePaths);
    const contentPaths = selectedPendingContentPaths(
      request,
      reportPaths,
      baselinePaths,
      resources.paths,
      captured
    );
    const pending = await captureDomainPending(request, contentPaths, captured);
    return {
      status: "ok",
      value: { resources, reportPaths, baselinePaths, pending }
    };
  } catch (error) {
    return { status: "error", code: "pending-read-failed", error };
  }
}

/** Reuse this phase's capture only when all consumed payloads were retained. */
async function captureDomainPending(
  request: DomainAcquisitionRequest,
  contentPaths: readonly string[],
  _captured?: PendingSnapshot
): Promise<PendingSnapshot> {
  return await readRecordStagePending(request.repository, {
    scope: request.scope,
    indexPath: path.posix.join(
      request.investigationsScope,
      investigationIndexFileName
    ),
    pathScope: request.investigationsScope,
    contentPaths
  });
}

/** Retain only index content for index scope, or the sources consumed by domain validation. */
function selectedPendingContentPaths(
  request: DomainAcquisitionRequest,
  reportPaths: ReadonlySet<string>,
  baselinePaths: ReadonlySet<string>,
  resourcePaths: readonly string[],
  captured?: PendingSnapshot
): readonly string[] {
  if (request.scope === "index")
    return [
      path.posix.join(request.investigationsScope, investigationIndexFileName)
    ];
  return [
    ...(request.scope === "domain" &&
    request.pendingIndex === null &&
    !captured?.files.some(
      (file) =>
        file.path ===
        path.posix.join(request.investigationsScope, investigationIndexFileName)
    )
      ? []
      : [
          path.posix.join(
            request.investigationsScope,
            investigationIndexFileName
          )
        ]),
    ...reportPaths,
    ...[...request.pendingReportPaths.values()].flat(),
    ...baselinePaths,
    ...resourcePaths,
    ...selectedReportPaths(
      request.pendingIndex,
      request.sourceSelection.reportIds,
      request.investigationsScope
    )
  ];
}

function selectedBaselinePaths(
  request: DomainAcquisitionRequest
): ReadonlySet<string> {
  return new Set(
    request.scope === "index"
      ? []
      : [
          ...selectedReportPaths(
            request.baseline,
            request.selectedIds,
            request.investigationsScope
          ),
          ...selectedReportPaths(
            request.pendingIndex,
            request.selectedIds,
            request.investigationsScope
          ),
          ...request.selectedIds.flatMap(
            (id) => request.pendingReportPaths.get(id) ?? []
          )
        ]
  );
}

function validateSelectedPathOwnership(
  request: DomainAcquisitionRequest,
  baselinePaths: ReadonlySet<string>
): void {
  if (request.scope === "index") return;
  const ownedPaths = new Set([
    ...baselinePaths,
    ...selectedReportPaths(
      request.workspaceIndex,
      request.selectedIds,
      request.investigationsScope
    )
  ]);
  const entries = [request.pendingIndex, request.workspaceIndex].flatMap(
    (index) => Object.entries(index?.entries ?? {})
  );
  const selectedIds = new Set(request.selectedIds);
  for (const [id, state] of entries) {
    if (
      !selectedIds.has(id) &&
      ownedPaths.has(
        path.posix.join(request.investigationsScope, state.sourcePath)
      )
    )
      throw new Error(
        `Report path ownership requires explicitly selecting ${id} as well`
      );
  }
  for (const [id, paths] of request.pendingReportPaths) {
    if (!selectedIds.has(id) && paths.some((file) => ownedPaths.has(file)))
      throw new Error(
        `Pending report path ownership requires explicitly selecting ${id} as well`
      );
  }
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
    ...new Set([
      ...workspacePaths,
      ...request.headResourcePaths,
      ...request.pendingResourcePaths
    ])
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

export function selectedReportPaths(
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
