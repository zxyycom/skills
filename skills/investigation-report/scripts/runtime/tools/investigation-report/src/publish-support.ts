/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/publish-support.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/publish-support.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/publish-support.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import path from "node:path";
import { InvestigationCollectionMutationLockError } from "./collection-mutation-lock.ts";
import {
  diagnosticFromError,
  sanitizeInvestigationDiagnosticText,
  type InvestigationDiagnostic,
  type InvestigationMutationDiagnostic
} from "./diagnostics.ts";
import { investigationIndexFileName } from "./report-path.ts";
import type { InvestigationPublishPreparation } from "./publish-preparation.ts";
import type {
  InvestigationCandidatePublishOptions,
  InvestigationCandidatePublishResult
} from "./types.ts";

export function publishLockFailure(
  input: InvestigationCandidatePublishOptions,
  indexPath: string,
  error: unknown
): InvestigationCandidatePublishResult {
  const completed = completedPublishLockFailure(error);
  if (completed !== null) return completed;
  return incompletePublishLockFailure(input, indexPath, error);
}

function completedPublishLockFailure(
  error: unknown
): InvestigationCandidatePublishResult | null {
  if (
    error instanceof InvestigationCollectionMutationLockError &&
    error.operationCompleted &&
    isPublishResult(error.operationResult)
  ) {
    const completed = error.operationResult;
    const mutation =
      completed.mutation ??
      publishMutation(
        completed.changed ? "committed-cleanup-pending" : "no-change"
      );
    const { relationReview: _relationReview, ...result } = completed;
    return {
      ...result,
      diagnostics: [...result.diagnostics, { ...error.diagnostic, mutation }],
      errors: uniqueSorted([
        ...result.errors,
        sanitizeInvestigationDiagnosticText(error)
      ]),
      mutation
    };
  }
  return null;
}

function incompletePublishLockFailure(
  input: InvestigationCandidatePublishOptions,
  indexPath: string,
  error: unknown
): InvestigationCandidatePublishResult {
  const releaseFailure =
    error instanceof InvestigationCollectionMutationLockError &&
    error.diagnostic.code ===
      "investigation-report.collection-lock-release-failed";
  const mutation = publishMutation(
    releaseFailure ? "partial-or-unknown" : "no-change"
  );
  const diagnostic =
    error instanceof InvestigationCollectionMutationLockError
      ? { ...error.diagnostic, mutation }
      : diagnosticFromError({
          code: "investigation-report.publish-transaction-failed",
          error,
          mutation,
          reason: "the publish transaction stopped unexpectedly",
          recovery:
            "verify selected candidates, formal reports, resources, and the index before retrying publish",
          target: indexPath
        });
  return result(
    input,
    false,
    ["investigation publish could not be completed"],
    {
      diagnostics: [diagnostic],
      indexPath,
      mutation
    }
  );
}

export function validateOptions(input: InvestigationCandidatePublishOptions): {
  errors: string[];
} {
  const errors: string[] = [];
  if (!Array.isArray(input.ids)) errors.push("publish ids must be an array");
  if (input.ids.length === 0)
    errors.push("publish requires at least one Investigation selector");
  if (new Set(input.ids).size !== input.ids.length)
    errors.push("publish IDs must not repeat");
  return { errors: uniqueSorted(errors) };
}

export function invalidResult(
  input: unknown,
  errors: readonly string[]
): InvestigationCandidatePublishResult {
  const workspaceRoot =
    typeof input === "object" &&
    input !== null &&
    typeof Reflect.get(input, "workspaceRoot") === "string"
      ? (Reflect.get(input, "workspaceRoot") as string)
      : ".";
  return result({ ids: [], workspaceRoot }, false, errors);
}

export function result(
  input: Pick<
    InvestigationCandidatePublishOptions,
    "ids" | "preflight" | "workspaceRoot"
  >,
  changed: boolean,
  errors: readonly string[],
  options: Readonly<{
    diagnostics?: readonly InvestigationDiagnostic[];
    indexPath?: string;
    mutation?: InvestigationMutationDiagnostic;
    relationReview?: import("./types.ts").InvestigationRelationReview;
    warnings?: readonly string[];
  }> = {}
): InvestigationCandidatePublishResult {
  return {
    changed,
    diagnostics: [...(options.diagnostics ?? [])],
    errors: uniqueSorted(errors),
    ids: [...input.ids].sort(compareText),
    indexPath:
      options.indexPath ??
      path.resolve(
        input.workspaceRoot,
        "docs/investigations",
        investigationIndexFileName
      ),
    ...(options.mutation === undefined ? {} : { mutation: options.mutation }),
    ...(options.relationReview === undefined
      ? {}
      : { relationReview: options.relationReview }),
    preflight: input.preflight === true,
    warnings: uniqueSorted(options.warnings ?? [])
  };
}

export function publishMutation(
  outcome: InvestigationMutationDiagnostic["outcome"]
): InvestigationMutationDiagnostic {
  return { outcome, scope: "investigation candidate publish collection" };
}

export function sameSources(
  left: readonly Readonly<{ id: string; text: string }>[],
  right: readonly Readonly<{ id: string; text: string }>[]
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (source, index) =>
        source.id === right[index]?.id && source.text === right[index]?.text
    )
  );
}

export function sameResourceSnapshots(
  left: readonly InvestigationPublishPreparation["resourceSnapshot"][number][],
  right: readonly InvestigationPublishPreparation["resourceSnapshot"][number][]
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (resource, index) =>
        resource.id === right[index]?.id &&
        resource.dev === right[index]?.dev &&
        resource.ino === right[index]?.ino
    )
  );
}

export function isPublishResult(
  value: unknown
): value is InvestigationCandidatePublishResult {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "changed") === "boolean" &&
    Array.isArray(Reflect.get(value, "errors")) &&
    Array.isArray(Reflect.get(value, "ids"))
  );
}

export function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    Reflect.get(error, "code") === "ENOENT"
  );
}

export function errorText(error: unknown): string {
  return sanitizeInvestigationDiagnosticText(error);
}

export function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
