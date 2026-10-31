/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/candidates/candidate-read-resources.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/candidates/candidate-read-resources.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/candidates/candidate-read-resources.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import fs from "node:fs/promises";
import path from "node:path";
import { prepareInvestigationResourceRoot } from "../resources/resource-root.ts";
import {
  validateReferencedInvestigationResources,
  type InvestigationResourceReferencesByReport
} from "../resources/resources.ts";
import { investigationResourcesDirectoryName } from "../resources/resource-reference.ts";
import type { CandidateReadContext } from "./candidate-document.ts";

async function candidateResourceRootExists(
  directory: string
): Promise<boolean> {
  try {
    await fs.lstat(path.join(directory, investigationResourcesDirectoryName));
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return false;
    throw error;
  }
}

export async function prepareCandidateResources(
  investigationsDirectory: string,
  required: boolean,
  references: InvestigationResourceReferencesByReport,
  selectedIds: readonly string[]
): Promise<Pick<CandidateReadContext, "resources" | "ownerWarnings">> {
  if (
    !required &&
    !(await candidateResourceRootExists(investigationsDirectory))
  )
    return { resources: undefined, ownerWarnings: [] };
  const resources = await prepareInvestigationResourceRoot(
    investigationsDirectory
  );
  if (resources.status !== "ready") return { resources, ownerWarnings: [] };
  const visibleByOwner = candidateGitResourcesByOwner(resources, selectedIds);
  const ownerWarnings: string[] = [];
  for (const id of selectedIds) {
    const visible =
      resources.membership.mode === "version-control"
        ? (visibleByOwner.get(id) ?? [])
        : await visibleCandidateOwnerResources(
            resources.canonicalResourcesRoot,
            id
          );
    for (const resource of visible) {
      if (references.get(id)?.has(resource)) continue;
      const issues = await validateReferencedInvestigationResources(
        investigationsDirectory,
        [resource],
        undefined,
        resources
      );
      ownerWarnings.push(
        `${investigationResourcesDirectoryName}/${resource} must be referenced by its owner report ${id}`,
        ...issues
      );
    }
  }
  return { resources, ownerWarnings };
}

function candidateGitResourcesByOwner(
  resources: Extract<
    Awaited<ReturnType<typeof prepareInvestigationResourceRoot>>,
    { status: "ready" }
  >,
  selectedIds: readonly string[]
): Map<string, string[]> {
  const byOwner = new Map<string, string[]>();
  if (resources.membership.mode !== "version-control") return byOwner;
  const selected = new Set(selectedIds);
  for (const resource of resources.membership.files) {
    const separator = resource.indexOf("/");
    if (separator < 0) continue;
    const owner = resource.slice(0, separator);
    if (!selected.has(owner)) continue;
    const visible = byOwner.get(owner) ?? [];
    visible.push(resource);
    byOwner.set(owner, visible);
  }
  return byOwner;
}

async function visibleCandidateOwnerResources(
  root: string,
  relative: string
): Promise<string[]> {
  const target = path.join(root, relative);
  let entry;
  try {
    entry = await fs.lstat(target);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return [];
    throw error;
  }
  if (!entry.isDirectory() || entry.isSymbolicLink()) return [relative];
  const children = await fs.readdir(target);
  const members: string[] = [];
  for (const child of children.sort())
    members.push(
      ...(await visibleCandidateOwnerResources(root, `${relative}/${child}`))
    );
  return members;
}
