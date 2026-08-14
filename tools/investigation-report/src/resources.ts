import {
  constants as fileSystemConstants,
  type Dirent
} from "node:fs";
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
import {
  investigationResourcesDirectoryName,
  isInvestigationResourceId
} from "./resource-reference.ts";
import type { InvestigationResourceSource } from "./types.ts";

type ResourceWalkResult = {
  encounteredResourceIds: string[];
  errors: string[];
  resources: InvestigationResourceSource[];
};

type ManagedResourceMembership =
  | Readonly<{ mode: "file-system" }>
  | Readonly<{
    directories: ReadonlySet<string>;
    files: ReadonlySet<string>;
    mode: "version-control";
  }>;

export async function readInvestigationResources(
  investigationsDirectory: string,
  signal?: AbortSignal
): Promise<InvestigationResourceSource[]> {
  const resourcesRoot = path.join(
    investigationsDirectory,
    investigationResourcesDirectoryName
  );
  let rootStat: Awaited<ReturnType<typeof fs.lstat>> | null;
  try {
    rootStat = await lstatOrNull(resourcesRoot);
  } catch (error) {
    throw new Error(
      `${investigationResourcesDirectoryName} could not be inspected: ${errorText(error)}`,
      { cause: error }
    );
  }
  if (rootStat === null) {
    return [];
  }
  if (rootStat.isSymbolicLink()) {
    throw new Error(`${investigationResourcesDirectoryName} must not be a symbolic link`);
  }
  if (!rootStat.isDirectory()) {
    throw new Error(`${investigationResourcesDirectoryName} must be a directory`);
  }

  let canonicalResourcesRoot: string;
  try {
    canonicalResourcesRoot = await verifiedCanonicalResourcesRoot(
      investigationsDirectory,
      resourcesRoot
    );
  } catch (error) {
    throw new Error(
      `${investigationResourcesDirectoryName} could not be safely resolved: ${errorText(error)}`,
      { cause: error }
    );
  }
  const managedResourceMembership = await readManagedResourceMembership(
    investigationsDirectory,
    canonicalResourcesRoot
  );
  const walked = await walkResourceDirectory(
    canonicalResourcesRoot,
    "",
    canonicalResourcesRoot,
    managedResourceMembership,
    signal
  );
  if (managedResourceMembership.mode === "version-control") {
    const encountered = new Set(walked.encounteredResourceIds);
    for (const id of managedResourceMembership.files) {
      if (!encountered.has(id)) {
        walked.errors.push(`${resourcePath(id)} does not exist`);
      }
    }
  }
  if (walked.errors.length > 0) {
    throw new Error(uniqueSorted(walked.errors).join("; "));
  }
  return walked.resources.sort((left, right) => compareText(left.id, right.id));
}

