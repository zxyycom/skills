import fs from "node:fs/promises";
import path from "node:path";
import { err, errAsync, ok, ResultAsync, type Result } from "neverthrow";
import type { StateSnapshot } from "../../index-runtime/src/index.ts";
import {
  openVersionControl,
  repositoryRelativePathFromFileSystemPath
} from "../../shared/src/version-control/index.ts";
import {
  createInvestigationStateSnapshot,
  inspectInvestigationCollectionLayout,
  readInvestigationSources
} from "./investigation-index-source.ts";
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
  investigationRoot: string
): Promise<ValidatedInvestigationCollection> {
  const indexPath = path.join(investigationRoot, investigationIndexFileName);
  const layout = await inspectInvestigationCollectionLayout(investigationRoot);
  const errors = [...layout.errors];
  if (layout.reportIds.length === 0) {
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
    referencesByReport
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
              [
                `investigation report check could not be completed: ${errorText(error)}`
              ],
              prepared.value.indexPath
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
      >(synchronizeFullCollection(canonical.investigationsDirectory), (error) =>
        syncFailure(
          "operation",
          emptySyncResult(
            [
              `investigation index synchronization could not be completed: ${errorText(error)}`
            ],
            prepared.value.indexPath
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
  const collection =
    await collectValidatedInvestigationCollection(investigationRoot);
  if (collection.errors.length > 0 || collection.snapshot === null) {
    return checkResult(
      collection.reportCount,
      collection.errors,
      false,
      collection.indexPath,
      collection.warnings
    );
  }
  const synchronized = await syncInvestigationStateIndex({
    investigationsDirectory: investigationRoot,
    mode: "check",
    snapshot: collection.snapshot
  });
  const errors =
    synchronized.status === "error"
      ? investigationIndexDiagnosticMessages(
          synchronized.diagnostics,
          collection.indexPath
        )
      : [];
  const warnings = [
    ...collection.warnings,
    ...(await unrecordedPredecessorWarnings(
      investigationRoot,
      collection.states
    ))
  ];
  return checkResult(
    collection.reportCount,
    errors,
    synchronized.status === "ok",
    collection.indexPath,
    warnings
  );
}

async function validateScopedCollection(
  investigationRoot: string,
  ids: readonly string[]
): Promise<InvestigationReportCheckResult> {
  const layout = await inspectInvestigationCollectionLayout(investigationRoot);
  // Scoped checks intentionally do not claim collection-wide layout, graph,
  // resource membership, or index freshness proof. The selected root report
  // and only its direct resource links are the validation boundary.
  const errors: string[] = [];
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
    let text: string;
    try {
      text = await fs.readFile(
        reportPathForInvestigationId(investigationRoot, id),
        "utf8"
      );
    } catch (error) {
      errors.push(`${id} could not be read: ${errorText(error)}`);
      continue;
    }
    const built = buildInvestigationReportState(
      id,
      parseInvestigationReport(text, id)
    );
    errors.push(...built.errors);
    if (built.status === "valid") {
      errors.push(
        ...(await validateReferencedInvestigationResources(
          investigationRoot,
          built.state.resourceIds
        ))
      );
    }
  }
  return checkResult(
    layout.reportIds.length,
    errors,
    false,
    path.join(investigationRoot, investigationIndexFileName),
    [],
    selected.length
  );
}

async function synchronizeFullCollection(
  investigationRoot: string
): Promise<InvestigationIndexSyncResult> {
  const collection =
    await collectValidatedInvestigationCollection(investigationRoot);
  if (collection.errors.length > 0 || collection.snapshot === null) {
    return syncResult(
      collection.reportCount,
      false,
      collection.errors,
      collection.indexPath,
      collection.warnings
    );
  }
  const synchronized = await syncInvestigationStateIndex({
    investigationsDirectory: investigationRoot,
    mode: "write",
    snapshot: collection.snapshot
  });
  const errors =
    synchronized.status === "error"
      ? investigationIndexDiagnosticMessages(
          synchronized.diagnostics,
          collection.indexPath
        )
      : [];
  return syncResult(
    collection.reportCount,
    synchronized.changed,
    errors,
    collection.indexPath,
    collection.warnings
  );
}

function checkResult(
  availableReportCount: number,
  errors: readonly string[],
  indexChecked: boolean,
  indexPath: string,
  warnings: readonly string[] = [],
  selectedReportCount: number = availableReportCount
): InvestigationReportCheckResult {
  return {
    availableReportCount,
    errors: uniqueSorted(errors),
    indexChecked,
    indexPath,
    selectedReportCount,
    warnings: uniqueSorted(warnings)
  };
}

function syncResult(
  reportCount: number,
  changed: boolean,
  errors: readonly string[],
  indexPath: string,
  warnings: readonly string[] = []
): InvestigationIndexSyncResult {
  return {
    changed,
    errors: uniqueSorted(errors),
    indexPath,
    reportCount,
    warnings: uniqueSorted(warnings)
  };
}

function emptyResult(
  errors: readonly string[],
  indexPath: string
): InvestigationReportCheckResult {
  return checkResult(0, errors, false, indexPath, [], 0);
}
function emptySyncResult(
  errors: readonly string[],
  indexPath: string
): InvestigationIndexSyncResult {
  return syncResult(0, false, errors, indexPath);
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

async function unrecordedPredecessorWarnings(
  investigationsDirectory: string,
  states: ReadonlyMap<string, InvestigationIndexState>
): Promise<string[]> {
  const directPredecessors = [...states].flatMap(([source, state]) =>
    state.relations.map((relation) => ({ relation, source }))
  );
  const recordedIds = await recordedInvestigationIdsAtHead(
    investigationsDirectory,
    new Set(directPredecessors.map(({ relation }) => relation.target))
  );
  if (recordedIds === null) return [];
  return uniqueSorted(
    directPredecessors
      .filter(({ relation }) => !recordedIds.has(relation.target))
      .map(
        ({ relation, source }) =>
          `前序报告 ${relation.target} 尚未进入 Git HEAD，请确认 ${source} 的 ${relation.type} 关系是否应保留为独立调查演进。`
      )
  );
}

async function recordedInvestigationIdsAtHead(
  investigationsDirectory: string,
  ids: Iterable<string>
): Promise<Set<string> | null> {
  try {
    const repository = await openVersionControl(investigationsDirectory);
    const revision = await repository.getCurrentRevision();
    if (revision === null) return null;
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
    return new Set(
      revisionFiles.flatMap((filePath) => {
        const id = pathsById.get(filePath);
        return id === undefined ? [] : [id];
      })
    );
  } catch {
    return null;
  }
}
function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
