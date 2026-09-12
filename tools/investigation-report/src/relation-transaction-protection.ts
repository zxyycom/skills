import {
  diagnosticFromError,
  genericInvestigationDiagnostic
} from "./diagnostics.ts";
import {
  buildStateIndex,
  serializeStateIndex
} from "../../index-runtime/src/index.ts";
import {
  createInvestigationStateSnapshot,
  sameInvestigationSources
} from "./investigation-index-source.ts";
import {
  createInvestigationStateIndexDefinition,
  investigationIndexDiagnosticMessages
} from "./investigation-state-index.ts";
import path from "node:path";
import {
  collectValidatedInvestigationCollection,
  type ValidatedInvestigationCollection
} from "./validation.ts";
import type {
  InvestigationIndexState,
  InvestigationRelationSetResult,
  InvestigationSource
} from "./types.ts";
import {
  errorText,
  readRegularText,
  relationMutation,
  relationPhaseResult,
  relationResult,
  type RelationPhase
} from "./relation-transaction-support.ts";
import type { CandidateRelationContext } from "./relation-transaction-candidate.ts";
import type { RelationTransactionOptions } from "./relation-transaction-preparation.ts";

export async function buildRelationIndex(
  options: RelationTransactionOptions,
  candidateSources: readonly InvestigationSource[],
  candidateStates: ReadonlyMap<string, InvestigationIndexState>
): Promise<{ errors: string[] } | { text: string }> {
  const snapshot = createInvestigationStateSnapshot(
    candidateSources,
    candidateSources.map((source) => candidateStates.get(source.id)!)
  );
  const definition = createInvestigationStateIndexDefinition({ snapshot });
  const builtIndex = await buildStateIndex(definition, { root: options.root });
  return builtIndex.status === "error"
    ? {
        errors: investigationIndexDiagnosticMessages(
          builtIndex.diagnostics,
          options.indexPath
        )
      }
    : { text: serializeStateIndex(builtIndex.value, definition) };
}

export async function protectRelationCollection(
  options: RelationTransactionOptions,
  context: CandidateRelationContext
): Promise<RelationPhase<ValidatedInvestigationCollection>> {
  const protectedCollection = await collectValidatedInvestigationCollection(
    options.root
  );
  if (
    protectedCollection.errors.length > 0 ||
    protectedCollection.snapshot === null
  ) {
    return relationPhaseResult(
      invalidProtectedRelationCollection(options, context, protectedCollection)
    );
  }
  if (
    !sameInvestigationSources(
      protectedCollection.sources,
      context.collection.sources
    )
  ) {
    return relationPhaseResult(
      driftedProtectedRelationCollection(options, context)
    );
  }
  return { status: "ready", value: protectedCollection };
}

function invalidProtectedRelationCollection(
  options: RelationTransactionOptions,
  context: CandidateRelationContext,
  collection: ValidatedInvestigationCollection
): InvestigationRelationSetResult {
  return relationResult(
    false,
    context.sourceIds,
    options.indexPath,
    [
      "investigation collection could not be revalidated before relation transaction; no files were written",
      ...collection.errors
    ],
    {
      diagnostics: [
        genericInvestigationDiagnostic({
          code: "investigation-report.relation-source-recheck-failed",
          mutation: relationMutation("no-change"),
          reason:
            "the investigation collection could not be revalidated before relation publication",
          recovery:
            "correct the reported collection problem, then retry from the current collection state",
          target: options.root
        })
      ],
      mutation: relationMutation("no-change")
    }
  );
}

function driftedProtectedRelationCollection(
  options: RelationTransactionOptions,
  context: CandidateRelationContext
): InvestigationRelationSetResult {
  return relationResult(
    false,
    context.sourceIds,
    options.indexPath,
    [
      "investigation collection changed after relation validation; no files were written"
    ],
    {
      diagnostics: [
        genericInvestigationDiagnostic({
          code: "investigation-report.relation-source-drift",
          mutation: relationMutation("no-change"),
          reason:
            "the investigation report sources changed after relation validation",
          recovery:
            "review the concurrent report change, then retry from the current collection state",
          target: options.root
        })
      ],
      mutation: relationMutation("no-change")
    }
  );
}

