import fs from "node:fs/promises";
import path from "node:path";
import { errorMessage, lstatOrNull } from "./check-support.ts";
import { createPlanVersionControlInspector } from "./git-distance.ts";
import { inspectChangeRootRepositoryBoundary } from "./repository-boundary.ts";
import {
  checkChangePlanDirectory,
  checkChangePlanDirectoryInRoot
} from "./check.ts";
import {
  changePlanArtifactNames,
  tombstoneDirectoryName,
  type ChangePlanArtifactContents,
  type ChangePlanCollectionCheckResult,
  type ChangePlanCollectionOptions,
  type ChangePlanListOptions,
  type ChangePlanListResult,
  type ChangePlanShowResult
} from "./types.ts";

async function listChangeDirectoryNames(directory: string): Promise<string[]> {
  return (await fs.readdir(directory, { withFileTypes: true }))
    .filter(
      (entry) => entry.name !== tombstoneDirectoryName && entry.isDirectory()
    )
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

export async function listChangePlans(
  options: ChangePlanListOptions = {}
): Promise<ChangePlanListResult> {
  const result: ChangePlanListResult = {
    changeRoot: path.resolve(options.changeRoot ?? "changes"),
    entries: [],
    errors: []
  };
  const boundaryFailure = await inspectChangeRootRepositoryBoundary(
    result.changeRoot
  );
  if (boundaryFailure !== null) {
    result.errors.push(boundaryFailure.message);
    return result;
  }
  const inspectVersionControl = createPlanVersionControlInspector(
    result.changeRoot
  );
  try {
    result.entries = await Promise.all(
      (await listChangeDirectoryNames(result.changeRoot)).map((name) =>
        checkChangePlanDirectoryInRoot(
          path.join(result.changeRoot, name),
          result.changeRoot,
          {
            inspectGitDistance: options.stage !== "draft",
            inspectVersionControl,
            repositoryBoundaryChecked: true
          }
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
      (diagnostic) =>
        diagnostic.code === "change-directory-not-active-member" ||
        diagnostic.code === "change-root-contains-repository" ||
        diagnostic.code === "change-root-read-failed"
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
