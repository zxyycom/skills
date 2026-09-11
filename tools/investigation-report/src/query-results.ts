import path from "node:path";
import {
  diagnosticFromError,
  type InvestigationDiagnostic
} from "./diagnostics.ts";
import { defaultInvestigationsDirectory } from "./report-path.ts";
import { investigationIndexFileName } from "./investigation-state-index.ts";
import type {
  InvestigationReportShowResult,
  InvestigationReportTraceResult,
  InvestigationSearchResult
} from "./types.ts";
import type {
  InvestigationIndexQueryFailure,
  QueryOperationFailure
} from "./query.ts";

export function queryFailure(
  input: Readonly<{
    diagnostics?: readonly InvestigationDiagnostic[];
    errors: readonly string[];
    indexPath: string;
    kind: InvestigationIndexQueryFailure["kind"];
    limit: number;
    offset: number;
  }>
): InvestigationIndexQueryFailure {
  return {
    kind: input.kind,
    result: {
      appliedFilters: null,
      entries: [],
      diagnostics: [...(input.diagnostics ?? [])],
      errors: uniqueSorted(input.errors),
      facets: null,
      indexPath: input.indexPath,
      limit: input.limit,
      offset: input.offset,
      total: 0
    }
  };
}
export function searchFailure(
  errors: readonly string[],
  indexPath: string,
  diagnostics: readonly InvestigationDiagnostic[] = [],
  warnings: readonly string[] = []
): InvestigationSearchResult {
  return {
    diagnostics: [...diagnostics],
    entries: [],
    errors: uniqueSorted(errors),
    indexPath,
    status: "error",
    truncation: { files: false, matches: false, previewCharacters: false },
    warnings: [...warnings]
  };
}
export function showFailure(
  id: string,
  indexPath: string,
  errors: readonly string[],
  diagnostics: readonly InvestigationDiagnostic[] = []
): InvestigationReportShowResult {
  return {
    errors: uniqueSorted(errors),
    diagnostics: [...diagnostics],
    id,
    indexPath,
    markdown: null,
    state: null,
    status: "error"
  };
}
export function traceFailure(
  id: string,
  indexPath: string,
  errors: readonly string[],
  diagnostics: readonly InvestigationDiagnostic[] = []
): InvestigationReportTraceResult {
  return {
    edges: [],
    diagnostics: [...diagnostics],
    errors: uniqueSorted(errors),
    id,
    indexPath,
    reportIds: [],
    status: "error"
  };
}
export function defaultInvestigationIndexPath(): string {
  return path.join(
    path.resolve("."),
    defaultInvestigationsDirectory,
    investigationIndexFileName
  );
}
export function investigationIndexPathForOptions(options: {
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
export function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}
export function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
export function queryOperationFailure(
  error: unknown,
  reason: string,
  indexPath: string
): QueryOperationFailure {
  return {
    diagnostics: [
      diagnosticFromError({
        code: "investigation-report.index-query-unavailable",
        error,
        reason,
        recovery: "correct the reported index problem, then retry the query",
        target: indexPath
      })
    ],
    errors: ["investigation index query could not be completed"]
  };
}
