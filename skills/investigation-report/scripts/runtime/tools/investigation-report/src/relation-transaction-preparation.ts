/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/relation-transaction-preparation.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/relation-transaction-preparation.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/relation-transaction-preparation.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
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
  InvestigationSource
} from "./types.ts";
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

export async function loadRelationTransaction(
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
