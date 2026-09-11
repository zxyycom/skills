import path from "node:path";
import {
  isStateIndexText,
  type StateIndexSyncScope
} from "../../index-runtime/src/index.ts";
import { withInvestigationCollectionMutationLock } from "./collection-mutation-lock.ts";
import {
  genericInvestigationDiagnostic,
  type InvestigationDiagnostic
} from "./diagnostics.ts";
import {
  investigationIndexDiagnosticMessages,
  investigationIndexFileName,
  loadInvestigationIndex,
  syncInvestigationStateIndex
} from "./investigation-state-index.ts";
import {
  normalizeInvestigationSelectorInput,
  parseDatedInvestigationId
} from "./report-path.ts";
import {
  collectValidatedInvestigationCollection,
  type InvestigationSnapshot,
  type ValidatedInvestigationCollection
} from "./validation-collection.ts";
import type { InvestigationIndexSyncResult } from "./types.ts";
import {
  compareText,
  lstatOrNull,
  stateIndexSyncDiagnostics,
  syncMutation,
  syncResult
} from "./validation-results.ts";
import {
  duplicateResolvedSelectorDiagnostic,
  investigationSelectorContext,
  type InvestigationSelectorContext
} from "./validation-sync-selectors.ts";

export async function synchronizeFullCollection(
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
  if (scope.status === "error")
    return invalidSelectedSyncResult(collection, selectors, scope);
  const synchronized = await syncInvestigationStateIndex(
    syncRequest(investigationRoot, mode, snapshot, scope.value)
  );
  return synchronizedSyncResult(collection, selectors, synchronized);
}

function invalidSelectedSyncResult(
  collection: ValidatedInvestigationCollection,
  selectors: readonly string[] | undefined,
  scope: Extract<
    Awaited<ReturnType<typeof selectedInvestigationSyncScope>>,
    { status: "error" }
  >
): InvestigationIndexSyncResult {
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

function syncRequest(
  investigationsDirectory: string,
  mode: "check" | "write",
  snapshot: InvestigationSnapshot,
  scope: StateIndexSyncScope | undefined
) {
  return {
    investigationsDirectory,
    mode,
    snapshot,
    ...(scope === undefined ? {} : { scope })
  };
}

function synchronizedSyncResult(
  collection: ValidatedInvestigationCollection,
  selectors: readonly string[] | undefined,
  synchronized: Awaited<ReturnType<typeof syncInvestigationStateIndex>>
): InvestigationIndexSyncResult {
  const failure = synchronized.status === "error" ? synchronized : null;
  const diagnostics =
    failure === null
      ? []
      : stateIndexSyncDiagnostics(failure, collection.indexPath);
  const errors =
    failure === null
      ? []
      : investigationIndexDiagnosticMessages(
          failure.diagnostics,
          collection.indexPath
        );
  const mutation = syncFailureMutation(failure, diagnostics);
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

function syncFailureMutation(
  failure: Extract<
    Awaited<ReturnType<typeof syncInvestigationStateIndex>>,
    { status: "error" }
  > | null,
  diagnostics: readonly InvestigationDiagnostic[]
) {
  if (diagnostics.length === 0) return undefined;
  return syncMutation(
    failure?.state === "index-write-failed" ? "partial-or-unknown" : "no-change"
  );
}

export async function synchronizeFullCollectionWithMutationLock(
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
  if (baseline.status === "error")
    return {
      status: "ok",
      value: { kind: "selected", selectedIds: raw.selectors }
    };
  const resolved = resolveSelectedInvestigationIds(
    raw.selectors,
    baseline.value.entries,
    options.snapshot,
    options.indexPath
  );
  return resolved.diagnostics.length > 0
    ? {
        diagnostics: resolved.diagnostics,
        errors: resolved.diagnostics.map((diagnostic) => diagnostic.reason),
        status: "error"
      }
    : {
        status: "ok",
        value: { kind: "selected", selectedIds: resolved.ids.sort(compareText) }
      };
}

type SelectedIdResolution = Readonly<{
  diagnostics: InvestigationDiagnostic[];
  ids: string[];
}>;

function resolveSelectedInvestigationIds(
  selectors: readonly string[],
  baseline: Record<string, { name: string }>,
  snapshot: InvestigationSnapshot,
  indexPath: string
): SelectedIdResolution {
  const context = investigationSelectorContext(baseline, snapshot);
  const diagnostics: InvestigationDiagnostic[] = [];
  const ids = selectors.flatMap((selector) =>
    resolveSelectedId(selector, context, diagnostics)
  );
  if (new Set(ids).size !== ids.length)
    diagnostics.push(duplicateResolvedSelectorDiagnostic(indexPath));
  return { diagnostics, ids };
}

function resolveSelectedId(
  selector: string,
  context: InvestigationSelectorContext,
  diagnostics: InvestigationDiagnostic[]
): string[] {
  const normalized = normalizeInvestigationSelectorInput(selector);
  const dated = parseDatedInvestigationId(normalized);
  const matches =
    dated === null
      ? [...(context.idsByName.get(normalized) ?? [])].sort(compareText)
      : context.knownIds.has(dated.id)
        ? [dated.id]
        : [];
  if (matches.length === 1) return matches;
  diagnostics.push(unresolvedSelectorDiagnostic(normalized, matches));
  return [];
}

function unresolvedSelectorDiagnostic(
  normalized: string,
  matches: readonly string[]
): InvestigationDiagnostic {
  const missing = matches.length === 0;
  return genericInvestigationDiagnostic({
    code: missing
      ? "investigation-report.selector-not-found"
      : "investigation-report.selector-ambiguous",
    reason: missing
      ? `Investigation selector does not resolve in the baseline or current collection: ${normalized}`
      : `Investigation name is ambiguous: ${normalized}; choose one standard ID: ${matches.join(", ")}`,
    recovery: missing
      ? "Use an existing Investigation ID or unique name, then retry the selected sync."
      : "Retry with one listed calendar-valid YYMMDD-name Investigation ID.",
    target: normalized
  });
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
