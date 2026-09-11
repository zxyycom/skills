import type { DecisionApplicationFailure } from "./application-result.ts";
import type {
  DecisionQueryRequest,
  IndexedDecisionRecord
} from "./decision-query-contract.ts";
import { resolveDecisionRelationIds } from "./decision-query-relation-filter.ts";

export function filterSearchRecords(
  records: readonly IndexedDecisionRecord[],
  request: Pick<
    Extract<DecisionQueryRequest, { command: "search" }>,
    "alignment" | "direction" | "relatedTo" | "relationType" | "status" | "tags"
  >
):
  | { records: IndexedDecisionRecord[]; status: "ok" }
  | { failure: DecisionApplicationFailure; status: "error" } {
  const relationIds = resolveDecisionRelationIds(records, request);
  if (relationIds.status === "error") return relationIds;
  return {
    records: records.filter(
      (record) =>
        (request.status === "all" || record.status === request.status) &&
        (request.alignment === "all" ||
          record.alignment === request.alignment) &&
        request.tags.every((tag) => record.tags.includes(tag)) &&
        (relationIds.decisionIds === null ||
          relationIds.decisionIds.has(record.decisionId))
    ),
    status: "ok"
  };
}
