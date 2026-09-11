import { searchDecisionMetadata } from "./decision-query-search-metadata.ts";
import { searchDecisionContent } from "./decision-query-search-content.ts";
import type {
  DecisionQueryRequest,
  DecisionQueryResult
} from "./decision-query-contract.ts";

export async function executeDecisionSearch(
  request: Extract<DecisionQueryRequest, { command: "search" }>
): Promise<DecisionQueryResult> {
  return request.in === "metadata"
    ? await searchDecisionMetadata(request)
    : await searchDecisionContent(request);
}
