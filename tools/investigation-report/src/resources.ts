import { constants as fileSystemConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import {
  isFileSystemError,
  isPathWithinDirectory
} from "../../shared/src/node/filesystem.ts";
import type { InvestigationResourceSource } from "./types.ts";

export const investigationResourcesDirectoryName = "_resources";

const investigationResourcePathSegmentPatternSource =
  "[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?";

export const investigationResourceIdPatternSource =
  `^${investigationResourcePathSegmentPatternSource}`
  + `(?:/${investigationResourcePathSegmentPatternSource})*$`;

const investigationResourceIdPattern = new RegExp(
  investigationResourceIdPatternSource,
  "u"
);

type ResourceLinkTargetResult =
  | { error: null; id: string }
  | { error: string; id: null };

type ResourceWalkResult = {
  errors: string[];
  resources: InvestigationResourceSource[];
};

export function isInvestigationResourceId(value: string): boolean {
  return investigationResourceIdPattern.test(value);
}

export function investigationResourceIdFromLinkTarget(
  target: string
): ResourceLinkTargetResult {
  const prefix = `../${investigationResourcesDirectoryName}/`;
  if (
    !target.startsWith(prefix)
    || target.includes("?")
    || target.includes("#")
    || target.includes("%")
    || target.includes("\\")
  ) {
    return {
      error: `resource link target ${JSON.stringify(target)} must use `
        + `../${investigationResourcesDirectoryName}/<resource-id> without `
        + "queries, fragments, encoding, or backslashes",
      id: null
    };
  }
  const id = target.slice(prefix.length);
  if (!isInvestigationResourceId(id)) {
    return {
      error: `resource link target ${JSON.stringify(target)} must contain a safe, `
        + "normalized resource id",
      id: null
    };
  }
  return { error: null, id };
}

export async function readInvestigationResources(
  investigationsDirectory: string,
  signal?: AbortSignal
): Promise<InvestigationResourceSource[]> {
  const resourcesRoot = path.join(
    investigationsDirectory,
    investigationResourcesDirectoryName
  );
  const rootStat = await lstatOrNull(resourcesRoot);
  if (rootStat === null) {
    return [];
  }
  if (rootStat.isSymbolicLink()) {
    throw new Error(`${investigationResourcesDirectoryName} must not be a symbolic link`);
  }
  if (!rootStat.isDirectory()) {
    throw new Error(`${investigationResourcesDirectoryName} must be a directory`);
  }

  const canonicalResourcesRoot = await verifiedCanonicalResourcesRoot(
    investigationsDirectory,
    resourcesRoot
  );
  const walked = await walkResourceDirectory(
    canonicalResourcesRoot,
    "",
    canonicalResourcesRoot,
    signal
  );
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
  const rootStat = await lstatOrNull(resourcesRoot);
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

  const canonicalResourcesRoot = await verifiedCanonicalResourcesRoot(
    investigationsDirectory,
    resourcesRoot
  );

  for (const id of validIds) {
    if (signal?.aborted === true) {
      throw new Error("investigation resource validation was aborted");
    }
    errors.push(...await validateReferencedResource(
      canonicalResourcesRoot,
      id
    ));
  }
  return uniqueSorted(errors);
}

async function walkResourceDirectory(
  absoluteDirectory: string,
  relativeDirectory: string,
  canonicalResourcesRoot: string,
  signal: AbortSignal | undefined
): Promise<ResourceWalkResult> {
  const errors: string[] = [];
  const resources: InvestigationResourceSource[] = [];
  if (signal?.aborted === true) {
    throw new Error("investigation resource read was aborted");
  }
  const entries = (await fs.readdir(absoluteDirectory, { withFileTypes: true }))
    .sort((left, right) => compareText(left.name, right.name));
  for (const entry of entries) {
    const id = relativeDirectory.length === 0
      ? entry.name
      : `${relativeDirectory}/${entry.name}`;
    const absolutePath = path.join(absoluteDirectory, entry.name);
    const stat = await fs.lstat(absolutePath);
    if (stat.isSymbolicLink()) {
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
        signal
      );
      errors.push(...nested.errors);
      resources.push(...nested.resources);
      continue;
    }
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
  return { errors, resources };
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
    return new Uint8Array(await handle.readFile());
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

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
