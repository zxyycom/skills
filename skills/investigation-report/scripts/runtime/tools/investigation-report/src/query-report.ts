/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/query-report.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/query-report.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/query-report.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import { showPublishedRecord } from "../../record-operations/src/query.ts";
import { createInvestigationStateIndexDefinition } from "./investigation-index-definition.ts";
import { investigationSourceRevision } from "./investigation-source-revision.ts";
import {
  normalizeInvestigationSelectorInput,
  parseDatedInvestigationId
} from "./report-path.ts";
import path from "node:path";
import { err, errAsync, ok, ResultAsync, type Result } from "neverthrow";
import {
  diagnosticFromError,
  diagnosticFromStateIndexDiagnostic
} from "./diagnostics.ts";
import { investigationIdFromMarkdown } from "./markdown.ts";
import {
  investigationIndexDiagnosticMessages,
  investigationIndexFileName,
  loadInvestigationQueryIndex
} from "./investigation-state-index.ts";
import { persistedSnapshotBodyWarning } from "./index-staleness.ts";
import {
  parseInvestigationReportShowOptions,
  parseInvestigationReportTraceOptions
} from "./options.ts";
import {
  canonicalizeInvestigationsDirectory,
  resolveInvestigationsDirectory
} from "./report-path.ts";
import type { InvestigationRelationContext } from "./relation-context.ts";
import {
  normalizeInvestigationTraceOptions,
  traceLoadedInvestigation
} from "./query-trace.ts";
import {
  defaultInvestigationIndexPath,
  investigationIndexPathForOptions,
  queryFailure,
  showFailure,
  traceFailure
} from "./query-results.ts";
import {
  prepareQuery,
  queryValidatedInvestigationIndex,
  type LoadedInvestigationIndex
} from "./query-index.ts";
import type {
  InvestigationIndexQueryResult,
  InvestigationReportShowOptions,
  InvestigationReportShowResult,
  InvestigationReportTraceResult
} from "./types.ts";
import type {
  InvestigationIndexQueryFailure,
  QueryOperationFailure
} from "./query.ts";

export function executeInvestigationIndexQuery(
  input: unknown
): ResultAsync<InvestigationIndexQueryResult, InvestigationIndexQueryFailure> {
  const prepared = prepareQuery(input);
  if (prepared.isErr()) {
    return errAsync(prepared.error);
  }
  return canonicalizeInvestigationsDirectory(prepared.value.resolved)
    .mapErr((errors) =>
      queryFailure({
        errors,
        indexPath: prepared.value.indexPath,
        kind: "operation",
        limit: prepared.value.validated.limit,
        offset: prepared.value.validated.offset
      })
    )
    .andThen((canonical) =>
      queryValidatedInvestigationIndex(
        canonical.investigationsDirectory,
        prepared.value.validated
      ).mapErr((failure) =>
        queryFailure({
          diagnostics: failure.diagnostics,
          errors: failure.errors,
          indexPath: path.join(
            canonical.investigationsDirectory,
            investigationIndexFileName
          ),
          kind: "operation",
          limit: prepared.value.validated.limit,
          offset: prepared.value.validated.offset
        })
      )
    );
}

export async function showInvestigationReport(
  input: unknown
): Promise<InvestigationReportShowResult> {
  const parsed = parseInvestigationReportShowOptions(input);
  const rawId = rawStringField(input, "id") ?? "";
  if (parsed.isErr())
    return showFailure(rawId, defaultInvestigationIndexPath(), parsed.error);
  const { id: selector } = parsed.value;
  const indexPath = investigationIndexPathForOptions(parsed.value);
  const shown = await showPublishedRecord({
    workspaceRoot: parsed.value.workspaceRoot,
    collection: parsed.value.investigationsDir ?? "docs/investigations",
    definition: createInvestigationStateIndexDefinition(),
    indexPath: investigationIndexFileName,
    selector,
    normalizeSelector: normalizeInvestigationSelectorInput,
    datedSelectorId: (value) => parseDatedInvestigationId(value)?.id ?? null,
    idFromMarkdown: (text) =>
      investigationIdFromMarkdown(text.replace(/^\uFEFF/, "")),
    sourceFingerprint: (source) =>
      investigationSourceRevision([source]).entries[source.id]!
  });
  if (shown.status === "ok")
    return {
      errors: [],
      diagnostics: [],
      id: shown.id,
      indexPath,
      markdown: shown.text,
      state: shown.state,
      status: "ok",
      warnings: shown.stale ? [persistedSnapshotBodyWarning] : []
    };
  if (shown.phase === "location")
    return showFailure(selector, indexPath, [
      shown.error instanceof Error
        ? shown.error.message
        : "investigations directory could not be safely resolved"
    ]);
  if (shown.phase === "selection")
    return showFailure(
      selector,
      indexPath,
      shown.matches.length === 0
        ? [`${shown.normalized} investigation report does not exist`]
        : [
            `Investigation name is ambiguous: ${shown.normalized}; choose one standard ID: ${shown.matches.join(", ")}`
          ]
    );
  if (shown.phase === "index")
    return showFailure(
      selector,
      indexPath,
      investigationIndexDiagnosticMessages(shown.diagnostics, indexPath),
      shown.diagnostics.map((diagnostic) =>
        diagnosticFromStateIndexDiagnostic(diagnostic, {
          recovery:
            "correct the reported derived-index problem, then retry showing the report",
          target: indexPath
        })
      )
    );
  return showFailure(
    shown.id,
    indexPath,
    [`${shown.id} could not be read`],
    [
      diagnosticFromError({
        code: "investigation-report.report-read-failed",
        error: shown.error,
        reason: "the selected investigation report could not be read",
        recovery: "restore read access to the report, then retry show",
        target: path.join(
          parsed.value.workspaceRoot,
          parsed.value.investigationsDir ?? "docs/investigations",
          shown.state.sourcePath
        )
      })
    ]
  );
}

