/*
 * Synced TypeScript runtime; repository maintenance edits tools/shared/src/file-text-search/record-search-output.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/shared/src/file-text-search/record-search-output.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/shared/src/file-text-search/record-search-output.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import type { RecordSearchInfo } from "./record-search-info.ts";

/** Pure projection of the same result consumed by API callers. */
export function renderRecordSearchSummary(
  info: RecordSearchInfo<unknown>
): string {
  const { query, source, counts, coverage } = info;
  const limits = [`maxRecords=${query.limits.maxRecords ?? "unlimited"}`];
  if (query.limits.resources !== null)
    for (const [key, value] of Object.entries(query.limits.resources))
      limits.push(`${key}=${value}`);
  if (query.limits.preview !== null)
    for (const [key, value] of Object.entries(query.limits.preview))
      limits.push(`${key}=${value}`);
  const covered = (value: boolean | null) =>
    value === null ? "n/a" : value ? "complete" : "limited";
  return [
    `Query: text=${JSON.stringify(query.text)} in=${query.in} match=${query.match}`,
    `Filters: ${JSON.stringify(query.filters)}`,
    `Source: kind=${source.kind} currentness=${source.currentness} fallback=${source.fallback}`,
    `Limits: ${limits.join(" ")}`,
    `Counts: matched${counts.matched.precision === "exact" ? "=" : ">="}${counts.matched.value} precision=${counts.matched.precision} returned=${counts.returned}`,
    `Coverage: scan=${covered(coverage.scanComplete)} results=${covered(coverage.resultsComplete)} previews=${covered(coverage.previewsComplete)} reasons=${coverage.reasons.join(",") || "none"}`
  ].join("\n");
}
