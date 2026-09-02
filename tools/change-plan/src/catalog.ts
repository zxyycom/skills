import type { Stats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { changePlanStatusFromDirectory } from "./change-directory.ts";
import { checkChangePlanDirectory } from "./check.ts";
import {
  changePlanArtifactNames,
  type ChangePlanActiveListEntry,
  type ChangePlanArtifactContents,
  type ChangePlanArchivedListEntry,
  type ChangePlanArchivedShowResult,
  type ChangePlanCheckResult,
  type ChangePlanCollectionCheckResult,
  type ChangePlanCollectionOptions,
  type ChangePlanListOptions,
  type ChangePlanListResult,
  type ChangePlanListSelection,
  type ChangePlanShowResult,
  type ChangePlanStatus
} from "./types.ts";

function isMissingPathError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT"
  );
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

function activeListEntry(
  check: ChangePlanCheckResult
): ChangePlanActiveListEntry {
  return { ...check, status: "active" };
}

async function listDirectoryNames(
  directory: string,
  status: ChangePlanStatus
): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return entries
    .filter(
      (entry) =>
        entry.isDirectory() &&
        (status === "archived" || entry.name !== "archive")
    )
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

async function listActiveDirectoryEntries(
  directory: string
): Promise<ChangePlanActiveListEntry[]> {
  const directoryNames = await listDirectoryNames(directory, "active");
  return await Promise.all(
    directoryNames.map(async (name) =>
      activeListEntry(
        await checkChangePlanDirectory(path.join(directory, name))
      )
    )
  );
}

async function listArchivedDirectoryEntries(
  directory: string
): Promise<ChangePlanArchivedListEntry[]> {
  return (await listDirectoryNames(directory, "archived")).map((name) => ({
    changeDirectory: path.join(directory, name),
    changeName: name,
    status: "archived"
  }));
}

async function inspectChangeRoot(
  result: ChangePlanListResult
): Promise<boolean> {
  let rootStat: Stats | null;
  try {
    rootStat = await lstatOrNull(result.changeRoot);
  } catch (error) {
    result.errors.push(
      `cannot access change root ${result.changeRoot}: ${errorMessage(error)}`
    );
    return false;
  }
  if (rootStat === null) {
    result.errors.push(`change root does not exist: ${result.changeRoot}`);
    return false;
  }
  if (!rootStat.isDirectory()) {
    result.errors.push(`change root must be a directory: ${result.changeRoot}`);
    return false;
  }
  return true;
}

async function appendActiveEntries(
  result: ChangePlanListResult
): Promise<void> {
  try {
    result.entries.push(
      ...(await listActiveDirectoryEntries(result.changeRoot))
    );
  } catch (error) {
    result.errors.push(
      `cannot list active changes in ${result.changeRoot}: ${errorMessage(error)}`
    );
  }
}

async function appendArchivedEntries(
  result: ChangePlanListResult
): Promise<void> {
  const archiveDirectory = path.join(result.changeRoot, "archive");
  try {
    const archiveStat = await lstatOrNull(archiveDirectory);
    if (archiveStat === null) {
      return;
    }
    if (!archiveStat.isDirectory()) {
      result.errors.push(
        `change archive must be a directory: ${archiveDirectory}`
      );
      return;
    }
    result.entries.push(
      ...(await listArchivedDirectoryEntries(archiveDirectory))
    );
  } catch (error) {
    result.errors.push(
      `cannot list archived changes in ${archiveDirectory}: ${errorMessage(error)}`
    );
  }
}

function includesStatus(
  selection: ChangePlanListSelection,
  status: ChangePlanStatus
): boolean {
  return selection === status || selection === "all";
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

  if (!(await inspectChangeRoot(result))) {
    return result;
  }

  if (includesStatus(status, "active")) {
    await appendActiveEntries(result);
  }

  if (includesStatus(status, "archived")) {
    await appendArchivedEntries(result);
  }

  result.entries.sort(
    (left, right) =>
      (left.status === right.status ? 0 : left.status === "active" ? -1 : 1) ||
      left.changeName.localeCompare(right.changeName)
  );
  if (options.stage !== undefined) {
    result.entries = result.entries.filter(
      (entry) => entry.status === "active" && entry.stage === options.stage
    );
  }
  return result;
}

export async function checkChangePlanCollection(
  options: ChangePlanCollectionOptions = {}
): Promise<ChangePlanCollectionCheckResult> {
  const listResult = await listChangePlans({
    changeRoot: options.changeRoot,
    status: "active"
  });
  const entries = listResult.entries.filter(
    (entry): entry is ChangePlanActiveListEntry => entry.status === "active"
  );
  const validCount = entries.filter((entry) => entry.valid).length;
  const invalidCount = entries.length - validCount;
  return {
    changeRoot: listResult.changeRoot,
    checkedCount: entries.length,
    entries,
    errors: listResult.errors,
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
    directoryStat === null ||
    directoryStat.isSymbolicLink() ||
    !directoryStat.isDirectory()
  ) {
    return artifacts;
  }

  await Promise.all(
    changePlanArtifactNames.map(async (artifact) => {
      const artifactPath = path.join(changeDirectory, artifact);
      try {
        const artifactStat = await lstatOrNull(artifactPath);
        if (
          artifactStat !== null &&
          artifactStat.isFile() &&
          !artifactStat.isSymbolicLink()
        ) {
          artifacts[artifact] = await fs.readFile(artifactPath, "utf8");
        }
      } catch {
        artifacts[artifact] = null;
      }
    })
  );
  return artifacts;
}

async function showArchivedChangeDirectory(
  changeDirectory: string
): Promise<ChangePlanArchivedShowResult> {
  const errors: string[] = [];
  let directoryStat: Stats | null;
  try {
    directoryStat = await lstatOrNull(changeDirectory);
  } catch (error) {
    errors.push(
      `cannot inspect archived change directory ${changeDirectory}: ${errorMessage(error)}`
    );
    directoryStat = null;
  }
  if (directoryStat === null && errors.length === 0) {
    errors.push(`archived change directory does not exist: ${changeDirectory}`);
  } else if (
    directoryStat !== null &&
    (directoryStat.isSymbolicLink() || !directoryStat.isDirectory())
  ) {
    errors.push(
      `archived change path must be a regular directory and not a symbolic link: ${changeDirectory}`
    );
  }

  return {
    artifacts:
      errors.length === 0
        ? await readArtifactContents(changeDirectory)
        : {
            "design.md": null,
            "proposal.md": null,
            "tasks.md": null
          },
    changeDirectory,
    changeName: path.basename(changeDirectory),
    check: null,
    errors,
    status: "archived"
  };
}

export async function showChangePlanDirectory(
  changeDirectoryInput: string
): Promise<ChangePlanShowResult> {
  const changeDirectory = path.resolve(changeDirectoryInput);
  if (changePlanStatusFromDirectory(changeDirectory) === "archived") {
    return await showArchivedChangeDirectory(changeDirectory);
  }
  const check = await checkChangePlanDirectory(changeDirectory);
  return {
    artifacts: await readArtifactContents(check.changeDirectory),
    check,
    status: "active"
  };
}