export async function validateReferencedInvestigationResources(
  investigationsDirectory: string,
  resourceIds: readonly string[],
  signal?: AbortSignal
): Promise<string[]> {
  const ids = uniqueSorted(resourceIds);
  if (ids.length === 0) {
    return [];
  }

  const errors: string[] = [];
  const validIds = ids.filter((id) => {
    if (isInvestigationResourceId(id)) {
      return true;
    }
    errors.push(`resource ${JSON.stringify(id)} must use a safe, normalized resource id`);
    return false;
  });
  const resourcesRoot = path.join(
    investigationsDirectory,
    investigationResourcesDirectoryName
  );
  let rootStat: Awaited<ReturnType<typeof fs.lstat>> | null;
  try {
    rootStat = await lstatOrNull(resourcesRoot);
  } catch (error) {
    errors.push(
      `${investigationResourcesDirectoryName} could not be inspected: ${errorText(error)}`
    );
    return uniqueSorted(errors);
  }
  if (rootStat === null) {
    errors.push(...validIds.map((id) => `${resourcePath(id)} does not exist`));
    return uniqueSorted(errors);
  }
  if (rootStat.isSymbolicLink()) {
    errors.push(`${investigationResourcesDirectoryName} must not be a symbolic link`);
    return uniqueSorted(errors);
  }
  if (!rootStat.isDirectory()) {
    errors.push(`${investigationResourcesDirectoryName} must be a directory`);
    return uniqueSorted(errors);
  }

  let canonicalResourcesRoot: string;
  try {
    canonicalResourcesRoot = await verifiedCanonicalResourcesRoot(
      investigationsDirectory,
      resourcesRoot
    );
  } catch (error) {
    errors.push(
      `${investigationResourcesDirectoryName} could not be safely resolved: ${errorText(error)}`
    );
    return uniqueSorted(errors);
  }
  let managedResourceMembership: ManagedResourceMembership;
  try {
    managedResourceMembership = await readManagedResourceMembership(
      investigationsDirectory,
      canonicalResourcesRoot
    );
  } catch (error) {
    errors.push(
      `${investigationResourcesDirectoryName} membership could not be determined: ${errorText(error)}`
    );
    return uniqueSorted(errors);
  }

  for (const id of validIds) {
    if (signal?.aborted === true) {
      throw new Error("investigation resource validation was aborted");
    }
    try {
      const resourceErrors = await validateReferencedResource(
        canonicalResourcesRoot,
        id
      );
      errors.push(...resourceErrors);
      if (
        resourceErrors.length === 0
        && managedResourceMembership.mode === "version-control"
        && !managedResourceMembership.files.has(id)
      ) {
        errors.push(
          `${resourcePath(id)} is ignored by version-control rules and is not a managed investigation resource`
        );
      }
    } catch (error) {
      errors.push(`${resourcePath(id)} could not be validated: ${errorText(error)}`);
    }
  }
  return uniqueSorted(errors);
}

async function walkResourceDirectory(
  absoluteDirectory: string,
  relativeDirectory: string,
  canonicalResourcesRoot: string,
  managedResourceMembership: ManagedResourceMembership,
  signal: AbortSignal | undefined
): Promise<ResourceWalkResult> {
  const encounteredResourceIds: string[] = [];
  const errors: string[] = [];
  const resources: InvestigationResourceSource[] = [];
  if (signal?.aborted === true) {
    throw new Error("investigation resource read was aborted");
  }
  let entries: Dirent<string>[];
  try {
    entries = await fs.readdir(absoluteDirectory, { withFileTypes: true });
  } catch (error) {
    errors.push(
      `${resourceDirectoryPath(relativeDirectory)} could not be read: ${errorText(error)}`
    );
    return { encounteredResourceIds, errors, resources };
  }
  entries.sort((left, right) => compareText(left.name, right.name));
  for (const entry of entries) {
    const id = relativeDirectory.length === 0
      ? entry.name
      : `${relativeDirectory}/${entry.name}`;
    if (!isManagedResourcePath(id, managedResourceMembership)) {
      continue;
    }
    const absolutePath = path.join(absoluteDirectory, entry.name);
    let stat: Awaited<ReturnType<typeof fs.lstat>>;
    try {
      stat = await fs.lstat(absolutePath);
    } catch (error) {
      errors.push(`${resourcePath(id)} could not be inspected: ${errorText(error)}`);
      continue;
    }
    if (stat.isSymbolicLink()) {
      if (
        managedResourceMembership.mode === "version-control"
        && managedResourceMembership.files.has(id)
      ) {
        encounteredResourceIds.push(id);
      }
      errors.push(`${resourcePath(id)} must not be a symbolic link`);
      continue;
    }
    if (stat.isDirectory()) {
      let canonicalDirectory: string;
      try {
        canonicalDirectory = await verifiedCanonicalResourceDirectory(
          absolutePath,
          canonicalResourcesRoot
        );
      } catch (error) {
        errors.push(`${resourcePath(id)} could not be safely traversed: ${errorText(error)}`);
        continue;
      }
      const nested = await walkResourceDirectory(
        canonicalDirectory,
        id,
        canonicalResourcesRoot,
        managedResourceMembership,
        signal
      );
      encounteredResourceIds.push(...nested.encounteredResourceIds);
      errors.push(...nested.errors);
      resources.push(...nested.resources);
      continue;
    }
    if (
      managedResourceMembership.mode === "version-control"
      && !managedResourceMembership.files.has(id)
    ) {
      errors.push(
        `${resourcePath(id)} must remain a directory for version-control-visible resources`
      );
      continue;
    }
    encounteredResourceIds.push(id);
    if (!stat.isFile()) {
      errors.push(`${resourcePath(id)} must be a regular file`);
      continue;
    }
    if (!isInvestigationResourceId(id)) {
      errors.push(`${resourcePath(id)} must use a safe, normalized resource id`);
      continue;
    }
    try {
      resources.push({
        bytes: await readVerifiedRegularFile(
          absolutePath,
          canonicalResourcesRoot
        ),
        id
      });
    } catch (error) {
      errors.push(`${resourcePath(id)} could not be read as a regular file: ${errorText(error)}`);
    }
  }
  return { encounteredResourceIds, errors, resources };
}

