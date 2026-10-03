export const investigationListHelp = [
  "Semantics:",
  "  Lists formal reports only; authoring candidates stay outside the index (see candidates / show-candidate).",
  "  Repeatable --tag filters are ANDed, --formed-from/--formed-to are inclusive, and relation conditions intersect with the other filters before paging.",
  "  --related-to resolves first; --direction and --relation-type qualify its direct edges, while --relation-type alone matches any direct edge of that type.",
  "  A stale index still returns the last published snapshot with a warning; restore it with sync-index. An empty page only describes the current filters and window.",
  "Examples:",
  "  investigation-report list --tag investigation-report --limit 20",
  "  investigation-report list --related-to 260912-isolate-ci-version-control-test-load --direction predecessors --detail"
].join("\n");

export const investigationSearchHelp = [
  "Semantics:",
  "  Searches formal report Markdown only; authoring candidates stay outside the index.",
  "  --in content (default) verifies current sources and may serve the query from a read-only validated projection with a warning; --in metadata reads only the published index snapshot.",
  "  --related-to resolves first; --direction and --relation-type qualify its direct edges, while --relation-type alone matches any direct edge of that type.",
  "  --match all requires every term, any requires one term, phrase requires one contiguous phrase; structural filters apply before text matching.",
  "  The six-line summary reports applied query/filters, source, limits, counts, and independent scan/results/previews coverage; matched>=N is a lower bound.",
  "  --limit bounds returned reports without offset paging; metadata retains an exact match count. Preview limits do not stop matching; source or results warnings mean do not conclude absence from bounded or unverified-current results.",
  "  Identify a report here, then read its full body and direct relations with show <investigation-id>.",
  "Examples:",
  '  investigation-report search "index staleness" --match phrase',
  '  investigation-report search "索引" --in metadata --tag investigation-report'
].join("\n");
