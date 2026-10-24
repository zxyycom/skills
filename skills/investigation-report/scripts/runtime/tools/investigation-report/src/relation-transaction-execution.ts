/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/relation-transaction-execution.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/relation-transaction-execution.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/relation-transaction-execution.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import {
  prepareRelationWrites,
  type PreparedRelationTransaction
} from "./relation-transaction-plan.ts";
import path from "node:path";
import { parseStateIndex } from "../../index-runtime/src/index.ts";
import { runRecordTransaction } from "../../record-operations/src/transaction.ts";
import { verifyInvestigationMembers } from "./transaction-files.ts";
import { createInvestigationStateIndexDefinition } from "./investigation-state-index.ts";
import { buildRelationCandidate } from "./relation-transaction-candidate.ts";
import { protectRelationCollection } from "./relation-transaction-protection.ts";
import {
  loadRelationTransaction,
  type RelationTransactionOptions
} from "./relation-transaction-preparation.ts";
import { diagnosticFromError } from "./diagnostics.ts";
import { readPublishedInvestigationDependencies } from "./published-preparation.ts";
import {
  errorText,
  readRegularText,
  relationMutation,
  relationResult
} from "./relation-transaction-support.ts";
import type { InvestigationRelationSetResult } from "./types.ts";

export async function applyRelationReplacements(
  options: RelationTransactionOptions
): Promise<InvestigationRelationSetResult> {
  let rejected: InvestigationRelationSetResult | null = null;
  const transaction = await runRecordTransaction<PreparedRelationTransaction>({
    preflight: options.preflight,
    prepare: async () => {
      const loaded = await loadRelationTransaction(options);
      if (loaded.status === "result") {
        rejected = loaded.result;
        throw new Error(loaded.result.errors.join("; "));
      }
      const candidate = await buildRelationCandidate(options, loaded.value);
      if (candidate.status === "result") {
        rejected = candidate.result;
        throw new Error(candidate.result.errors.join("; "));
      }
      return await prepareRelationWrites(options, candidate.value);
    },
    fresh: async ({ context, members }) => {
      await options.beforePublish();
      const protectedCollection = await protectRelationCollection(
        options,
        context
      );
      if (protectedCollection.status === "result") {
        rejected = protectedCollection.result;
        throw new Error(protectedCollection.result.errors.join("; "));
      }
      if (
        (await readRegularText(options.indexPath)) !== context.originalIndexText
      )
        throw new Error(
          "investigation index changed after relation validation; no files were written"
        );
      await verifyInvestigationMembers(options.root, members);
    },
    verify: async ({ context, members }) => {
      await verifyInvestigationMembers(
        options.root,
        members,
        context.candidateSources
          .filter((source) => context.changedSources.includes(source.id))
          .map((source) => path.join(options.root, source.sourcePath))
      );
      const definition = createInvestigationStateIndexDefinition();
      const parsed = parseStateIndex({
        definition,
        text: context.nextIndexText,
        sourcePath: options.indexPath
      });
      if (parsed.status === "error")
        throw new Error(
          parsed.diagnostics.map((item) => item.message).join("; ")
        );
      await readPublishedInvestigationDependencies(
        options.root,
        parsed.value,
        context.collection.sources.map((source) => source.id)
      );
    },
    verifyRecovered: async ({ context, members }) => {
      await verifyInvestigationMembers(
        options.root,
        members,
        context.candidateSources
          .filter((source) => context.changedSources.includes(source.id))
          .map((source) => path.join(options.root, source.sourcePath))
      );
    }
  });
  if (rejected !== null && !transaction.changed) return rejected;
  const context = transaction.value?.context;
  if (transaction.status === "ok" && context !== undefined)
    return relationResult(
      transaction.changed,
      context.sourceIds,
      options.indexPath,
      [],
      { preflight: options.preflight, relationReview: context.relationReview }
    );
  const mutation = relationMutation(transaction.outcome);
  return relationResult(
    transaction.changed,
    context?.sourceIds ?? [],
    options.indexPath,
    [...transaction.errors, ...transaction.cleanupErrors].map(
      (error) => "relation transaction publish failed: " + errorText(error)
    ),
    {
      mutation,
      diagnostics: [...transaction.errors, ...transaction.cleanupErrors].map(
        (error) =>
          diagnosticFromError({
            code: "investigation-report.relation-publish-failed",
            error,
            mutation,
            reason: transaction.committed
              ? "the derived index committed, but transaction verification failed or is unknown"
              : "the relation transaction could not complete",
            recovery:
              "inspect and reconcile the selected reports and index before another mutation",
            target: options.indexPath
          })
      )
    }
  );
}
