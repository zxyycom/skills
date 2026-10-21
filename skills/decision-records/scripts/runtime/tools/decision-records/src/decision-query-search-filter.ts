/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/decision-query-search-filter.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/decision-query-search-filter.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/decision-query-search-filter.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import type { DecisionRelationRecordSnapshot } from "./decision-query-records.ts";
import type { DecisionApplicationFailure } from "./application-result.ts";
import type {
  DecisionFilteredRecord,
  DecisionQueryRequest,
  DecisionSearchFilters,
  IndexedDecisionRecord
} from "./decision-query-contract.ts";
import { filterDecisionRelationRecords } from "./decision-query-relation-filter.ts";

export function filterSearchRecords(
  source: readonly IndexedDecisionRecord[] | DecisionRelationRecordSnapshot,
  request: Pick<
    Extract<DecisionQueryRequest, { command: "search" }>,
    "alignment" | "direction" | "relatedTo" | "relationType" | "status" | "tags"
  >
):
  | {
      records: DecisionFilteredRecord[];
      filters: DecisionSearchFilters;
      status: "ok";
    }
  | { failure: DecisionApplicationFailure; status: "error" } {
  const relationFiltered = filterDecisionRelationRecords(source, request);
  if (relationFiltered.status === "error") return relationFiltered;
  return {
    filters: {
      status: request.status,
      alignment: request.alignment,
      tags: [...request.tags],
      ...(request.relationType === undefined
        ? {}
        : { relationType: request.relationType }),
      ...(relationFiltered.relatedTo === undefined
        ? {}
        : {
            relatedTo: relationFiltered.relatedTo,
            direction: request.direction ?? "both"
          })
    },
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
