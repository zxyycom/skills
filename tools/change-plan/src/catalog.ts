import type { Stats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { checkChangePlanDirectory } from "./check.ts";
import {
  changePlanArtifactNames,
  type ChangePlanArtifactContents,
  type ChangePlanCheckResult,
  type ChangePlanCollectionCheckResult,
  type ChangePlanCollectionOptions,
  type ChangePlanListEntry,
  type ChangePlanListOptions,
  type ChangePlanListResult,
  type ChangePlanShowResult,
  type ChangePlanStatus
} from "./types.ts";

function isMissingPathError(error: unknown): boolean {
  return error !== null
    && typeof error === "object"
    && "code" in error
    && error.code === "ENOENT";
}

async function lstatOrNull(targetPath: string): Promise<Stats | null> {
  try {
    return await fs.lstat(targetPath);
  } catch (error) {
    if (isMissingPathError(error)) {
      return null;
    }
    throw error;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function changePlanStatusFromDirectory(
  changeDirectory: string
): ChangePlanStatus {
  return path.basename(path.dirname(path.resolve(changeDirectory))) === "archive"
    ? "archived"
    : "active";
}

function listEntry(
  check: ChangePlanCheckResult,
  status: ChangePlanStatus
): ChangePlanListEntry {
  return { ...check, status };
}

async function listDirectoryEntries(
  directory: string,
  status: ChangePlanStatus
): Promise<ChangePlanListEntry[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const directoryNames = entries
    .filter((entry) => entry.isDirectory() && (
      status === "archived" || entry.name !== "archive"
    ))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  return await Promise.all(directoryNames.map(async (name) => (
    listEntry(
      await checkChangePlanDirectory(path.join(directory, name)),
      status
    )
  )));
}

export async function listChangePlans(
  options: ChangePlanListOptions = {}
): Promise<ChangePlanListResult> {
  const changeRoot = path.resolve(options.changeRoot ?? "changes");
  const status = options.status ?? "active";
  const result: ChangePlanListResult = {
    changeRoot,
    entries: [],
    errors: [],
    status
  };

  if (options.stage !== undefined && status !== "active") {
    result.errors.push("stage filter is only valid for active changes");
    return result;
  }

  let rootStat: Stats | null;
  try {
    rootStat = await lstatOrNull(changeRoot);
  } catch (error) {
    result.errors.push(
      `cannot access change root ${changeRoot}: ${errorMessage(error)}`
    );
    return result;
  }
  if (rootStat === null) {
    result.errors.push(`change root does not exist: ${changeRoot}`);
    return result;
  }
  if (!rootStat.isDirectory()) {
    result.errors.push(`change root must be a directory: ${changeRoot}`);
    return result;
  }

  if (status === "active" || status === "all") {
    try {
      result.entries.push(...await listDirectoryEntries(changeRoot, "active"));
    } catch (error) {
      result.errors.push(
        `cannot list active changes in ${changeRoot}: ${errorMessage(error)}`
      );
    }
  }

  if (status === "archived" || status === "all") {
    const archiveDirectory = path.join(changeRoot, "archive");
    try {
      const archiveStat = await lstatOrNull(archiveDirectory);
      if (archiveStat !== null) {
        if (!archiveStat.isDirectory()) {
          result.errors.push(
            `change archive must be a directory: ${archiveDirectory}`
          );
        } else {
          result.entries.push(
            ...await listDirectoryEntries(archiveDirectory, "archived")
          );
        }
      }
    } catch (error) {
      result.errors.push(
        `cannot list archived changes in ${archiveDirectory}: ${errorMessage(error)}`
      );
    }
  }

  result.entries.sort((left, right) => (
    (left.status === right.status ? 0 : left.status === "active" ? -1 : 1)
    || left.changeName.localeCompare(right.changeName)
  ));
  if (options.stage !== undefined) {
    result.entries = result.entries.filter(
      (entry) => entry.stage === options.stage
    );
  }
  return result;
}

export async function checkChangePlanCollection(
  options: ChangePlanCollectionOptions = {}
): Promise<ChangePlanCollectionCheckResult> {
  const listResult = await listChangePlans(options);
  const validCount = listResult.entries.filter((entry) => entry.valid).length;
  const invalidCount = listResult.entries.length - validCount;
  return {
    ...listResult,
    checkedCount: listResult.entries.length,
    invalidCount,
    valid: listResult.errors.length === 0 && invalidCount === 0,
    validCount
  };
}

async function readArtifactContents(
  changeDirectory: string
): Promise<ChangePlanArtifactContents> {
  const artifacts: ChangePlanArtifactContents = {
    "proposal.md": null,
    "design.md": null,
    "tasks.md": null
  };
  let directoryStat: Stats | null;
  try {
    directoryStat = await lstatOrNull(changeDirectory);
  } catch {
    return artifacts;
  }
  if (
    directoryStat === null
    || directoryStat.isSymbolicLink()
    || !directoryStat.isDirectory()
  ) {
    return artifacts;
  }

  await Promise.all(changePlanArtifactNames.map(async (artifact) => {
    const artifactPath = path.join(changeDirectory, artifact);
    try {
      const artifactStat = await lstatOrNull(artifactPath);
      if (
        artifactStat !== null
        && artifactStat.isFile()
        && !artifactStat.isSymbolicLink()
      ) {
        artifacts[artifact] = await fs.readFile(artifactPath, "utf8");
      }
    } catch {
      artifacts[artifact] = null;
    }
  }));
  return artifacts;
}

export async function showChangePlanDirectory(
  changeDirectoryInput: string
): Promise<ChangePlanShowResult> {
  const check = await checkChangePlanDirectory(changeDirectoryInput);
  return {
    artifacts: await readArtifactContents(check.changeDirectory),
    check,
    status: changePlanStatusFromDirectory(check.changeDirectory)
  };
}
