import {
  inspectResource,
  ResourceInspectionError,
  type ResourceInspectionResult
} from "./resource-inspection.ts";
import { constants as fileSystemConstants, type Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { isPathWithinDirectory } from "../../shared/src/node/filesystem.ts";
import { sanitizeInvestigationDiagnosticText } from "./diagnostics.ts";
import { type ResourceRoot } from "./resource-root.ts";
import {
  investigationResourcesDirectoryName,
  isInvestigationResourceId
} from "./resource-reference.ts";

export async function inspectDirectInvestigationResource(
  resourceRoot: ResourceRoot,
  id: string
): Promise<ResourceInspectionResult> {
  const errors = invalidResourceIdErrors(id);
  let failure: ResourceInspectionError | undefined;
  if (isSafeResourcePath(id)) {
    const inspected = await resourcePathErrors(resourceRoot, id, {
      target: "file",
      missing: "reject"
    });
    errors.push(...inspected.errors);
    failure = inspected.failure;
  }
  if (
    resourceRoot.membership.mode === "version-control" &&
    !resourceRoot.membership.files.has(id)
  )
    errors.push(
      `${resourcePath(id)} is ignored by version-control rules and is not a managed investigation resource`
    );
  return {
    errors: uniqueSorted(errors),
    ...(failure === undefined ? {} : { failure })
  };
}

/** Selected owner trees may have deleted members, but no unsafe live components. */
export async function inspectOwnedInvestigationResources(
  resourceRoot: ResourceRoot,
  ownerIds: readonly string[],
  resourceIds: readonly string[]
): Promise<ResourceInspectionResult> {
  const errors: string[] = [];
  let failure: ResourceInspectionError | undefined;
  for (const ownerId of ownerIds) {
    const inspected = await resourcePathErrors(resourceRoot, ownerId, {
      target: "directory",
      missing: "allow"
    });
    errors.push(...inspected.errors);
    failure ??= inspected.failure;
  }
  for (const id of resourceIds) {
    if (!isSafeResourcePath(id)) {
      errors.push(
        `${resourcePath(id)} must use a safe, normalized resource path`
      );
      continue;
    }
    const inspected = await resourcePathErrors(resourceRoot, id, {
      target: "file",
      missing: "allow"
    });
    errors.push(...inspected.errors);
    failure ??= inspected.failure;
  }
  return {
    errors: uniqueSorted(errors),
    ...(failure === undefined ? {} : { failure })
  };
}

type ResourcePathValidation = {
  errors: string[];
  failure?: ResourceInspectionError;
};

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
  resourceRoot: ResourceRoot,
  id: string,
  requirement: ResourcePathRequirement
): Promise<ResourceInspectionResult> {
  try {
    return await validateResourcePath(resourceRoot, id, requirement);
  } catch (error) {
    return {
      errors: [
        `${resourcePath(id)} could not be validated: ${errorText(error)}`
      ],
      ...(error instanceof ResourceInspectionError ? { failure: error } : {})
    };
  }
}

async function validateResourcePath(
  resourceRoot: ResourceRoot,
  id: string,
  requirement: ResourcePathRequirement
): Promise<ResourceInspectionResult> {
  const { canonicalResourcesRoot } = resourceRoot;
  const result: ResourcePathValidation = { errors: [] };
  const { errors } = result;
  let currentDirectory = canonicalResourcesRoot;
  const segments = id.split("/");
  for (const [index, segment] of segments.entries()) {
    const entry = await exactResourceEntry(
      resourceRoot,
      currentDirectory,
      segment,
      id,
      { errors, missing: requirement.missing }
    );
    if (entry === null) return result;
    const absolutePath = path.join(currentDirectory, entry.name);
    const stat = await inspectResource(
      "inspect resource path",
      absolutePath,
      () => fs.lstat(absolutePath)
    );
    const next = await nextValidatedResourcePath({
      absolutePath,
      canonicalResourcesRoot,
      directories: resourceRoot.directories,
      result,
      id,
      isFile: index === segments.length - 1 && requirement.target === "file",
      segment,
      stat
    });
    if (next === null) return result;
    currentDirectory = next;
  }
  return result;
}

