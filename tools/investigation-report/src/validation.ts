import fs from "node:fs/promises";
import path from "node:path";
import { err, errAsync, ok, ResultAsync, type Result } from "neverthrow";
import type { StateSnapshot } from "../../index-runtime/src/index.ts";
import { operationErrorDetail } from "../../shared/src/version-control/error-detail.ts";
import {
  openVersionControl,
  repositoryRelativePathFromFileSystemPath,
  VersionControlError
} from "../../shared/src/version-control/index.ts";
import {
  createInvestigationStateSnapshot,
  inspectInvestigationCollectionLayout,
  readInvestigationSources
} from "./investigation-index-source.ts";
import { readCandidateAuthoringResourceReferences } from "./candidate.ts";
import {
  InvestigationCollectionMutationLockError,
  withInvestigationCollectionMutationLock
} from "./collection-mutation-lock.ts";
import {
  diagnosticFromError,
  diagnosticFromStateIndexDiagnostic,
  type InvestigationDiagnostic,
  type InvestigationMutationDiagnostic
} from "./diagnostics.ts";
import {
  investigationIndexDiagnosticMessages,
  investigationIndexFileName,
  syncInvestigationStateIndex
} from "./investigation-state-index.ts";
import { parseInvestigationReport } from "./markdown.ts";
import {
  parseInvestigationIndexSyncOptions,
  parseInvestigationReportCheckOptions
} from "./options.ts";
import {
  canonicalizeInvestigationsDirectory,
  defaultInvestigationsDirectory,
  isInvestigationId,
  reportPathForInvestigationId,
  resolveInvestigationsDirectory,
  type ResolvedInvestigationsDirectory
} from "./report-path.ts";
import { validateInvestigationRelationGraph } from "./relation-validation.ts";
import { buildInvestigationReportState } from "./report-validation.ts";
import {
  validateFullInvestigationResources,
  validateReferencedInvestigationResources,
  type InvestigationResourceReferencesByReport
} from "./resources.ts";
import type {
  InvestigationIndexMetadata,
  InvestigationIndexState,
  InvestigationIndexSyncOptions,
  InvestigationIndexSyncResult,
  InvestigationReportCheckOptions,
  InvestigationReportCheckResult,
  InvestigationSource
} from "./types.ts";

type InvestigationSnapshot = StateSnapshot<
  InvestigationIndexState,
  InvestigationIndexMetadata
>;

export type ValidatedInvestigationCollection = Readonly<{
  errors: string[];
  indexPath: string;
  reportCount: number;
  snapshot: InvestigationSnapshot | null;
  sources: InvestigationSource[];
  states: Map<string, InvestigationIndexState>;
  warnings: string[];
}>;

type InvestigationReportCheckFailure = Readonly<{
  kind: "invalid-options" | "operation";
  result: InvestigationReportCheckResult;
}>;
type InvestigationIndexSyncFailure = Readonly<{
  kind: "invalid-options" | "operation";
  result: InvestigationIndexSyncResult;
}>;
type PreparedCheck = Readonly<{
  ids: string[];
  indexPath: string;
  resolved: ResolvedInvestigationsDirectory;
}>;
type PreparedSync = Readonly<{
  indexPath: string;
  resolved: ResolvedInvestigationsDirectory;
}>;

export async function collectValidatedInvestigationCollection(
  investigationRoot: string,
  options: { allowEmptyCollection?: boolean } = {}
): Promise<ValidatedInvestigationCollection> {
  const indexPath = path.join(investigationRoot, investigationIndexFileName);
  const layout = await inspectInvestigationCollectionLayout(investigationRoot);
  const errors = [...layout.errors];
  if (layout.reportIds.length === 0 && !options.allowEmptyCollection) {
    errors.push("investigation collection must contain at least one report");
  }
  const sources =
    layout.errors.length > 0
      ? []
      : await readInvestigationSources(investigationRoot, layout.reportIds);
  const states = new Map<string, InvestigationIndexState>();
  for (const source of sources) {
    const built = buildInvestigationReportState(
      source.id,
      parseInvestigationReport(source.text, source.id)
    );
    if (built.status === "invalid") {
      errors.push(...built.errors);
    } else {
      states.set(source.id, built.state);
    }
  }
  if (errors.length === 0) {
    errors.push(...validateInvestigationRelationGraph(states));
  }
  const referencesByReport: InvestigationResourceReferencesByReport = new Map(
    [...states.entries()].map(([id, state]) => [id, new Set(state.resourceIds)])
  );
  const resources = await validateFullInvestigationResources(
    investigationRoot,
    referencesByReport,
    {
      authoringReferencesByReport:
        await readCandidateAuthoringResourceReferences(investigationRoot)
    }
  );
  errors.push(...resources.errors);
  const sortedErrors = uniqueSorted(errors);
  return {
    errors: sortedErrors,
    indexPath,
    reportCount: layout.reportIds.length,
    snapshot:
      sortedErrors.length === 0
        ? createInvestigationStateSnapshot(sources, [...states.values()])
        : null,
    sources,
    states,
    warnings: resources.warnings
  };
}

