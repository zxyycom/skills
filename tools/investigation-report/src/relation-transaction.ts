import path from "node:path";
import {
  InvestigationCollectionMutationLockError,
  withInvestigationCollectionMutationLock
} from "./collection-mutation-lock.ts";
import { diagnosticFromError } from "./diagnostics.ts";
import { investigationIndexFileName } from "./investigation-state-index.ts";
import { parseInvestigationRelationSetOptions } from "./options.ts";
import {
  canonicalizeInvestigationsDirectory,
  resolveInvestigationsDirectory
} from "./report-path.ts";
import type { InvestigationRelationSummaryInput } from "./relation-summary.ts";
import type { InvestigationRelationSetResult } from "./types.ts";
import { applyRelationReplacements } from "./relation-transaction-preparation.ts";
import {
  defaultIndexPath,
  errorText,
  indexPathForOptions,
  isRelationResult,
  relationMutation,
  relationResult,
  uniqueSorted,
  validateReplacements,
  writeTextAtomically
} from "./relation-transaction-support.ts";

export type InvestigationAtomicWriter = (
  targetPath: string,
  text: string
) => Promise<void>;
export type BeforeRelationPublish = () => Promise<void>;

export async function setInvestigationRelations(
  input: unknown
): Promise<InvestigationRelationSetResult> {
  return await setInvestigationRelationsWithWriter(input, writeTextAtomically);
}

export async function setInvestigationRelationsFromCli(
  input: unknown,
  relationSummaryGroups: readonly (readonly InvestigationRelationSummaryInput[])[]
): Promise<InvestigationRelationSetResult> {
  return await setInvestigationRelationsWithWriterAndSummaries(
    input,
    writeTextAtomically,
    async () => {},
    relationSummaryGroups
  );
}

export async function setInvestigationRelationsWithWriter(
  input: unknown,
  write: InvestigationAtomicWriter,
  beforePublish: BeforeRelationPublish = async () => {}
): Promise<InvestigationRelationSetResult> {
  return await setInvestigationRelationsWithWriterAndSummaries(
    input,
    write,
    beforePublish,
    []
  );
}

async function setInvestigationRelationsWithWriterAndSummaries(
  input: unknown,
  write: InvestigationAtomicWriter,
  beforePublish: BeforeRelationPublish,
  relationSummaryGroups: readonly (readonly InvestigationRelationSummaryInput[])[]
): Promise<InvestigationRelationSetResult> {
  const parsed = parseInvestigationRelationSetOptions(input);
  if (parsed.isErr()) {
    return relationResult(false, [], defaultIndexPath(input), parsed.error);
  }
  if (
    relationSummaryGroups.length > 0 &&
    relationSummaryGroups.length !== parsed.value.replacements.length
  ) {
    return relationResult(false, [], indexPathForOptions(parsed.value), [
      "relation-summary groups must match the complete source groups"
    ]);
  }
  const summaryGroupsBySource = new Map(
    parsed.value.replacements.map((replacement, index) => [
      replacement.source,
      relationSummaryGroups[index] ?? []
    ])
  );
  const validated = validateReplacements(parsed.value.replacements);
  if (validated.errors.length > 0) {
    return relationResult(
      false,
      validated.sourceIds,
      indexPathForOptions(parsed.value),
      validated.errors
    );
  }
  const resolved = resolveInvestigationsDirectory(
    parsed.value.workspaceRoot,
    parsed.value.investigationsDir
  );
  if (resolved.isErr()) {
    return relationResult(
      false,
      validated.sourceIds,
      indexPathForOptions(parsed.value),
      resolved.error
    );
  }
  const canonical = await canonicalizeInvestigationsDirectory(resolved.value);
  if (canonical.isErr()) {
    return relationResult(
      false,
      validated.sourceIds,
      indexPathForOptions(parsed.value),
      canonical.error
    );
  }
  const root = canonical.value.investigationsDirectory;
  const indexPath = path.join(root, investigationIndexFileName);
  return await withInvestigationCollectionMutationLock(
    indexPath,
    async () =>
      await applyRelationReplacements({
        indexPath,
        replacements: validated.replacements,
        relationSummaryGroups: validated.replacements.map(
          (replacement) => summaryGroupsBySource.get(replacement.source) ?? []
        ),
        root,
        write,
        beforePublish
      })
  ).catch((error: unknown) =>
    relationLockFailure(error, validated.sourceIds, indexPath)
  );
}

function relationLockFailure(
  error: unknown,
  sourceIds: readonly string[],
  indexPath: string
): InvestigationRelationSetResult {
  const releaseFailure =
    error instanceof InvestigationCollectionMutationLockError &&
    error.diagnostic.code ===
      "investigation-report.collection-lock-release-failed";
  const completedResult = completedRelationResult(error);
  if (completedResult !== null && releaseFailure) {
    return completedRelationLockFailure(error, completedResult);
  }
  return incompleteRelationLockFailure(
    error,
    sourceIds,
    indexPath,
    releaseFailure
  );
}

function completedRelationResult(
  error: unknown
): InvestigationRelationSetResult | null {
  if (!(error instanceof InvestigationCollectionMutationLockError)) return null;
  if (!error.operationCompleted || !isRelationResult(error.operationResult))
    return null;
  return error.operationResult;
}

function completedRelationLockFailure(
  error: InvestigationCollectionMutationLockError,
  completedResult: InvestigationRelationSetResult
): InvestigationRelationSetResult {
  const mutation =
    completedResult.mutation ??
    relationMutation(
      completedResult.changed ? "committed-cleanup-pending" : "no-change"
    );
  return {
    ...completedResult,
    diagnostics: [
      ...completedResult.diagnostics,
      { ...error.diagnostic, mutation }
    ],
    errors: uniqueSorted([...completedResult.errors, errorText(error)]),
    mutation
  };
}

function incompleteRelationLockFailure(
  error: unknown,
  sourceIds: readonly string[],
  indexPath: string,
  releaseFailure: boolean
): InvestigationRelationSetResult {
  return relationResult(false, sourceIds, indexPath, [errorText(error)], {
    diagnostics:
      error instanceof InvestigationCollectionMutationLockError
        ? [
            {
              ...error.diagnostic,
              mutation: relationMutation(
                releaseFailure ? "partial-or-unknown" : "no-change"
              )
            }
          ]
        : [
            diagnosticFromError({
              code: "investigation-report.relation-transaction-failed",
              error,
              mutation: relationMutation("partial-or-unknown"),
              reason: "the relation transaction stopped unexpectedly",
              recovery:
                "verify the selected reports and index before retrying the relation update",
              target: indexPath
            })
          ],
    mutation: relationMutation(
      releaseFailure ? "partial-or-unknown" : "no-change"
    )
  });
}
