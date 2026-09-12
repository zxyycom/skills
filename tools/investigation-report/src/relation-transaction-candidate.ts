import { buildInvestigationReportState } from "./report-validation.ts";
import { relationReview, relationSetsEqual } from "./relation-review.ts";
import { validateInvestigationRelationGraph } from "./relation-validation.ts";
import { buildRelationIndex } from "./relation-transaction-protection.ts";
import {
  parseInvestigationReport,
  replaceInvestigationReportRelations
} from "./markdown.ts";
import type {
  InvestigationIndexState,
  InvestigationRelationReplacement,
  InvestigationSource
} from "./types.ts";
import type {
  LoadedRelationContext,
  RelationTransactionOptions
} from "./relation-transaction-preparation.ts";
import {
  relationPhaseResult,
  relationResult,
  type RelationPhase
} from "./relation-transaction-support.ts";

export type CandidateRelationContext = LoadedRelationContext &
  Readonly<{
    candidateSources: InvestigationSource[];
    candidateStates: Map<string, InvestigationIndexState>;
    changedSources: string[];
    nextIndexText: string;
    relationReview: import("./types.ts").InvestigationRelationReview;
  }>;

type PreparedRelationCandidate = Readonly<{
  candidateSources: InvestigationSource[];
  candidateStates: Map<string, InvestigationIndexState>;
  changedSources: string[];
  relationReview: import("./types.ts").InvestigationRelationReview;
}>;

/** Builds, validates, and reviews the complete candidate relation collection. */
export async function buildRelationCandidate(
  options: RelationTransactionOptions,
  loaded: LoadedRelationContext
): Promise<RelationPhase<CandidateRelationContext>> {
  const candidateSet = buildCandidateRelationSources(options, loaded);
  if (candidateSet.status === "result") return candidateSet;
  const prepared = prepareRelationCandidate(
    options,
    loaded,
    candidateSet.value
  );
  if (prepared.status === "result") return prepared;
  return await buildCandidateContext(options, loaded, prepared.value);
}

function prepareRelationCandidate(
  options: RelationTransactionOptions,
  loaded: LoadedRelationContext,
  candidateSet: Extract<
    ReturnType<typeof buildCandidateRelationSources>,
    { status: "ready" }
  >["value"]
): RelationPhase<PreparedRelationCandidate> {
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
  const review = replacementReview(options, loaded, candidateStates);
  if (changedSources.length === 0) {
    return relationPhaseResult(
      relationResult(false, loaded.sourceIds, options.indexPath, [], {
        preflight: options.preflight,
        relationReview: review
      })
    );
  }
  return {
    status: "ready",
    value: {
      candidateSources,
      candidateStates,
      changedSources,
      relationReview: review
    }
  };
}

async function buildCandidateContext(
  options: RelationTransactionOptions,
  loaded: LoadedRelationContext,
  candidate: PreparedRelationCandidate
): Promise<RelationPhase<CandidateRelationContext>> {
  const nextIndex = await buildRelationIndex(
    options,
    candidate.candidateSources,
    candidate.candidateStates
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
      ...candidate,
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
  if (state === undefined)
    throw new Error(
      `validated relation collection is missing state for ${investigationId}`
    );
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
  if (parsed.report === null || parsed.errors.length > 0)
    return { errors: parsed.errors };
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

function replacementReview(
  options: RelationTransactionOptions,
  loaded: LoadedRelationContext,
  states: ReadonlyMap<string, InvestigationIndexState>
): import("./types.ts").InvestigationRelationReview {
  return relationReview(
    options.preflight ? "preflight" : "committed",
    loaded.sourceIds.map((sourceId) => {
      const before = requiredRelationState(
        loaded.collection.states,
        sourceId
      ).relations;
      const after = requiredRelationState(states, sourceId).relations;
      return {
        sourceId,
        before,
        after,
        action: relationSetsEqual(before, after) ? "unchanged" : "replace"
      };
    })
  );
}
