import { constants as fileSystemConstants, type Dirent } from "node:fs";
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
import {
  investigationResourceOwnerReportId,
  investigationResourcesDirectoryName,
  isInvestigationResourceId
} from "./resource-reference.ts";

type ManagedResourceMembership =
  | Readonly<{ mode: "file-system" }>
  | Readonly<{
      files: ReadonlySet<string>;
      mode: "version-control";
    }>;

type ResourceRoot = Readonly<{
  canonicalResourcesRoot: string;
  membership: ManagedResourceMembership;
}>;

type ResourceRootPreparation =
  | Readonly<{
      membership: ManagedResourceMembership;
      status: "missing";
    }>
  | Readonly<{ errors: string[]; status: "invalid" }>
  | (ResourceRoot & Readonly<{ status: "ready" }>);

export type InvestigationResourceValidationResult = Readonly<{
  errors: string[];
  warnings: string[];
}>;

/** Maps each discovered report id to the valid resource IDs it directly declares. */
export type InvestigationResourceReferencesByReport = ReadonlyMap<
  string,
  ReadonlySet<string>
>;

/**
 * Validates only the direct targets of scoped report references. Owner anchors
 * and unreferenced-member discovery deliberately belong to the full check.
 */
export async function validateReferencedInvestigationResources(
  investigationsDirectory: string,
  resourceIds: readonly string[],
  signal?: AbortSignal
): Promise<string[]> {
  const ids = uniqueSorted(resourceIds);
  if (ids.length === 0) {
    return [];
  }

  const prepared = await prepareResourceRoot(investigationsDirectory);
  if (prepared.status === "invalid") {
    return prepared.errors;
  }
  if (prepared.status === "missing") {
    return ids.map((id) => missingResourceIssue(id));
  }

  const errors: string[] = [];
  for (const id of ids) {
    throwIfAborted(signal, "investigation resource validation was aborted");
    errors.push(...(await directResourceIssues(prepared, id)));
  }
  return uniqueSorted(errors);
}

/**
 * Performs the default resource check after all reports have been
 * parsed. Referenced resources are errors; visible members absent from every
 * valid reference are warnings.
 */
export async function validateCandidateInvestigationResources(
  investigationsDirectory: string,
  candidateResourceIds: readonly string[],
  authoringReferencesByReport: InvestigationResourceReferencesByReport,
  signal?: AbortSignal
): Promise<string[]> {
  const directErrors = await validateReferencedInvestigationResources(
    investigationsDirectory,
    candidateResourceIds,
    signal
  );
  const ownerErrors = uniqueSorted(candidateResourceIds).flatMap((id) =>
    ownerIssues(id, authoringReferencesByReport)
  );
  return uniqueSorted([...directErrors, ...ownerErrors]);
}

export async function validateFullInvestigationResources(
  investigationsDirectory: string,
  referencesByReport: InvestigationResourceReferencesByReport,
  options: Readonly<{
    authoringReferencesByReport?: InvestigationResourceReferencesByReport;
    signal?: AbortSignal;
  }> = {}
): Promise<InvestigationResourceValidationResult> {
  const signal = options.signal;
  const authoringReferences =
    options.authoringReferencesByReport ?? referencesByReport;
  const referencedIds = uniqueSorted(
    [...referencesByReport.values()].flatMap((ids) => [...ids])
  );
  const errors: string[] = [];
  const warnings: string[] = [];
  const prepared = await prepareResourceRoot(investigationsDirectory);
  errors.push(
    ...referencedIds.flatMap((id) => ownerIssues(id, referencesByReport))
  );

  if (prepared.status === "invalid") {
    errors.push(...prepared.errors);
    return validationResult(errors, warnings);
  }
  if (prepared.status === "missing") {
    validateMissingResourceRoot(
      prepared,
      referencedIds,
      authoringReferences,
      errors,
      warnings
    );
    return validationResult(errors, warnings);
  }
  const visibleIds = await visibleResourceIds(prepared, signal, errors);
  errors.push(...(await validateResourceIds(prepared, referencedIds, signal)));
  warnings.push(
    ...(await validateUnreferencedResourceIds(
      prepared,
      visibleIds,
      new Set(referencedIds),
      authoringReferences,
      signal
    ))
  );
  return validationResult(errors, warnings);
}

function validateMissingResourceRoot(
  prepared: Extract<ResourceRootPreparation, { status: "missing" }>,
  referencedIds: readonly string[],
  authoringReferences: InvestigationResourceReferencesByReport,
  errors: string[],
  warnings: string[]
): void {
  errors.push(...referencedIds.map(missingResourceIssue));
  if (prepared.membership.mode !== "version-control") return;
  const referenced = new Set(referencedIds);
  for (const id of prepared.membership.files) {
    if (referenced.has(id)) continue;
    warnings.push(...ownerIssues(id, authoringReferences));
    warnings.push(missingResourceIssue(id));
  }
}

