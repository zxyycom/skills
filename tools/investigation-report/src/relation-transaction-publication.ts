import path from "node:path";
import type { InvestigationRelationSetResult } from "./types.ts";
import {
  compareText,
  errorText,
  relationMutation,
  relationResult,
  restoreOriginalTexts
} from "./relation-transaction-support.ts";
import { diagnosticFromError } from "./diagnostics.ts";
import type {
  CandidateRelationContext,
  RelationTransactionOptions
} from "./relation-transaction-preparation.ts";

export async function publishRelationCandidate(
  options: RelationTransactionOptions,
  context: CandidateRelationContext,
  originalTextByPath: Map<string, string>
): Promise<InvestigationRelationSetResult> {
  const nextSourceById = new Map(
    context.candidateSources.map((source) => [source.id, source])
  );
  const writtenPaths: string[] = [];
  try {
    await writeRelationCandidate(
      options,
      context,
      nextSourceById,
      writtenPaths
    );
    return relationResult(true, context.sourceIds, options.indexPath, []);
  } catch (error) {
    return await relationPublicationFailure(
      options,
      context,
      originalTextByPath,
      writtenPaths,
      error
    );
  }
}

async function writeRelationCandidate(
  options: RelationTransactionOptions,
  context: CandidateRelationContext,
  sources: ReadonlyMap<string, import("./types.ts").InvestigationSource>,
  writtenPaths: string[]
): Promise<void> {
  for (const id of context.changedSources.sort(compareText)) {
    const source = sources.get(id)!;
    const reportPath = path.join(options.root, source.sourcePath);
    writtenPaths.push(reportPath);
    await options.write(reportPath, source.text);
  }
  writtenPaths.push(options.indexPath);
  await options.write(options.indexPath, context.nextIndexText);
}

async function relationPublicationFailure(
  options: RelationTransactionOptions,
  context: CandidateRelationContext,
  originalTextByPath: Map<string, string>,
  writtenPaths: readonly string[],
  error: unknown
): Promise<InvestigationRelationSetResult> {
  const restorationErrors = await restoreOriginalTexts(
    options.indexPath,
    context.originalIndexText,
    originalTextByPath,
    writtenPaths,
    options.write
  );
  const outcome =
    restorationErrors.length === 0 ? "rolled-back" : "partial-or-unknown";
  return relationPublicationFailureResult(
    options,
    context,
    restorationErrors,
    outcome,
    error
  );
}

function relationPublicationFailureResult(
  options: RelationTransactionOptions,
  context: CandidateRelationContext,
  restorationErrors: readonly string[],
  outcome: "rolled-back" | "partial-or-unknown",
  error: unknown
): InvestigationRelationSetResult {
  return relationResult(
    false,
    context.sourceIds,
    options.indexPath,
    [
      `relation transaction publish failed: ${errorText(error)}`,
      ...restorationErrors
    ],
    {
      diagnostics: [
        diagnosticFromError({
          code: "investigation-report.relation-publish-failed",
          error,
          mutation: relationMutation(outcome),
          reason: relationFailureReason(outcome),
          recovery: relationFailureRecovery(outcome),
          target: options.indexPath
        })
      ],
      mutation: relationMutation(outcome)
    }
  );
}

function relationFailureReason(
  outcome: "rolled-back" | "partial-or-unknown"
): string {
  return outcome === "rolled-back"
    ? "relation publication failed and the original report and index bytes were restored"
    : "relation publication failed and restoration could not be fully verified";
}
function relationFailureRecovery(
  outcome: "rolled-back" | "partial-or-unknown"
): string {
  return outcome === "rolled-back"
    ? "correct the publication failure, then retry the relation update"
    : "inspect the listed report and index paths before any retry";
}
