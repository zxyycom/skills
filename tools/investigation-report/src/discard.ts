import path from "node:path";
import {
  InvestigationCollectionMutationLockError,
  withInvestigationCollectionMutationLock
} from "./collection-mutation-lock.ts";
import {
  diagnosticFromError,
  genericInvestigationDiagnostic,
  sanitizeInvestigationDiagnosticText,
  type InvestigationDiagnostic,
  type InvestigationMutationDiagnostic
} from "./diagnostics.ts";
import { investigationIndexFileName } from "./investigation-state-index.ts";
import { parseInvestigationReportDiscardOptions } from "./options.ts";
import {
  canonicalizeInvestigationsDirectory,
  resolveInvestigationsDirectory
} from "./report-path.ts";
import { collectValidatedInvestigationCollection } from "./validation.ts";
import type { InvestigationReportDiscardResult } from "./types.ts";
import { discardFromCollection } from "./discard-loading.ts";
import { writeTextAtomically } from "./discard-files.ts";
export {
  readRegularText,
  sameResourceTree,
  sameTextList
} from "./discard-files.ts";
export {
  referencesToTarget,
  sharedOwnerResourceReferences
} from "./discard-history.ts";
export type { ResourceTreeScan } from "./discard-history.ts";

export type InvestigationDiscardWriter = (
  targetPath: string,
  text: string
) => Promise<void>;
export type BeforeDiscardPublish = () => Promise<void>;
export type AfterDiscardResourceTombstone = () => Promise<void>;
export type DiscardCollectionOptions = Readonly<{
  afterResourceTombstone: AfterDiscardResourceTombstone;
  beforePublish: BeforeDiscardPublish;
  deleteOwnedResources: boolean;
  deleteRecordedReport: boolean;
  id: string;
  indexPath: string;
  root: string;
  write: InvestigationDiscardWriter;
}>;

export async function discardInvestigationReport(
  input: unknown
): Promise<InvestigationReportDiscardResult> {
  return await discardInvestigationReportWithWriter(input, writeTextAtomically);
}

export async function discardInvestigationReportWithWriter(
  input: unknown,
  write: InvestigationDiscardWriter,
  beforePublish: BeforeDiscardPublish = async () => {},
  afterResourceTombstone: AfterDiscardResourceTombstone = async () => {}
): Promise<InvestigationReportDiscardResult> {
  const parsed = parseInvestigationReportDiscardOptions(input);
  if (parsed.isErr())
    return discardResult({ errors: parsed.error, id: "", input: {} });
  if (parsed.value.id.length === 0) {
    return discardResult({
      errors: ["discard requires an Investigation selector"],
      id: parsed.value.id,
      input: parsed.value
    });
  }
  const resolved = resolveInvestigationsDirectory(
    parsed.value.workspaceRoot,
    parsed.value.investigationsDir
  );
  if (resolved.isErr())
    return discardResult({
      errors: resolved.error,
      id: parsed.value.id,
      input: parsed.value
    });
  const canonical = await canonicalizeInvestigationsDirectory(resolved.value);
  if (canonical.isErr())
    return discardResult({
      errors: canonical.error,
      id: parsed.value.id,
      input: parsed.value
    });
  const root = canonical.value.investigationsDirectory;
  const indexPath = path.join(root, investigationIndexFileName);
  return await withInvestigationCollectionMutationLock(
    indexPath,
    async () =>
      await discardFromCollection({
        afterResourceTombstone,
        beforePublish,
        deleteOwnedResources: parsed.value.deleteOwnedResources === true,
        deleteRecordedReport: parsed.value.deleteRecordedReport === true,
        id: parsed.value.id,
        indexPath,
        root,
        write
      })
  ).catch((error: unknown) =>
    discardLockFailure(error, parsed.value, parsed.value.id)
  );
}

function discardLockFailure(
  error: unknown,
  input: { investigationsDir?: string; workspaceRoot?: string },
  id: string
): InvestigationReportDiscardResult {
  const releaseFailure =
    error instanceof InvestigationCollectionMutationLockError &&
    error.diagnostic.code ===
      "investigation-report.collection-lock-release-failed";
  const completedResult = completedDiscardResult(error);
  if (completedResult !== null && releaseFailure) {
    return completedDiscardLockFailure(completedResult, error);
  }
  return incompleteDiscardLockFailure(error, input, id, releaseFailure);
}

function completedDiscardResult(
  error: unknown
): InvestigationReportDiscardResult | null {
  return error instanceof InvestigationCollectionMutationLockError &&
    error.operationCompleted &&
    isDiscardResult(error.operationResult)
    ? error.operationResult
    : null;
}

