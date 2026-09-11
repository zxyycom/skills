import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import {
  openVersionControl,
  repositoryRelativePathFromFileSystemPath,
  VersionControlError,
  type VersionControlRepository
} from "../../shared/src/version-control/index.ts";
import {
  investigationResourcesDirectoryName,
  isInvestigationResourceId
} from "./resource-reference.ts";
import { compareText, errorText, uniqueSorted } from "./discard.ts";
import type { InvestigationIndexState } from "./types.ts";
import { lstatOrNull } from "./discard-files.ts";

export function referencesToTarget(
  states: ReadonlyMap<string, InvestigationIndexState>,
  id: string
): string[] {
  return uniqueSorted(
    [...states]
      .filter(
        ([source, state]) =>
          source !== id &&
          state.relations.some((relation) => relation.target === id)
      )
      .map(
        ([source]) =>
          `${id} is still a direct relation target of ${source}; update that report with set-relations before discard`
      )
  );
}

export function sharedOwnerResourceReferences(
  referencesByReport: ReadonlyMap<string, ReadonlySet<string>>,
  id: string
): string[] {
  const ownerPrefix = `${id}/`;
  return uniqueSorted(
    [...referencesByReport]
      .filter(
        ([source, resourceIds]) =>
          source !== id &&
          [...resourceIds].some((resourceId) =>
            resourceId.startsWith(ownerPrefix)
          )
      )
      .map(
        ([source]) =>
          `${id} owns resources still referenced by ${source}; remove or replace those resource links before discard`
      )
  );
}

export async function isRecordedAtHead(
  root: string,
  reportSourcePath: string,
  ownedResourceIds: readonly string[]
): Promise<{ errors: string[]; recorded: boolean }> {
  const opened = await openRepositoryOrFilesystem(root);
  if (opened.errors.length > 0)
    return { errors: opened.errors, recorded: false };
  if (opened.repository === null) return { errors: [], recorded: false };
  try {
    const revision = await opened.repository.getCurrentRevision();
    if (revision === null) return { errors: [], recorded: false };
    const scope = repositoryScope(opened.repository, root);
    const paths = [
      scope.length === 0 ? reportSourcePath : `${scope}/${reportSourcePath}`,
      ...ownedResourceIds.map((resourceId) =>
        scope.length === 0
          ? `${investigationResourcesDirectoryName}/${resourceId}`
          : `${scope}/${investigationResourcesDirectoryName}/${resourceId}`
      )
    ];
    const files = await opened.repository.listRevisionFiles(revision, {
      pathScopes: paths
    });
    return { errors: [], recorded: files.length > 0 };
  } catch (error) {
    return {
      errors: [
        `Git HEAD could not be inspected before discard: ${errorText(error)}`
      ],
      recorded: false
    };
  }
}

export async function openRepositoryOrFilesystem(root: string): Promise<{
  errors: string[];
  repository: VersionControlRepository | null;
}> {
  try {
    return { errors: [], repository: await openVersionControl(root) };
  } catch (error) {
    if (
      error instanceof VersionControlError &&
      error.code === "not-repository"
    ) {
      return { errors: [], repository: null };
    }
    return {
      errors: [
        `version-control state could not be inspected before discard: ${errorText(error)}`
      ],
      repository: null
    };
  }
}

export function repositoryScope(
  repository: VersionControlRepository,
  root: string
): string {
  return path.resolve(root) === repository.rootDirectory
    ? ""
    : repositoryRelativePathFromFileSystemPath(repository.rootDirectory, root);
}

export async function inspectOwnedResources(
  root: string,
  ownerPath: string
): Promise<ResourceTreeScan> {
  const scanned = await scanOwnerResourceTree(
    ownerPath,
    path.basename(ownerPath)
  );
  const errors = [...scanned.errors];
  if (scanned.directories.length === 0) {
    return { ...scanned, errors: uniqueSorted(errors) };
  }
  const opened = await openRepositoryOrFilesystem(root);
  errors.push(...opened.errors);
  if (opened.repository !== null) {
    try {
      const resourceRoot = path.join(root, investigationResourcesDirectoryName);
      const scope = repositoryRelativePathFromFileSystemPath(
        opened.repository.rootDirectory,
        resourceRoot
      );
      const visible = new Set(
        (
          await opened.repository.listWorkspaceFiles({ pathScopes: [scope] })
        ).flatMap((file) =>
          file.startsWith(`${scope}/`) ? [file.slice(scope.length + 1)] : []
        )
      );
      for (const resourceId of scanned.resourceIds) {
        if (!visible.has(resourceId)) {
          errors.push(
            `owned resource ${resourceId} is ignored by version-control rules and cannot be deleted transactionally`
          );
        }
      }
    } catch (error) {
      errors.push(
        `owned resources could not be checked against version-control membership: ${errorText(error)}`
      );
    }
  }
  return { ...scanned, errors: uniqueSorted(errors) };
}

export type ResourceTreeScan = Readonly<{
  directories: string[];
  errors: string[];
  resourceIds: string[];
}>;

export async function scanOwnerResourceTree(
  ownerPath: string,
  ownerPrefix: string
): Promise<ResourceTreeScan> {
  const ownerEntry = await lstatOrNull(ownerPath);
  if (ownerEntry === null)
    return { directories: [], errors: [], resourceIds: [] };
  if (ownerEntry.isSymbolicLink() || !ownerEntry.isDirectory()) {
    return {
      directories: [],
      errors: ["owner resource path must be a non-symbolic-link directory"],
      resourceIds: []
    };
  }
  const directories = [""];
  const errors: string[] = [];
  const resourceIds: string[] = [];
  async function walk(directory: string, relative: string): Promise<void> {
    let entries: Dirent<string>[];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      errors.push(
        `owned resources could not be inspected: ${errorText(error)}`
      );
      return;
    }
    for (const entry of entries.sort((left, right) =>
      compareText(left.name, right.name)
    )) {
      const next =
        relative.length === 0 ? entry.name : `${relative}/${entry.name}`;
      const resourceId = `${ownerPrefix}/${next}`;
      const absolute = path.join(directory, entry.name);
      let stat: Awaited<ReturnType<typeof fs.lstat>>;
      try {
        stat = await fs.lstat(absolute);
      } catch (error) {
        errors.push(
          `owned resource ${resourceId} could not be inspected: ${errorText(error)}`
        );
        continue;
      }
      if (stat.isSymbolicLink()) {
        errors.push(`owned resource ${resourceId} must not be a symbolic link`);
      } else if (stat.isDirectory()) {
        directories.push(next);
        await walk(absolute, next);
      } else if (stat.isFile()) {
        if (!isInvestigationResourceId(resourceId)) {
          errors.push(
            `owned resource ${resourceId} must use a safe, normalized resource id`
          );
        }
        resourceIds.push(resourceId);
      } else {
        errors.push(`owned resource ${resourceId} must be a regular file`);
      }
    }
  }
  await walk(ownerPath, "");
  return {
    directories: [...new Set(directories)].sort(compareText),
    errors: uniqueSorted(errors),
    resourceIds: uniqueSorted(resourceIds)
  };
}