export function executeInvestigationReportCheck(
  input: unknown
): ResultAsync<
  InvestigationReportCheckResult,
  InvestigationReportCheckFailure
> {
  const prepared = prepareCheck(input);
  if (prepared.isErr()) {
    return errAsync(prepared.error);
  }
  return canonicalizeInvestigationsDirectory(prepared.value.resolved)
    .mapErr((errors) =>
      checkFailure("operation", emptyResult(errors, prepared.value.indexPath))
    )
    .andThen((canonical) =>
      ResultAsync.fromPromise<
        InvestigationReportCheckResult,
        InvestigationReportCheckFailure
      >(
        prepared.value.ids.length > 0
          ? validateScopedCollection(
              canonical.investigationsDirectory,
              prepared.value.ids
            )
          : validateFullCollection(canonical.investigationsDirectory),
        (error) =>
          checkFailure(
            "operation",
            emptyResult(
              ["investigation report check could not be completed"],
              prepared.value.indexPath,
              [
                diagnosticFromError({
                  code: "investigation-report.check-unavailable",
                  error,
                  reason:
                    "the investigation report check could not be completed",
                  recovery:
                    "correct the reported collection failure, then retry the check",
                  target: prepared.value.indexPath
                })
              ]
            )
          )
      )
    )
    .andThen((result) =>
      result.errors.length === 0
        ? ok(result)
        : err(checkFailure("operation", result))
    );
}

export async function validateInvestigationReports(
  options: InvestigationReportCheckOptions
): Promise<InvestigationReportCheckResult> {
  const executed = await executeInvestigationReportCheck(options);
  return executed.match(
    (result) => result,
    (failure) => failure.result
  );
}

export function executeInvestigationIndexSync(
  input: unknown
): ResultAsync<InvestigationIndexSyncResult, InvestigationIndexSyncFailure> {
  const prepared = prepareSync(input);
  if (prepared.isErr()) {
    return errAsync(prepared.error);
  }
  return canonicalizeInvestigationsDirectory(prepared.value.resolved)
    .mapErr((errors) =>
      syncFailure(
        "operation",
        emptySyncResult(errors, prepared.value.indexPath)
      )
    )
    .andThen((canonical) =>
      ResultAsync.fromPromise<
        InvestigationIndexSyncResult,
        InvestigationIndexSyncFailure
      >(
        synchronizeFullCollectionWithMutationLock(
          canonical.investigationsDirectory
        ),
        (error) =>
          syncFailure(
            "operation",
            syncFailureResult(error, prepared.value.indexPath)
          )
      )
    )
    .andThen((result) =>
      result.errors.length === 0
        ? ok(result)
        : err(syncFailure("operation", result))
    );
}

export async function synchronizeInvestigationIndex(
  options: InvestigationIndexSyncOptions
): Promise<InvestigationIndexSyncResult> {
  const executed = await executeInvestigationIndexSync(options);
  return executed.match(
    (result) => result,
    (failure) => failure.result
  );
}

function prepareCheck(
  input: unknown
): Result<PreparedCheck, InvestigationReportCheckFailure> {
  const parsed = parseInvestigationReportCheckOptions(input);
  if (parsed.isErr()) {
    return err(
      checkFailure(
        "invalid-options",
        emptyResult(parsed.error, defaultInvestigationIndexPath())
      )
    );
  }
  const resolved = resolveInvestigationsDirectory(
    parsed.value.workspaceRoot,
    parsed.value.investigationsDir
  );
  const ids = uniqueSorted(parsed.value.ids ?? []);
  const invalidIds = ids.filter((id) => !isInvestigationId(id));
  if (resolved.isErr() || invalidIds.length > 0) {
    return err(
      checkFailure(
        "invalid-options",
        emptyResult(
          [
            ...(resolved.isErr() ? resolved.error : []),
            ...invalidIds.map(
              (id) => `${id || "<empty>"} check id must use an Investigation ID`
            )
          ],
          investigationIndexPathForOptions(parsed.value)
        )
      )
    );
  }
  return ok({
    ids,
    indexPath: path.join(
      resolved.value.investigationsDirectory,
      investigationIndexFileName
    ),
    resolved: resolved.value
  });
}

