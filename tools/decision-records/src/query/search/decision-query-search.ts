import { searchDecisionMetadata } from "./decision-query-search-metadata.ts";
import { searchDecisionContent } from "./decision-query-search-content.ts";
import {
  decisionDiagnostic,
  decisionFailure
} from "../../application-result.ts";
import type {
  DecisionQueryRequest,
  DecisionQueryResult
} from "../decision-query-contract.ts";

export async function executeDecisionSearch(
  request: Extract<DecisionQueryRequest, { command: "search" }>
): Promise<DecisionQueryResult> {
  if (request.in !== "metadata" && request.limit !== undefined) {
    return decisionFailure([
      decisionDiagnostic({
        code: "decision-records.invalid-search-options",
        reason: "limit is supported only for metadata search.",
        recovery: "Set in to metadata, or omit limit for content search.",
        target: "Decision search limit"
      })
    ]);
  }
  return request.in === "metadata"
    ? await searchDecisionMetadata(request)
    : await searchDecisionContent(request);
}
