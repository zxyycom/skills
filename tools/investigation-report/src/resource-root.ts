import { type Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import {
  isFileSystemError,
  isPathWithinDirectory
} from "../../shared/src/node/filesystem.ts";
import {
  openVersionControl,
  repositoryRelativePathFromFileSystemPath,
  VersionControlError
} from "../../shared/src/version-control/index.ts";
import { sanitizeInvestigationDiagnosticText } from "./diagnostics.ts";
import { investigationResourcesDirectoryName } from "./resource-reference.ts";

export type ManagedResourceMembership =
  | Readonly<{ mode: "file-system" }>
  | Readonly<{ files: ReadonlySet<string>; mode: "version-control" }>;
export type ResourceRoot = Readonly<{
  canonicalResourcesRoot: string;
  membership: ManagedResourceMembership;
}>;
export type ResourceRootPreparation =
  | Readonly<{ membership: ManagedResourceMembership; status: "missing" }>
  | Readonly<{ errors: string[]; status: "invalid" }>
  | (ResourceRoot & Readonly<{ status: "ready" }>);

export async function prepareInvestigationResourceRoot(
  investigationsDirectory: string
): Promise<ResourceRootPreparation> {
  const resourcesRoot = path.join(
    investigationsDirectory,
    investigationResourcesDirectoryName
  );
  try {
    const rootStat = await lstatOrNull(resourcesRoot);
    if (rootStat === null)
      return await prepareMissingResourceRoot(
        investigationsDirectory,
        resourcesRoot
      );
    if (rootStat.isSymbolicLink())
      return invalidRoot(
        `${investigationResourcesDirectoryName} must not be a symbolic link`
      );
    if (!rootStat.isDirectory())
      return invalidRoot(
        `${investigationResourcesDirectoryName} must be a directory`
      );
    return await prepareReadyResourceRoot(
      investigationsDirectory,
      resourcesRoot
    );
  } catch (error) {
    return invalidRoot(
      `${investigationResourcesDirectoryName} could not be inspected: ${errorText(error)}`
    );
  }
}

export async function discoverVisibleInvestigationResourceIds(
  resourceRoot: ResourceRoot,
  signal: AbortSignal | undefined
): Promise<string[]> {
  if (resourceRoot.membership.mode === "version-control")
    return [...resourceRoot.membership.files].sort(compareText);
  return await walkFileSystemResourceIds(
    resourceRoot.canonicalResourcesRoot,
    "",
    resourceRoot.canonicalResourcesRoot,
    signal
  );
}

async function prepareMissingResourceRoot(
  investigationsDirectory: string,
  resourcesRoot: string
): Promise<ResourceRootPreparation> {
  try {
    return {
      membership: await readManagedResourceMembership(
        investigationsDirectory,
        resourcesRoot
      ),
      status: "missing"
    };
  } catch (error) {
    return invalidRoot(
      `${investigationResourcesDirectoryName} membership could not be determined: ${errorText(error)}`
    );
  }
}

async function prepareReadyResourceRoot(
  investigationsDirectory: string,
  resourcesRoot: string
): Promise<ResourceRootPreparation> {
  try {
    const canonicalResourcesRoot = await verifiedCanonicalResourcesRoot(
      investigationsDirectory,
      resourcesRoot
    );
    const membership = await readManagedResourceMembership(
      investigationsDirectory,
      canonicalResourcesRoot
    );
    return { canonicalResourcesRoot, membership, status: "ready" };
  } catch (error) {
    return invalidRoot(
      `${investigationResourcesDirectoryName} could not be safely resolved: ${errorText(error)}`
    );
  }
}

async function readManagedResourceMembership(
  investigationsDirectory: string,
  resourcesRoot: string
): Promise<ManagedResourceMembership> {
  let repository: Awaited<ReturnType<typeof openVersionControl>>;
  try {
    repository = await openVersionControl(investigationsDirectory);
  } catch (error) {
    if (error instanceof VersionControlError && error.code === "not-repository")
      return { mode: "file-system" };
    throw error;
  }
  const resourcePathScope = repositoryRelativePathFromFileSystemPath(
    repository.rootDirectory,
    resourcesRoot
  );
  const resourcePathPrefix = resourcePathScope + "/";
  const workspaceFiles = await repository.listWorkspaceFiles({
    pathScopes: [resourcePathScope]
  });
  return {
    files: new Set(
      workspaceFiles.flatMap((workspacePath) =>
        workspacePath.startsWith(resourcePathPrefix)
          ? [workspacePath.slice(resourcePathPrefix.length)]
          : []
      )
    ),
    mode: "version-control"
  };
}

async function walkFileSystemResourceIds(
  absoluteDirectory: string,
  relativeDirectory: string,
  canonicalResourcesRoot: string,
  signal: AbortSignal | undefined
): Promise<string[]> {
  throwIfAborted(signal, "investigation resource discovery was aborted");
  const entries = await readResourceDirectory(
    absoluteDirectory,
    relativeDirectory
  );
  const nested = await Promise.all(
    entries.map((entry) =>
      fileSystemResourceEntryIds(
        absoluteDirectory,
        relativeDirectory,
        canonicalResourcesRoot,
        entry,
        signal
      )
    )
  );
  return nested.flat().sort(compareText);
}

async function readResourceDirectory(
  absoluteDirectory: string,
  relativeDirectory: string
): Promise<Dirent<string>[]> {
  try {
    const entries = await fs.readdir(absoluteDirectory, {
      withFileTypes: true
    });
    return entries.sort((left, right) => compareText(left.name, right.name));
  } catch (error) {
    throw new Error(
      `${resourceDirectoryPath(relativeDirectory)} could not be read: ${errorText(error)}`,
      { cause: error }
    );
  }
}

async function fileSystemResourceEntryIds(
  absoluteDirectory: string,
  relativeDirectory: string,
  canonicalResourcesRoot: string,
  entry: Dirent<string>,
  signal: AbortSignal | undefined
): Promise<string[]> {
  const id =
    relativeDirectory.length === 0
      ? entry.name
      : `${relativeDirectory}/${entry.name}`;
  const absolutePath = path.join(absoluteDirectory, entry.name);
  const stat = await inspectedResourceEntry(absolutePath, id);
  if (!stat.isDirectory() || stat.isSymbolicLink()) return [id];
  const canonicalDirectory = await canonicalNestedDirectory(
    absolutePath,
    canonicalResourcesRoot,
    id
  );
  const nestedIds = await walkFileSystemResourceIds(
    canonicalDirectory,
    id,
    canonicalResourcesRoot,
    signal
  );
  return nestedIds.length === 0 && id.split("/").length >= 2 ? [id] : nestedIds;
}

async function inspectedResourceEntry(
  absolutePath: string,
  id: string
): Promise<Awaited<ReturnType<typeof fs.lstat>>> {
  try {
    return await fs.lstat(absolutePath);
  } catch (error) {
    throw new Error(
      `${resourcePath(id)} could not be inspected: ${errorText(error)}`,
      { cause: error }
    );
  }
}

async function canonicalNestedDirectory(
  absolutePath: string,
  canonicalResourcesRoot: string,
  id: string
): Promise<string> {
  try {
    return await verifiedCanonicalResourceDirectory(
      absolutePath,
      canonicalResourcesRoot
    );
  } catch (error) {
    throw new Error(
      `${resourcePath(id)} could not be safely traversed: ${errorText(error)}`,
      { cause: error }
    );
  }
}

export async function verifiedCanonicalResourceDirectory(
  directoryPath: string,
  canonicalResourcesRoot: string
): Promise<string> {
  const canonicalDirectory = await fs.realpath(directoryPath);
  if (!isPathWithinDirectory(canonicalDirectory, canonicalResourcesRoot))
    throw new Error("directory resolves outside the resource root");
  const verifiedStat = await fs.lstat(directoryPath, { bigint: true });
  if (verifiedStat.isSymbolicLink())
    throw new Error("directory must not be a symbolic link");
  if (!verifiedStat.isDirectory())
    throw new Error("path component must remain a directory");
  const canonicalStat = await fs.stat(canonicalDirectory, { bigint: true });
  if (!sameFileIdentity(verifiedStat, canonicalStat))
    throw new Error("directory identity changed while being verified");
  if ((await fs.realpath(directoryPath)) !== canonicalDirectory)
    throw new Error("directory changed while being verified");
  return canonicalDirectory;
}

async function verifiedCanonicalResourcesRoot(
  investigationsDirectory: string,
  resourcesRoot: string
): Promise<string> {
  const canonicalInvestigationsDirectory = await fs.realpath(
    investigationsDirectory
  );
  const canonicalResourcesRoot = await fs.realpath(resourcesRoot);
  if (
    !isPathWithinDirectory(
      canonicalResourcesRoot,
      canonicalInvestigationsDirectory
    )
  )
    throw new Error(
      `${investigationResourcesDirectoryName} resolves outside the investigation root`
    );
  const verifiedRootStat = await fs.lstat(resourcesRoot, { bigint: true });
  if (verifiedRootStat.isSymbolicLink())
    throw new Error(
      `${investigationResourcesDirectoryName} must not be a symbolic link`
    );
  if (!verifiedRootStat.isDirectory())
    throw new Error(
      `${investigationResourcesDirectoryName} must be a directory`
    );
  const canonicalRootStat = await fs.stat(canonicalResourcesRoot, {
    bigint: true
  });
  if (!sameFileIdentity(verifiedRootStat, canonicalRootStat))
    throw new Error(
      `${investigationResourcesDirectoryName} identity changed while being verified`
    );
  if ((await fs.realpath(resourcesRoot)) !== canonicalResourcesRoot)
    throw new Error(
      `${investigationResourcesDirectoryName} changed while being verified`
    );
  return canonicalResourcesRoot;
}

function invalidRoot(error: string): ResourceRootPreparation {
  return { errors: [error], status: "invalid" };
}
function sameFileIdentity(
  left: Readonly<{ dev: bigint; ino: bigint }>,
  right: Readonly<{ dev: bigint; ino: bigint }>
): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}
async function lstatOrNull(
  targetPath: string
): Promise<Awaited<ReturnType<typeof fs.lstat>> | null> {
  try {
    return await fs.lstat(targetPath);
  } catch (error) {
    if (isFileSystemError(error, "ENOENT")) return null;
    throw error;
  }
}
function throwIfAborted(
  signal: AbortSignal | undefined,
  message: string
): void {
  if (signal?.aborted === true) throw new Error(message);
}
function resourcePath(id: string): string {
  return `${investigationResourcesDirectoryName}/${id}`;
}
function resourceDirectoryPath(relativeDirectory: string): string {
  return relativeDirectory.length === 0
    ? investigationResourcesDirectoryName
    : resourcePath(relativeDirectory);
}
function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
function errorText(error: unknown): string {
  return sanitizeInvestigationDiagnosticText(error);
}