function prepareSync(
  input: unknown
): Result<PreparedSync, InvestigationIndexSyncFailure> {
  const parsed = parseInvestigationIndexSyncOptions(input);
  if (parsed.isErr()) {
    return err(
      syncFailure(
        "invalid-options",
        emptySyncResult(parsed.error, defaultInvestigationIndexPath())
      )
    );
  }
  const resolved = resolveInvestigationsDirectory(
    parsed.value.workspaceRoot,
    parsed.value.investigationsDir
  );
  if (resolved.isErr()) {
    return err(
      syncFailure(
        "invalid-options",
        emptySyncResult(
          resolved.error,
          investigationIndexPathForOptions(parsed.value)
        )
      )
    );
  }
  return ok({
    indexPath: path.join(
      resolved.value.investigationsDirectory,
      investigationIndexFileName
    ),
    resolved: resolved.value
  });
}

async function validateFullCollection(
  investigationRoot: string
): Promise<InvestigationReportCheckResult> {
  const collection = await collectValidatedInvestigationCollection(
    investigationRoot,
    {
      allowEmptyCollection: true
    }
  );
  if (collection.errors.length > 0 || collection.snapshot === null) {
    return checkResult({
      availableReportCount: collection.reportCount,
      errors: collection.errors,
      indexChecked: false,
      indexPath: collection.indexPath,
      warnings: collection.warnings
    });
  }
  const snapshot = collection.snapshot;
  if (
    collection.reportCount === 0 &&
    (await lstatOrNull(collection.indexPath)) === null
  ) {
    return checkResult({
      availableReportCount: 0,
      errors: ["investigation collection must contain at least one report"],
      indexChecked: false,
      indexPath: collection.indexPath,
      warnings: collection.warnings
    });
  }
  return await validateSynchronizedCollection(
    investigationRoot,
    collection,
    snapshot
  );
}

async function validateSynchronizedCollection(
  investigationRoot: string,
  collection: ValidatedInvestigationCollection,
  snapshot: InvestigationSnapshot
): Promise<InvestigationReportCheckResult> {
  const synchronized = await syncInvestigationStateIndex({
    investigationsDirectory: investigationRoot,
    mode: "check",
    snapshot
  });
  const errors =
    synchronized.status === "error"
      ? investigationIndexDiagnosticMessages(
          synchronized.diagnostics,
          collection.indexPath
        )
      : [];
  const diagnostics =
    synchronized.status === "error"
      ? synchronized.diagnostics.map((diagnostic) =>
          diagnosticFromStateIndexDiagnostic(diagnostic, {
            recovery:
              "correct the reported derived-index problem, then retry the check",
            target: collection.indexPath
          })
        )
      : [];
  const warnings = [
    ...collection.warnings,
    ...(await unrecordedPredecessorWarnings(
      investigationRoot,
      collection.states
    ))
  ];
  return checkResult({
    availableReportCount: collection.reportCount,
    diagnostics,
    errors,
    indexChecked: synchronized.status === "ok",
    indexPath: collection.indexPath,
    selectedReportCount: collection.reportCount,
    warnings
  });
}

async function validateScopedCollection(
  investigationRoot: string,
  ids: readonly string[]
): Promise<InvestigationReportCheckResult> {
  const layout = await inspectInvestigationCollectionLayout(investigationRoot);
  // Scoped checks intentionally do not claim collection-wide layout, graph,
  // resource membership, or index freshness proof. The selected root report
  // and only its direct resource links are the validation boundary.
  const errors: string[] = [...layout.candidateErrors];
  const diagnostics: InvestigationDiagnostic[] = [];
  const available = new Set(layout.reportIds);
  const selected = ids.filter((id) => available.has(id));
  if (selected.length === 0) {
    errors.push("no investigation reports matched the requested IDs");
  }
  for (const id of ids) {
    if (!available.has(id)) {
      errors.push(`${id} investigation report does not exist`);
      continue;
    }
    errors.push(
      ...(await validateScopedReport(investigationRoot, id, diagnostics))
    );
  }
  return checkResult({
    availableReportCount: layout.reportIds.length,
    diagnostics,
    errors,
    indexChecked: false,
    indexPath: path.join(investigationRoot, investigationIndexFileName),
    selectedReportCount: selected.length
  });
}

