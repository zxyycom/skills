import {
  investigationIndexDiagnosticMessages,
  syncInvestigationStateIndex
} from "./investigation-state-index.ts";
import type { InvestigationRelationSummaryInput } from "./relation-summary.ts";
import {
  collectValidatedInvestigationCollection,
  type ValidatedInvestigationCollection
} from "./validation.ts";
import type {
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
  collection: ValidatedInvestigationCollection;
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
