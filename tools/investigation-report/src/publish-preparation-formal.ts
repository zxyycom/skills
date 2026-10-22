import fs from "node:fs/promises";
import path from "node:path";
import {
  createInvestigationStateSnapshot,
  inspectInvestigationCollectionLayout,
  type InvestigationCollectionLayout
} from "./investigation-index-source.ts";
import {
  investigationIndexDiagnosticMessages,
  loadInvestigationIndex
} from "./investigation-state-index.ts";
import { publishedGraphErrors } from "./published-preparation.ts";
import {
  preparationFailure,
  type FormalPublishContext,
  type PublishPreparationStep
} from "./publish-preparation.ts";

export async function prepareFormalPublishContext(
  investigationsDirectory: string,
  layout: InvestigationCollectionLayout
): Promise<PublishPreparationStep<FormalPublishContext>> {
  const indexPath = path.join(
    investigationsDirectory,
    "investigation-index.json"
  );
  const exists = await regularIndexExists(indexPath);
  if (exists.status === "error") return exists;
  if (!exists.value)
    return await prepareInitialPublishContext(
      investigationsDirectory,
      layout,
      indexPath
    );
  const loaded = await loadInvestigationIndex({ investigationsDirectory });
  if (loaded.status === "error")
    return preparationFailure([
      ...investigationIndexDiagnosticMessages(loaded.diagnostics, indexPath),
      "restore the index with full sync-index before retrying publish"
    ]);
  const formal = formalPublishedBaseline(indexPath, loaded.value);
  const states = formal.states;
  const errors = publishedGraphErrors(states);
  for (const id of layout.candidateIds)
    if (states.has(id))
      errors.push(
        `${id} exists as both a formal investigation report and an authoring candidate`
      );
  if (errors.length > 0) return preparationFailure(errors);
  return {
    status: "ok",
    value: {
      formal,
      layout,
      indexExisted: true,
      warnings: []
    }
  };
}

async function regularIndexExists(
  indexPath: string
): Promise<PublishPreparationStep<boolean>> {
  try {
    const entry = await fs.lstat(indexPath);
    return entry.isFile() && !entry.isSymbolicLink()
      ? { status: "ok", value: true }
      : preparationFailure([
          "investigation index must be a regular non-symbolic-link file"
        ]);
  } catch (error) {
    if (isMissing(error)) return { status: "ok", value: false };
    return preparationFailure([
      "investigation index could not be inspected before publish"
    ]);
  }
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    Reflect.get(error, "code") === "ENOENT"
  );
}

async function prepareInitialPublishContext(
  investigationsDirectory: string,
  layout: InvestigationCollectionLayout,
  indexPath: string
): Promise<PublishPreparationStep<FormalPublishContext>> {
  // Only first establishment may discover the complete formal identity set.
  const initial = await inspectInvestigationCollectionLayout(
    investigationsDirectory
  );
  if (initial.errors.length > 0) return preparationFailure(initial.errors);
  if (initial.reportIds.length > 0)
    return preparationFailure([
      "investigation index is missing for existing formal reports; run full sync-index before retrying publish"
    ]);
  return {
    status: "ok",
    value: {
      formal: {
        indexPath,
        sources: [],
        states: new Map(),
        snapshot: createInvestigationStateSnapshot([], []),
        publishedIndex: null
      },
      layout,
      indexExisted: false,
      warnings: []
    }
  };
}

function formalPublishedBaseline(
  indexPath: string,
  index: NonNullable<FormalPublishContext["formal"]["publishedIndex"]>
): FormalPublishContext["formal"] {
  return {
    indexPath,
    sources: [],
    states: new Map(Object.entries(index.entries)),
    snapshot: {
      metadata: index.metadata,
      sourceRevision: index.sourceRevision,
      states: index.entries
    },
    publishedIndex: index
  };
}
