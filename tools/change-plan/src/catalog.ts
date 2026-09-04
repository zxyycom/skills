import type { Stats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import {
  checkChangePlanDirectory,
  checkChangePlanDirectoryInRoot
} from "./check.ts";
import {
  changePlanArtifactNames,
  type ChangePlanArtifactContents,
  type ChangePlanCollectionCheckResult,
  type ChangePlanCollectionOptions,
  type ChangePlanListOptions,
  type ChangePlanListResult,
  type ChangePlanShowResult
} from "./types.ts";

const tombstoneDirectoryName = ".change-plan-tombstones";

async function lstatOrNull(targetPath: string): Promise<Stats | null> {
  try {
    return await fs.lstat(targetPath);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function listChangeDirectoryNames(directory: string): Promise<string[]> {
  return (await fs.readdir(directory, { withFileTypes: true }))
    .filter(
      (entry) => entry.name !== tombstoneDirectoryName && entry.isDirectory()
    )
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
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
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    result.errors.push(
      `change root must be a regular directory: ${result.changeRoot}`
    );
    return false;
  }
  return true;
}

export async function listChangePlans(
  options: ChangePlanListOptions = {}
): Promise<ChangePlanListResult> {
  const result: ChangePlanListResult = {
    changeRoot: path.resolve(options.changeRoot ?? "changes"),
    entries: [],
    errors: []
  };
  if (!(await inspectChangeRoot(result))) return result;
  try {
    result.entries = await Promise.all(
      (await listChangeDirectoryNames(result.changeRoot)).map((name) =>
        checkChangePlanDirectoryInRoot(
          path.join(result.changeRoot, name),
          result.changeRoot
        )
      )
    );
  } catch (error) {
    result.errors.push(
      `cannot list changes in ${result.changeRoot}: ${errorMessage(error)}`
    );
  }
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
  const list = await listChangePlans(options);
  const validCount = list.entries.filter((entry) => entry.valid).length;
  return {
    changeRoot: list.changeRoot,
    checkedCount: list.entries.length,
    entries: list.entries,
    errors: list.errors,
    invalidCount: list.entries.length - validCount,
    valid: list.errors.length === 0 && validCount === list.entries.length,
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
  await Promise.all(
    changePlanArtifactNames.map(async (artifact) => {
      const artifactPath = path.join(changeDirectory, artifact);
      try {
        const stat = await lstatOrNull(artifactPath);
        if (stat !== null && !stat.isSymbolicLink() && stat.isFile()) {
          artifacts[artifact] = await fs.readFile(artifactPath, "utf8");
        }
      } catch {
        artifacts[artifact] = null;
      }
    })
  );
  return artifacts;
}

export async function showChangePlanDirectory(
  changeDirectoryInput: string
): Promise<ChangePlanShowResult> {
  const check = await checkChangePlanDirectory(changeDirectoryInput);
  return {
    artifacts: check.diagnostics.some(
      (diagnostic) => diagnostic.code === "change-directory-not-active-member"
    )
      ? {
          "design.md": null,
          "proposal.md": null,
          "tasks.md": null
        }
      : await readArtifactContents(check.changeDirectory),
    check
  };
}
