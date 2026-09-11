import {
  investigationIndexDiagnosticMessages,
  syncInvestigationStateIndex
} from "./investigation-state-index.ts";
import { validateInvestigationRelationGraph } from "./relation-validation.ts";
import type { InvestigationRelationSummaryInput } from "./relation-summary.ts";
import {
  parseInvestigationReport,
  replaceInvestigationReportRelations
} from "./markdown.ts";
import { buildInvestigationReportState } from "./report-validation.ts";
import {
  collectValidatedInvestigationCollection,
  type ValidatedInvestigationCollection
} from "./validation.ts";
import type {
  InvestigationIndexState,
  InvestigationRelationReplacement,
  InvestigationRelationSetResult,
  InvestigationSource
} from "./types.ts";
import {
  buildRelationIndex,
  protectRelationCollection,
  verifyRelationIndexBytes,
  verifyRelationSourceBytes
} from "./relation-transaction-protection.ts";
import { publishRelationCandidate } from "./relation-transaction-publication.ts";
import { diagnosticFromError } from "./diagnostics.ts";
import {
  errorText,
  readRegularText,
  relationMutation,
  relationPhaseResult,
  relationResult,
  resolveRelationSelectors,
  type RelationPhase
} from "./relation-transaction-support.ts";
import type {
  BeforeRelationPublish,
  InvestigationAtomicWriter
} from "./relation-transaction.ts";

export type RelationTransactionOptions = Readonly<{
  beforePublish: BeforeRelationPublish;
  indexPath: string;
  replacements: readonly InvestigationRelationReplacement[];
  relationSummaryGroups: readonly (readonly InvestigationRelationSummaryInput[])[];
  root: string;
  write: InvestigationAtomicWriter;
}>;

type LoadedRelationContext = Readonly<{
  collection: ValidatedInvestigationCollection;
  originalIndexText: string;
  replacements: readonly InvestigationRelationReplacement[];
  sourceById: Map<string, InvestigationSource>;
  sourceIds: string[];
}>;

export type CandidateRelationContext = LoadedRelationContext & {
  candidateSources: InvestigationSource[];
  candidateStates: Map<string, InvestigationIndexState>;
  changedSources: string[];
  nextIndexText: string;
};

export async function applyRelationReplacements(
  options: RelationTransactionOptions
): Promise<InvestigationRelationSetResult> {
  const loaded = await loadRelationTransaction(options);
  if (loaded.status === "result") return loaded.result;
  const candidate = await buildRelationCandidate(options, loaded.value);
  if (candidate.status === "result") return candidate.result;
  await options.beforePublish();
  const protectedCollection = await protectRelationCollection(
    options,
    candidate.value
  );
  if (protectedCollection.status === "result")
    return protectedCollection.result;
  const sourceBytes = await verifyRelationSourceBytes(options, candidate.value);
  if (sourceBytes.status === "result") return sourceBytes.result;
  const indexFailure = await verifyRelationIndexBytes(options, candidate.value);
  if (indexFailure !== null) return indexFailure;
  return await publishRelationCandidate(
    options,
    candidate.value,
    sourceBytes.value
  );
}

async function loadRelationTransaction(
  options: RelationTransactionOptions
): Promise<RelationPhase<LoadedRelationContext>> {
  const collection = await collectValidatedInvestigationCollection(
    options.root
  );
  if (collection.errors.length > 0 || collection.snapshot === null) {
    return relationPhaseResult(
      relationResult(false, [], options.indexPath, collection.errors)
    );
  }
  const selected = resolveRelationSelectors(
    options.replacements,
    collection.states,
    options.relationSummaryGroups
  );
  if (selected.status === "error") {
    return relationPhaseResult(
      relationResult(false, [], options.indexPath, selected.errors)
    );
  }
  const completeCollection = {
    ...collection,
    snapshot: collection.snapshot
  } as ValidatedInvestigationCollection & {
    snapshot: NonNullable<ValidatedInvestigationCollection["snapshot"]>;
  };
  return await loadSelectedRelationTransaction(
    options,
    completeCollection,
    selected.replacements
  );
}

async function loadSelectedRelationTransaction(
  options: RelationTransactionOptions,
  collection: ValidatedInvestigationCollection & {
    snapshot: NonNullable<ValidatedInvestigationCollection["snapshot"]>;
  },
  replacements: readonly InvestigationRelationReplacement[]
): Promise<RelationPhase<LoadedRelationContext>> {
  const sourceIds = replacements.map((replacement) => replacement.source);
  const originalIndex = await readOriginalRelationIndex(options, sourceIds);
  if (originalIndex.status === "result") return originalIndex;
  const freshnessFailure = await relationFreshnessFailure(
    options,
    sourceIds,
    collection.snapshot
  );
  if (freshnessFailure !== null) return relationPhaseResult(freshnessFailure);
  const sourceById = new Map(
    collection.sources.map((source) => [source.id, source])
  );
  const missingSource = sourceIds.find((source) => !sourceById.has(source));
  if (missingSource !== undefined) {
    return relationPhaseResult(
      relationResult(false, sourceIds, options.indexPath, [
        `${missingSource} investigation report does not exist`
      ])
    );
  }
  return {
    status: "ready",
    value: {
      collection,
      originalIndexText: originalIndex.value,
      replacements,
      sourceById,
      sourceIds
    }
  };
}

