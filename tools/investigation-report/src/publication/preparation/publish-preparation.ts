import { discoverInvestigationCandidates } from "../../candidates/candidate-discovery.ts";
import { prepareFormalPublishContext } from "./publish-preparation-formal.ts";
import {
  buildStateIndex,
  serializeStateIndex
} from "../../../../index-runtime/src/index.ts";
import { type InvestigationCollectionLayout } from "../../index/investigation-index-source.ts";
import {
  createInvestigationStateIndexDefinition,
  investigationIndexDiagnosticMessages
} from "../../index/investigation-state-index.ts";
import { validateInvestigationRelationGraph } from "../../relations/relation-validation.ts";
import { createInvestigationRelationContext } from "../../relations/relation-context.ts";
import {
  validateReferencedInvestigationResources,
  validateInvestigationResourceOwnership,
  type InvestigationResourceReferencesByReport
} from "../../resources/resources.ts";
import {
  sameReferencedResourceIdentity,
  snapshotReferencedInvestigationResources,
  type InvestigationPublishResourceIdentity
} from "../publish-resource-snapshot.ts";
import { unrecordedPredecessorWarnings } from "../../records/validation/validation.ts";
import type {
  InvestigationIndexState,
  InvestigationSource
} from "../../types.ts";
import {
  diagnosticFromError,
  type InvestigationDiagnostic
} from "../../diagnostics.ts";
import {
  publicationSnapshot,
  readPublishedInvestigationDependencies,
  type PublishedInvestigationIndex,
  type PublishedInvestigationSnapshot
} from "./published-preparation.ts";
import { preparePublishCandidates } from "./publish-preparation-candidates.ts";

export type InvestigationPublishPreparation = Readonly<{
  candidatePaths: Map<string, string>;
  candidateSources: InvestigationSource[];
  formalSources: InvestigationSource[];
  indexExisted: boolean;
  indexPath: string;
  nextIndexText: string;
  resourceSnapshot: readonly InvestigationPublishResourceIdentity[];
  sources: InvestigationSource[];
  states: Map<string, InvestigationIndexState>;
  warnings: string[];
}>;

export type { InvestigationPublishResourceIdentity } from "../publish-resource-snapshot.ts";

export type InvestigationPublishPreparationResult =
  | Readonly<{
      diagnostics: InvestigationDiagnostic[];
      errors: [];
      status: "ok";
      value: InvestigationPublishPreparation;
      warnings: string[];
    }>
  | Readonly<{
      diagnostics: InvestigationDiagnostic[];
      errors: string[];
      status: "error";
      warnings: string[];
    }>;

export type PublishPreparationFailure = Extract<
  InvestigationPublishPreparationResult,
  { status: "error" }
>;
export type PublishPreparationStep<T> =
  | PublishPreparationFailure
  | { status: "ok"; value: T };
export type FormalPublishContext = Readonly<{
  formal: Readonly<{
    indexPath: string;
    sources: InvestigationSource[];
    states: Map<string, InvestigationIndexState>;
    snapshot: PublishedInvestigationSnapshot;
    publishedIndex: PublishedInvestigationIndex | null;
  }>;
  layout: InvestigationCollectionLayout;
  indexExisted: boolean;
  warnings: string[];
}>;
export type CandidatePublishContext = FormalPublishContext & {
  candidatePaths: Map<string, string>;
  candidateSources: InvestigationSource[];
  states: Map<string, InvestigationIndexState>;
};

/**
 * Builds the exact final formal collection for a selected candidate batch.
 * It owns only read-only publication gates; the mutation module re-runs it
 * under the collection lock before changing candidate names or the index.
 */
export async function prepareInvestigationPublish(
  investigationsDirectory: string,
  ids: readonly string[]
): Promise<InvestigationPublishPreparationResult> {
  const layout = await readLayout(investigationsDirectory);
  if ("errors" in layout) {
    return layout;
  }
  const selectionErrors = selectedCandidateErrors(layout.value, ids);
  if (selectionErrors.length > 0) {
    return preparationFailure(selectionErrors);
  }
  const formalStep = await prepareFormalPublishContext(
    investigationsDirectory,
    layout.value
  );
  if (formalStep.status === "error") {
    return formalStep;
  }
  const candidateStep = await preparePublishCandidates(
    investigationsDirectory,
    ids,
    formalStep.value
  );
  if (candidateStep.status === "error") {
    return candidateStep;
  }
  const dependencyStep = await preparePublicationDependencies(
    investigationsDirectory,
    ids,
    candidateStep.value
  );
  if (dependencyStep.status === "error") {
    return dependencyStep;
  }
  const context = dependencyStep.value;
  const validation = await validatePublishCollection(
    investigationsDirectory,
    context
  );
  if (validation.status === "error") {
    return validation;
  }
  return await buildPreparedPublication(investigationsDirectory, context);
}

