import type { DecisionApplicationFailure } from "./application-result.ts";
import type {
  DecisionFilteredRecord,
  DecisionQueryRequest,
  IndexedDecisionRecord
} from "./decision-query-contract.ts";
import { filterDecisionRelationRecords } from "./decision-query-relation-filter.ts";

export function filterSearchRecords(
  records: readonly IndexedDecisionRecord[],
  request: Pick<
    Extract<DecisionQueryRequest, { command: "search" }>,
    "alignment" | "direction" | "relatedTo" | "relationType" | "status" | "tags"
  >
):
  | { records: DecisionFilteredRecord[]; status: "ok" }
  | { failure: DecisionApplicationFailure; status: "error" } {
  const relationFiltered = filterDecisionRelationRecords(records, request);
  if (relationFiltered.status === "error") return relationFiltered;
  return {
    records: relationFiltered.records.filter(
      (record) =>
        (request.status === "all" || record.status === request.status) &&
        (request.alignment === "all" ||
          record.alignment === request.alignment) &&
        request.tags.every((tag) => record.tags.includes(tag))
    ),
    status: "ok"
  };
}