function completedDiscardLockFailure(
  completedResult: InvestigationReportDiscardResult,
  error: InvestigationCollectionMutationLockError
): InvestigationReportDiscardResult {
  const mutation =
    completedResult.mutation ??
    discardMutation(
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

function incompleteDiscardLockFailure(
  error: unknown,
  input: { investigationsDir?: string; workspaceRoot?: string },
  id: string,
  releaseFailure: boolean
): InvestigationReportDiscardResult {
  const mutation = discardMutation(
    releaseFailure ? "partial-or-unknown" : "no-change"
  );
  return discardResult({
    errors: [errorText(error)],
    id,
    input,
    options: {
      diagnostics:
        error instanceof InvestigationCollectionMutationLockError
          ? [{ ...error.diagnostic, mutation }]
          : [
              diagnosticFromError({
                code: "investigation-report.discard-transaction-failed",
                error,
                mutation: discardMutation("partial-or-unknown"),
                reason: "the discard transaction stopped unexpectedly",
                recovery:
                  "verify the report, owner resources, and index before retrying discard",
                target: id
              })
            ],
      mutation
    }
  });
}

export type InvestigationCollectionScan = Awaited<
  ReturnType<typeof collectValidatedInvestigationCollection>
>;
export type ValidatedInvestigationCollection = Omit<
  InvestigationCollectionScan,
  "snapshot"
> & {
  snapshot: NonNullable<InvestigationCollectionScan["snapshot"]>;
};
export type InvestigationCollectionSource =
  ValidatedInvestigationCollection["sources"][number];
export type DiscardStep<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; result: InvestigationReportDiscardResult }>;

type DiscardResultOptions = Readonly<{
  diagnostics?: readonly InvestigationDiagnostic[];
  mutation?: InvestigationMutationDiagnostic;
}>;
type DiscardResultInput = Readonly<{
  changed?: boolean;
  deletedResourceIds?: readonly string[];
  errors: readonly string[];
  id: string;
  input: { investigationsDir?: string; workspaceRoot?: string };
  options?: DiscardResultOptions;
}>;

export function discardResult(
  input: DiscardResultInput
): InvestigationReportDiscardResult {
  return withDiscardMutation(discardResultBase(input), input.options?.mutation);
}

function discardResultBase(
  input: DiscardResultInput
): Omit<InvestigationReportDiscardResult, "mutation"> {
  const location = input.input;
  const options = input.options;
  const root = location.workspaceRoot ?? ".";
  const dir = location.investigationsDir ?? "docs/investigations";
  const sortedErrors = uniqueSorted(input.errors);
  const changed = input.changed === true;
  const deletedResourceIds = sortedDiscardResourceIds(input.deletedResourceIds);
  const diagnostics = defaultDiscardDiagnostics(
    input.id,
    sortedErrors,
    options === undefined ? undefined : options.diagnostics
  );
  const indexPath = path.resolve(root, dir, investigationIndexFileName);
  return {
    changed,
    deletedResourceIds,
    diagnostics,
    errors: sortedErrors,
    id: input.id,
    indexPath,
    requiresRecordedDeletionConfirmation: false
  };
}

function sortedDiscardResourceIds(
  ids: readonly string[] | undefined
): string[] {
  return [...(ids ?? [])].sort(compareText);
}

function withDiscardMutation(
  result: Omit<InvestigationReportDiscardResult, "mutation">,
  mutation: InvestigationMutationDiagnostic | undefined
): InvestigationReportDiscardResult {
  if (mutation === undefined) return result;
  return { ...result, mutation };
}
export function result(
  options: { id: string; indexPath: string },
  changed: boolean,
  deletedResourceIds: readonly string[],
  errors: readonly string[],
  resultOptions: Readonly<{
    diagnostics?: readonly InvestigationDiagnostic[];
    mutation?: InvestigationMutationDiagnostic;
  }> = {}
): InvestigationReportDiscardResult {
  const sortedErrors = uniqueSorted(errors);
  return {
    changed,
    deletedResourceIds: [...deletedResourceIds].sort(compareText),
    diagnostics: defaultDiscardDiagnostics(
      options.id,
      sortedErrors,
      resultOptions.diagnostics
    ),
    errors: sortedErrors,
    id: options.id,
    indexPath: options.indexPath,
    ...(resultOptions.mutation === undefined
      ? {}
      : { mutation: resultOptions.mutation }),
    requiresRecordedDeletionConfirmation: false
  };
}

function defaultDiscardDiagnostics(
  id: string,
  errors: readonly string[],
  diagnostics: readonly InvestigationDiagnostic[] | undefined
): InvestigationDiagnostic[] {
  if (diagnostics !== undefined) return [...diagnostics];
  if (errors.length === 0) return [];
  return [
    genericInvestigationDiagnostic({
      code: "investigation-report.discard-failed",
      reason: errors.join("; "),
      recovery:
        "correct the reported report, resource, relation, or confirmation problem before retrying discard",
      target: id || "requested Investigation ID"
    })
  ];
}

export function discardMutation(
  outcome: InvestigationMutationDiagnostic["outcome"]
): InvestigationMutationDiagnostic {
  return { outcome, scope: "investigation report discard collection" };
}

function isDiscardResult(
  value: unknown
): value is InvestigationReportDiscardResult {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray(Reflect.get(value, "errors")) &&
    Array.isArray(Reflect.get(value, "diagnostics")) &&
    typeof Reflect.get(value, "changed") === "boolean" &&
    typeof Reflect.get(value, "id") === "string"
  );
}
export function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}
export function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
export function errorText(error: unknown): string {
  return sanitizeInvestigationDiagnosticText(error);
}
