import fs from "node:fs/promises";
import path from "node:path";
import {
  readOptionalSkillVersionFromMarkdown,
  skillEntryFileName
} from "../../skill-package/src/version.ts";
import {
  isFileSystemError,
  isPathWithinDirectory
} from "../../shared/src/node/filesystem.ts";
import type {
  LocalSkillState,
  SkillFile,
  SkillUpdatePlanEntry
} from "./types.ts";

function safeJoin(root: string, relativePath: string): string {
  const fullPath = path.resolve(root, relativePath);
  if (!isPathWithinDirectory(fullPath, root)) {
    throw new Error(`Refusing to write outside target directory: ${relativePath}`);
  }

  return fullPath;
}

async function lstatOrNull(targetPath: string): Promise<Awaited<ReturnType<typeof fs.lstat>> | null> {
  try {
    return await fs.lstat(targetPath);
  } catch (error) {
    if (isFileSystemError(error, "ENOENT")) {
      return null;
    }
    throw error;
  }
}

async function assertTargetDirectory(targetDir: string): Promise<boolean> {
  const stats = await lstatOrNull(targetDir);
  if (stats === null) {
    return false;
  }
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new Error(`Target path exists but is not a regular directory: ${targetDir}`);
  }

  return true;
}

async function assertParentDirectories(
  targetDir: string,
  relativePath: string
): Promise<void> {
  const segments = relativePath.split("/");
  for (let index = 1; index < segments.length; index += 1) {
    const parentPath = safeJoin(targetDir, segments.slice(0, index).join("/"));
    const stats = await lstatOrNull(parentPath);
    if (stats !== null && (stats.isSymbolicLink() || !stats.isDirectory())) {
      throw new Error(
        `Cannot update ${relativePath}; parent path is not a regular directory: `
        + segments.slice(0, index).join("/")
      );
    }
  }
}

export async function localSkillState(targetDir: string): Promise<LocalSkillState> {
  if (!await assertTargetDirectory(targetDir)) {
    return { state: "missing" };
  }

  const skillEntryPath = safeJoin(targetDir, skillEntryFileName);
  const skillEntryStats = await lstatOrNull(skillEntryPath);
  if (skillEntryStats === null) {
    return { state: "unversioned" };
  }
  if (skillEntryStats.isSymbolicLink() || !skillEntryStats.isFile()) {
    throw new Error(
      `${skillEntryFileName} exists but is not a regular file: ${skillEntryPath}`
    );
  }

  const version = readOptionalSkillVersionFromMarkdown(
    await fs.readFile(skillEntryPath, "utf8"),
    skillEntryPath
  );
  return version === null
    ? { state: "unversioned" }
    : { state: "versioned", version };
}

export async function planSkillUpdate(
  files: readonly SkillFile[],
  targetDir: string
): Promise<SkillUpdatePlanEntry[]> {
  await assertTargetDirectory(targetDir);
  const seenPaths = new Set<string>();
  const plan: SkillUpdatePlanEntry[] = [];

  for (const file of files) {
    if (seenPaths.has(file.path)) {
      throw new Error(`Remote release contains duplicate skill path: ${file.path}`);
    }
    seenPaths.add(file.path);

    await assertParentDirectories(targetDir, file.path);
    const outputPath = safeJoin(targetDir, file.path);
    const stats = await lstatOrNull(outputPath);
    if (stats === null) {
      plan.push({ action: "add", path: file.path });
      continue;
    }
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw new Error(
        `Cannot replace ${file.path}; target exists but is not a regular file`
      );
    }

    plan.push({ action: "replace", path: file.path });
  }

  return plan;
}

async function writeSkillFiles(
  files: readonly SkillFile[],
  outputDir: string
): Promise<void> {
  for (const file of files) {
    const outputPath = safeJoin(outputDir, file.path);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, file.data);
  }
}

async function restoreAppliedFiles(
  applied: readonly SkillUpdatePlanEntry[],
  backupDir: string,
  targetDir: string
): Promise<void> {
  for (const entry of [...applied].reverse()) {
    const outputPath = safeJoin(targetDir, entry.path);
    if (entry.action === "add") {
      await fs.rm(outputPath, { force: true });
      continue;
    }

    const backupPath = safeJoin(backupDir, entry.path);
    await fs.copyFile(backupPath, outputPath);
  }
}

export async function installSkillFiles(
  files: readonly SkillFile[],
  targetDir: string
): Promise<void> {
  const plan = await planSkillUpdate(files, targetDir);
  const parentDir = path.dirname(targetDir);
  await fs.mkdir(parentDir, { recursive: true });
  const tempDir = await fs.mkdtemp(
    path.join(parentDir, `.${path.basename(targetDir)}.update-`)
  );
  const stagedDir = path.join(tempDir, "staged");
  const backupDir = path.join(tempDir, "backup");

  try {
    await writeSkillFiles(files, stagedDir);
    await fs.mkdir(targetDir, { recursive: true });

    for (const entry of plan) {
      if (entry.action !== "replace") {
        continue;
      }

      const backupPath = safeJoin(backupDir, entry.path);
      await fs.mkdir(path.dirname(backupPath), { recursive: true });
      await fs.copyFile(safeJoin(targetDir, entry.path), backupPath);
    }

    const entriesByPath = new Map(plan.map((entry) => [entry.path, entry]));
    const applied: SkillUpdatePlanEntry[] = [];
    try {
      for (const file of files) {
        const entry = entriesByPath.get(file.path);
        if (entry === undefined) {
          throw new Error(`Update plan is missing remote path: ${file.path}`);
        }

        const outputPath = safeJoin(targetDir, file.path);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        applied.push(entry);
        await fs.copyFile(safeJoin(stagedDir, file.path), outputPath);
      }
    } catch (error) {
      try {
        await restoreAppliedFiles(applied, backupDir, targetDir);
      } catch (rollbackError) {
        throw new Error(
          "Skill update failed and rollback did not complete: "
          + (rollbackError instanceof Error ? rollbackError.message : String(rollbackError)),
          { cause: error }
        );
      }
      throw error;
    }
  } finally {
    await fs.rm(tempDir, { force: true, recursive: true });
  }
}
