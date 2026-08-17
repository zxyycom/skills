import fs from "node:fs/promises";
import path from "node:path";
import { err, errAsync, ok, ResultAsync, type Result } from "neverthrow";
import type { StateSnapshot } from "../../index-runtime/src/index.ts";
import {
  createInvestigationStateSnapshot,
  inspectInvestigationCollectionLayout
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
  investigationCategoryOf,
  isInvestigationCategory,
  isInvestigationTopicPath,
  normalizeInvestigationTopicPath,
  resolveInvestigationsDirectory,
  validateInvestigationTopicPath,
  type ResolvedInvestigationsDirectory
} from "./report-path.ts";
import { buildInvestigationTopicState } from "./report-validation.ts";
import {
  validateFullInvestigationResources,
  validateReferencedInvestigationResources
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

type Selection = Readonly<{
  active: boolean;
  categories: ReadonlySet<string>;
  paths: ReadonlySet<string>;
}>;

type InvestigationSnapshot = StateSnapshot<
  InvestigationIndexState,
  InvestigationIndexMetadata
>;

type InvestigationReportCheckFailure = Readonly<{
  kind: "invalid-options" | "operation";
  result: InvestigationReportCheckResult;
}>;

type InvestigationIndexSyncFailure = Readonly<{
  kind: "invalid-options" | "operation";
  result: InvestigationIndexSyncResult;
}>;

type PreparedCheck = Readonly<{
  indexPath: string;
  resolved: ResolvedInvestigationsDirectory;
  selection: Selection;
}>;

type PreparedSync = Readonly<{
  indexPath: string;
  resolved: ResolvedInvestigationsDirectory;
}>;

type SnapshotCounts = Readonly<{
  categoryCount: number;
  topicCount: number;
}>;

type FullCollectionValidation =
  | Readonly<{
      counts: SnapshotCounts;
      errors: string[];
      status: "invalid";
      warnings: string[];
    }>
  | Readonly<{
      counts: SnapshotCounts;
      snapshot: InvestigationSnapshot;
      status: "valid";
      warnings: string[];
    }>;

function prepareSelection(
  options: InvestigationReportCheckOptions
): Result<Selection, string[]> {
  const errors: string[] = [];
  const categories = new Set(
    (options.categories ?? []).map((value) => value.trim())
  );
  const paths = new Set(
    (options.paths ?? []).map(normalizeInvestigationTopicPath)
  );

  for (const category of categories) {
    if (!isInvestigationCategory(category)) {
      errors.push(
        `category filter must use kebab-case: ${category || "<empty>"}`
      );
    }
  }
  for (const topicPath of paths) {
    if (!isInvestigationTopicPath(topicPath)) {
      errors.push(
        "path filter must use <category-id>/<semantic-slug>.md: " +
          (topicPath || "<empty>")
      );
    }
  }

  const uniqueErrors = uniqueSorted(errors);
  return uniqueErrors.length > 0
    ? err(uniqueErrors)
    : ok({
        active: categories.size > 0 || paths.size > 0,
        categories,
        paths
      });
}

function selectionMatches(selection: Selection, relativePath: string): boolean {
  const category = investigationCategoryOf(relativePath);
  return (
    (selection.categories.size === 0 ||
      (category !== null && selection.categories.has(category))) &&
    (selection.paths.size === 0 || selection.paths.has(relativePath))
  );
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
    .andThen((canonical) => {
      const checked = prepared.value.selection.active
        ? validateScopedInvestigationCollection(
            canonical.investigationsDirectory,
            prepared.value.selection
          )
        : validateFullInvestigationCollection(
            canonical.investigationsDirectory
          );
      return checked.mapErr((result) => checkFailure("operation", result));
    });
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
  const selection = prepareSelection(parsed.value);
  if (resolved.isErr() || selection.isErr()) {
    return err(
      checkFailure(
        "invalid-options",
        emptyResult(
          [
            ...(resolved.isErr() ? resolved.error : []),
            ...(selection.isErr() ? selection.error : [])
          ],
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
    resolved: resolved.value,
    selection: selection.value
  });
}

function validateFullInvestigationCollection(
  investigationRoot: string
): ResultAsync<InvestigationReportCheckResult, InvestigationReportCheckResult> {
  const indexPath = path.join(investigationRoot, investigationIndexFileName);
  return ResultAsync.fromPromise(
    collectFullInvestigationValidation(investigationRoot),
    (error) =>
      emptyResult(
        [
          "investigation report check could not be completed: " +
            errorText(error)
        ],
        indexPath
      )
  ).andThen((collection) => {
    const collected = checkResult(
      collection.counts,
      collection.status === "invalid" ? collection.errors : [],
      false,
      indexPath,
      collection.warnings
    );
    if (collection.status === "invalid") {
      return errAsync(collected);
    }
    return checkInvestigationSnapshot(
      investigationRoot,
      indexPath,
      collection.snapshot,
      collection.warnings
    );
  });
}

function checkInvestigationSnapshot(
  investigationRoot: string,
  indexPath: string,
  snapshot: InvestigationSnapshot,
  warnings: readonly string[]
): ResultAsync<InvestigationReportCheckResult, InvestigationReportCheckResult> {
  const counts = snapshotCounts(snapshot);
  return ResultAsync.fromPromise(
    syncInvestigationStateIndex({
      investigationsDirectory: investigationRoot,
      mode: "check",
      snapshot
    }),
    (error) =>
      checkResult(
        counts,
        [
          "investigation report check could not be completed: " +
            errorText(error)
        ],
        false,
        indexPath,
        warnings
      )
  ).andThen((synchronized) => {
    const errors =
      synchronized.status === "error"
        ? investigationIndexDiagnosticMessages(synchronized.diagnostics)
        : [];
    const result = checkResult(
      counts,
      errors,
      synchronized.status === "ok" ||
        !synchronized.diagnostics.some(
          (diagnostic) => diagnostic.code === "state-index.source-read-failed"
        ),
      indexPath,
      warnings
    );
    return errors.length > 0 ? err(result) : ok(result);
  });
}

function validateScopedInvestigationCollection(
  investigationRoot: string,
  selection: Selection
): ResultAsync<InvestigationReportCheckResult, InvestigationReportCheckResult> {
  const indexPath = path.join(investigationRoot, investigationIndexFileName);
  return ResultAsync.fromPromise(
    collectScopedInvestigationResult(investigationRoot, selection),
    (error) =>
      emptyResult(
        [
          "investigation report check could not be completed: " +
            errorText(error)
        ],
        indexPath
      )
  ).andThen((result) => (result.errors.length > 0 ? err(result) : ok(result)));
}

async function collectScopedInvestigationResult(
  investigationRoot: string,
  selection: Selection
): Promise<InvestigationReportCheckResult> {
  const errors: string[] = [];
  const layout = await inspectInvestigationCollectionLayout(investigationRoot);
  const fileSet = new Set(layout.topicPaths);
  const candidatePaths = new Set([...layout.topicPaths, ...selection.paths]);
  const selectedPaths = [...candidatePaths]
    .filter((relativePath) => selectionMatches(selection, relativePath))
    .sort(compareText);
  const selectedResourceIds: string[] = [];

  if (selectedPaths.length === 0) {
    errors.push("no investigation topics matched the requested filters");
  }
  for (const relativePath of selectedPaths) {
    errors.push(...validateInvestigationTopicPath(relativePath));
    if (!fileSet.has(relativePath)) {
      const category = investigationCategoryOf(relativePath);
      const layoutError = layout.errors.find(
        (error) =>
          error.startsWith(`${relativePath} `) ||
          (category !== null && error.startsWith(`${category} `))
      );
      errors.push(layoutError ?? `${relativePath} topic file does not exist`);
      continue;
    }
    const reportPath = path.join(investigationRoot, ...relativePath.split("/"));
    let markdown: string;
    try {
      markdown = await fs.readFile(reportPath, "utf8");
    } catch (error) {
      errors.push(`${relativePath} could not be read: ${errorText(error)}`);
      continue;
    }
    const report = parseInvestigationReport(markdown, relativePath);
    const built = buildInvestigationTopicState(relativePath, report);
    errors.push(...built.errors);
    selectedResourceIds.push(...resourceIdsFromReport(report));
  }
  errors.push(
    ...(await validateReferencedInvestigationResources(
      investigationRoot,
      selectedResourceIds
    ))
  );

  return {
    availableTopicCount: layout.topicPaths.length,
    categoryCount: categoriesOf(selectedPaths).size,
    errors: uniqueSorted(errors),
    indexChecked: false,
    indexPath: path.join(investigationRoot, investigationIndexFileName),
    selectedTopicCount: selectedPaths.length,
    warnings: []
  };
}

async function collectFullInvestigationValidation(
  investigationRoot: string
): Promise<FullCollectionValidation> {
  const layout = await inspectInvestigationCollectionLayout(investigationRoot);
  const errors = [...layout.errors];
  const sources: InvestigationSource[] = [];
  const states: InvestigationIndexState[] = [];
  const referencesByTopic = new Map<string, Set<string>>(
    layout.topicPaths.map((topicPath) => [topicPath, new Set<string>()])
  );

  if (layout.topicPaths.length === 0) {
    errors.push("investigation collection must contain at least one topic");
  }

  for (const relativePath of layout.topicPaths) {
    const reportPath = path.join(investigationRoot, ...relativePath.split("/"));
    let markdown: string;
    try {
      markdown = await fs.readFile(reportPath, "utf8");
    } catch (error) {
      errors.push(`${relativePath} could not be read: ${errorText(error)}`);
      continue;
    }
    sources.push({ path: relativePath, text: markdown });
    const report = parseInvestigationReport(markdown, relativePath);
    const built = buildInvestigationTopicState(relativePath, report);
    errors.push(...built.errors);
    if (built.status === "valid") {
      states.push(built.state);
      referencesByTopic.set(
        relativePath,
        new Set(
          built.state.resourceReferences.flatMap(
            (reference) => reference.resourceIds
          )
        )
      );
    }
  }

  const resources = await validateFullInvestigationResources(
    investigationRoot,
    referencesByTopic
  );
  errors.push(...resources.errors);
  const counts = {
    categoryCount: categoriesOf(layout.topicPaths).size,
    topicCount: layout.topicPaths.length
  };
  const uniqueErrors = uniqueSorted(errors);
  if (uniqueErrors.length > 0) {
    return {
      counts,
      errors: uniqueErrors,
      status: "invalid",
      warnings: resources.warnings
    };
  }
  return {
    counts,
    snapshot: createInvestigationStateSnapshot(sources, states),
    status: "valid",
    warnings: resources.warnings
  };
}

function resourceIdsFromReport(
  report: ReturnType<typeof parseInvestigationReport>
): string[] {
  return report.reports.flatMap((entry) => entry.resourceIds);
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
      synchronizeFullInvestigationCollection(
        canonical.investigationsDirectory
      ).mapErr((result) => syncFailure("operation", result))
    );
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

function synchronizeFullInvestigationCollection(
  investigationRoot: string
): ResultAsync<InvestigationIndexSyncResult, InvestigationIndexSyncResult> {
  const indexPath = path.join(investigationRoot, investigationIndexFileName);
  return ResultAsync.fromPromise(
    collectFullInvestigationValidation(investigationRoot),
    (error) =>
      emptySyncResult(
        [
          "investigation index synchronization could not be completed: " +
            errorText(error)
        ],
        indexPath
      )
  ).andThen((collection) => {
    const collected = syncResult(
      collection.counts,
      false,
      collection.status === "invalid" ? collection.errors : [],
      indexPath,
      collection.warnings
    );
    if (collection.status === "invalid") {
      return errAsync(collected);
    }
    return synchronizeInvestigationSnapshot(
      investigationRoot,
      indexPath,
      collection.snapshot,
      collection.warnings
    );
  });
}

function synchronizeInvestigationSnapshot(
  investigationRoot: string,
  indexPath: string,
  snapshot: InvestigationSnapshot,
  warnings: readonly string[]
): ResultAsync<InvestigationIndexSyncResult, InvestigationIndexSyncResult> {
  const counts = snapshotCounts(snapshot);
  return ResultAsync.fromPromise(
    syncInvestigationStateIndex({
      investigationsDirectory: investigationRoot,
      mode: "write",
      snapshot
    }),
    (error) =>
      syncResult(
        counts,
        false,
        [
          "investigation index synchronization could not be completed: " +
            errorText(error)
        ],
        indexPath,
        warnings
      )
  ).andThen((synchronized) => {
    const errors =
      synchronized.status === "error"
        ? investigationIndexDiagnosticMessages(synchronized.diagnostics)
        : [];
    const result = syncResult(
      counts,
      synchronized.changed,
      errors,
      indexPath,
      warnings
    );
    return errors.length > 0 ? err(result) : ok(result);
  });
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

function snapshotCounts(snapshot: InvestigationSnapshot): SnapshotCounts {
  const states = Object.values(snapshot.states);
  return {
    categoryCount: categoriesOf(states.map((state) => state.path)).size,
    topicCount: states.length
  };
}

function checkResult(
  counts: SnapshotCounts,
  errors: readonly string[],
  indexChecked: boolean,
  indexPath: string,
  warnings: readonly string[] = []
): InvestigationReportCheckResult {
  return {
    availableTopicCount: counts.topicCount,
    categoryCount: counts.categoryCount,
    errors: uniqueSorted(errors),
    indexChecked,
    indexPath,
    selectedTopicCount: counts.topicCount,
    warnings: uniqueSorted(warnings)
  };
}

function syncResult(
  counts: SnapshotCounts,
  changed: boolean,
  errors: readonly string[],
  indexPath: string,
  warnings: readonly string[] = []
): InvestigationIndexSyncResult {
  return {
    categoryCount: counts.categoryCount,
    changed,
    errors: uniqueSorted(errors),
    indexPath,
    topicCount: counts.topicCount,
    warnings: uniqueSorted(warnings)
  };
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

function emptyResult(
  errors: readonly string[],
  indexPath: string
): InvestigationReportCheckResult {
  return {
    availableTopicCount: 0,
    categoryCount: 0,
    errors: uniqueSorted(errors),
    indexChecked: false,
    indexPath,
    selectedTopicCount: 0,
    warnings: []
  };
}

function emptySyncResult(
  errors: readonly string[],
  indexPath: string
): InvestigationIndexSyncResult {
  return {
    categoryCount: 0,
    changed: false,
    errors: uniqueSorted(errors),
    indexPath,
    topicCount: 0,
    warnings: []
  };
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

function categoriesOf(paths: readonly string[]): Set<string> {
  return new Set(
    paths.flatMap((relativePath) => {
      const category = investigationCategoryOf(relativePath);
      return category === null ? [] : [category];
    })
  );
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
