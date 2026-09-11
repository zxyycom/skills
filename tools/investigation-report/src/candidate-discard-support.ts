import { InvestigationCollectionMutationLockError } from "./collection-mutation-lock.ts";
import {
  diagnosticFromError,
  sanitizeInvestigationDiagnosticText,
  type InvestigationDiagnostic,
  type InvestigationMutationDiagnostic
} from "./diagnostics.ts";
import type { CandidateResourceTree } from "./candidate-discard-resources.ts";
import type { CandidateDiscardPreparation } from "./candidate-discard.ts";
import type {
  InvestigationCandidateDiscardOptions,
  InvestigationCandidateDiscardResult
} from "./types.ts";

export function sameCandidateDiscardPreparation(
  left: CandidateDiscardPreparation,
  right: CandidateDiscardPreparation | undefined
): boolean {
  return (
    right !== undefined &&
    left.candidatePath === right.candidatePath &&
    left.candidateText === right.candidateText &&
    sameResourceTree(left.resources, right.resources) &&
    sameTextList(left.sharedReferences, right.sharedReferences)
  );
}

export function sameResourceTree(
  left: CandidateResourceTree,
  right: CandidateResourceTree
): boolean {
  return (
    sameTextList(left.resourceIds, right.resourceIds) &&
    sameTextList(left.directories, right.directories)
  );
}

export function sameTextList(
  left: readonly string[],
  right: readonly string[]
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function validateOptions(
  input: InvestigationCandidateDiscardOptions
): string[] {
  return input.id.length === 0
    ? ["discard-candidate requires an Investigation selector"]
    : [];
}

export function invalidResult(
  input: unknown,
  errors: readonly string[]
): InvestigationCandidateDiscardResult {
  const id =
    typeof input === "object" &&
    input !== null &&
    typeof Reflect.get(input, "id") === "string"
      ? (Reflect.get(input, "id") as string)
      : "";
  return result({ id }, false, [], errors);
}

export function lockFailure(
  input: InvestigationCandidateDiscardOptions,
  error: unknown
): InvestigationCandidateDiscardResult {
  const completed = completedLockFailure(error);
  if (completed !== null) return completed;
  return ordinaryLockFailure(input, error);
}

function completedLockFailure(
  error: unknown
): InvestigationCandidateDiscardResult | null {
  if (
    error instanceof InvestigationCollectionMutationLockError &&
    error.operationCompleted &&
    isDiscardResult(error.operationResult)
  ) {
    const completed = error.operationResult;
    const mutation = discardMutation(
      completed.changed ? "committed-cleanup-pending" : "no-change"
    );
    return {
      ...completed,
      diagnostics: [
        ...completed.diagnostics,
        { ...error.diagnostic, mutation }
      ],
      errors: uniqueSorted([
        ...completed.errors,
        sanitizeInvestigationDiagnosticText(error)
      ]),
      mutation
    };
  }
  return null;
}

function ordinaryLockFailure(
  input: InvestigationCandidateDiscardOptions,
  error: unknown
): InvestigationCandidateDiscardResult {
  const releaseFailure =
    error instanceof InvestigationCollectionMutationLockError &&
    error.diagnostic.code ===
      "investigation-report.collection-lock-release-failed";
  const mutation = discardMutation(
    releaseFailure ? "partial-or-unknown" : "no-change"
  );
  return result(
    input,
    false,
    [],
    ["investigation candidate discard could not be completed"],
    {
      diagnostics: [
        error instanceof InvestigationCollectionMutationLockError
          ? { ...error.diagnostic, mutation }
          : diagnosticFromError({
              code: "investigation-report.discard-candidate-transaction-failed",
              error,
              mutation,
              reason: "the candidate discard transaction stopped unexpectedly",
              recovery:
                "verify the candidate and owner resource paths before retrying discard-candidate",
              target: input.id
            })
      ],
      mutation
    }
  );
}

export function result(
  input: Pick<InvestigationCandidateDiscardOptions, "id">,
  changed: boolean,
  deletedResourceIds: readonly string[],
  errors: readonly string[],
  options: Readonly<{
    diagnostics?: readonly InvestigationDiagnostic[];
    mutation?: InvestigationMutationDiagnostic;
  }> = {}
): InvestigationCandidateDiscardResult {
  return {
    changed,
    deletedResourceIds: [...deletedResourceIds].sort(compareText),
    diagnostics: [...(options.diagnostics ?? [])],
    errors: uniqueSorted(errors),
    id: input.id,
    ...(options.mutation === undefined ? {} : { mutation: options.mutation }),
    requiresRecordedDeletionConfirmation: false
  };
}

export function discardMutation(
  outcome: InvestigationMutationDiagnostic["outcome"]
): InvestigationMutationDiagnostic {
  return { outcome, scope: "investigation candidate discard collection" };
}

export function isDiscardResult(
  value: unknown
): value is InvestigationCandidateDiscardResult {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "changed") === "boolean" &&
    Array.isArray(Reflect.get(value, "errors")) &&
    typeof Reflect.get(value, "id") === "string"
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
export function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}
