/*
 * Synced TypeScript runtime; repository maintenance edits tools/shared/src/file-text-search/record-search-info.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/shared/src/file-text-search/record-search-info.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/shared/src/file-text-search/record-search-info.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import type {
  FileTextSearchMode,
  FileTextSearchResourceLimits,
  FileTextSearchTruncation
} from "./contracts.ts";
import type { RecordTextSearchResult } from "./record-search.ts";

export type RecordSearchSource = Readonly<{
  kind: "published-index" | "published-index+current-text";
  currentness: "current" | "stale" | "unchecked";
  fallback: boolean;
}>;
export type RecordSearchLimits = Readonly<{
  maxRecords: number | null;
  resources: FileTextSearchResourceLimits | null;
  preview: Readonly<{
    contextLines: number;
    maxMatchesPerFile: number;
    maxPreviewCharacters: number;
  }> | null;
}>;
export type RecordSearchCoverage = Readonly<{
  scanComplete: boolean;
  resultsComplete: boolean;
  previewsComplete: boolean | null;
  reasons: readonly ("max-records" | "match-previews" | "preview-characters")[];
}>;
export type RecordSearchInfo<Filters> = Readonly<{
  query: Readonly<{
    text: string;
    in: "content" | "metadata";
    match: FileTextSearchMode;
    filters: Filters;
    limits: RecordSearchLimits;
  }>;
  source: RecordSearchSource;
  counts: Readonly<{
    matched: Readonly<{ value: number; precision: "exact" | "lower-bound" }>;
    returned: number;
  }>;
  coverage: RecordSearchCoverage;
}>;

export function contentSearchFacts(searched: RecordTextSearchResult): Pick<
  RecordSearchInfo<never>,
  "counts" | "coverage"
> & {
  limits: RecordSearchLimits;
} {
  const scanComplete = searched.scannedFiles === searched.selectedFiles;
  return {
    counts: {
      matched: {
        value: searched.matched,
        precision: scanComplete ? "exact" : "lower-bound"
      },
      returned: searched.hits.length
    },
    coverage: {
      scanComplete,
      resultsComplete: scanComplete && !searched.truncation.files,
      previewsComplete:
        !searched.truncation.matches && !searched.truncation.previewCharacters,
      reasons: searchLimitReasons(searched.truncation)
    },
    limits: {
      maxRecords: searched.preview.maxFiles,
      resources: searched.limits,
      preview: {
        contextLines: searched.preview.contextLines,
        maxMatchesPerFile: searched.preview.maxMatchesPerFile,
        maxPreviewCharacters: searched.preview.maxPreviewCharacters
      }
    }
  };
}

export function metadataSearchFacts(
  matched: number,
  returned: number,
  maxRecords: number | null
): Pick<RecordSearchInfo<never>, "counts" | "coverage"> & {
  limits: RecordSearchLimits;
} {
  return {
    counts: { matched: { value: matched, precision: "exact" }, returned },
    coverage: {
      scanComplete: true,
      resultsComplete: matched === returned,
      previewsComplete: null,
      reasons: matched > returned ? ["max-records"] : []
    },
    limits: { maxRecords, resources: null, preview: null }
  };
}

function searchLimitReasons(
  truncation: FileTextSearchTruncation
): RecordSearchCoverage["reasons"] {
  return [
    ...(truncation.files ? ["max-records" as const] : []),
    ...(truncation.matches ? ["match-previews" as const] : []),
    ...(truncation.previewCharacters ? ["preview-characters" as const] : [])
  ];
}

export function searchLimitWarnings(coverage: RecordSearchCoverage): string[] {
  const warnings: string[] = [];
  if (coverage.reasons.includes("max-records"))
    warnings.push("search results limited: max-records");
  const previews = coverage.reasons.filter(
    (reason) => reason !== "max-records"
  );
  if (previews.length > 0)
    warnings.push("search previews limited: " + previews.join(","));
  return warnings;
}

export function publishedSearchWarning(
  currentness: RecordSearchSource["currentness"],
  domain: "Decision" | "Investigation"
): string[] {
  return currentness === "current"
    ? []
    : [
        `search source: ${currentness} published-index; the persisted ${domain} index is ${currentness}; this result reflects the last published index snapshot, not verified current Markdown. Run sync-index to publish the current projection before drawing conclusions about the complete collection.`
      ];
}
