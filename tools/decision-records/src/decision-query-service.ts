import {
  listDecisionCandidates,
  checkDecisionRecords
} from "./decision-query-candidates.ts";
import { listDecisionRecords } from "./decision-query-list.ts";
import { executeDecisionSearch } from "./decision-query-search.ts";
import {
  showDecisionCandidate,
  showDecisionRecord,
  traceDecisionRecord
} from "./decision-query-record-queries.ts";
import { synchronizeDecisionIndex } from "./decision-query-sync.ts";
import type { DecisionLocation } from "./decision-query-context.ts";
import type {
  DecisionQueryRequest,
  DecisionQueryResult
} from "./decision-query-contract.ts";

export type {
  CandidateDecisionRecord,
  DecisionContentSearchRecord,
  DecisionListAppliedFilters,
  DecisionMetadataMatchedRelation,
  DecisionMetadataSearchField,
  DecisionMetadataSearchRecord,
  DecisionQueryRequest,
  DecisionQueryResult,
  DecisionQuerySuccess,
  IndexedDecisionRecord
} from "./decision-query-contract.ts";
export { decisionMetadataSearchFields } from "./decision-query-contract.ts";
export type { DecisionLocation } from "./decision-query-context.ts";

type QueryHandler = (
  request: DecisionQueryRequest
) => Promise<DecisionQueryResult>;
const decisionQueryHandlers: Readonly<
  Record<DecisionQueryRequest["command"], QueryHandler>
> = {
  candidates: (request) =>
    listDecisionCandidates(
      (request as unknown as { location: DecisionLocation }).location
    ),
  check: (request) =>
    checkDecisionRecords(
      (request as unknown as { location: DecisionLocation }).location
    ),
  list: (request) =>
    listDecisionRecords(
      request as Extract<DecisionQueryRequest, { command: "list" }>
    ),
  search: (request) =>
    executeDecisionSearch(
      request as Extract<DecisionQueryRequest, { command: "search" }>
    ),
  show: (request) =>
    showDecisionRecord(
      request as Extract<DecisionQueryRequest, { command: "show" }>
    ),
  "show-candidate": (request) =>
    showDecisionCandidate(
      request as Extract<DecisionQueryRequest, { command: "show-candidate" }>
    ),
  "sync-index": (request) =>
    synchronizeDecisionIndex(
      request as Extract<DecisionQueryRequest, { command: "sync-index" }>
    ),
  trace: (request) =>
    traceDecisionRecord(
      request as Extract<DecisionQueryRequest, { command: "trace" }>
    )
};

export async function executeDecisionQuery(
  request: DecisionQueryRequest
): Promise<DecisionQueryResult> {
  return await decisionQueryHandlers[request.command](request);
}
