/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/discard-loading.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/discard-loading.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/discard-loading.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import { InvestigationPreparation } from "./strict-preparation.ts";
import {
  inspectInvestigationCollectionLayout,
  type InvestigationCollectionLayout
} from "./investigation-layout.ts";
import path from "node:path";
import { buildDiscardIndexText } from "./discard-index-projection.ts";
import { prepareResourceSourceProof } from "./rename-resource-proof.ts";

import type { ResourceMoveProgress } from "./rename-contract.ts";
import { readCandidateAuthoringResourceReferences } from "./candidate.ts";
import { genericInvestigationDiagnostic } from "./diagnostics.ts";
import {
  investigationIndexDiagnosticMessages,
  syncInvestigationStateIndex
} from "./investigation-state-index.ts";
import { resolveInvestigationSelector } from "./investigation-selector.ts";
import { validateInvestigationRelationGraph } from "./relation-validation.ts";
import { createInvestigationRelationContext } from "./relation-context.ts";
import { investigationResourcesDirectoryName } from "./resource-reference.ts";
import { collectValidatedInvestigationCollection } from "./validation.ts";
import type {
  InvestigationIndexState,
  InvestigationReportDiscardResult
} from "./types.ts";
import {
  discardMutation,
  result,
  type DiscardCollectionOptions,
  type DiscardStep,
  type InvestigationCollectionSource,
  type ValidatedInvestigationCollection
} from "./discard.ts";
import {
  discardProtectionFailure,
  discardStepFailure,
  discardStepValue
} from "./discard-protection.ts";
import {
  inspectOwnedResources,
  isRecordedAtHead,
  referencesToTarget,
  sharedOwnerResourceReferences,
  type ResourceTreeScan
} from "./discard-history.ts";
import { discardIndexReadFailure } from "./discard-loading-diagnostics.ts";
import { publishLoadedDiscard } from "./discard-loading-publication.ts";

type LoadedDiscardCollection = Readonly<{
  collection: ValidatedInvestigationCollection;
  originalIndexText: string;
  preparation: InvestigationPreparation;
  layout: InvestigationCollectionLayout;
}>;

export function requiredReportSourcePath(
  collection: ValidatedInvestigationCollection,
  id: string
): string {
  const source = collection.sources.find((entry) => entry.id === id);
  if (source === undefined) {
    throw new Error(`validated investigation collection is missing ${id}`);
  }
  return source.sourcePath;
}

export async function discardFromCollection(
  options: DiscardCollectionOptions,
  acquisition?: Readonly<{
    preparation: InvestigationPreparation;
    layout: InvestigationCollectionLayout;
  }>
): Promise<InvestigationReportDiscardResult> {
  const preparation =
    acquisition?.preparation ??
    new InvestigationPreparation(path.dirname(options.root), options.root);
  const layout =
    acquisition?.layout ??
    (await inspectInvestigationCollectionLayout(options.root, {
      preparation
    }));
  const current = await collectValidatedInvestigationCollection(options.root, {
    layout,
    preparation
  });
  if (current.errors.length > 0 || current.snapshot === null) {
    return result(options, false, [], current.errors);
  }
  const selected = resolveInvestigationSelector(
    [...current.states.entries()].map(([id, state]) => ({
      id,
      name: state.name
    })),
    options.id
  );
  if (selected.status === "error") {
    return result(options, false, [], selected.errors);
  }
  options = { ...options, id: selected.id };
  const loaded = await loadDiscardCollection(options, current, {
    preparation,
    layout
  });
  if (!loaded.ok) return loaded.result;
  return await discardLoadedCollection(options, loaded.value);
}

async function discardLoadedCollection(
  options: DiscardCollectionOptions,
  loaded: LoadedDiscardCollection
): Promise<InvestigationReportDiscardResult> {
  const collection = loaded.collection;
  const freshnessFailure = await discardFreshnessFailure(options, collection);
  if (freshnessFailure !== null) return freshnessFailure;
  return await prepareLoadedDiscard(options, loaded, collection);
}