async function exactResourceEntry(
  resourceRoot: ResourceRoot,
  currentDirectory: string,
  segment: string,
  id: string,
  options: Readonly<{
    errors: string[];
    missing: ResourcePathRequirement["missing"];
  }>
): Promise<Dirent<string> | null> {
  const found = await resourceRoot.directories.entry(currentDirectory, segment);
  if (found !== null && found.name === segment) return found;
  if (found === null) {
    if (options.missing === "reject")
      options.errors.push(`${resourcePath(id)} does not exist`);
    return null;
  }
  options.errors.push(
    `${resourcePath(id)} must match actual path casing; found ${JSON.stringify(found.name)}`
  );
  return null;
}

type ResourcePathStep = Readonly<{
  absolutePath: string;
  canonicalResourcesRoot: string;
  directories: ResourceRoot["directories"];
  result: ResourcePathValidation;
  id: string;
  isFile: boolean;
  segment: string;
  stat: Awaited<ReturnType<typeof fs.lstat>>;
}>;

async function nextValidatedResourcePath(
  step: ResourcePathStep
): Promise<string | null> {
  if (step.stat.isSymbolicLink()) {
    step.result.errors.push(
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
    step.result.errors.push(
      `${resourcePath(step.id)} has a non-directory path component ${JSON.stringify(step.segment)}`
    );
    return null;
  }
  try {
    return await step.directories.directory(step.absolutePath);
  } catch (error) {
    if (error instanceof ResourceInspectionError) step.result.failure ??= error;
    step.result.errors.push(
      `${resourcePath(step.id)} could not be safely traversed: ${errorText(error)}`
    );
    return null;
  }
}

async function validatedResourceFile(
  step: ResourcePathStep
): Promise<string | null> {
  if (!step.stat.isFile()) {
    step.result.errors.push(`${resourcePath(step.id)} must be a regular file`);
    return null;
  }
  try {
    await verifyRegularFile(step.absolutePath, step.canonicalResourcesRoot);
  } catch (error) {
    if (error instanceof ResourceInspectionError) step.result.failure ??= error;
    step.result.errors.push(
      `${resourcePath(step.id)} could not be read as a regular file: ${errorText(error)}`
    );
  }
  return step.canonicalResourcesRoot;
}

async function verifyRegularFile(
  absolutePath: string,
  canonicalResourcesRoot: string
): Promise<void> {
  const handle = await inspectResource("open resource file", absolutePath, () =>
    fs.open(
      absolutePath,
      fileSystemConstants.O_RDONLY | fileSystemConstants.O_NOFOLLOW
    )
  );
  try {
    const openedStat = await inspectResource(
      "inspect opened resource file",
      absolutePath,
      () => handle.stat({ bigint: true })
    );
    if (!openedStat.isFile()) throw new Error("target is not a regular file");
    const canonicalTarget = await inspectResource(
      "resolve resource file",
      absolutePath,
      () => fs.realpath(absolutePath)
    );
    if (!isPathWithinDirectory(canonicalTarget, canonicalResourcesRoot))
      throw new Error("opened target resolves outside the resource root");
    const resolvedStat = await inspectResource(
      "inspect resource file",
      canonicalTarget,
      () => fs.stat(canonicalTarget, { bigint: true })
    );
    if (
      (await inspectResource("resolve resource file", absolutePath, () =>
        fs.realpath(absolutePath)
      )) !== canonicalTarget ||
      !sameFileIdentity(openedStat, resolvedStat)
    )
      throw new Error(
        "resource path changed while its opened file was being verified"
      );
  } finally {
    await inspectResource("close resource file", absolutePath, () =>
      handle.close()
    );
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

/** Existing validation callers consume issues without adopting stage failure policy. */
export async function directInvestigationResourceIssues(
  resourceRoot: ResourceRoot,
  id: string
): Promise<string[]> {
  return (await inspectDirectInvestigationResource(resourceRoot, id)).errors;
}
