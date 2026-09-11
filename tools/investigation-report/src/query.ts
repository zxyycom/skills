import { executeInvestigationIndexQuery } from "./query-report.ts";
import type { ResolvedInvestigationsDirectory } from "./report-path.ts";
import type { StateIndexFilter } from "../../index-runtime/src/index.ts";
import type { InvestigationDiagnostic } from "./diagnostics.ts";
import type {
  InvestigationIndexQueryOptions,
  InvestigationIndexQueryResult,
  InvestigationIndexState,
  InvestigationListAppliedFilters,
  InvestigationSearchOptions
} from "./types.ts";

export type InvestigationIndexQueryFailure = Readonly<{
  kind: "invalid-options" | "operation";
  result: InvestigationIndexQueryResult;
}>;
export type PreparedQuery = Readonly<{
  indexPath: string;
  resolved: ResolvedInvestigationsDirectory;
  validated: ValidatedQueryOptions;
}>;
export type ValidatedQueryOptions = Readonly<{
  appliedFilters: InvestigationListAppliedFilters;
  filters: StateIndexFilter[];
  limit: number;
  offset: number;
  relatedTo?: string;
  relationType?: InvestigationIndexQueryOptions["relationType"];
  direction?: NonNullable<InvestigationIndexQueryOptions["direction"]>;
}>;
export type QueryOptionValidationFailure = Readonly<{
  errors: string[];
  limit: number;
  offset: number;
}>;
export type QueryOperationFailure = Readonly<{
  diagnostics: InvestigationDiagnostic[];
  errors: string[];
}>;
export type PreparedSearch = Readonly<{
  indexPath: string;
  in: "content" | "metadata";
  query: string;
  resolved: ResolvedInvestigationsDirectory;
  validated: Readonly<{
    direction?: NonNullable<InvestigationSearchOptions["direction"]>;
    limit: number;
    match: "all" | "any" | "phrase";
    relatedTo?: string;
    relationType?: InvestigationSearchOptions["relationType"];
    states: (state: InvestigationIndexState) => boolean;
  }>;
}>;

export type InvestigationSnapshotEntry = Readonly<{
  id: string;
  state: InvestigationIndexState;
}>;

export const investigationListDefaultLimit = 10;

export async function queryInvestigationIndex(
  options: InvestigationIndexQueryOptions
): Promise<InvestigationIndexQueryResult> {
  const executed = await executeInvestigationIndexQuery(options);
  return executed.match(
    (result) => result,
    (failure) => failure.result
  );
}

export { searchInvestigationReports } from "./query-search.ts";
export {
  executeInvestigationIndexQuery,
  showInvestigationReport,
  traceInvestigationReports
} from "./query-report.ts";
