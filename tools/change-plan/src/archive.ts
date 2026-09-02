import type { Stats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { checkChangePlanDirectory } from "./check.ts";
import { changePlanStatusFromDirectory } from "./change-directory.ts";
import type {
  ChangePlanArchiveResult,
  ChangePlanCheckResult
} from "./types.ts";

type DirectoryIdentity = {
  dev: number;
  ino: number;
};

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

function directoryIdentity(stat: Stats): DirectoryIdentity {
  return { dev: stat.dev, ino: stat.ino };
}

function hasDirectoryIdentity(
  stat: Stats,
  identity: DirectoryIdentity
): boolean {
  return (
    !stat.isSymbolicLink() &&
    stat.isDirectory() &&
    stat.dev === identity.dev &&
    stat.ino === identity.ino
  );
}

type ArchiveContext = Readonly<{
  archiveDirectory: string;
  archivedDirectory: string;
  sourceDirectory: string;
}>;
type ArchiveStep<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; result: ChangePlanArchiveResult }>;
type PreparedArchiveDirectory = Readonly<{
  archiveIdentity: DirectoryIdentity;
  createdIdentity: DirectoryIdentity | null;
}>;

export async function archiveChangePlanDirectory(
  changeDirectoryInput: string
): Promise<ChangePlanArchiveResult> {
  const context = createArchiveContext(changeDirectoryInput);
  const source = await inspectArchiveSource(context);
  if (!source.ok) return source.result;
  const checked = await checkArchivePlan(context);
  if (!checked.ok) return checked.result;
  let prepared: ArchiveStep<PreparedArchiveDirectory>;
  try {
    prepared = await prepareArchiveDirectory(context, checked.value);
  } catch (error) {
    return archiveFailure(
      context,
      `cannot archive change plan ${context.sourceDirectory}: ${errorMessage(error)}`,
      checked.value
    );
  }
  if (!prepared.ok) return prepared.result;
  return await publishArchive(
    context,
    source.value,
    checked.value,
    prepared.value
  );
}

function createArchiveContext(changeDirectoryInput: string): ArchiveContext {
  const sourceDirectory = path.resolve(changeDirectoryInput);
  const archiveDirectory = path.join(path.dirname(sourceDirectory), "archive");
  return {
    archiveDirectory,
    archivedDirectory: path.join(
      archiveDirectory,
      path.basename(sourceDirectory)
    ),
    sourceDirectory
  };
}

async function inspectArchiveSource(
  context: ArchiveContext
): Promise<ArchiveStep<DirectoryIdentity>> {
  let sourceStat: Stats | null;
  try {
    sourceStat = await lstatOrNull(context.sourceDirectory);
  } catch (error) {
    return archiveStepFailure(
      archiveFailure(
        context,
        `cannot inspect change directory ${context.sourceDirectory}: ${errorMessage(error)}`
      )
    );
  }
  if (sourceStat === null) {
    return archiveStepFailure(
      archiveFailure(
        context,
        `change directory does not exist: ${context.sourceDirectory}`
      )
    );
  }
  const error = archiveSourceError(context, sourceStat);
  return error === null
    ? archiveStepValue(directoryIdentity(sourceStat))
    : archiveStepFailure(archiveFailure(context, error));
}

function archiveSourceError(
  context: ArchiveContext,
  sourceStat: Stats
): string | null {
  if (sourceStat.isSymbolicLink()) {
    return `change directory must not be a symbolic link: ${context.sourceDirectory}`;
  }
  if (!sourceStat.isDirectory()) {
    return `change path must be a directory: ${context.sourceDirectory}`;
  }
  if (changePlanStatusFromDirectory(context.sourceDirectory) === "archived") {
    return `change plan is already archived: ${context.sourceDirectory}`;
  }
  return context.sourceDirectory === context.archiveDirectory
    ? `reserved change archive directory cannot be archived: ${context.sourceDirectory}`
    : null;
}

async function checkArchivePlan(
  context: ArchiveContext
): Promise<ArchiveStep<ChangePlanCheckResult>> {
  let check: ChangePlanCheckResult;
  try {
    check = await checkChangePlanDirectory(context.sourceDirectory);
  } catch (error) {
    return archiveStepFailure(
      archiveFailure(
        context,
        `cannot check change plan ${context.sourceDirectory}: ${errorMessage(error)}`
      )
    );
  }
  const error = archiveCheckError(check);
  return error === null
    ? archiveStepValue(check)
    : archiveStepFailure(archiveFailure(context, error, check));
}

function archiveCheckError(check: ChangePlanCheckResult): string | null {
  if (!check.valid) return "change plan must pass check before archive";
  if (check.stage !== "plan") {
    return "change plan must be an active plan before archive";
  }
  return check.completedTaskCount === check.taskCount
    ? null
    : `all tasks must be completed before archive: ${check.completedTaskCount}/${check.taskCount}`;
}

