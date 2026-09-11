import fs from "node:fs/promises";
import {
  buildStateIndex,
  serializeStateIndex
} from "../../index-runtime/src/index.ts";
import {
  createInvestigationStateSnapshot,
  inspectInvestigationCollectionLayout,
  type InvestigationCollectionLayout
} from "./investigation-index-source.ts";
import {
  createInvestigationStateIndexDefinition,
  investigationIndexDiagnosticMessages,
  syncInvestigationStateIndex
} from "./investigation-state-index.ts";
import { validateInvestigationRelationGraph } from "./relation-validation.ts";
import {
  validateFullInvestigationResources,
  type InvestigationResourceReferencesByReport
} from "./resources.ts";
import {
  sameReferencedResourceIdentity,
  snapshotReferencedInvestigationResources,
  type InvestigationPublishResourceIdentity
} from "./publish-resource-snapshot.ts";
import {
  collectValidatedInvestigationCollection,
  unrecordedPredecessorWarnings,
  type ValidatedInvestigationCollection
} from "./validation.ts";
import type { InvestigationIndexState, InvestigationSource } from "./types.ts";
import type { InvestigationDiagnostic } from "./diagnostics.ts";
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

export type { InvestigationPublishResourceIdentity } from "./publish-resource-snapshot.ts";

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
  formal: ValidatedInvestigationCollection;
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
  if ("errors" in layout) return layout;
  const selectionErrors = selectedCandidateErrors(layout.value, ids);
  if (selectionErrors.length > 0) return preparationFailure(selectionErrors);
  const formalStep = await prepareFormalPublishContext(investigationsDirectory);
  if (formalStep.status === "error") return formalStep;
  const candidateStep = await preparePublishCandidates(
    investigationsDirectory,
    ids,
    formalStep.value
  );
  if (candidateStep.status === "error") return candidateStep;
  const context = candidateStep.value;
  const validation = await validatePublishCollection(
    investigationsDirectory,
    context
  );
  if (validation.status === "error") return validation;
  return await buildPreparedPublication(investigationsDirectory, context);
}

async function buildPreparedPublication(
  investigationsDirectory: string,
  context: CandidatePublishContext
): Promise<InvestigationPublishPreparationResult> {
  const sources = [...context.formal.sources, ...context.candidateSources].sort(
    (left, right) => compareText(left.id, right.id)
  );
  const snapshot = createInvestigationStateSnapshot(
    sources,
    sources.map((source) => requiredPublishState(context.states, source.id))
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

async function prepareFormalPublishContext(
  investigationsDirectory: string
): Promise<PublishPreparationStep<FormalPublishContext>> {
  const formal = await collectValidatedInvestigationCollection(
    investigationsDirectory,
    { allowEmptyCollection: true }
  );
  if (formal.errors.length > 0 || formal.snapshot === null) {
    return preparationFailure(formal.errors, [], formal.warnings);
  }
  const indexExisted = await regularIndexExists(formal.indexPath);
  if ("errors" in indexExisted) return indexExisted;
  if (formal.reportCount > 0 || indexExisted.value) {
    const freshness = await syncInvestigationStateIndex({
      investigationsDirectory,
      mode: "check",
      snapshot: formal.snapshot
    });
    if (freshness.status === "error") {
      return preparationFailure(
        investigationIndexDiagnosticMessages(
          freshness.diagnostics,
          formal.indexPath
        ),
        [],
        formal.warnings
      );
    }
  }
  return {
    status: "ok",
    value: {
      formal,
      indexExisted: indexExisted.value,
      warnings: [...formal.warnings]
    }
  };
}

async function validatePublishCollection(
  investigationsDirectory: string,
  context: CandidatePublishContext
): Promise<PublishPreparationStep<undefined>> {
  const relationErrors = validateInvestigationRelationGraph(context.states);
  if (relationErrors.length > 0) {
    return preparationFailure(relationErrors, [], context.warnings);
  }
  const references: InvestigationResourceReferencesByReport = new Map(
    [...context.states].map(([id, state]) => [id, new Set(state.resourceIds)])
  );
  const resourceValidation = await validateFullInvestigationResources(
    investigationsDirectory,
    references
  );
  if (resourceValidation.errors.length > 0) {
    return preparationFailure(
      resourceValidation.errors,
      [],
      [...context.warnings, ...resourceValidation.warnings]
    );
  }
  context.warnings.push(...resourceValidation.warnings);
  context.warnings.push(
    ...(await unrecordedPredecessorWarnings(
      investigationsDirectory,
      context.states
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
    const layout = await inspectInvestigationCollectionLayout(
      investigationsDirectory
    );
    return layout.errors.length === 0
      ? { status: "ok", value: layout }
      : preparationFailure(layout.errors);
  } catch {
    return preparationFailure([
      "investigation root could not be safely inspected before publish"
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
  for (const id of ids) {
    if (!layout.candidateIds.includes(id)) {
      errors.push(`${id} investigation candidate does not exist`);
    }
  }
  return uniqueSorted(errors);
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

function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    Reflect.get(error, "code") === "ENOENT"
  );
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
