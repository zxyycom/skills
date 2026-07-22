import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { calculateSkillPackageFingerprint } from "../../skill-package/src/fingerprint.ts";
import {
  isFileSystemError,
  isPathWithinDirectory,
  pathExists,
  toPosix
} from "../../shared/src/node/filesystem.ts";
import type { SkillFile, UpdaterConfig } from "./types.ts";

const ignoredDirectoryNames = new Set([".git", "node_modules"]);

function safeJoin(root: string, relativePath: string): string {
  const fullPath = path.resolve(root, relativePath);
  if (!isPathWithinDirectory(fullPath, root)) {
    throw new Error(`Refusing to write outside target directory: ${relativePath}`);
  }

  return fullPath;
}

async function collectLocalFiles(
  directory: string,
  baseDirectory = directory
): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (isFileSystemError(error, "ENOENT")) {
      return [];
    }
    throw error;
  }

  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectoryNames.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectLocalFiles(fullPath, baseDirectory));
    } else if (entry.isFile()) {
      files.push(toPosix(path.relative(baseDirectory, fullPath)));
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

export async function localSkillFingerprint(
  config: UpdaterConfig,
  targetDir: string
): Promise<string | null> {
  if (!await pathExists(targetDir)) {
    return null;
  }

  const stats = await fs.stat(targetDir);
  if (!stats.isDirectory()) {
    throw new Error(`Target path exists but is not a directory: ${targetDir}`);
  }

  const localPaths = await collectLocalFiles(targetDir);
  const files = await Promise.all(localPaths.map(async (relativePath) => ({
    data: await fs.readFile(safeJoin(targetDir, relativePath)),
    path: relativePath
  })));

  return calculateSkillPackageFingerprint(config.skillName, files);
}

async function writeSkillFiles(files: SkillFile[], tempDir: string): Promise<void> {
  for (const file of files) {
    const outputPath = safeJoin(tempDir, file.path);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, file.data);
  }
}

async function replaceDirectory(targetDir: string, tempDir: string): Promise<void> {
  const parentDir = path.dirname(targetDir);
  const baseName = path.basename(targetDir);
  const backupDir = path.join(parentDir, `.${baseName}.backup-${process.pid}-${Date.now()}`);
  const targetExists = await pathExists(targetDir);

  if (isPathWithinDirectory(process.cwd(), targetDir)) {
    process.chdir(os.tmpdir());
  }

  try {
    if (targetExists) {
      await fs.rename(targetDir, backupDir);
    }
    await fs.rename(tempDir, targetDir);
    if (targetExists) {
      await fs.rm(backupDir, { force: true, recursive: true });
    }
  } catch (error) {
    if (!await pathExists(targetDir) && await pathExists(backupDir)) {
      await fs.rename(backupDir, targetDir);
    }
    throw error;
  }
}

export async function installSkillFiles(
  files: SkillFile[],
  targetDir: string
): Promise<void> {
  const parentDir = path.dirname(targetDir);
  await fs.mkdir(parentDir, { recursive: true });
  const tempDir = await fs.mkdtemp(
    path.join(parentDir, `.${path.basename(targetDir)}.update-`)
  );

  try {
    await writeSkillFiles(files, tempDir);
    await replaceDirectory(targetDir, tempDir);
  } finally {
    if (await pathExists(tempDir)) {
      await fs.rm(tempDir, { force: true, recursive: true });
    }
  }
}
