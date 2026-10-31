/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/staging/domain/staging-domain-resources.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/staging/domain/staging-domain-resources.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/staging/domain/staging-domain-resources.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import path from "node:path";
import { VersionControlError } from "../../../../shared/src/version-control/index.ts";
import { sanitizeInvestigationDiagnosticText } from "../../diagnostics.ts";
import { ResourceInspectionError } from "../../resources/resource-inspection.ts";
import {
  prepareInvestigationResourceRoot,
  type ResourceRoot
} from "../../resources/resource-root.ts";
import {
  inspectOwnedInvestigationResources,
  inspectDirectInvestigationResource
} from "../../resources/resource-file-validation.ts";
import { validateReferencedInvestigationResources } from "../../resources/resources.ts";
import { investigationResourcesDirectoryName } from "../../resources/resource-reference.ts";
import type { DomainResourcePaths } from "./staging-domain-membership.ts";
import type { DomainAcquisitionRequest } from "./staging-domain-writes.ts";

export async function validateDomainResources(
  request: DomainAcquisitionRequest,
  resources: DomainResourcePaths
): Promise<void> {
  const prefix =
    path.posix.join(
      request.investigationsScope,
      investigationResourcesDirectoryName
    ) + "/";
  const directory = path.join(
    request.repository.rootDirectory,
    request.investigationsScope
  );
  const prepared = await prepareInvestigationResourceRoot(directory, {
    mode: "version-control",
    files: new Set(
      resources.workspacePaths
        .filter((file) => file.startsWith(prefix))
        .map((file) => file.slice(prefix.length))
    )
  });
  if (prepared.status === "invalid") {
    if (
      prepared.failure instanceof ResourceInspectionError ||
      prepared.failure instanceof VersionControlError
    )
      throw prepared.failure;
    throw new Error(prepared.errors.join("; "));
  }
  if (prepared.status === "missing") {
    const errors = await validateReferencedInvestigationResources(
      directory,
      request.sourceSelection.resourceIds,
      undefined,
      prepared
    );
    if (errors.length > 0) throw new Error(errors.join("; "));
    return;
  }
  await validateReadyDomainResources(
    prepared,
    request,
    resources.ownerPaths.map((file) => file.slice(prefix.length))
  );
}

export function domainResourceInspectionFailure(
  error: unknown,
  repositoryRoot: string
): unknown {
  if (
    !(error instanceof ResourceInspectionError) ||
    error.diagnostic.target === null
  )
    return error;
  const relative = path
    .relative(repositoryRoot, error.diagnostic.target)
    .split(path.sep)
    .join("/");
  return new ResourceInspectionError({
    ...error.diagnostic,
    target: sanitizeInvestigationDiagnosticText(relative).replace(
      /\p{Cc}/gu,
      " "
    )
  });
}

async function validateReadyDomainResources(
  prepared: ResourceRoot,
  request: DomainAcquisitionRequest,
  ownedResourceIds: readonly string[]
): Promise<void> {
  const owned = await inspectOwnedInvestigationResources(
    prepared,
    request.selectedIds,
    ownedResourceIds
  );
  if (owned.failure !== undefined) throw owned.failure;
  const errors = [...owned.errors];
  for (const id of request.sourceSelection.resourceIds) {
    const direct = await inspectDirectInvestigationResource(prepared, id);
    if (direct.failure !== undefined) throw direct.failure;
    errors.push(...direct.errors);
  }
  if (errors.length > 0) throw new Error(errors.join("; "));
  await prepared.directories.assertCurrent();
}