async function readOriginalRelationIndex(
  options: RelationTransactionOptions,
  sourceIds: readonly string[]
): Promise<RelationPhase<string>> {
  try {
    return { status: "ready", value: await readRegularText(options.indexPath) };
  } catch (error) {
    return relationPhaseResult(
      relationResult(
        false,
        sourceIds,
        options.indexPath,
        [
          `failed to read current index before relation transaction: ${errorText(error)}`
        ],
        {
          diagnostics: [
            diagnosticFromError({
              code: "investigation-report.relation-index-read-failed",
              error,
              mutation: relationMutation("no-change"),
              reason:
                "the current investigation index could not be read before the relation transaction",
              recovery:
                "restore read access to the current index, then retry the relation update",
              target: options.indexPath
            })
          ],
          mutation: relationMutation("no-change")
        }
      )
    );
  }
}

async function relationFreshnessFailure(
  options: RelationTransactionOptions,
  sourceIds: readonly string[],
  snapshot: NonNullable<ValidatedInvestigationCollection["snapshot"]>
): Promise<InvestigationRelationSetResult | null> {
  const freshness = await syncInvestigationStateIndex({
    investigationsDirectory: options.root,
    mode: "check",
    snapshot
  });
  if (freshness.status === "error") {
    return relationResult(
      false,
      sourceIds,
      options.indexPath,
      investigationIndexDiagnosticMessages(
        freshness.diagnostics,
        options.indexPath
      )
    );
  }
  return null;
}

async function buildRelationCandidate(
  options: RelationTransactionOptions,
  loaded: LoadedRelationContext
): Promise<RelationPhase<CandidateRelationContext>> {
  const candidateSet = buildCandidateRelationSources(options, loaded);
  if (candidateSet.status === "result") return candidateSet;
  return await validateRelationCandidate(options, loaded, candidateSet.value);
}

async function validateRelationCandidate(
  options: RelationTransactionOptions,
  loaded: LoadedRelationContext,
  candidateSet: Extract<
    ReturnType<typeof buildCandidateRelationSources>,
    { status: "ready" }
  >["value"]
): Promise<RelationPhase<CandidateRelationContext>> {
  const { candidateSources, candidateStates } = candidateSet;
  const relationErrors = validateInvestigationRelationGraph(candidateStates);
  if (relationErrors.length > 0) {
    return relationPhaseResult(
      relationResult(false, loaded.sourceIds, options.indexPath, relationErrors)
    );
  }
  const candidateById = new Map(
    candidateSources.map((source) => [source.id, source])
  );
  const changedSources = loaded.sourceIds.filter(
    (id) => loaded.sourceById.get(id)?.text !== candidateById.get(id)?.text
  );
  if (changedSources.length === 0) {
    return relationPhaseResult(
      relationResult(false, loaded.sourceIds, options.indexPath, [])
    );
  }
  const nextIndex = await buildRelationIndex(
    options,
    candidateSources,
    candidateStates
  );
  if ("errors" in nextIndex) {
    return relationPhaseResult(
      relationResult(
        false,
        loaded.sourceIds,
        options.indexPath,
        nextIndex.errors
      )
    );
  }
  return {
    status: "ready",
    value: {
      ...loaded,
      candidateSources,
      candidateStates,
      changedSources,
      nextIndexText: nextIndex.text
    }
  };
}

function buildCandidateRelationSources(
  options: RelationTransactionOptions,
  loaded: LoadedRelationContext
): RelationPhase<{
  candidateSources: InvestigationSource[];
  candidateStates: Map<string, InvestigationIndexState>;
}> {
  const replacementBySource = new Map(
    loaded.replacements.map((replacement) => [replacement.source, replacement])
  );
  const candidateSources: InvestigationSource[] = [];
  const candidateStates = new Map<string, InvestigationIndexState>();
  for (const source of loaded.collection.sources) {
    const candidate = candidateRelationSource(
      source,
      replacementBySource.get(source.id),
      requiredRelationState(loaded.collection.states, source.id)
    );
    if ("errors" in candidate) {
      return relationPhaseResult(
        relationResult(
          false,
          loaded.sourceIds,
          options.indexPath,
          candidate.errors
        )
      );
    }
    candidateSources.push(candidate.source);
    candidateStates.set(source.id, candidate.state);
  }
  return { status: "ready", value: { candidateSources, candidateStates } };
}

function requiredRelationState(
  states: ReadonlyMap<string, InvestigationIndexState>,
  investigationId: string
): InvestigationIndexState {
  const state = states.get(investigationId);
  if (state === undefined) {
    throw new Error(
      `validated relation collection is missing state for ${investigationId}`
    );
  }
  return state;
}

function candidateRelationSource(
  source: InvestigationSource,
  replacement: InvestigationRelationReplacement | undefined,
  currentState: InvestigationIndexState
):
  | { errors: string[] }
  | { source: InvestigationSource; state: InvestigationIndexState } {
  if (replacement === undefined) return { source, state: currentState };
  const parsed = parseInvestigationReport(source.text, source.id);
  if (parsed.report === null || parsed.errors.length > 0) {
    return { errors: parsed.errors };
  }
  const nextText = replaceInvestigationReportRelations(
    source.text,
    parsed.report,
    replacement.relations
  );
  const built = buildInvestigationReportState(
    source.id,
    parseInvestigationReport(nextText, source.id),
    source.sourcePath
  );
  return built.status === "invalid"
    ? { errors: built.errors }
    : {
        source: {
          id: source.id,
          sourcePath: source.sourcePath,
          text: nextText
        },
        state: built.state
      };
}
