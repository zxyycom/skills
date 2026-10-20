/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/resource-root.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/resource-root.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/resource-root.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import {
  verifiedCanonicalResourceDirectory,
  verifiedCanonicalResourcesRoot
} from "./resource-canonical-path.ts";
export { verifiedCanonicalResourceDirectory } from "./resource-canonical-path.ts";
import {
  inspectResource,
  ResourceInspectionError,
  resourceInspectionFailure
} from "./resource-inspection.ts";
import { type Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { isFileSystemError } from "../../shared/src/node/filesystem.ts";
import {
  openVersionControl,
  repositoryRelativePathFromFileSystemPath,
  VersionControlError
} from "../../shared/src/version-control/index.ts";
import { sanitizeInvestigationDiagnosticText } from "./diagnostics.ts";
import { ResourceDirectoryFacts } from "./resource-directory-facts.ts";
import { investigationResourcesDirectoryName } from "./resource-reference.ts";

export type ManagedResourceMembership =
  | Readonly<{ mode: "file-system" }>
  | Readonly<{ files: ReadonlySet<string>; mode: "version-control" }>;
export type ResourceRoot = Readonly<{
  canonicalResourcesRoot: string;
  directories: ResourceDirectoryFacts;
  membership: ManagedResourceMembership;
}>;
export type ResourceRootPreparation =
  | Readonly<{ membership: ManagedResourceMembership; status: "missing" }>
  | Readonly<{
      errors: string[];
      failure?: ResourceInspectionError | VersionControlError;
      status: "invalid";
    }>
  | (ResourceRoot & Readonly<{ status: "ready" }>);

export async function prepareInvestigationResourceRoot(
  investigationsDirectory: string,
  membership?: ManagedResourceMembership
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
        resourcesRoot,
        membership
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
      resourcesRoot,
      membership
    );
  } catch (error) {
    return invalidRoot(
      `${investigationResourcesDirectoryName} could not be inspected: ${errorText(error)}`,
      error
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
  resourcesRoot: string,
  membership?: ManagedResourceMembership
): Promise<ResourceRootPreparation> {
  try {
    return {
      membership:
        membership ??
        (await readManagedResourceMembership(
          investigationsDirectory,
          resourcesRoot
        )),
      status: "missing"
    };
  } catch (error) {
    return invalidRoot(
      `${investigationResourcesDirectoryName} membership could not be determined: ${errorText(error)}`,
      error
    );
  }
}

async function prepareReadyResourceRoot(
  investigationsDirectory: string,
  resourcesRoot: string,
  membership?: ManagedResourceMembership
): Promise<ResourceRootPreparation> {
  try {
    const canonicalResourcesRoot = await verifiedCanonicalResourcesRoot(
      investigationsDirectory,
      resourcesRoot
    );
    const managed =
      membership ??
      (await readManagedResourceMembership(
        investigationsDirectory,
        canonicalResourcesRoot
      ));
    return {
      canonicalResourcesRoot,
      directories: await ResourceDirectoryFacts.create(canonicalResourcesRoot),
      membership: managed,
      status: "ready"
    };
  } catch (error) {
    return invalidRoot(
      `${investigationResourcesDirectoryName} could not be safely resolved: ${errorText(error)}`,
      error
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
    const entries = await inspectResource(
      "read resource directory",
      absoluteDirectory,
      () => fs.readdir(absoluteDirectory, { withFileTypes: true })
    );
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
    return await inspectResource("inspect resource path", absolutePath, () =>
      fs.lstat(absolutePath)
    );
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

function invalidRoot(
  error: string,
  failure?: unknown
): ResourceRootPreparation {
  return {
    errors: [error],
    ...(failure instanceof ResourceInspectionError ||
    failure instanceof VersionControlError
      ? { failure }
      : {}),
    status: "invalid"
  };
}
async function lstatOrNull(
  targetPath: string
): Promise<Awaited<ReturnType<typeof fs.lstat>> | null> {
  try {
    return await fs.lstat(targetPath);
  } catch (error) {
    if (isFileSystemError(error, "ENOENT")) return null;
    throw resourceInspectionFailure(error, "inspect resource path", targetPath);
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