async function visibleResourceIds(
  prepared: Extract<ResourceRootPreparation, { status: "ready" }>,
  signal: AbortSignal | undefined,
  errors: string[]
): Promise<string[]> {
  try {
    return await discoverVisibleResourceIds(prepared, signal);
  } catch (error) {
    errors.push(
      `${investigationResourcesDirectoryName} membership could not be fully inspected: ${errorText(error)}`
    );
    return [];
  }
}

async function validateResourceIds(
  prepared: Extract<ResourceRootPreparation, { status: "ready" }>,
  ids: readonly string[],
  signal: AbortSignal | undefined
): Promise<string[]> {
  const errors: string[] = [];
  for (const id of ids) {
    throwIfAborted(signal, "investigation resource validation was aborted");
    errors.push(...(await directResourceIssues(prepared, id)));
  }
  return errors;
}

async function validateUnreferencedResourceIds(
  prepared: Extract<ResourceRootPreparation, { status: "ready" }>,
  visibleIds: readonly string[],
  referencedIds: ReadonlySet<string>,
  authoringReferences: InvestigationResourceReferencesByReport,
  signal: AbortSignal | undefined
): Promise<string[]> {
  const warnings: string[] = [];
  for (const id of visibleIds) {
    if (referencedIds.has(id)) continue;
    throwIfAborted(signal, "investigation resource validation was aborted");
    warnings.push(...ownerIssues(id, authoringReferences));
    warnings.push(...(await directResourceIssues(prepared, id)));
  }
  return warnings;
}

async function prepareResourceRoot(
  investigationsDirectory: string
): Promise<ResourceRootPreparation> {
  const resourcesRoot = path.join(
    investigationsDirectory,
    investigationResourcesDirectoryName
  );
  let rootStat: Awaited<ReturnType<typeof fs.lstat>> | null;
  try {
    rootStat = await lstatOrNull(resourcesRoot);
  } catch (error) {
    return {
      errors: [
        `${investigationResourcesDirectoryName} could not be inspected: ${errorText(error)}`
      ],
      status: "invalid"
    };
  }
  if (rootStat === null) {
    return await prepareMissingResourceRoot(
      investigationsDirectory,
      resourcesRoot
    );
  }
  if (rootStat.isSymbolicLink()) {
    return {
      errors: [
        `${investigationResourcesDirectoryName} must not be a symbolic link`
      ],
      status: "invalid"
    };
  }
  if (!rootStat.isDirectory()) {
    return {
      errors: [`${investigationResourcesDirectoryName} must be a directory`],
      status: "invalid"
    };
  }

  return await prepareReadyResourceRoot(investigationsDirectory, resourcesRoot);
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
    return {
      errors: [
        `${investigationResourcesDirectoryName} membership could not be determined: ${errorText(error)}`
      ],
      status: "invalid"
    };
  }
}

async function prepareReadyResourceRoot(
  investigationsDirectory: string,
  resourcesRoot: string
): Promise<ResourceRootPreparation> {
  let canonicalResourcesRoot: string;
  try {
    canonicalResourcesRoot = await verifiedCanonicalResourcesRoot(
      investigationsDirectory,
      resourcesRoot
    );
  } catch (error) {
    return {
      errors: [
        `${investigationResourcesDirectoryName} could not be safely resolved: ${errorText(error)}`
      ],
      status: "invalid"
    };
  }
  try {
    return {
      canonicalResourcesRoot,
      membership: await readManagedResourceMembership(
        investigationsDirectory,
        canonicalResourcesRoot
      ),
      status: "ready"
    };
  } catch (error) {
    return {
      errors: [
        `${investigationResourcesDirectoryName} membership could not be determined: ${errorText(error)}`
      ],
      status: "invalid"
    };
  }
}

async function discoverVisibleResourceIds(
  resourceRoot: ResourceRoot,
  signal: AbortSignal | undefined
): Promise<string[]> {
  if (resourceRoot.membership.mode === "version-control") {
    return [...resourceRoot.membership.files].sort(compareText);
  }
  return await walkFileSystemResourceIds(
    resourceRoot.canonicalResourcesRoot,
    "",
    resourceRoot.canonicalResourcesRoot,
    signal
  );
}

