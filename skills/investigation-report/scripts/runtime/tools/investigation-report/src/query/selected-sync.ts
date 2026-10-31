/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/query/selected-sync.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/query/selected-sync.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/query/selected-sync.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import { ResourceDirectoryFacts } from "../resources/resource-directory-facts.ts";
import { prepareInvestigationResourceRoot } from "../resources/resource-root.ts";
import { investigationResourcesDirectoryName } from "../resources/resource-reference.ts";
import type { InvestigationIndexState } from "../types.ts";
import { synchronizeSelectedRecordIndex } from "../../../record-operations/src/selected-synchronize.ts";
import { createInvestigationStateIndexDefinition } from "../index/investigation-index-definition.ts";
import { investigationIndexFileName } from "../index/investigation-state-index.ts";
import {
  investigationIdFromMarkdown,
  parseInvestigationReport
} from "../records/markdown.ts";
import {
  investigationNameFromId,
  normalizeInvestigationSelectorInput,
  parseDatedInvestigationId
} from "../collection/report-path.ts";
import { investigationSourceRevision } from "../index/investigation-source-revision.ts";
import {
  publicationDependencyIds,
  publishedGraphErrors
} from "../publication/preparation/published-preparation.ts";
import { buildInvestigationReportState } from "../records/report-validation.ts";
import { validateReferencedInvestigationResources } from "../resources/resources.ts";
import type { StateIndexSyncMode } from "../../../index-runtime/src/index.ts";

export async function synchronizeSelectedInvestigationIndex(
  root: string,
  mode: StateIndexSyncMode,
  selectors: readonly string[]
) {
  return await synchronizeSelectedRecordIndex({
    root,
    mode,
    selectors,
    indexPath: investigationIndexFileName,
    definition: createInvestigationStateIndexDefinition(),
    selectorPolicy: {
      label: "Investigation",
      codePrefix: "investigation-report",
      normalize: normalizeInvestigationSelectorInput,
      datedId: (selector) => parseDatedInvestigationId(selector)?.id ?? null,
      nameFromId: investigationNameFromId
    },
    identity: investigationIdFromMarkdown,
    parse: async (source) => {
      const built = buildInvestigationReportState(
        source.id,
        parseInvestigationReport(source.text, source.id),
        source.sourcePath
      );
      if (built.status === "invalid") throw new Error(built.errors.join("; "));
      return built.state;
    },
    revision: investigationSourceRevision,
    dependencies: (index, selected) =>
      publicationDependencyIds(
        new Map(Object.entries(index.entries)),
        selected
      ),
    graphErrors: (entries) =>
      publishedGraphErrors(new Map(Object.entries(entries))),
    verifyAffected: (baseline, next, selected) =>
      verifyRemovedOwners(root, baseline, next, selected),
    verifyResources: async (states) => {
      const errors = await validateReferencedInvestigationResources(root, [
        ...new Set(states.flatMap((state) => state.resourceIds))
      ]);
      if (errors.length > 0) throw new Error(errors.join("; "));
    }
  });
}

/** A removed published owner is a known affected location, not unknown-path discovery. */
async function verifyRemovedOwners(
  root: string,
  baseline: Readonly<Record<string, InvestigationIndexState>>,
  next: Readonly<Record<string, InvestigationIndexState>>,
  selected: ReadonlySet<string>
): Promise<void> {
  const removed = [...selected].filter(
    (id) => Object.hasOwn(baseline, id) && !Object.hasOwn(next, id)
  );
  if (removed.length === 0) return;
  const collection = await ResourceDirectoryFacts.create(root);
  const resourceEntry = await collection.entry(
    root,
    investigationResourcesDirectoryName
  );
  if (resourceEntry === null) {
    await collection.assertCurrent();
    return;
  }
  if (resourceEntry.name !== investigationResourcesDirectoryName)
    throw new Error(
      "Selected removal resource root must match actual path casing"
    );
  // Absence is a filesystem fact: ignored, empty and unsafe owner entries also prevent removal.
  const resources = await prepareInvestigationResourceRoot(root, {
    mode: "file-system"
  });
  if (resources.status === "invalid")
    throw resources.failure ?? new Error(resources.errors.join("; "));
  if (resources.status === "missing")
    throw new Error("Resource root changed while checking removed owners");
  for (const id of removed) {
    const entry = await resources.directories.entry(
      resources.canonicalResourcesRoot,
      id
    );
    if (entry !== null)
      throw new Error(
        `Removed Investigation owner path still exists: ${id}; restore its report or explicitly reconcile resources, then run full sync-index (sync does not remove resources)`
      );
  }
  await resources.directories.assertCurrent();
  await collection.assertCurrent();
}
