/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/relations/transactions/relation-transaction-protection.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/relations/transactions/relation-transaction-protection.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/relations/transactions/relation-transaction-protection.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import {
  diagnosticFromError,
  genericInvestigationDiagnostic
} from "../../diagnostics.ts";
import {
  buildStateIndex,
  serializeStateIndex
} from "../../../../index-runtime/src/index.ts";
import { sameInvestigationSources } from "../../index/investigation-index-source.ts";
import {
  createInvestigationStateIndexDefinition,
  investigationIndexDiagnosticMessages
} from "../../index/investigation-state-index.ts";
import {
  publicationSnapshot,
  readPublishedInvestigationDependencies,
  type PublishedInvestigationSnapshot
} from "../../publication/preparation/published-preparation.ts";
import type { LoadedRelationContext } from "./relation-transaction-preparation.ts";
import type {
  InvestigationIndexState,
  InvestigationRelationSetResult,
  InvestigationSource
} from "../../types.ts";
import {
  errorText,
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
  candidateStates: ReadonlyMap<string, InvestigationIndexState>,
  baseline: PublishedInvestigationSnapshot
): Promise<{ errors: string[] } | { text: string }> {
  const snapshot = publicationSnapshot(
    baseline,
    candidateStates,
    candidateSources
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
): Promise<RelationPhase<LoadedRelationContext["collection"]>> {
  let sources: InvestigationSource[];
  try {
    sources = await readPublishedInvestigationDependencies(
      options.root,
      context.collection.publishedIndex,
      context.collection.sources.map((source) => source.id)
    );
  } catch (error) {
    return relationPhaseResult(
      relationResult(
        false,
        context.sourceIds,
        options.indexPath,
        [
          "investigation dependencies could not be revalidated before relation transaction; no files were written",
          errorText(error)
        ],
        {
          diagnostics: [
            diagnosticFromError({
              code: "investigation-report.relation-source-recheck-failed",
              error,
              mutation: relationMutation("no-change"),
              reason:
                "a required relation dependency could not be revalidated before publication",
              recovery:
                "restore the required dependency, then retry from the current published state",
              target: options.root
            })
          ],
          mutation: relationMutation("no-change")
        }
      )
    );
  }
  if (!sameInvestigationSources(sources, context.collection.sources))
    return relationPhaseResult(
      driftedProtectedRelationCollection(options, context)
    );
  return { status: "ready", value: { ...context.collection, sources } };
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
