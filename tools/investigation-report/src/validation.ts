import fs from "node:fs/promises";
import path from "node:path";
import { err, errAsync, ok, ResultAsync, type Result } from "neverthrow";
import {
  isStateIndexText,
  type StateIndexSyncScope,
  type StateSnapshot
} from "../../index-runtime/src/index.ts";
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
  genericInvestigationDiagnostic,
  type InvestigationDiagnostic,
  type InvestigationMutationDiagnostic
} from "./diagnostics.ts";
import {
  investigationIndexDiagnosticMessages,
  investigationIndexFileName,
  loadInvestigationIndex,
  syncInvestigationStateIndex
} from "./investigation-state-index.ts";
import {
  investigationIdFromMarkdown,
  parseInvestigationReport
} from "./markdown.ts";
import {
  parseInvestigationIndexSyncOptions,
  parseInvestigationReportCheckOptions
} from "./options.ts";
import {
  canonicalizeInvestigationsDirectory,
  defaultInvestigationsDirectory,
  isInvestigationId,
  isInvestigationSourcePath,
  normalizeInvestigationSelectorInput,
  parseDatedInvestigationId,
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
  mode: "check" | "write";
  resolved: ResolvedInvestigationsDirectory;
  selectors?: readonly string[];
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
      parseInvestigationReport(source.text, source.id),
      source.sourcePath
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
        emptySyncResult(
          errors,
          prepared.value.indexPath,
          [],
          undefined,
          prepared.value.selectors ?? []
        )
      )
    )
    .andThen((canonical) =>
      ResultAsync.fromPromise<
        InvestigationIndexSyncResult,
        InvestigationIndexSyncFailure
      >(
        synchronizeFullCollectionWithMutationLock(
          canonical.investigationsDirectory,
          prepared.value.mode,
          prepared.value.selectors
        ),
        (error) =>
          syncFailure(
            "operation",
            syncFailureResult(
              error,
              prepared.value.indexPath,
              prepared.value.selectors ?? []
            )
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
          investigationIndexPathForOptions(parsed.value),
          [],
          undefined,
          parsed.value.selectors ?? []
        )
      )
    );
  }
  return ok({
    indexPath: path.join(
      resolved.value.investigationsDirectory,
      investigationIndexFileName
    ),
    mode:
      parsed.value.mode ??
      (parsed.value.selectors === undefined ? "write" : "check"),
    resolved: resolved.value,
    ...(parsed.value.selectors === undefined
      ? {}
      : { selectors: parsed.value.selectors })
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
  const sources = await readInvestigationSources(
    investigationRoot,
    layout.reportIds
  );
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const available = new Set(sourceById.keys());
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
      ...(await validateScopedReport(
        investigationRoot,
        sourceById.get(id)!,
        diagnostics
      ))
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
  source: InvestigationSource,
  diagnostics: InvestigationDiagnostic[]
): Promise<string[]> {
  const { id } = source;
  const target = path.join(investigationRoot, source.sourcePath);
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
    parseInvestigationReport(text, id),
    source.sourcePath
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
  investigationRoot: string,
  mode: "check" | "write",
  selectors: readonly string[] | undefined
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
      selectors: selectors ?? [],
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
      selectors: selectors ?? [],
      warnings: collection.warnings
    });
  }
  return await synchronizeValidatedCollection(
    investigationRoot,
    collection,
    snapshot,
    mode,
    selectors
  );
}

async function synchronizeValidatedCollection(
  investigationRoot: string,
  collection: ValidatedInvestigationCollection,
  snapshot: InvestigationSnapshot,
  mode: "check" | "write",
  selectors: readonly string[] | undefined
): Promise<InvestigationIndexSyncResult> {
  const scope = await selectedInvestigationSyncScope({
    indexPath: collection.indexPath,
    investigationsDirectory: investigationRoot,
    selectors,
    snapshot
  });
  if (scope.status === "error") {
    return syncResult({
      changed: false,
      diagnostics: scope.diagnostics,
      errors: scope.errors,
      indexPath: collection.indexPath,
      reportCount: collection.reportCount,
      scope: "selected",
      selectedIds: [],
      selectors: selectors ?? [],
      state: "selection-invalid",
      warnings: collection.warnings
    });
  }
  const synchronized = await syncInvestigationStateIndex({
    investigationsDirectory: investigationRoot,
    mode,
    snapshot,
    ...(scope.value === undefined ? {} : { scope: scope.value })
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
    changedIds: synchronized.changedIds,
    diagnostics,
    errors,
    indexPath: collection.indexPath,
    mutation,
    reportCount: collection.reportCount,
    scope: synchronized.scope,
    selectedIds: synchronized.selectedIds,
    selectors: selectors ?? [],
    state: synchronized.state,
    warnings: collection.warnings
  });
}