async function buildPreparedPublication(
  investigationsDirectory: string,
  context: CandidatePublishContext
): Promise<InvestigationPublishPreparationResult> {
  const sources = [...context.formal.sources, ...context.candidateSources].sort(
    (left, right) => compareText(left.id, right.id)
  );
  const snapshot = publicationSnapshot(
    context.formal.snapshot,
    context.states,
    sources
  );
  const definition = createInvestigationStateIndexDefinition({ snapshot });
  const builtIndex = await buildStateIndex(definition, {
    root: investigationsDirectory
  });
  if (builtIndex.status === "error") {
    return preparationFailure(
      investigationIndexDiagnosticMessages(
        builtIndex.diagnostics,
        context.formal.indexPath
      ),
      [],
      context.warnings
    );
  }

  const resourceSnapshot = await snapshotReferencedInvestigationResources(
    investigationsDirectory,
    context.candidateSources.flatMap(
      (source) => requiredPublishState(context.states, source.id).resourceIds
    )
  );
  if (resourceSnapshot.status === "error") {
    return preparationFailure(resourceSnapshot.errors, [], context.warnings);
  }
  return {
    diagnostics: [],
    errors: [],
    status: "ok",
    value: {
      candidatePaths: context.candidatePaths,
      candidateSources: context.candidateSources,
      formalSources: context.formal.sources,
      indexExisted: context.indexExisted,
      indexPath: context.formal.indexPath,
      nextIndexText: serializeStateIndex(builtIndex.value, definition),
      resourceSnapshot: resourceSnapshot.value,
      sources,
      states: context.states,
      warnings: uniqueSorted(context.warnings)
    },
    warnings: uniqueSorted(context.warnings)
  };
}

function requiredPublishState(
  states: ReadonlyMap<string, InvestigationIndexState>,
  investigationId: string
): InvestigationIndexState {
  const state = states.get(investigationId);
  if (state === undefined) {
    throw new Error(
      `validated publish collection is missing state for ${investigationId}`
    );
  }
  return state;
}

async function validatePublishCollection(
  investigationsDirectory: string,
  context: CandidatePublishContext
): Promise<PublishPreparationStep<undefined>> {
  const relationErrors = validateInvestigationRelationGraph(
    createInvestigationRelationContext(context.states)
  );
  if (relationErrors.length > 0) {
    return preparationFailure(relationErrors, [], context.warnings);
  }
  const references: InvestigationResourceReferencesByReport = new Map(
    [...context.states].map(([id, state]) => [id, new Set(state.resourceIds)])
  );
  const ownershipErrors = validateInvestigationResourceOwnership(
    [...context.states.values()].flatMap((state) => state.resourceIds),
    references
  );
  const resourceErrors = await validateReferencedInvestigationResources(
    investigationsDirectory,
    context.candidateSources.flatMap(
      (source) => context.states.get(source.id)!.resourceIds
    )
  );
  if (ownershipErrors.length + resourceErrors.length > 0)
    return preparationFailure(
      [...ownershipErrors, ...resourceErrors],
      [],
      context.warnings
    );
  context.warnings.push(
    ...(await unrecordedPredecessorWarnings(
      investigationsDirectory,
      new Map(
        context.candidateSources.map((source) => [
          source.id,
          context.states.get(source.id)!
        ])
      )
    ))
  );
  return { status: "ok", value: undefined };
}

/** Rechecks only member identity, deliberately not resource bytes. */
export async function resourceSnapshotStillCurrent(
  investigationsDirectory: string,
  expected: readonly InvestigationPublishResourceIdentity[]
): Promise<string[]> {
  const current = await snapshotReferencedInvestigationResources(
    investigationsDirectory,
    expected.map((resource) => resource.id)
  );
  if (current.status === "error") return current.errors;
  const unchanged = sameReferencedResourceIdentity(expected, current.value);
  return unchanged
    ? []
    : [
        "selected candidate resources changed identity after publish preparation; no files were written"
      ];
}

async function readLayout(
  investigationsDirectory: string
): Promise<
  | Readonly<{ status: "ok"; value: InvestigationCollectionLayout }>
  | InvestigationPublishPreparationResult
> {
  try {
    const layout = await discoverInvestigationCandidates(
      investigationsDirectory
    );
    return layout.errors.length === 0
      ? { status: "ok", value: layout }
      : preparationFailure(layout.errors);
  } catch (error) {
    return preparationFailure([
      "investigation root could not be safely inspected before publish: " +
        (error instanceof Error ? error.message : "unavailable") +
        "; repair sources and explicitly sync-index"
    ]);
  }
}

function selectedCandidateErrors(
  layout: InvestigationCollectionLayout,
  ids: readonly string[]
): string[] {
  const selected = new Set(ids);
  const errors: string[] = [];
  if (ids.length === 0)
    errors.push("publish requires at least one Investigation ID");
  if (selected.size !== ids.length) errors.push("publish IDs must not repeat");
  const candidateIds = new Set(layout.candidateIds);
  for (const id of ids) {
    if (!candidateIds.has(id)) {
      errors.push(`${id} investigation candidate does not exist`);
    }
  }
  return uniqueSorted(errors);
}

export function preparationFailure(
  errors: readonly string[],
  diagnostics: readonly InvestigationDiagnostic[] = [],
  warnings: readonly string[] = []
): PublishPreparationFailure {
  return {
    diagnostics: [...diagnostics],
    errors: uniqueSorted(errors),
    status: "error",
    warnings: uniqueSorted(warnings)
  };
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

async function preparePublicationDependencies(
  investigationsDirectory: string,
  ids: readonly string[],
  context: CandidatePublishContext
): Promise<PublishPreparationStep<CandidatePublishContext>> {
  if (context.formal.publishedIndex !== null) {
    try {
      const sources = await readPublishedInvestigationDependencies(
        investigationsDirectory,
        context.formal.publishedIndex,
        ids,
        context.formal.sources
      );
      return {
        status: "ok",
        value: { ...context, formal: { ...context.formal, sources } }
      };
    } catch (error) {
      return preparationFailure(
        [
          error instanceof Error
            ? error.message
            : "required published dependencies could not be read"
        ],
        [
          diagnosticFromError({
            code: "investigation-report.publish-dependency-read-failed",
            error,
            reason: "a selected publication dependency could not be validated",
            recovery:
              "restore the selected dependency and synchronize intentional formal edits before retrying publish",
            target: investigationsDirectory
          })
        ]
      );
    }
  }
  return { status: "ok", value: context };
}