async function validateScopedReport(
  investigationRoot: string,
  id: string,
  diagnostics: InvestigationDiagnostic[]
): Promise<string[]> {
  const target = reportPathForInvestigationId(investigationRoot, id);
  let text: string;
  try {
    text = await fs.readFile(target, "utf8");
  } catch (error) {
    diagnostics.push(
      diagnosticFromError({
        code: "investigation-report.report-read-failed",
        error,
        reason: "the selected investigation report could not be read",
        recovery: "restore read access to the report, then retry the check",
        target
      })
    );
    return [`${id} could not be read`];
  }
  const built = buildInvestigationReportState(
    id,
    parseInvestigationReport(text, id)
  );
  if (built.status !== "valid") return built.errors;
  return [
    ...built.errors,
    ...(await validateReferencedInvestigationResources(
      investigationRoot,
      built.state.resourceIds
    ))
  ];
}

async function synchronizeFullCollection(
  investigationRoot: string
): Promise<InvestigationIndexSyncResult> {
  const collection = await collectValidatedInvestigationCollection(
    investigationRoot,
    { allowEmptyCollection: true }
  );
  if (collection.errors.length > 0 || collection.snapshot === null) {
    return syncResult({
      changed: false,
      errors: collection.errors,
      indexPath: collection.indexPath,
      reportCount: collection.reportCount,
      warnings: collection.warnings
    });
  }
  const snapshot = collection.snapshot;
  if (
    collection.reportCount === 0 &&
    (await lstatOrNull(collection.indexPath)) === null
  ) {
    return syncResult({
      changed: false,
      errors: ["investigation collection must contain at least one report"],
      indexPath: collection.indexPath,
      reportCount: 0,
      warnings: collection.warnings
    });
  }
  return await synchronizeValidatedCollection(
    investigationRoot,
    collection,
    snapshot
  );
}

async function synchronizeValidatedCollection(
  investigationRoot: string,
  collection: ValidatedInvestigationCollection,
  snapshot: InvestigationSnapshot
): Promise<InvestigationIndexSyncResult> {
  const synchronized = await syncInvestigationStateIndex({
    investigationsDirectory: investigationRoot,
    mode: "write",
    snapshot
  });
  const errors =
    synchronized.status === "error"
      ? investigationIndexDiagnosticMessages(
          synchronized.diagnostics,
          collection.indexPath
        )
      : [];
  const diagnostics =
    synchronized.status === "error"
      ? stateIndexSyncDiagnostics(synchronized, collection.indexPath)
      : [];
  const mutation =
    diagnostics.length === 0
      ? undefined
      : syncMutation(
          synchronized.status === "error" &&
            synchronized.state === "index-write-failed"
            ? "partial-or-unknown"
            : "no-change"
        );
  return syncResult({
    changed: synchronized.changed,
    diagnostics,
    errors,
    indexPath: collection.indexPath,
    mutation,
    reportCount: collection.reportCount,
    warnings: collection.warnings
  });
}

async function synchronizeFullCollectionWithMutationLock(
  investigationRoot: string
): Promise<InvestigationIndexSyncResult> {
  return await withInvestigationCollectionMutationLock(
    path.join(investigationRoot, investigationIndexFileName),
    async () => await synchronizeFullCollection(investigationRoot)
  );
}