async function synchronizeFullCollectionWithMutationLock(
  investigationRoot: string,
  mode: "check" | "write",
  selectors: readonly string[] | undefined
): Promise<InvestigationIndexSyncResult> {
  return await withInvestigationCollectionMutationLock(
    path.join(investigationRoot, investigationIndexFileName),
    async () =>
      await synchronizeFullCollection(investigationRoot, mode, selectors)
  );
}

async function selectedInvestigationSyncScope(options: {
  indexPath: string;
  investigationsDirectory: string;
  selectors: readonly string[] | undefined;
  snapshot: InvestigationSnapshot;
}): Promise<
  | Readonly<{ status: "ok"; value: StateIndexSyncScope | undefined }>
  | Readonly<{
      diagnostics: InvestigationDiagnostic[];
      errors: string[];
      status: "error";
    }>
> {
  if (options.selectors === undefined)
    return { status: "ok", value: undefined };
  const raw = validateInvestigationSyncSelectors(
    options.selectors,
    options.indexPath
  );
  if (raw.status === "error") return raw;
  const baseline = await loadInvestigationIndex({
    investigationsDirectory: options.investigationsDirectory
  });
  if (baseline.status === "error") {
    return {
      status: "ok",
      value: { kind: "selected", selectedIds: raw.selectors }
    };
  }
  const idsByName = new Map<string, Set<string>>();
  for (const [id, state] of Object.entries(baseline.value.entries)) {
    addIdForInvestigationName(idsByName, state.name, id);
  }
  for (const [id, state] of Object.entries(options.snapshot.states)) {
    addIdForInvestigationName(idsByName, state.name, id);
  }
  const knownIds = new Set([
    ...Object.keys(baseline.value.entries),
    ...Object.keys(options.snapshot.states)
  ]);
  const selectedIds: string[] = [];
  const diagnostics: InvestigationDiagnostic[] = [];
  for (const selector of raw.selectors) {
    const normalized = normalizeInvestigationSelectorInput(selector);
    const dated = parseDatedInvestigationId(normalized);
    const matches =
      dated === null
        ? [...(idsByName.get(normalized) ?? [])].sort(compareText)
        : knownIds.has(dated.id)
          ? [dated.id]
          : [];
    if (matches.length === 1) {
      selectedIds.push(matches[0]!);
      continue;
    }
    diagnostics.push(
      genericInvestigationDiagnostic({
        code:
          matches.length === 0
            ? "investigation-report.selector-not-found"
            : "investigation-report.selector-ambiguous",
        reason:
          matches.length === 0
            ? `Investigation selector does not resolve in the baseline or current collection: ${normalized}`
            : `Investigation name is ambiguous: ${normalized}; choose one standard ID: ${matches.join(", ")}`,
        recovery:
          matches.length === 0
            ? "Use an existing Investigation ID or unique name, then retry the selected sync."
            : "Retry with one listed calendar-valid YYMMDD-name Investigation ID.",
        target: normalized
      })
    );
  }
  if (new Set(selectedIds).size !== selectedIds.length) {
    diagnostics.push(
      genericInvestigationDiagnostic({
        code: "investigation-report.selector-duplicate",
        reason:
          "Selected Investigation selectors resolve to the same Investigation ID.",
        recovery:
          "Select every Investigation ID at most once, then retry the selected sync.",
        target: options.indexPath
      })
    );
  }
  return diagnostics.length > 0
    ? {
        diagnostics,
        errors: diagnostics.map((diagnostic) => diagnostic.reason),
        status: "error"
      }
    : {
        status: "ok",
        value: { kind: "selected", selectedIds: selectedIds.sort(compareText) }
      };
}

function addIdForInvestigationName(
  idsByName: Map<string, Set<string>>,
  name: string,
  id: string
): void {
  const ids = idsByName.get(name) ?? new Set<string>();
  ids.add(id);
  idsByName.set(name, ids);
}

