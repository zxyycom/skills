import type { Stats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { checkChangePlanDirectory } from "./check.ts";
import { changePlanStatusFromDirectory } from "./catalog.ts";
import type {
  ChangePlanArchiveResult,
  ChangePlanCheckResult
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

export async function archiveChangePlanDirectory(
  changeDirectoryInput: string
): Promise<ChangePlanArchiveResult> {
  const sourceDirectory = path.resolve(changeDirectoryInput);
  const archiveDirectory = path.join(path.dirname(sourceDirectory), "archive");
  const archivedDirectory = path.join(
    archiveDirectory,
    path.basename(sourceDirectory)
  );
  const baseResult = {
    archiveDirectory,
    archivedDirectory,
    sourceDirectory
  };
  const failure = (
    error: string,
    check: ChangePlanCheckResult | null = null
  ): ChangePlanArchiveResult => ({
    ...baseResult,
    archived: false,
    check,
    error
  });
  const success = (
    check: ChangePlanCheckResult
  ): ChangePlanArchiveResult => ({
    ...baseResult,
    archived: true,
    check,
    error: null
  });

  let sourceStat: Stats | null;
  try {
    sourceStat = await lstatOrNull(sourceDirectory);
  } catch (error) {
    return failure(
      `cannot inspect change directory ${sourceDirectory}: ${errorMessage(error)}`
    );
  }
  if (sourceStat === null) {
    return failure(`change directory does not exist: ${sourceDirectory}`);
  }
  if (sourceStat.isSymbolicLink()) {
    return failure(
      `change directory must not be a symbolic link: ${sourceDirectory}`
    );
  }
  if (!sourceStat.isDirectory()) {
    return failure(`change path must be a directory: ${sourceDirectory}`);
  }
  if (changePlanStatusFromDirectory(sourceDirectory) === "archived") {
    return failure(`change plan is already archived: ${sourceDirectory}`);
  }
  if (sourceDirectory === archiveDirectory) {
    return failure(
      `reserved change archive directory cannot be archived: ${sourceDirectory}`
    );
  }

  let check: ChangePlanCheckResult;
  try {
    check = await checkChangePlanDirectory(sourceDirectory);
  } catch (error) {
    return failure(
      `cannot check change plan ${sourceDirectory}: ${errorMessage(error)}`
    );
  }
  if (!check.valid) {
    return failure("change plan must pass check before archive", check);
  }
  if (check.stage !== "implementation") {
    return failure(
      "change plan must be in implementation stage before archive",
      check
    );
  }
  if (check.completedTaskCount !== check.taskCount) {
    return failure(
      `all tasks must be completed before archive: `
        + `${check.completedTaskCount}/${check.taskCount}`,
      check
    );
  }

  try {
    sourceStat = await lstatOrNull(sourceDirectory);
  } catch (error) {
    return failure(
      `cannot recheck change directory ${sourceDirectory}: ${errorMessage(error)}`,
      check
    );
  }
  if (sourceStat === null) {
    return failure(
      `change directory disappeared before archive: ${sourceDirectory}`,
      check
    );
  }
  if (sourceStat.isSymbolicLink() || !sourceStat.isDirectory()) {
    return failure(
      `change directory changed before archive: ${sourceDirectory}`,
      check
    );
  }

  let createdArchiveDirectory = false;
  const removeCreatedArchiveDirectory = async (): Promise<void> => {
    if (!createdArchiveDirectory) {
      return;
    }
    try {
      await fs.rmdir(archiveDirectory);
    } catch {
      // Preserve the original archive failure; the directory may no longer be empty.
    }
  };
  try {
    const archiveStat = await lstatOrNull(archiveDirectory);
    if (archiveStat !== null) {
      if (!archiveStat.isDirectory() || archiveStat.isSymbolicLink()) {
        return failure(
          `change archive must be a regular directory: ${archiveDirectory}`,
          check
        );
      }
    } else {
      await fs.mkdir(archiveDirectory);
      createdArchiveDirectory = true;
    }

    if (await lstatOrNull(archivedDirectory) !== null) {
      await removeCreatedArchiveDirectory();
      return failure(
        `archive target already exists: ${archivedDirectory}`,
        check
      );
    }

    await fs.rename(sourceDirectory, archivedDirectory);
    return success(check);
  } catch (error) {
    await removeCreatedArchiveDirectory();
    return failure(
      `cannot archive change plan ${sourceDirectory}: ${errorMessage(error)}`,
      check
    );
  }
}