async function walkFileSystemResourceIds(
  absoluteDirectory: string,
  relativeDirectory: string,
  canonicalResourcesRoot: string,
  signal: AbortSignal | undefined
): Promise<string[]> {
  throwIfAborted(signal, "investigation resource discovery was aborted");
  let entries: Dirent<string>[];
  try {
    entries = await fs.readdir(absoluteDirectory, { withFileTypes: true });
  } catch (error) {
    throw new Error(
      `${resourceDirectoryPath(relativeDirectory)} could not be read: ${errorText(error)}`,
      { cause: error }
    );
  }
  entries.sort((left, right) => compareText(left.name, right.name));

  const ids: string[] = [];
  for (const entry of entries) {
    ids.push(
      ...(await fileSystemResourceEntryIds(
        absoluteDirectory,
        relativeDirectory,
        canonicalResourcesRoot,
        entry,
        signal
      ))
    );
  }
  return ids.sort(compareText);
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
  let stat: Awaited<ReturnType<typeof fs.lstat>>;
  try {
    stat = await fs.lstat(absolutePath);
  } catch (error) {
    throw new Error(
      `${resourcePath(id)} could not be inspected: ${errorText(error)}`,
      {
        cause: error
      }
    );
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) return [id];
  let canonicalDirectory: string;
  try {
    canonicalDirectory = await verifiedCanonicalResourceDirectory(
      absolutePath,
      canonicalResourcesRoot
    );
  } catch (error) {
    throw new Error(
      `${resourcePath(id)} could not be safely traversed: ${errorText(error)}`,
      { cause: error }
    );
  }
  const nestedIds = await walkFileSystemResourceIds(
    canonicalDirectory,
    id,
    canonicalResourcesRoot,
    signal
  );
  return nestedIds.length === 0 && id.split("/").length >= 2 ? [id] : nestedIds;
}

async function directResourceIssues(
  resourceRoot: ResourceRoot,
  id: string
): Promise<string[]> {
  const errors: string[] = [];
  if (!isInvestigationResourceId(id)) {
    errors.push(
      `${resourcePath(id)} must use a safe, normalized resource id with an owner report prefix`
    );
  }
  if (isSafeResourcePath(id)) {
    try {
      errors.push(
        ...(await validateReferencedResource(
          resourceRoot.canonicalResourcesRoot,
          id
        ))
      );
    } catch (error) {
      errors.push(
        `${resourcePath(id)} could not be validated: ${errorText(error)}`
      );
    }
  }
  if (
    resourceRoot.membership.mode === "version-control" &&
    !resourceRoot.membership.files.has(id)
  ) {
    errors.push(
      `${resourcePath(id)} is ignored by version-control rules and is not a managed investigation resource`
    );
  }
  return uniqueSorted(errors);
}

function ownerIssues(
  id: string,
  referencesByReport: InvestigationResourceReferencesByReport
): string[] {
  const ownerReportId = investigationResourceOwnerReportId(id);
  if (ownerReportId === null) {
    return [
      `${resourcePath(id)} must use a safe, normalized resource id with an owner report prefix`
    ];
  }
  const ownerReferences = referencesByReport.get(ownerReportId);
  if (ownerReferences === undefined) {
    return [`${resourcePath(id)} owner report ${ownerReportId} does not exist`];
  }
  if (!ownerReferences.has(id)) {
    return [
      `${resourcePath(id)} must be referenced by its owner report ${ownerReportId}`
    ];
  }
  return [];
}

