import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import {
  openVersionControl,
  repositoryRelativePathFromFileSystemPath,
  VersionControlError,
  type VersionControlRepository
} from "../../shared/src/version-control/index.ts";
import { findCandidatePathForInvestigationId } from "./candidate-path.ts";
import {
  investigationResourcesDirectoryName,
  isInvestigationResourceId
} from "./resource-reference.ts";

export type CandidateResourceTree = Readonly<{
  directories: string[];
  errors: string[];
  resourceIds: string[];
}>;

export async function scanCandidateOwnerResources(
  root: string,
  ownerPath: string
): Promise<CandidateResourceTree> {
  const scanned = await scanResourceTree(ownerPath, path.basename(ownerPath));
  if (scanned.errors.length > 0 || scanned.resourceIds.length === 0)
    return scanned;
  const repository = await openRepository(root);
  if (repository.status === "error") {
    return { ...scanned, errors: repository.errors };
  }
  if (repository.value === null) return scanned;
  try {
    const resourcesRoot = path.join(root, investigationResourcesDirectoryName);
    const scope = repositoryScope(repository.value, resourcesRoot);
    const visible = new Set(
      (
        await repository.value.listWorkspaceFiles({ pathScopes: [scope] })
      ).flatMap((file) =>
        file.startsWith(`${scope}/`) ? [file.slice(scope.length + 1)] : []
      )
    );
    const errors = scanned.resourceIds
      .filter((id) => !visible.has(id))
      .map(
        (id) =>
          `owned resource ${id} is ignored by version-control rules and cannot be deleted transactionally`
      );
    return { ...scanned, errors };
  } catch {
    return {
      ...scanned,
      errors: [
        "owned resources could not be checked against version-control membership"
      ]
    };
  }
}

export async function scanResourceTree(
  ownerPath: string,
  ownerPrefix: string
): Promise<CandidateResourceTree> {
  const owner = await lstatOrNull(ownerPath);
  if (owner === null) return { directories: [], errors: [], resourceIds: [] };
  if (owner.isSymbolicLink() || !owner.isDirectory()) {
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
    } catch {
      errors.push("owned resources could not be inspected");
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
      } catch {
        errors.push(`owned resource ${resourceId} could not be inspected`);
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
            `owned resource ${resourceId} must use a safe resource ID`
          );
        } else {
          resourceIds.push(resourceId);
        }
      } else {
        errors.push(
          `owned resource ${resourceId} must be a regular file or directory`
        );
      }
    }
  }
  await walk(ownerPath, "");
  return {
    directories: directories.sort(compareText),
    errors: uniqueSorted(errors),
    resourceIds: resourceIds.sort(compareText)
  };
}

export async function candidateRecordedAtHead(
  root: string,
  id: string,
  resourceIds: readonly string[]
): Promise<
  | Readonly<{ status: "ok"; value: boolean }>
  | Readonly<{ errors: string[]; status: "error" }>
> {
  const repository = await openRepository(root);
  if (repository.status === "error") return repository;
  if (repository.value === null) return { status: "ok", value: false };
  try {
    const revision = await repository.value.getCurrentRevision();
    if (revision === null) return { status: "ok", value: false };
    const scope = repositoryScope(repository.value, root);
    const candidatePath = await findCandidatePathForInvestigationId(root, id);
    if (candidatePath === null) return { status: "ok", value: false };
    const candidate = path.basename(candidatePath);
    const paths = [
      scope.length === 0 ? candidate : `${scope}/${candidate}`,
      ...resourceIds.map((resource) =>
        scope.length === 0
          ? `${investigationResourcesDirectoryName}/${resource}`
          : `${scope}/${investigationResourcesDirectoryName}/${resource}`
      )
    ];
    const files = await repository.value.listRevisionFiles(revision, {
      pathScopes: paths
    });
    return { status: "ok", value: files.length > 0 };
  } catch {
    return {
      errors: ["Git HEAD could not be inspected before discard-candidate"],
      status: "error"
    };
  }
}

export async function openRepository(
  root: string
): Promise<
  | Readonly<{ status: "ok"; value: VersionControlRepository | null }>
  | Readonly<{ errors: string[]; status: "error" }>
> {
  try {
    return { status: "ok", value: await openVersionControl(root) };
  } catch (error) {
    if (
      error instanceof VersionControlError &&
      error.code === "not-repository"
    ) {
      return { status: "ok", value: null };
    }
    return {
      errors: [
        "version-control state could not be inspected before discard-candidate"
      ],
      status: "error"
    };
  }
}

export function repositoryScope(
  repository: VersionControlRepository,
  directory: string
): string {
  return path.resolve(directory) === repository.rootDirectory
    ? ""
    : repositoryRelativePathFromFileSystemPath(
        repository.rootDirectory,
        directory
      );
}

async function lstatOrNull(
  target: string
): Promise<Awaited<ReturnType<typeof fs.lstat>> | null> {
  try {
    return await fs.lstat(target);
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}
function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    Reflect.get(error, "code") === "ENOENT"
  );
}
function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}
function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
