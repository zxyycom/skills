import type { BigIntStats } from "node:fs";
import fs from "node:fs/promises";
import { isPathWithinDirectory } from "../../../shared/src/node/filesystem.ts";
import { inspectResource } from "./resource-inspection.ts";
import { investigationResourcesDirectoryName } from "./resource-reference.ts";

export async function verifiedCanonicalResourceDirectory(
  directoryPath: string,
  canonicalResourcesRoot: string
): Promise<string> {
  const canonicalDirectory = await inspectResource(
    "resolve resource directory",
    directoryPath,
    () => fs.realpath(directoryPath)
  );
  if (!isPathWithinDirectory(canonicalDirectory, canonicalResourcesRoot))
    throw new Error("directory resolves outside the resource root");
  const verifiedStat = await inspectResource(
    "inspect resource directory",
    directoryPath,
    () => fs.lstat(directoryPath, { bigint: true })
  );
  if (verifiedStat.isSymbolicLink())
    throw new Error("directory must not be a symbolic link");
  if (!verifiedStat.isDirectory())
    throw new Error("path component must remain a directory");
  const canonicalStat = await inspectResource(
    "inspect resource directory",
    canonicalDirectory,
    () => fs.stat(canonicalDirectory, { bigint: true })
  );
  if (!sameFileIdentity(verifiedStat, canonicalStat))
    throw new Error("directory identity changed while being verified");
  if (
    (await inspectResource("resolve resource directory", directoryPath, () =>
      fs.realpath(directoryPath)
    )) !== canonicalDirectory
  )
    throw new Error("directory changed while being verified");
  return canonicalDirectory;
}

export async function verifiedCanonicalResourcesRoot(
  investigationsDirectory: string,
  resourcesRoot: string
): Promise<string> {
  const canonicalInvestigationsDirectory = await inspectResource(
    "resolve investigation directory",
    investigationsDirectory,
    () => fs.realpath(investigationsDirectory)
  );
  const canonicalResourcesRoot = await inspectResource(
    "resolve resource root",
    resourcesRoot,
    () => fs.realpath(resourcesRoot)
  );
  if (
    !isPathWithinDirectory(
      canonicalResourcesRoot,
      canonicalInvestigationsDirectory
    )
  )
    throw new Error(
      `${investigationResourcesDirectoryName} resolves outside the investigation root`
    );
  const verifiedRootStat = await inspectResource(
    "inspect resource root",
    resourcesRoot,
    () => fs.lstat(resourcesRoot, { bigint: true })
  );
  assertResourceRootType(verifiedRootStat);
  const canonicalRootStat = await inspectResource(
    "inspect resource root",
    canonicalResourcesRoot,
    () => fs.stat(canonicalResourcesRoot, { bigint: true })
  );
  if (!sameFileIdentity(verifiedRootStat, canonicalRootStat))
    throw new Error(
      `${investigationResourcesDirectoryName} identity changed while being verified`
    );
  if (
    (await inspectResource("resolve resource root", resourcesRoot, () =>
      fs.realpath(resourcesRoot)
    )) !== canonicalResourcesRoot
  )
    throw new Error(
      `${investigationResourcesDirectoryName} changed while being verified`
    );
  return canonicalResourcesRoot;
}

function sameFileIdentity(
  left: Readonly<{ dev: bigint; ino: bigint }>,
  right: Readonly<{ dev: bigint; ino: bigint }>
): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function assertResourceRootType(verifiedRootStat: BigIntStats): void {
  if (verifiedRootStat.isSymbolicLink())
    throw new Error(
      `${investigationResourcesDirectoryName} must not be a symbolic link`
    );
  if (!verifiedRootStat.isDirectory())
    throw new Error(
      `${investigationResourcesDirectoryName} must be a directory`
    );
}