function syncFailureResult(
  error: unknown,
  indexPath: string
): InvestigationIndexSyncResult {
  if (error instanceof InvestigationCollectionMutationLockError) {
    if (
      error.operationCompleted &&
      isInvestigationIndexSyncResult(error.operationResult)
    ) {
      const completed = error.operationResult;
      const mutation =
        completed.mutation ??
        syncMutation(
          completed.changed ? "committed-cleanup-pending" : "no-change"
        );
      return {
        ...completed,
        diagnostics: [
          ...completed.diagnostics,
          { ...error.diagnostic, mutation }
        ],
        errors: uniqueSorted([...completed.errors, error.message]),
        mutation
      };
    }
    const mutation = syncMutation(
      error.diagnostic.code ===
        "investigation-report.collection-lock-release-failed"
        ? "partial-or-unknown"
        : "no-change"
    );
    return emptySyncResult(
      [error.message],
      indexPath,
      [{ ...error.diagnostic, mutation }],
      mutation
    );
  }
  const mutation = syncMutation("partial-or-unknown");
  return emptySyncResult(
    ["investigation index synchronization could not be completed"],
    indexPath,
    [
      diagnosticFromError({
        code: "investigation-report.sync-transaction-failed",
        error,
        mutation,
        reason: "the index synchronization transaction stopped unexpectedly",
        recovery:
          "inspect the reported failure and verify the collection and index before retrying",
        target: indexPath
      })
    ],
    mutation
  );
}

function isInvestigationIndexSyncResult(
  value: unknown
): value is InvestigationIndexSyncResult {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "changed") === "boolean" &&
    Array.isArray(Reflect.get(value, "diagnostics")) &&
    Array.isArray(Reflect.get(value, "errors")) &&
    typeof Reflect.get(value, "indexPath") === "string" &&
    typeof Reflect.get(value, "reportCount") === "number" &&
    Array.isArray(Reflect.get(value, "warnings"))
  );
}

function stateIndexSyncDiagnostics(
  result: Extract<
    Awaited<ReturnType<typeof syncInvestigationStateIndex>>,
    { status: "error" }
  >,
  indexPath: string
): InvestigationDiagnostic[] {
  const mutation = syncMutation(
    result.state === "index-write-failed" ? "partial-or-unknown" : "no-change"
  );
  return result.diagnostics.map((diagnostic) => ({
    ...diagnosticFromStateIndexDiagnostic(diagnostic, {
      mutation,
      recovery:
        "correct the reported derived-index problem, then retry the synchronization",
      target: indexPath
    })
  }));
}

function syncMutation(
  outcome: InvestigationMutationDiagnostic["outcome"]
): InvestigationMutationDiagnostic {
  return { outcome, scope: "investigation report index collection" };
}

function checkResult(
  options: Readonly<{
    availableReportCount: number;
    diagnostics?: readonly InvestigationDiagnostic[];
    errors: readonly string[];
    indexChecked: boolean;
    indexPath: string;
    selectedReportCount?: number;
    warnings?: readonly string[];
  }>
): InvestigationReportCheckResult {
  return {
    availableReportCount: options.availableReportCount,
    diagnostics: [...(options.diagnostics ?? [])],
    errors: uniqueSorted(options.errors),
    indexChecked: options.indexChecked,
    indexPath: options.indexPath,
    selectedReportCount:
      options.selectedReportCount ?? options.availableReportCount,
    warnings: uniqueSorted(options.warnings ?? [])
  };
}

function syncResult(
  options: Readonly<{
    changed: boolean;
    diagnostics?: readonly InvestigationDiagnostic[];
    errors: readonly string[];
    indexPath: string;
    mutation?: InvestigationMutationDiagnostic;
    reportCount: number;
    warnings?: readonly string[];
  }>
): InvestigationIndexSyncResult {
  return {
    changed: options.changed,
    diagnostics: [...(options.diagnostics ?? [])],
    errors: uniqueSorted(options.errors),
    indexPath: options.indexPath,
    ...(options.mutation === undefined ? {} : { mutation: options.mutation }),
    reportCount: options.reportCount,
    warnings: uniqueSorted(options.warnings ?? [])
  };
}

