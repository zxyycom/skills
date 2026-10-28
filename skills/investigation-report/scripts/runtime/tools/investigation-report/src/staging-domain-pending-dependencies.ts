/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/staging-domain-pending-dependencies.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/staging-domain-pending-dependencies.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/staging-domain-pending-dependencies.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import path from "node:path";
import type { VersionControlFile } from "../../shared/src/version-control/index.ts";
import type { PendingSnapshot } from "../../shared/src/version-control/pending-snapshot.ts";
import { investigationResourcesDirectoryName } from "./resource-reference.ts";
import type { DomainAcquisitionRequest } from "./staging-domain-writes.ts";
import { sameDomainWriteValue } from "./staging-domain-support.ts";

export function validatePendingDomainDependencies(
  request: DomainAcquisitionRequest,
  pending: PendingSnapshot,
  filesByPath: ReadonlyMap<string, VersionControlFile>
): void {
  const pendingFiles = new Map(pending.files.map((file) => [file.path, file]));
  validatePendingResources(request, pendingFiles, filesByPath);
}

function validatePendingResources(
  request: DomainAcquisitionRequest,
  pendingFiles: ReadonlyMap<string, VersionControlFile>,
  filesByPath: ReadonlyMap<string, VersionControlFile>
): void {
  const prefix =
    path.posix.join(
      request.investigationsScope,
      investigationResourcesDirectoryName
    ) + "/";
  const selectedIds = new Set(request.selectedIds);
  for (const resourceId of request.sourceSelection.resourceIds) {
    const owner = resourceId.slice(0, resourceId.indexOf("/"));
    if (selectedIds.has(owner)) continue;
    const resourcePath = prefix + resourceId;
    const current = filesByPath.get(resourcePath);
    const staged = pendingFiles.get(resourcePath);
    if (
      current === undefined ||
      staged === undefined ||
      !sameDomainWriteValue(current, staged)
    )
      throw new Error(
        `Required shared resource is not ready in pending: ${resourceId}; explicitly select owner ${owner} as well`
      );
  }
}
