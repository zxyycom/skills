/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/decision-query-search.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/decision-query-search.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/decision-query-search.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
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
