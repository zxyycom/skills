/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/publish.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/publish.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/publish.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import {
  preparePublishTransaction,
  freshPublishTransaction,
  verifyPublishTransaction,
  type PublishTransactionContext,
  type PreparedPublication
} from "./publish-transaction.ts";
import path from "node:path";
import { withInvestigationCollectionMutationLock } from "./collection-mutation-lock.ts";
import { diagnosticFromError } from "./diagnostics.ts";
import { runRecordTransaction } from "../../record-operations/src/transaction.ts";
import { verifyInvestigationMembers } from "./transaction-files.ts";
import {
  type BeforeInvestigationPublish,
  type InvestigationPublishWriter,
  type PublishWithinLockOptions
} from "./publish-contract.ts";
import { parseInvestigationCandidatePublishOptions } from "./options.ts";
import { writeIndexAtomically } from "./publish-index-writer.ts";
import {
  invalidResult,
  publishLockFailure,
  publishMutation,
  result,
  validateOptions,
  errorText
} from "./publish-support.ts";
import {
  canonicalizeInvestigationsDirectory,
  investigationIndexFileName,
  resolveInvestigationsDirectory
} from "./report-path.ts";
import type { InvestigationCandidatePublishResult } from "./types.ts";
import { establishedRelationReview } from "./relation-review.ts";

export async function publishInvestigationCandidates(
  input: unknown
): Promise<InvestigationCandidatePublishResult> {
  return await publishInvestigationCandidatesWithWriter(
    input,
    writeIndexAtomically
  );
}

export async function publishInvestigationCandidatesWithWriter(
  input: unknown,
  write: InvestigationPublishWriter,
  beforePublish: BeforeInvestigationPublish = async () => {}
): Promise<InvestigationCandidatePublishResult> {
  const parsed = parseInvestigationCandidatePublishOptions(input);
  if (parsed.isErr()) return invalidResult(input, parsed.error);
  const options = parsed.value;
  const validated = validateOptions(options);
  if (validated.errors.length > 0)
    return result(options, false, validated.errors);
  const resolved = resolveInvestigationsDirectory(
    options.workspaceRoot,
    options.investigationsDir
  );
  if (resolved.isErr()) return result(options, false, resolved.error);
  const canonical = await canonicalizeInvestigationsDirectory(resolved.value);
  if (canonical.isErr()) return result(options, false, canonical.error);
  const root = canonical.value.investigationsDirectory;
  const indexPath = path.join(root, investigationIndexFileName);
  const execute = () =>
    publishCollection(
      { beforePublish, ids: options.ids, indexPath, root, write },
      options.preflight === true
    );
  if (options.preflight === true) return await execute();
  try {
    return await withInvestigationCollectionMutationLock(indexPath, execute);
  } catch (error) {
    return publishLockFailure(options, indexPath, error);
  }
}

async function publishCollection(
  options: PublishWithinLockOptions,
  preflight: boolean
): Promise<InvestigationCandidatePublishResult> {
  const context: PublishTransactionContext = {
    options,
    rejected: null,
    cleanupWarnings: []
  };
  const transaction = await runRecordTransaction<PreparedPublication>({
    preflight,
    prepare: () => preparePublishTransaction(context),
    fresh: (value) => freshPublishTransaction(options, value),
    verify: (value) => verifyPublishTransaction(options, value),
    verifyRecovered: async ({ members, changedPaths }) =>
      verifyInvestigationMembers(options.root, members, changedPaths),
    cleanup: async () => {
      if (context.cleanupWarnings.length > 0)
        throw new Error(context.cleanupWarnings.join("; "));
    }
  });
  if (context.rejected !== null && !transaction.changed)
    return context.rejected;
  const preparation = transaction.value?.preparation;
  const input = {
    ids:
      preparation?.candidateSources.map((source) => source.id) ?? options.ids,
    workspaceRoot: options.root,
    preflight
  };
  if (transaction.status === "ok" && preparation !== undefined)
    return result(input, transaction.changed, [], {
      indexPath: options.indexPath,
      warnings: preparation.warnings,
      relationReview: establishedRelationReview(
        preflight ? "preflight" : "committed",
        preparation.candidateSources,
        preparation.states
      )
    });
  const mutation = publishMutation(transaction.outcome);
  const errors = [...transaction.errors, ...transaction.cleanupErrors];
  return result(input, transaction.changed, errors.map(errorText), {
    indexPath: options.indexPath,
    warnings: preparation?.warnings ?? [],
    mutation,
    diagnostics: errors.map((error) =>
      diagnosticFromError({
        code: "investigation-report.publish-failed",
        error,
        mutation,
        reason: transaction.committed
          ? transaction.verification === "passed"
            ? "publication committed, but cleanup is incomplete"
            : "publication committed, but verification failed or is unknown"
          : transaction.verification === "failed-or-unknown"
            ? "the publication commit state could not be established; preserve and reconcile its actual writes"
            : "publication stopped before its derived index commit point",
        recovery:
          transaction.outcome === "rolled-back"
            ? "review the restored original collection before deciding whether to retry"
            : "stop mutations and reconcile the actual candidate, report, resource, index and cleanup paths",
        target: options.indexPath
      })
    )
  });
}

export type { InvestigationPublishWriter } from "./publish-contract.ts";