async function readManagedResourceMembership(
  investigationsDirectory: string,
  resourcesRoot: string
): Promise<ManagedResourceMembership> {
  let repository: Awaited<ReturnType<typeof openVersionControl>>;
  try {
    repository = await openVersionControl(investigationsDirectory);
  } catch (error) {
    if (
      error instanceof VersionControlError &&
      error.code === "not-repository"
    ) {
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

async function validateReferencedResource(
  canonicalResourcesRoot: string,
  id: string
): Promise<string[]> {
  const errors: string[] = [];
  let currentDirectory = canonicalResourcesRoot;
  const segments = id.split("/");
  for (const [index, segment] of segments.entries()) {
    const entries = await fs.readdir(currentDirectory, { withFileTypes: true });
    const exact = exactResourceEntry(entries, segment, id, errors);
    if (exact === null) return errors;

    const absolutePath = path.join(currentDirectory, exact.name);
    const stat = await fs.lstat(absolutePath);
    if (stat.isSymbolicLink()) {
      errors.push(
        `${resourcePath(id)} must not traverse or target a symbolic link`
      );
      return errors;
    }
    const isLast = index === segments.length - 1;
    if (!isLast) {
      const nextDirectory = await validatedResourceDirectory(
        absolutePath,
        canonicalResourcesRoot,
        id,
        segment,
        stat,
        errors
      );
      if (nextDirectory === null) return errors;
      currentDirectory = nextDirectory;
      continue;
    }
    if (!stat.isFile()) {
      errors.push(`${resourcePath(id)} must be a regular file`);
      return errors;
    }
    try {
      await verifyRegularFile(absolutePath, canonicalResourcesRoot);
    } catch (error) {
      errors.push(
        `${resourcePath(id)} could not be read as a regular file: ${errorText(error)}`
      );
    }
  }
  return errors;
}

function exactResourceEntry(
  entries: readonly Dirent<string>[],
  segment: string,
  id: string,
  errors: string[]
): Dirent<string> | null {
  const exact = entries.find((entry) => entry.name === segment);
  if (exact !== undefined) return exact;
  const caseMismatch = entries.find(
    (entry) => entry.name.toLowerCase() === segment.toLowerCase()
  );
  errors.push(
    caseMismatch === undefined
      ? `${resourcePath(id)} does not exist`
      : `${resourcePath(id)} must match actual path casing; found ${JSON.stringify(caseMismatch.name)}`
  );
  return null;
}

async function validatedResourceDirectory(
  absolutePath: string,
  canonicalResourcesRoot: string,
  id: string,
  segment: string,
  stat: Awaited<ReturnType<typeof fs.lstat>>,
  errors: string[]
): Promise<string | null> {
  if (!stat.isDirectory()) {
    errors.push(
      `${resourcePath(id)} has a non-directory path component ${JSON.stringify(segment)}`
    );
    return null;
  }
  try {
    return await verifiedCanonicalResourceDirectory(
      absolutePath,
      canonicalResourcesRoot
    );
  } catch (error) {
    errors.push(
      `${resourcePath(id)} could not be safely traversed: ${errorText(error)}`
    );
    return null;
  }
}

async function verifyRegularFile(
  absolutePath: string,
  canonicalResourcesRoot: string
): Promise<void> {
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
    if ((await fs.realpath(absolutePath)) !== canonicalTarget) {
      throw new Error(
        "resource path changed while its opened file was being verified"
      );
    }
    if (!sameFileIdentity(openedStat, resolvedStat)) {
      throw new Error(
        "resource path changed while its opened file was being verified"
      );
    }
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
  if ((await fs.realpath(directoryPath)) !== canonicalDirectory) {
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
  if (
    !isPathWithinDirectory(
      canonicalResourcesRoot,
      canonicalInvestigationsDirectory
    )
  ) {
    throw new Error(
      `${investigationResourcesDirectoryName} resolves outside the investigation root`
    );
  }
  const verifiedRootStat = await fs.lstat(resourcesRoot, { bigint: true });
  if (verifiedRootStat.isSymbolicLink()) {
    throw new Error(
      `${investigationResourcesDirectoryName} must not be a symbolic link`
    );
  }
  if (!verifiedRootStat.isDirectory()) {
    throw new Error(
      `${investigationResourcesDirectoryName} must be a directory`
    );
  }
  const canonicalRootStat = await fs.stat(canonicalResourcesRoot, {
    bigint: true
  });
  if (!sameFileIdentity(verifiedRootStat, canonicalRootStat)) {
    throw new Error(
      `${investigationResourcesDirectoryName} identity changed while being verified`
    );
  }
  if ((await fs.realpath(resourcesRoot)) !== canonicalResourcesRoot) {
    throw new Error(
      `${investigationResourcesDirectoryName} changed while being verified`
    );
  }
  return canonicalResourcesRoot;
}

function isSafeResourcePath(value: string): boolean {
  return (
    value.length > 0 &&
    !path.posix.isAbsolute(value) &&
    !path.win32.isAbsolute(value) &&
    !value
      .split("/")
      .some(
        (segment) => segment.length === 0 || segment === "." || segment === ".."
      )
  );
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
    if (isFileSystemError(error, "ENOENT")) {
      return null;
    }
    throw error;
  }
}

function validationResult(
  errors: readonly string[],
  warnings: readonly string[]
): InvestigationResourceValidationResult {
  return {
    errors: uniqueSorted(errors),
    warnings: uniqueSorted(warnings)
  };
}

function throwIfAborted(
  signal: AbortSignal | undefined,
  message: string
): void {
  if (signal?.aborted === true) {
    throw new Error(message);
  }
}

function resourcePath(id: string): string {
  return `${investigationResourcesDirectoryName}/${id}`;
}

function missingResourceIssue(id: string): string {
  return `${resourcePath(id)} does not exist`;
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
  return sanitizeInvestigationDiagnosticText(error);
}