async function prepareLoadedDiscard(
  options: DiscardCollectionOptions,
  loaded: LoadedDiscardCollection,
  collection: ValidatedInvestigationCollection
): Promise<InvestigationReportDiscardResult> {
  const ownership = await prepareDiscardOwnership(options, collection, loaded);
  if (!ownership.ok) return ownership.result;
  const candidate = prepareDiscardCandidate(options, collection);
  if (!candidate.ok) return candidate.result;
  const reportSourcePath = requiredReportSourcePath(collection, options.id);
  const ownedResources = ownership.value.ownedResources;
  const historyFailure = await discardHistoryFailure(
    options,
    reportSourcePath,
    ownedResources.resourceIds
  );
  if (historyFailure !== null) return historyFailure;
  const indexText = await buildDiscardIndexText(options, candidate.value);
  if (!indexText.ok) return indexText.result;
  return await commitLoadedDiscard(
    options,
    loaded,
    ownership.value,
    indexText.value
  );
}

async function commitLoadedDiscard(
  options: DiscardCollectionOptions,
  loaded: LoadedDiscardCollection,
  ownership: Extract<
    Awaited<ReturnType<typeof prepareDiscardOwnership>>,
    { ok: true }
  >["value"],
  indexText: string
): Promise<InvestigationReportDiscardResult> {
  await options.beforePublish();
  const protectionFailure = await discardProtectionFailure(
    options,
    loaded.collection,
    loaded.originalIndexText
  );
  if (protectionFailure !== null) return protectionFailure;
  return await publishLoadedDiscard(options, loaded, ownership, indexText);
}

async function loadDiscardCollection(
  options: DiscardCollectionOptions,
  collection: Awaited<
    ReturnType<typeof collectValidatedInvestigationCollection>
  >,
  facts: Pick<LoadedDiscardCollection, "preparation" | "layout">
): Promise<DiscardStep<LoadedDiscardCollection>> {
  if (collection.errors.length > 0 || collection.snapshot === null) {
    return discardStepFailure(result(options, false, [], collection.errors));
  }
  if (!collection.sources.some((source) => source.id === options.id)) {
    return discardStepFailure(
      result(
        options,
        false,
        [],
        [`${options.id} investigation report does not exist`]
      )
    );
  }
  const validatedCollection: ValidatedInvestigationCollection = {
    ...collection,
    snapshot: collection.snapshot
  };
  try {
    return discardStepValue({
      collection: validatedCollection,
      ...facts,
      originalIndexText: await facts.preparation.read(options.indexPath)
    });
  } catch (error) {
    return discardStepFailure(discardIndexReadFailure(options, error));
  }
}

async function discardFreshnessFailure(
  options: DiscardCollectionOptions,
  collection: ValidatedInvestigationCollection
): Promise<InvestigationReportDiscardResult | null> {
  const freshness = await syncInvestigationStateIndex({
    investigationsDirectory: options.root,
    mode: "check",
    snapshot: collection.snapshot
  });
  return freshness.status === "error"
    ? result(
        options,
        false,
        [],
        investigationIndexDiagnosticMessages(
          freshness.diagnostics,
          options.indexPath
        )
      )
    : null;
}

async function prepareDiscardOwnership(
  options: DiscardCollectionOptions,
  collection: ValidatedInvestigationCollection,
  loaded: LoadedDiscardCollection
): Promise<
  DiscardStep<{
    ownedResources: ResourceTreeScan;
    reportPath: string;
    resourceOwnerPath: string;
    resourceProgress: ResourceMoveProgress;
  }>
