import fs from "node:fs/promises";
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
  loadCurrentInvestigationIndex
} from "./investigation-state-index.ts";
import {
  parseInvestigationReportShowOptions,
  parseInvestigationReportTraceOptions
} from "./options.ts";
import {
  canonicalizeInvestigationsDirectory,
  resolveInvestigationsDirectory
} from "./report-path.ts";
import { resolveInvestigationSelector } from "./investigation-selector.ts";
import { traceInvestigationRelations } from "./relation-validation.ts";
import {
  compareText,
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
  InvestigationReportTraceOptions,
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
  const loaded = await loadIndexedInvestigationContext(
    parsed.value,
    "correct the reported derived-index problem, then retry showing the report"
  );
  if (loaded.isErr()) {
    return showFailure(
      selector,
      loaded.error.indexPath,
      loaded.error.errors,
      loaded.error.diagnostics
    );
  }
  const { index, indexPath, investigationsDirectory } = loaded.value;
  const resolved = resolveInvestigationSelector(
    Object.entries(index.entries).map(([id, state]) => ({
      id,
      name: state.name
    })),
    selector
  );
  if (resolved.status === "error")
    return showFailure(selector, indexPath, resolved.errors);
  const { id } = resolved;
  const entry = index.entries[id]!;
  return await readShownInvestigation(
    investigationsDirectory,
    indexPath,
    id,
    entry
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
  const loaded = await loadCurrentInvestigationIndex({
    investigationsDirectory
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
  return ok({ index: loaded.value, indexPath, investigationsDirectory });
}

async function readShownInvestigation(
  investigationsDirectory: string,
  indexPath: string,
  id: string,
  state: NonNullable<InvestigationReportShowResult["state"]>
): Promise<InvestigationReportShowResult> {
  const target = path.join(investigationsDirectory, state.sourcePath);
  try {
    const markdown = await fs.readFile(target, "utf8");
    if (investigationIdFromMarkdown(markdown) !== id) {
      throw new Error(
        "frontmatter Investigation ID does not match the requested ID"
      );
    }
    return {
      errors: [],
      diagnostics: [],
      id,
      indexPath,
      markdown,
      state,
      status: "ok"
    };
  } catch (error) {
    return showFailure(
      id,
      indexPath,
      [`${id} could not be read`],
      [
        diagnosticFromError({
          code: "investigation-report.report-read-failed",
          error,
          reason: "the selected investigation report could not be read",
          recovery: "restore read access to the report, then retry show",
          target
        })
      ]
    );
  }
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
  const traceOptions = validatedTraceOptions(options);
  if (traceOptions === null) {
    return traceFailure(
      selector,
      investigationIndexPathForOptions(parsed.value),
      ["maxDepth must be a non-negative integer"]
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
  return tracedLoadedInvestigation(selector, traceOptions, loaded.value);
}

function tracedLoadedInvestigation(
  selector: string,
  traceOptions: NonNullable<ReturnType<typeof validatedTraceOptions>>,
  context: IndexedInvestigationContext
): InvestigationReportTraceResult {
  const { index, indexPath } = context;
  const resolved = resolveInvestigationSelector(
    Object.entries(index.entries).map(([id, state]) => ({
      id,
      name: state.name
    })),
    selector
  );
  if (resolved.status === "error")
    return traceFailure(selector, indexPath, resolved.errors);
  const { id } = resolved;
  const trace = traceInvestigationRelations(
    new Map(
      Object.entries(index.entries).map(([reportId, state]) => [
        reportId,
        state
      ])
    ),
    id,
    traceOptions
  );
  return {
    edges: trace.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      type: edge.type,
      ...(edge.summary === undefined ? {} : { summary: edge.summary })
    })),
    diagnostics: [],
    errors: [],
    id,
    indexPath,
    reportIds: [...trace.ids].sort(compareText),
    status: "ok"
  };
}

function validatedTraceOptions(options: InvestigationReportTraceOptions): {
  direction: NonNullable<InvestigationReportTraceOptions["direction"]>;
  maxDepth: number | null;
} | null {
  const direction = options.direction ?? "both";
  const maxDepth = options.maxDepth ?? null;
  if (!validTraceMaxDepth(maxDepth)) return null;
  return { direction, maxDepth };
}

function validTraceMaxDepth(maxDepth: number | null): boolean {
  if (maxDepth === null) return true;
  return Number.isSafeInteger(maxDepth) && maxDepth >= 0;
}

function rawStringField(input: unknown, field: string): string | undefined {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    return undefined;
  const value = Reflect.get(input, field);
  return typeof value === "string" ? value : undefined;
}
