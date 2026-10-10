import { constants as fileSystemConstants, type Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { isPathWithinDirectory } from "../../shared/src/node/filesystem.ts";
import { sanitizeInvestigationDiagnosticText } from "./diagnostics.ts";
import {
  verifiedCanonicalResourceDirectory,
  type ResourceRoot
} from "./resource-root.ts";
import {
  investigationResourcesDirectoryName,
  isInvestigationResourceId
} from "./resource-reference.ts";

export async function directInvestigationResourceIssues(
  resourceRoot: ResourceRoot,
  id: string
): Promise<string[]> {
  const errors = invalidResourceIdErrors(id);
  if (isSafeResourcePath(id))
    errors.push(
      ...(await resourcePathErrors(resourceRoot.canonicalResourcesRoot, id, {
        target: "file",
        missing: "reject"
      }))
    );
  if (
    resourceRoot.membership.mode === "version-control" &&
    !resourceRoot.membership.files.has(id)
  )
    errors.push(
      `${resourcePath(id)} is ignored by version-control rules and is not a managed investigation resource`
    );
  return uniqueSorted(errors);
}

/** Selected owner trees may have deleted members, but no unsafe live components. */
export async function ownedInvestigationResourceIssues(
  resourceRoot: ResourceRoot,
  ownerIds: readonly string[],
  resourceIds: readonly string[]
): Promise<string[]> {
  const errors: string[] = [];
  for (const ownerId of ownerIds)
    errors.push(
      ...(await resourcePathErrors(
        resourceRoot.canonicalResourcesRoot,
        ownerId,
        {
          target: "directory",
          missing: "allow"
        }
      ))
    );
  for (const id of resourceIds) {
    if (!isSafeResourcePath(id)) {
      errors.push(
        `${resourcePath(id)} must use a safe, normalized resource path`
      );
      continue;
    }
    errors.push(
      ...(await resourcePathErrors(resourceRoot.canonicalResourcesRoot, id, {
        target: "file",
        missing: "allow"
      }))
    );
  }
  return uniqueSorted(errors);
}

type ResourcePathRequirement = Readonly<{
  target: "file" | "directory";
  missing: "allow" | "reject";
}>;

function invalidResourceIdErrors(id: string): string[] {
  return isInvestigationResourceId(id)
    ? []
    : [
        `${resourcePath(id)} must use a safe, normalized resource id with an owner report prefix`
      ];
}

async function resourcePathErrors(
  canonicalResourcesRoot: string,
  id: string,
  requirement: ResourcePathRequirement
): Promise<string[]> {
  try {
    return await validateResourcePath(canonicalResourcesRoot, id, requirement);
  } catch (error) {
    return [`${resourcePath(id)} could not be validated: ${errorText(error)}`];
  }
}

async function validateResourcePath(
  canonicalResourcesRoot: string,
  id: string,
  requirement: ResourcePathRequirement
): Promise<string[]> {
  const errors: string[] = [];
  let currentDirectory = canonicalResourcesRoot;
  const segments = id.split("/");
  for (const [index, segment] of segments.entries()) {
    const entry = await exactResourceEntry(
      currentDirectory,
      segment,
      id,
      errors,
      requirement.missing
    );
    if (entry === null) return errors;
    const absolutePath = path.join(currentDirectory, entry.name);
    const stat = await fs.lstat(absolutePath);
    const next = await nextValidatedResourcePath({
      absolutePath,
      canonicalResourcesRoot,
      errors,
      id,
      isFile: index === segments.length - 1 && requirement.target === "file",
      segment,
      stat
    });
    if (next === null) return errors;
    currentDirectory = next;
  }
  return errors;
}

async function exactResourceEntry(
  currentDirectory: string,
  segment: string,
  id: string,
  errors: string[],
  missing: ResourcePathRequirement["missing"]
): Promise<Dirent<string> | null> {
  const entries = await fs.readdir(currentDirectory, { withFileTypes: true });
  const exact = entries.find((entry) => entry.name === segment);
  if (exact !== undefined) return exact;
  const caseMismatch = entries.find(
    (entry) => entry.name.toLowerCase() === segment.toLowerCase()
  );
  if (caseMismatch === undefined && missing === "allow") return null;
  errors.push(
    caseMismatch === undefined
      ? `${resourcePath(id)} does not exist`
      : `${resourcePath(id)} must match actual path casing; found ${JSON.stringify(caseMismatch.name)}`
  );
  return null;
}

type ResourcePathStep = Readonly<{
  absolutePath: string;
  canonicalResourcesRoot: string;
  errors: string[];
  id: string;
  isFile: boolean;
  segment: string;
  stat: Awaited<ReturnType<typeof fs.lstat>>;
}>;

async function nextValidatedResourcePath(
  step: ResourcePathStep
): Promise<string | null> {
  if (step.stat.isSymbolicLink()) {
    step.errors.push(
      `${resourcePath(step.id)} must not traverse or target a symbolic link`
    );
    return null;
  }
  return step.isFile
    ? await validatedResourceFile(step)
    : await validatedResourceDirectory(step);
}

async function validatedResourceDirectory(
  step: ResourcePathStep
): Promise<string | null> {
  if (!step.stat.isDirectory()) {
    step.errors.push(
      `${resourcePath(step.id)} has a non-directory path component ${JSON.stringify(step.segment)}`
    );
    return null;
  }
  try {
    return await verifiedCanonicalResourceDirectory(
      step.absolutePath,
      step.canonicalResourcesRoot
    );
  } catch (error) {
    step.errors.push(
      `${resourcePath(step.id)} could not be safely traversed: ${errorText(error)}`
    );
    return null;
  }
}

async function validatedResourceFile(
  step: ResourcePathStep
): Promise<string | null> {
  if (!step.stat.isFile()) {
    step.errors.push(`${resourcePath(step.id)} must be a regular file`);
    return null;
  }
  try {
    await verifyRegularFile(step.absolutePath, step.canonicalResourcesRoot);
  } catch (error) {
    step.errors.push(
      `${resourcePath(step.id)} could not be read as a regular file: ${errorText(error)}`
    );
  }
  return step.canonicalResourcesRoot;
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
    if (!openedStat.isFile()) throw new Error("target is not a regular file");
    const canonicalTarget = await fs.realpath(absolutePath);
    if (!isPathWithinDirectory(canonicalTarget, canonicalResourcesRoot))
      throw new Error("opened target resolves outside the resource root");
    const resolvedStat = await fs.stat(canonicalTarget, { bigint: true });
    if (
      (await fs.realpath(absolutePath)) !== canonicalTarget ||
      !sameFileIdentity(openedStat, resolvedStat)
    )
      throw new Error(
        "resource path changed while its opened file was being verified"
      );
  } finally {
    await handle.close();
  }
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
  return sanitizeInvestigationDiagnosticText(error);
}