type CurrentInvestigationIndex = Extract<
  LoadedInvestigationIndex,
  { status: "ok" }
>["value"];
type IndexedInvestigationContext = Readonly<{
  index: CurrentInvestigationIndex;
  indexPath: string;
  investigationsDirectory: string;
  relations: InvestigationRelationContext;
}>;
type IndexedInvestigationFailure = QueryOperationFailure & {
  indexPath: string;
};
type InvestigationQueryLocationOptions = Pick<
  InvestigationReportShowOptions,
  "investigationsDir" | "workspaceRoot"
>;

async function loadIndexedInvestigationContext(
  options: InvestigationQueryLocationOptions,
  recovery: string
): Promise<Result<IndexedInvestigationContext, IndexedInvestigationFailure>> {
  const fallbackIndexPath = investigationIndexPathForOptions(options);
  const resolved = resolveInvestigationsDirectory(
    options.workspaceRoot,
    options.investigationsDir
  );
  if (resolved.isErr()) {
    return err({
      diagnostics: [],
      errors: resolved.error,
      indexPath: fallbackIndexPath
    });
  }
  const canonical = await canonicalizeInvestigationsDirectory(resolved.value);
  if (canonical.isErr()) {
    return err({
      diagnostics: [],
      errors: canonical.error,
      indexPath: fallbackIndexPath
    });
  }
  const investigationsDirectory = canonical.value.investigationsDirectory;
  const indexPath = path.join(
    investigationsDirectory,
    investigationIndexFileName
  );
  const loaded = await loadInvestigationQueryIndex({
    investigationsDirectory,
    requiresRelations: true
  });
  if (loaded.status === "error") {
    return err({
      diagnostics: loaded.diagnostics.map((diagnostic) =>
        diagnosticFromStateIndexDiagnostic(diagnostic, {
          recovery,
          target: indexPath
        })
      ),
      errors: investigationIndexDiagnosticMessages(
        loaded.diagnostics,
        indexPath
      ),
      indexPath
    });
  }
  return ok({
    index: loaded.value,
    indexPath,
    investigationsDirectory,
    relations: loaded.relations
  });
}

export async function traceInvestigationReports(
  input: unknown
): Promise<InvestigationReportTraceResult> {
  const parsed = parseInvestigationReportTraceOptions(input);
  const rawId = rawStringField(input, "id") ?? "";
  if (parsed.isErr()) {
    return traceFailure(rawId, defaultInvestigationIndexPath(), [
      ...parsed.error
    ]);
  }
  const options = parsed.value;
  const selector = options.id;
  const traceOptions = normalizeInvestigationTraceOptions(options);
  if ("errors" in traceOptions) {
    return traceFailure(
      selector,
      investigationIndexPathForOptions(parsed.value),
      traceOptions.errors
    );
  }
  const loaded = await loadIndexedInvestigationContext(
    options,
    "correct the reported derived-index problem, then retry tracing reports"
  );
  if (loaded.isErr()) {
    return traceFailure(
      selector,
      loaded.error.indexPath,
      loaded.error.errors,
      loaded.error.diagnostics
    );
  }
  const traced = traceLoadedInvestigation(
    loaded.value.relations,
    loaded.value.indexPath,
    selector,
    traceOptions.value
  );
  if (traced.status === "error") return traced;
  return traced;
}

function rawStringField(input: unknown, field: string): string | undefined {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    return undefined;
  const value = Reflect.get(input, field);
  return typeof value === "string" ? value : undefined;
}
