import type { StateSnapshot } from "../../index-runtime/src/index.ts";
import { establishedDecisionMetadataFromSource } from "./decision-metadata.ts";
import { validateDecisionBody } from "./record.ts";
import { decisionRelationConsistencyIssues } from "./relation-graph.ts";
import { prepareDecisionSources } from "./decision-source-revision.ts";
import type {
  DecisionDocument,
  DecisionIndexMetadata,
  DecisionIndexState,
  DecisionMetadata,
  DecisionSource
} from "./types.ts";

const decisionSourceParseConcurrency = 32;

export function decisionIndexState(
  sourcePath: string,
  document: DecisionDocument
): DecisionIndexState {
  const metadata: DecisionMetadata = document.status === "active"
    ? {
        status: "active",
        alignment: document.alignment,
        createdAt: document.createdAt
      }
    : {
        status: "archived",
        alignment: document.alignment,
        createdAt: document.createdAt
      };
  return {
    sourcePath,
    title: document.title,
    ...metadata,
    purpose: document.purpose,
    background: document.background,
    decision: document.decision,
    tags: [...document.tags],
    relations: document.relations.map(({ type, target }) => ({ type, target }))
  };
}

export async function buildDecisionStateSnapshotFromSources(
  sources: readonly DecisionSource[],
  signal?: AbortSignal
): Promise<StateSnapshot<DecisionIndexState, DecisionIndexMetadata>> {
  const prepared = prepareDecisionSources(sources);
  const states: Array<{ decisionId: string; state: DecisionIndexState }> = [];
  for (
    let offset = 0;
    offset < prepared.sources.length;
    offset += decisionSourceParseConcurrency
  ) {
    if (signal?.aborted === true) {
      throw new Error("decision state projection was aborted");
    }
    const batch = prepared.sources.slice(offset, offset + decisionSourceParseConcurrency);
    states.push(...await Promise.all(batch.map(async (source) => ({
      decisionId: source.decisionId,
      state: await parseDecisionSource(source, prepared.decisionIds)
    }))));
  }

  const relationIssues = decisionRelationConsistencyIssues(states.map(({ decisionId, state }) => ({
    decisionId,
    projection: state,
    sourcePath: state.sourcePath,
    status: state.status
  })));
  if (relationIssues.length > 0) {
    throw new Error(relationIssues.map((issue) => issue.message).join("; "));
  }

  return {
    metadata: {},
    sourceRevision: prepared.revision,
    states: Object.fromEntries(states.map(({ decisionId, state }) => [decisionId, state]))
  };
}

async function parseDecisionSource(
  source: DecisionSource,
  decisionIds: ReadonlySet<string>
): Promise<DecisionIndexState> {
  const errors: string[] = [];
  const candidate = await validateDecisionBody({
    body: source.text,
    decisionId: source.decisionId,
    errors,
    sourcePath: source.sourcePath,
    targetExists: (targetId) => decisionIds.has(targetId)
  });
  const metadata = candidate === null
    ? null
    : establishedDecisionMetadataFromSource(candidate);
  if (candidate === null || metadata === null || errors.length > 0) {
    throw new Error(
      errors.length > 0
        ? errors.join("; ")
        : `${source.sourcePath} does not contain established decision metadata`
    );
  }

  return decisionIndexState(source.sourcePath, {
    title: candidate.title,
    purpose: candidate.purpose,
    background: candidate.background,
    decision: candidate.decision,
    tags: candidate.tags,
    relations: candidate.relations,
    ...metadata
  });
}