function emptyResult(
  errors: readonly string[],
  indexPath: string,
  diagnostics: readonly InvestigationDiagnostic[] = []
): InvestigationReportCheckResult {
  return checkResult({
    availableReportCount: 0,
    diagnostics,
    errors,
    indexChecked: false,
    indexPath,
    selectedReportCount: 0
  });
}
function emptySyncResult(
  errors: readonly string[],
  indexPath: string,
  diagnostics: readonly InvestigationDiagnostic[] = [],
  mutation?: InvestigationMutationDiagnostic
): InvestigationIndexSyncResult {
  return syncResult({
    changed: false,
    diagnostics,
    errors,
    indexPath,
    mutation,
    reportCount: 0
  });
}
function checkFailure(
  kind: InvestigationReportCheckFailure["kind"],
  result: InvestigationReportCheckResult
): InvestigationReportCheckFailure {
  return { kind, result };
}
function syncFailure(
  kind: InvestigationIndexSyncFailure["kind"],
  result: InvestigationIndexSyncResult
): InvestigationIndexSyncFailure {
  return { kind, result };
}
function defaultInvestigationIndexPath(): string {
  return path.join(
    path.resolve("."),
    defaultInvestigationsDirectory,
    investigationIndexFileName
  );
}
function investigationIndexPathForOptions(options: {
  investigationsDir?: string;
  workspaceRoot: string;
}): string {
  return path.join(
    path.resolve(
      options.workspaceRoot,
      options.investigationsDir ?? defaultInvestigationsDirectory
    ),
    investigationIndexFileName
  );
}
function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

export async function unrecordedPredecessorWarnings(
  investigationsDirectory: string,
  states: ReadonlyMap<string, InvestigationIndexState>
): Promise<string[]> {
  const directPredecessors = [...states].flatMap(([source, state]) =>
    state.relations.map((relation) => ({ relation, source }))
  );
  const recorded = await recordedInvestigationIdsAtHead(
    investigationsDirectory,
    new Set(directPredecessors.map(({ relation }) => relation.target))
  );
  if (recorded.status === "unavailable") return [recorded.warning];
  if (recorded.status === "no-head") return [];
  return uniqueSorted(
    directPredecessors
      .filter(({ relation }) => !recorded.ids.has(relation.target))
      .map(
        ({ relation, source }) =>
          `前序报告 ${relation.target} 尚未进入 Git HEAD，请确认 ${source} 的 ${relation.type} 关系是否应保留为独立调查演进。`
      )
  );
}

async function recordedInvestigationIdsAtHead(
  investigationsDirectory: string,
  ids: Iterable<string>
): Promise<
  | { ids: Set<string>; status: "available" }
  | { status: "no-head" }
  | { status: "unavailable"; warning: string }
> {
  try {
    const repository = await openVersionControl(investigationsDirectory);
    const revision = await repository.getCurrentRevision();
    if (revision === null) return { status: "no-head" };
    const directoryScope =
      path.resolve(investigationsDirectory) === repository.rootDirectory
        ? ""
        : repositoryRelativePathFromFileSystemPath(
            repository.rootDirectory,
            investigationsDirectory
          );
    const revisionFiles =
      directoryScope.length === 0
        ? await repository.listRevisionFiles(revision)
        : await repository.listRevisionFiles(revision, {
            pathScopes: [directoryScope]
          });
    const pathsById = new Map(
      [...ids].map((id) => [
        directoryScope.length === 0 ? id : `${directoryScope}/${id}`,
        id
      ])
    );
    return {
      ids: new Set(
        revisionFiles.flatMap((filePath) => {
          const id = pathsById.get(filePath);
          return id === undefined ? [] : [id];
        })
      ),
      status: "available"
    };
  } catch (error) {
    if (
      error instanceof VersionControlError &&
      error.code === "not-repository"
    ) {
      return { status: "no-head" };
    }
    return {
      status: "unavailable",
      warning: historyCheckUnavailableWarning(investigationsDirectory, error)
    };
  }
}

function historyCheckUnavailableWarning(
  investigationsDirectory: string,
  error: unknown
): string {
  const fields =
    error instanceof VersionControlError
      ? [
          `causeCategory: ${error.causeCategory}`,
          ...(error.operation === null
            ? []
            : [`operation: ${error.operation}`]),
          ...(error.detail === null ? [] : [`detail: ${error.detail}`])
        ]
      : operationErrorDetail(error) === null
        ? []
        : [`detail: ${operationErrorDetail(error)}`];
  return [
    "[investigation-report.history-check-unavailable]",
    `target: ${investigationsDirectory}`,
    "reason: the Git HEAD predecessor check could not be completed",
    "next: restore version-control access, then rerun the full check before relying on predecessor warnings",
    ...fields
  ].join("; ");
}
function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
async function lstatOrNull(
  filePath: string
): Promise<Awaited<ReturnType<typeof fs.lstat>> | null> {
  try {
    return await fs.lstat(filePath);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      Reflect.get(error, "code") === "ENOENT"
    )
      return null;
    throw error;
  }
}