export async function verifyRelationSourceBytes(
  options: RelationTransactionOptions,
  context: CandidateRelationContext
): Promise<RelationPhase<Map<string, string>>> {
  const originalTextByPath = new Map<string, string>();
  for (const source of context.collection.sources) {
    const verified = await verifyRelationSource(options, context, source);
    if ("result" in verified) return relationPhaseResult(verified.result);
    if (verified.changedPath !== null) {
      originalTextByPath.set(verified.changedPath, verified.text);
    }
  }
  return { status: "ready", value: originalTextByPath };
}

async function verifyRelationSource(
  options: RelationTransactionOptions,
  context: CandidateRelationContext,
  source: InvestigationSource
): Promise<
  | { changedPath: string | null; text: string }
  | { result: InvestigationRelationSetResult }
> {
  const reportPath = path.join(options.root, source.sourcePath);
  try {
    const currentText = await readRegularText(reportPath);
    if (currentText !== source.text) {
      return { result: driftedRelationSource(options, context, source.id) };
    }
    return {
      changedPath: context.changedSources.includes(source.id)
        ? reportPath
        : null,
      text: currentText
    };
  } catch (error) {
    return {
      result: unreadableRelationSource(options, context, source.id, error)
    };
  }
}

function driftedRelationSource(
  options: RelationTransactionOptions,
  context: CandidateRelationContext,
  sourceId: string
): InvestigationRelationSetResult {
  return relationResult(
    false,
    context.sourceIds,
    options.indexPath,
    [`${sourceId} changed after relation validation; no files were written`],
    {
      diagnostics: [
        genericInvestigationDiagnostic({
          code: "investigation-report.relation-source-drift",
          mutation: relationMutation("no-change"),
          reason: `${sourceId} changed after relation validation`,
          recovery:
            "review the concurrent report change, then retry from the current collection state",
          target: sourceId
        })
      ],
      mutation: relationMutation("no-change")
    }
  );
}

function unreadableRelationSource(
  options: RelationTransactionOptions,
  context: CandidateRelationContext,
  sourceId: string,
  error: unknown
): InvestigationRelationSetResult {
  return relationResult(
    false,
    context.sourceIds,
    options.indexPath,
    [
      `${sourceId} could not be verified before relation transaction: ${errorText(error)}`
    ],
    {
      diagnostics: [
        diagnosticFromError({
          code: "investigation-report.relation-source-recheck-failed",
          error,
          mutation: relationMutation("no-change"),
          reason:
            "a report could not be re-read before the relation transaction",
          recovery:
            "restore access to the report and verify its current contents before retrying",
          target: sourceId
        })
      ],
      mutation: relationMutation("no-change")
    }
  );
}

export async function verifyRelationIndexBytes(
  options: RelationTransactionOptions,
  context: CandidateRelationContext
): Promise<InvestigationRelationSetResult | null> {
  let currentIndexText: string;
  try {
    currentIndexText = await readRegularText(options.indexPath);
  } catch (error) {
    return relationResult(
      false,
      context.sourceIds,
      options.indexPath,
      [
        `current investigation index could not be re-read before relation transaction: ${errorText(error)}`
      ],
      {
        diagnostics: [
          diagnosticFromError({
            code: "investigation-report.relation-index-recheck-failed",
            error,
            mutation: relationMutation("no-change"),
            reason:
              "the current investigation index could not be re-read before publication",
            recovery:
              "restore read access to the index and verify it has not changed before retrying",
            target: options.indexPath
          })
        ],
        mutation: relationMutation("no-change")
      }
    );
  }
  if (currentIndexText === context.originalIndexText) return null;
  return relationResult(
    false,
    context.sourceIds,
    options.indexPath,
    [
      "investigation index changed after relation validation; no files were written"
    ],
    {
      diagnostics: [
        genericInvestigationDiagnostic({
          code: "investigation-report.relation-index-drift",
          mutation: relationMutation("no-change"),
          reason: "the investigation index changed after relation validation",
          recovery:
            "review the concurrent index change, then retry from the current collection state",
          target: options.indexPath
        })
      ],
      mutation: relationMutation("no-change")
    }
  );
}