async function readManagedResourceMembership(
  investigationsDirectory: string,
  resourcesRoot: string
): Promise<ManagedResourceMembership> {
  let repository: Awaited<ReturnType<typeof openVersionControl>>;
  try {
    repository = await openVersionControl(investigationsDirectory);
  } catch (error) {
    if (error instanceof VersionControlError && error.code === "not-repository") {
      return { mode: "file-system" };
    }
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
  const files = new Set(workspaceFiles.flatMap((workspacePath) => (
    workspacePath.startsWith(resourcePathPrefix)
      ? [workspacePath.slice(resourcePathPrefix.length)]
      : []
  )));
  const directories = new Set<string>();
  for (const id of files) {
    const segments = id.split("/");
    for (let index = 1; index < segments.length; index += 1) {
      directories.add(segments.slice(0, index).join("/"));
    }
  }
  return { directories, files, mode: "version-control" };
}

function isManagedResourcePath(
  id: string,
  managedResourceMembership: ManagedResourceMembership
): boolean {
  if (managedResourceMembership.mode === "file-system") {
    return true;
  }
  return managedResourceMembership.files.has(id)
    || managedResourceMembership.directories.has(id);
}

async function validateReferencedResource(
  canonicalResourcesRoot: string,
  id: string
): Promise<string[]> {
  const errors: string[] = [];
  let currentDirectory = canonicalResourcesRoot;
  const segments = id.split("/");
  for (const [index, segment] of segments.entries()) {
    const entries = await fs.readdir(currentDirectory, { withFileTypes: true });
    const exact = entries.find((entry) => entry.name === segment);
    if (exact === undefined) {
      const caseMismatch = entries.find((entry) => (
        entry.name.toLowerCase() === segment.toLowerCase()
      ));
      errors.push(caseMismatch === undefined
        ? `${resourcePath(id)} does not exist`
        : `${resourcePath(id)} must match actual path casing; found ${JSON.stringify(caseMismatch.name)}`);
      return errors;
    }

    const absolutePath = path.join(currentDirectory, exact.name);
    const stat = await fs.lstat(absolutePath);
    if (stat.isSymbolicLink()) {
      errors.push(`${resourcePath(id)} must not traverse or target a symbolic link`);
      return errors;
    }
    const isLast = index === segments.length - 1;
    if (!isLast) {
      if (!stat.isDirectory()) {
        errors.push(`${resourcePath(id)} has a non-directory path component ${JSON.stringify(segment)}`);
        return errors;
      }
      try {
        currentDirectory = await verifiedCanonicalResourceDirectory(
          absolutePath,
          canonicalResourcesRoot
        );
      } catch (error) {
        errors.push(`${resourcePath(id)} could not be safely traversed: ${errorText(error)}`);
        return errors;
      }
      continue;
    }
    if (!stat.isFile()) {
      errors.push(`${resourcePath(id)} must be a regular file`);
      return errors;
    }
    try {
      await readVerifiedRegularFile(absolutePath, canonicalResourcesRoot);
    } catch (error) {
      errors.push(`${resourcePath(id)} could not be read as a regular file: ${errorText(error)}`);
    }
  }
  return errors;
}

async function readVerifiedRegularFile(
  absolutePath: string,
  canonicalResourcesRoot: string
): Promise<Uint8Array> {
  const handle = await fs.open(
    absolutePath,
    fileSystemConstants.O_RDONLY | fileSystemConstants.O_NOFOLLOW
  );
  try {
    const openedStat = await handle.stat({ bigint: true });
    if (!openedStat.isFile()) {
      throw new Error("target is not a regular file");
    }
    const canonicalTarget = await fs.realpath(absolutePath);
    if (!isPathWithinDirectory(canonicalTarget, canonicalResourcesRoot)) {
      throw new Error("opened target resolves outside the resource root");
    }
    const resolvedStat = await fs.stat(canonicalTarget, { bigint: true });
    if (await fs.realpath(absolutePath) !== canonicalTarget) {
      throw new Error("resource path changed while its opened file was being verified");
    }
    if (!sameFileIdentity(openedStat, resolvedStat)) {
      throw new Error("resource path changed while its opened file was being verified");
    }
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

async function verifiedCanonicalResourceDirectory(
  directoryPath: string,
  canonicalResourcesRoot: string
): Promise<string> {
  const canonicalDirectory = await fs.realpath(directoryPath);
  if (!isPathWithinDirectory(canonicalDirectory, canonicalResourcesRoot)) {
    throw new Error("directory resolves outside the resource root");
  }
  const verifiedStat = await fs.lstat(directoryPath, { bigint: true });
  if (verifiedStat.isSymbolicLink()) {
    throw new Error("directory must not be a symbolic link");
  }
  if (!verifiedStat.isDirectory()) {
    throw new Error("path component must remain a directory");
  }
  const canonicalStat = await fs.stat(canonicalDirectory, { bigint: true });
  if (!sameFileIdentity(verifiedStat, canonicalStat)) {
    throw new Error("directory identity changed while being verified");
  }
  if (await fs.realpath(directoryPath) !== canonicalDirectory) {
    throw new Error("directory changed while being verified");
  }
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
  if (!isPathWithinDirectory(
    canonicalResourcesRoot,
    canonicalInvestigationsDirectory
  )) {
    throw new Error(`${investigationResourcesDirectoryName} resolves outside the investigation root`);
  }
  const verifiedRootStat = await fs.lstat(resourcesRoot, { bigint: true });
  if (verifiedRootStat.isSymbolicLink()) {
    throw new Error(`${investigationResourcesDirectoryName} must not be a symbolic link`);
  }
  if (!verifiedRootStat.isDirectory()) {
    throw new Error(`${investigationResourcesDirectoryName} must be a directory`);
  }
  const canonicalRootStat = await fs.stat(canonicalResourcesRoot, {
    bigint: true
  });
  if (!sameFileIdentity(verifiedRootStat, canonicalRootStat)) {
    throw new Error(`${investigationResourcesDirectoryName} identity changed while being verified`);
  }
  if (await fs.realpath(resourcesRoot) !== canonicalResourcesRoot) {
    throw new Error(`${investigationResourcesDirectoryName} changed while being verified`);
  }
  return canonicalResourcesRoot;
}

function sameFileIdentity(
  left: Readonly<{ dev: bigint; ino: bigint }>,
  right: Readonly<{ dev: bigint; ino: bigint }>
): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

async function lstatOrNull(targetPath: string): Promise<Awaited<
  ReturnType<typeof fs.lstat>
> | null> {
  try {
    return await fs.lstat(targetPath);
  } catch (error) {
    if (isFileSystemError(error, "ENOENT")) {
      return null;
    }
    throw error;
  }
}

function resourcePath(id: string): string {
  return `${investigationResourcesDirectoryName}/${id}`;
}

function resourceDirectoryPath(relativeDirectory: string): string {
  return relativeDirectory.length === 0
    ? investigationResourcesDirectoryName
    : resourcePath(relativeDirectory);
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