> {
  const resourceOwnerPath = path.join(
    options.root,
    investigationResourcesDirectoryName,
    options.id
  );
  const ownedResources = await inspectOwnedResources(
    options.root,
    resourceOwnerPath
  );
  if (ownedResources.errors.length > 0) {
    return discardStepFailure(
      result(options, false, [], ownedResources.errors)
    );
  }
  const errors = await discardOwnershipErrors(
    options,
    collection,
    ownedResources,
    loaded
  );
  const resourceProgress = await prepareResourceSourceProof({
    root: path.dirname(options.root),
    owner: resourceOwnerPath,
    files: ownedResources.resourceIds.map((resourceId) => ({
      path: resourceId.slice(options.id.length + 1)
    })),
    directories: ownedResources.directories
  });
  return errors.length > 0
    ? discardStepFailure(result(options, false, [], errors))
    : discardStepValue({
        ownedResources,
        reportPath: path.join(
          options.root,
          requiredReportSourcePath(collection, options.id)
        ),
        resourceOwnerPath,
        resourceProgress
      });
}

async function discardOwnershipErrors(
  options: DiscardCollectionOptions,
  collection: ValidatedInvestigationCollection,
  ownedResources: ResourceTreeScan,
  loaded: LoadedDiscardCollection
): Promise<string[]> {
  const relationshipErrors = referencesToTarget(collection.states, options.id);
  const resourceErrors = sharedOwnerResourceReferences(
    await readCandidateAuthoringResourceReferences(options.root, {
      failOnInvalidSources: true,
      layout: loaded.layout,
      preparation: loaded.preparation,
      formalReferences: new Map(
        [...collection.states].map(([id, state]) => [
          id,
          new Set(state.resourceIds)
        ])
      )
    }),
    options.id
  );
  const deletionErrors =
    ownedResources.resourceIds.length > 0 && !options.deleteOwnedResources
      ? [
          `${options.id} owns ${ownedResources.resourceIds.length} resource(s); re-run with --delete-owned-resources only after confirming their deletion`
        ]
      : [];
  return [...relationshipErrors, ...resourceErrors, ...deletionErrors];
}

function prepareDiscardCandidate(
  options: DiscardCollectionOptions,
  collection: ValidatedInvestigationCollection
): DiscardStep<{
  sources: InvestigationCollectionSource[];
  states: Map<string, InvestigationIndexState>;
}> {
  const sources = collection.sources.filter(
    (source) => source.id !== options.id
  );
  const states = new Map(
    [...collection.states].filter(([id]) => id !== options.id)
  );
  const relationErrors = validateInvestigationRelationGraph(
    createInvestigationRelationContext(states)
  );
  return relationErrors.length > 0
    ? discardStepFailure(result(options, false, [], relationErrors))
    : discardStepValue({ sources, states });
}

async function discardHistoryFailure(
  options: DiscardCollectionOptions,
  reportSourcePath: string,
  ownedResourceIds: readonly string[]
): Promise<InvestigationReportDiscardResult | null> {
  const recorded = await isRecordedAtHead(
    options.root,
    reportSourcePath,
    ownedResourceIds
  );
  if (recorded.errors.length > 0) {
    return discardHistoryCheckFailure(options, recorded.errors);
  }
  if (recorded.recorded && !options.deleteRecorded) {
    return {
      ...result(
        options,
        false,
        [],
        [
          `Investigation report ${options.id} has entered Git HEAD; confirm that its recorded history should be deleted.`,
          "Re-run with --delete-recorded only after confirming deletion; no files were changed."
        ]
      ),
      requiresRecordedDeletionConfirmation: true
    };
  }
  return null;
}

function discardHistoryCheckFailure(
  options: DiscardCollectionOptions,
  errors: readonly string[]
): InvestigationReportDiscardResult {
  return result(options, false, [], errors, {
    diagnostics: [
      genericInvestigationDiagnostic({
        code: "investigation-report.discard-history-check-unavailable",
        mutation: discardMutation("no-change"),
        reason:
          "the Git history check required before discard could not be completed",
        recovery:
          "restore version-control access, then rerun discard before deleting the report",
        target: options.id
      })
    ],
    mutation: discardMutation("no-change")
  });
}
