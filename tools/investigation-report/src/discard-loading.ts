import { readLocalPublication } from "./local-publication.ts";
import { validatePublishedDependency } from "./published-preparation.ts";
import { InvestigationPreparation } from "./strict-preparation.ts";
import path from "node:path";
import { buildDiscardIndexText } from "./discard-index-projection.ts";
import { prepareResourceSourceProof } from "./rename-resource-proof.ts";

import type { ResourceMoveProgress } from "./rename-contract.ts";
import { genericInvestigationDiagnostic } from "./diagnostics.ts";
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
  }>
): Promise<InvestigationReportDiscardResult> {
  const preparation =
    acquisition?.preparation ??
    new InvestigationPreparation(path.dirname(options.root), options.root);
  let current: Awaited<ReturnType<typeof readLocalPublication>>;
  try {
    const baseline = await readLocalPublication(options.root, [], preparation);
    const selected = resolveInvestigationSelector(
      [...baseline.states].map(([id, state]) => ({ id, name: state.name })),
      options.id
    );
    if (selected.status === "error")
      return result(options, false, [], selected.errors);
    options = { ...options, id: selected.id };
    const state = baseline.states.get(selected.id)!;
    const source = {
      id: selected.id,
      sourcePath: state.sourcePath,
      text: await preparation.read(path.join(options.root, state.sourcePath))
    };
    validatePublishedDependency(baseline.index, state, source);
    current = { ...baseline, sources: [source] };
  } catch (error) {
    return result(
      options,
      false,
      [],
      [
        error instanceof Error
          ? error.message
          : "published index or selected report could not be read"
      ]
    );
  }
  const loaded = await loadDiscardCollection(options, current, {
    preparation
  });
  if (!loaded.ok) return loaded.result;
  return await prepareLoadedDiscard(options, loaded.value);
}

async function prepareLoadedDiscard(
  options: DiscardCollectionOptions,
  loaded: LoadedDiscardCollection
): Promise<InvestigationReportDiscardResult> {
  const collection = loaded.collection;
  const ownership = await prepareDiscardOwnership(options, collection);
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
  const indexText = await buildDiscardIndexText(options, {
    ...candidate.value,
    baseline: collection.snapshot
  });
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
  facts: Pick<LoadedDiscardCollection, "preparation">
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
      originalIndexText: await facts.preparation.readOrCaptured(
        options.indexPath
      )
    });
  } catch (error) {
    return discardStepFailure(discardIndexReadFailure(options, error));
  }
}

async function prepareDiscardOwnership(
  options: DiscardCollectionOptions,
  collection: ValidatedInvestigationCollection
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
  const errors = discardOwnershipErrors(options, collection, ownedResources);
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

function discardOwnershipErrors(
  options: DiscardCollectionOptions,
  collection: ValidatedInvestigationCollection,
  ownedResources: ResourceTreeScan
): string[] {
  const relationshipErrors = referencesToTarget(collection.states, options.id);
  const resourceErrors = sharedOwnerResourceReferences(
    new Map(
      [...collection.states].map(([id, state]) => [
        id,
        new Set(state.resourceIds)
      ])
    ),
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
  states: Map<string, InvestigationIndexState>;
}> {
  const states = new Map(
    [...collection.states].filter(([id]) => id !== options.id)
  );
  const relationErrors = validateInvestigationRelationGraph(
    createInvestigationRelationContext(states)
  );
  return relationErrors.length > 0
    ? discardStepFailure(result(options, false, [], relationErrors))
    : discardStepValue({ states });
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