function validateInvestigationSyncSelectors(
  selectors: readonly string[],
  indexPath: string
):
  | Readonly<{ selectors: string[]; status: "ok" }>
  | Readonly<{
      diagnostics: InvestigationDiagnostic[];
      errors: string[];
      status: "error";
    }> {
  const diagnostics: InvestigationDiagnostic[] = [];
  const seen = new Set<string>();
  for (const selector of selectors) {
    if (typeof selector !== "string" || !isStateIndexText(selector)) {
      diagnostics.push(
        genericInvestigationDiagnostic({
          code: "investigation-report.selector-invalid",
          reason:
            "Selected Investigation selectors must be non-empty text without surrounding whitespace or control characters.",
          recovery:
            "Provide a standard Investigation ID or unique name, then retry.",
          target: typeof selector === "string" ? selector : indexPath
        })
      );
      continue;
    }
    if (seen.has(selector)) {
      diagnostics.push(
        genericInvestigationDiagnostic({
          code: "investigation-report.selector-duplicate",
          reason: `Selected Investigation selector appears more than once: ${selector}`,
          recovery: "Select every raw selector at most once, then retry.",
          target: selector
        })
      );
      continue;
    }
    seen.add(selector);
  }
  return diagnostics.length === 0
    ? { selectors: [...selectors], status: "ok" }
    : {
        diagnostics,
        errors: diagnostics.map((diagnostic) => diagnostic.reason),
        status: "error"
      };
}

function syncFailureResult(
  error: unknown,
  indexPath: string,
  selectors: readonly string[] = []
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
      mutation,
      selectors
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
    mutation,
    selectors
  );
}

function isInvestigationIndexSyncResult(
  value: unknown
): value is InvestigationIndexSyncResult {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "changed") === "boolean" &&
    Array.isArray(Reflect.get(value, "changedIds")) &&
    Array.isArray(Reflect.get(value, "diagnostics")) &&
    Array.isArray(Reflect.get(value, "errors")) &&
    typeof Reflect.get(value, "indexPath") === "string" &&
    typeof Reflect.get(value, "reportCount") === "number" &&
    (Reflect.get(value, "scope") === "all" ||
      Reflect.get(value, "scope") === "selected") &&
    Array.isArray(Reflect.get(value, "selectedIds")) &&
    Array.isArray(Reflect.get(value, "selectors")) &&
    typeof Reflect.get(value, "state") === "string" &&
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
    changedIds?: readonly string[];
    diagnostics?: readonly InvestigationDiagnostic[];
    errors: readonly string[];
    indexPath: string;
    mutation?: InvestigationMutationDiagnostic;
    reportCount: number;
    scope?: "all" | "selected";
    selectedIds?: readonly string[];
    selectors?: readonly string[];
    state?: string;
    warnings?: readonly string[];
  }>
): InvestigationIndexSyncResult {
  return {
    changed: options.changed,
    changedIds: [...(options.changedIds ?? [])],
    diagnostics: [...(options.diagnostics ?? [])],
    errors: uniqueSorted(options.errors),
    indexPath: options.indexPath,
    ...(options.mutation === undefined ? {} : { mutation: options.mutation }),
    reportCount: options.reportCount,
    scope: options.scope ?? "all",
    selectedIds: [...(options.selectedIds ?? [])],
    selectors: [...(options.selectors ?? [])],
    state: options.state ?? "source-invalid",
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
  mutation?: InvestigationMutationDiagnostic,
  selectors: readonly string[] = []
): InvestigationIndexSyncResult {
  return syncResult({
    changed: false,
    diagnostics,
    errors,
    indexPath,
    mutation,
    reportCount: 0,
    selectors
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
    const sourcePaths = revisionFiles.filter((filePath) => {
      const sourcePath =
        directoryScope.length === 0
          ? filePath
          : filePath.slice(directoryScope.length + 1);
      return isInvestigationSourcePath(sourcePath);
    });
    const files = await repository.readRevisionFiles(revision, {
      pathScopes: sourcePaths
    });
    const requested = new Set(ids);
    return {
      ids: new Set(
        files.flatMap((file) => {
          const sourcePath =
            directoryScope.length === 0
              ? file.path
              : file.path.slice(directoryScope.length + 1);
          const id =
            investigationIdFromMarkdown(
              Buffer.from(file.data).toString("utf8")
            ) ?? sourcePath.slice(0, -".md".length);
          return requested.has(id) ? [id] : [];
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
