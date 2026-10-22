import {
  expectationOf,
  parseStateIndex
} from "../../index-runtime/src/index.ts";
import {
  investigationIndexDiagnosticMessages,
  createInvestigationStateIndexDefinition
} from "./investigation-state-index.ts";
import type { InvestigationRelationSummaryInput } from "./relation-summary.ts";
import {
  publicationDependencyIds,
  publishedGraphErrors,
  readPublishedInvestigationDependencies,
  type PublishedInvestigationIndex,
  type PublishedInvestigationSnapshot
} from "./published-preparation.ts";
import type {
  InvestigationIndexState,
  InvestigationRelationReplacement,
  InvestigationRelationSetResult,
  InvestigationSource
} from "./types.ts";
import {
  protectRelationCollection,
  verifyRelationIndexBytes,
  verifyRelationSourceBytes
} from "./relation-transaction-protection.ts";
import { publishRelationCandidate } from "./relation-transaction-publication.ts";
import { buildRelationCandidate } from "./relation-transaction-candidate.ts";
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
  preflight: boolean;
  write: InvestigationAtomicWriter;
}>;

export type LoadedRelationContext = Readonly<{
  collection: Readonly<{
    sources: InvestigationSource[];
    states: Map<string, InvestigationIndexState>;
    snapshot: PublishedInvestigationSnapshot;
    publishedIndex: PublishedInvestigationIndex;
  }>;
  originalIndexText: string;
  replacements: readonly InvestigationRelationReplacement[];
  sourceById: Map<string, InvestigationSource>;
  sourceIds: string[];
}>;

export async function applyRelationReplacements(
  options: RelationTransactionOptions
): Promise<InvestigationRelationSetResult> {
  const loaded = await loadRelationTransaction(options);
  if (loaded.status === "result") return loaded.result;
  const candidate = await buildRelationCandidate(options, loaded.value);
  if (candidate.status === "result") return candidate.result;
  if (options.preflight)
    return relationResult(
      false,
      candidate.value.sourceIds,
      options.indexPath,
      [],
      {
        preflight: true,
        relationReview: candidate.value.relationReview
      }
    );
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
  const originalIndex = await readOriginalRelationIndex(options, []);
  if (originalIndex.status === "result") return originalIndex;
  const baseline = parseRelationBaseline(options, originalIndex.value);
  if (baseline.status === "result") return baseline;
  const collection = baseline.value;
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
  const dependencies = await readRelationDependencies(
    options,
    collection,
    selected.replacements
  );
  if (dependencies.status === "result") return dependencies;
  return await loadSelectedRelationTransaction(
    options,
    { ...collection, sources: dependencies.value },
    selected.replacements,
    originalIndex.value
  );
}

async function loadSelectedRelationTransaction(
  options: RelationTransactionOptions,
  collection: LoadedRelationContext["collection"],
  replacements: readonly InvestigationRelationReplacement[],
  originalIndexText: string
): Promise<RelationPhase<LoadedRelationContext>> {
  const sourceIds = replacements.map((replacement) => replacement.source);
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
      originalIndexText,
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
          `failed to read current index before relation transaction: ${errorText(error)}; restore access or rebuild a missing index with full sync-index`
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
                "restore read access to the current index, or rebuild a missing index with full sync-index, then retry the relation update",
              target: options.indexPath
            })
          ],
          mutation: relationMutation("no-change")
        }
      )
    );
  }
}

function parseRelationBaseline(
  options: RelationTransactionOptions,
  originalIndexText: string
): RelationPhase<LoadedRelationContext["collection"]> {
  const definition = createInvestigationStateIndexDefinition();
  const loaded = parseStateIndex({
    definition,
    expectation: expectationOf(definition),
    sourcePath: options.indexPath,
    text: originalIndexText
  });
  if (loaded.status === "error")
    return relationPhaseResult(
      relationResult(false, [], options.indexPath, [
        ...investigationIndexDiagnosticMessages(
          loaded.diagnostics,
          options.indexPath
        ),
        "restore the index with full sync-index before retrying set-relations"
      ])
    );
  const states = new Map(Object.entries(loaded.value.entries));
  const errors = publishedGraphErrors(states);
  if (errors.length > 0)
    return relationPhaseResult(
      relationResult(false, [], options.indexPath, errors)
    );
  const collection: LoadedRelationContext["collection"] = {
    sources: [],
    states,
    snapshot: {
      metadata: loaded.value.metadata,
      sourceRevision: loaded.value.sourceRevision,
      states: loaded.value.entries
    },
    publishedIndex: loaded.value
  };
  return { status: "ready", value: collection };
}

async function readRelationDependencies(
  options: RelationTransactionOptions,
  collection: LoadedRelationContext["collection"],
  replacements: readonly InvestigationRelationReplacement[]
): Promise<RelationPhase<InvestigationSource[]>> {
  const selectedIds = new Set(
    replacements.map((replacement) => replacement.source)
  );
  const nextStates = replacementRelationStates(collection.states, replacements);
  const dependencies = [
    ...new Set([
      ...publicationDependencyIds(collection.states, selectedIds),
      ...publicationDependencyIds(nextStates, selectedIds)
    ])
  ].sort();
  let sources: InvestigationSource[];
  try {
    sources = await readPublishedInvestigationDependencies(
      options.root,
      collection.publishedIndex,
      dependencies
    );
  } catch (error) {
    return relationDependencyFailure(options, selectedIds, error);
  }
  return { status: "ready", value: sources };
}

function replacementRelationStates(
  states: ReadonlyMap<string, InvestigationIndexState>,
  replacements: readonly InvestigationRelationReplacement[]
): Map<string, InvestigationIndexState> {
  const nextStates = new Map(states);
  for (const replacement of replacements) {
    const state = nextStates.get(replacement.source);
    if (state !== undefined)
      nextStates.set(replacement.source, {
        ...state,
        relations: [...replacement.relations]
      });
  }
  return nextStates;
}

function relationDependencyFailure(
  options: RelationTransactionOptions,
  selectedIds: ReadonlySet<string>,
  error: unknown
): RelationPhase<never> {
  return relationPhaseResult(
    relationResult(
      false,
      [...selectedIds],
      options.indexPath,
      [errorText(error)],
      {
        diagnostics: [
          diagnosticFromError({
            code: "investigation-report.relation-dependency-read-failed",
            error,
            reason: "a selected relation dependency could not be validated",
            recovery:
              "restore the selected dependency and synchronize intentional formal edits before retrying set-relations",
            target: options.root
          })
        ]
      }
    )
  );
}