async function prepareArchiveDirectory(
  context: ArchiveContext,
  check: ChangePlanCheckResult
): Promise<ArchiveStep<PreparedArchiveDirectory>> {
  let archiveStat = await lstatOrNull(context.archiveDirectory);
  let createdIdentity: DirectoryIdentity | null = null;
  if (archiveStat === null) {
    await fs.mkdir(context.archiveDirectory);
    archiveStat = await lstatOrNull(context.archiveDirectory);
    if (archiveStat === null) {
      throw new Error(
        `created archive directory disappeared: ${context.archiveDirectory}`
      );
    }
    createdIdentity = directoryIdentity(archiveStat);
  }
  if (!archiveStat.isDirectory() || archiveStat.isSymbolicLink()) {
    await removeCreatedArchiveDirectory(context, createdIdentity);
    return archiveStepFailure(
      archiveFailure(
        context,
        `change archive must be a regular directory: ${context.archiveDirectory}`,
        check
      )
    );
  }
  if ((await lstatOrNull(context.archivedDirectory)) !== null) {
    await removeCreatedArchiveDirectory(context, createdIdentity);
    return archiveStepFailure(
      archiveFailure(
        context,
        `archive target already exists: ${context.archivedDirectory}`,
        check
      )
    );
  }
  return archiveStepValue({
    archiveIdentity: directoryIdentity(archiveStat),
    createdIdentity
  });
}

async function publishArchive(
  context: ArchiveContext,
  sourceIdentity: DirectoryIdentity,
  check: ChangePlanCheckResult,
  prepared: PreparedArchiveDirectory
): Promise<ChangePlanArchiveResult> {
  try {
    const protectionFailure = await archiveProtectionFailure(
      context,
      sourceIdentity,
      check,
      prepared
    );
    if (protectionFailure !== null) return protectionFailure;
    await fs.rename(context.sourceDirectory, context.archivedDirectory);
    return archiveSuccess(context, check);
  } catch (error) {
    await removeCreatedArchiveDirectory(context, prepared.createdIdentity);
    return archiveFailure(
      context,
      `cannot archive change plan ${context.sourceDirectory}: ${errorMessage(error)}`,
      check
    );
  }
}

async function archiveProtectionFailure(
  context: ArchiveContext,
  sourceIdentity: DirectoryIdentity,
  check: ChangePlanCheckResult,
  prepared: PreparedArchiveDirectory
): Promise<ChangePlanArchiveResult | null> {
  const currentArchiveStat = await lstatOrNull(context.archiveDirectory);
  if (
    currentArchiveStat === null ||
    !hasDirectoryIdentity(currentArchiveStat, prepared.archiveIdentity)
  ) {
    return await protectedArchiveFailure(
      context,
      prepared,
      `change archive directory changed before archive: ${context.archiveDirectory}`,
      check
    );
  }
  let sourceStat: Stats | null;
  try {
    sourceStat = await lstatOrNull(context.sourceDirectory);
  } catch (error) {
    return await protectedArchiveFailure(
      context,
      prepared,
      `cannot recheck change directory ${context.sourceDirectory}: ${errorMessage(error)}`,
      check
    );
  }
  const sourceError = protectedSourceError(context, sourceStat, sourceIdentity);
  if (sourceError !== null) {
    return await protectedArchiveFailure(context, prepared, sourceError, check);
  }
  return (await lstatOrNull(context.archivedDirectory)) === null
    ? null
    : await protectedArchiveFailure(
        context,
        prepared,
        `archive target appeared before archive: ${context.archivedDirectory}`,
        check
      );
}

function protectedSourceError(
  context: ArchiveContext,
  sourceStat: Stats | null,
  sourceIdentity: DirectoryIdentity
): string | null {
  if (sourceStat === null) {
    return `change directory disappeared before archive: ${context.sourceDirectory}`;
  }
  return hasDirectoryIdentity(sourceStat, sourceIdentity)
    ? null
    : `change directory changed before archive: ${context.sourceDirectory}`;
}

async function protectedArchiveFailure(
  context: ArchiveContext,
  prepared: PreparedArchiveDirectory,
  error: string,
  check: ChangePlanCheckResult
): Promise<ChangePlanArchiveResult> {
  await removeCreatedArchiveDirectory(context, prepared.createdIdentity);
  return archiveFailure(context, error, check);
}

async function removeCreatedArchiveDirectory(
  context: ArchiveContext,
  createdIdentity: DirectoryIdentity | null
): Promise<void> {
  if (createdIdentity === null) return;
  try {
    const currentArchiveStat = await lstatOrNull(context.archiveDirectory);
    if (
      currentArchiveStat !== null &&
      hasDirectoryIdentity(currentArchiveStat, createdIdentity)
    ) {
      await fs.rmdir(context.archiveDirectory);
    }
  } catch {
    // Preserve the original archive failure; the directory may no longer be empty.
  }
}

function archiveFailure(
  context: ArchiveContext,
  error: string,
  check: ChangePlanCheckResult | null = null
): ChangePlanArchiveResult {
  return { ...context, archived: false, check, error };
}

function archiveSuccess(
  context: ArchiveContext,
  check: ChangePlanCheckResult
): ChangePlanArchiveResult {
  return { ...context, archived: true, check, error: null };
}

function archiveStepValue<T>(value: T): ArchiveStep<T> {
  return { ok: true, value };
}

function archiveStepFailure<T>(
  result: ChangePlanArchiveResult
): ArchiveStep<T> {
  return { ok: false, result };
}
