import type { DecisionQuerySuccess } from "./decision-query-service.ts";
import type { DecisionRecordsCliIo } from "./cli-io.ts";
import { writeCliLine } from "./cli-output-writer.ts";
import { printRelationFilterEvidence } from "./cli-output-relation-evidence.ts";

type DecisionListSuccess = Extract<DecisionQuerySuccess, { command: "list" }>;

export type DecisionListOutputOptions = Readonly<{
  detail: boolean;
  fullTime: boolean;
}>;

const decisionListTagPreviewLimit = 30;
const decisionListMonthPreviewLimit = 10;

export function printDecisionListSuccess(
  result: DecisionListSuccess,
  options: DecisionListOutputOptions,
  io: DecisionRecordsCliIo
): void {
  printDecisionListFacets(result, options, io);
  writeCliLine(io.stdout, "Applied filters: " + decisionAppliedFilters(result));
  writeCliLine(io.stdout, "Latest matches:");
  if (result.records.length === 0) {
    writeCliLine(io.stdout, "- none");
  } else if (options.detail) {
    for (const record of result.records) {
      const timestamp = displayedDecisionTimestamp(record.createdAt, options);
      writeCliLine(
        io.stdout,
        `- ${record.status} ${record.alignment} ${timestamp} ${record.decisionId}`
      );
      writeCliLine(io.stdout, "  sourcePath: " + record.sourcePath);
      writeCliLine(io.stdout, "  tags: " + record.tags.join(", "));
      writeCliLine(io.stdout, "  title: " + record.projection.title);
      writeCliLine(io.stdout, "  purpose: " + record.projection.purpose);
      printRelationFilterEvidence(record, true, "  ", io);
    }
  } else {
    for (const record of result.records) {
      const timestamp = displayedDecisionTimestamp(record.createdAt, options);
      writeCliLine(
        io.stdout,
        `- ${record.decisionId} ${timestamp} ${record.status}/${record.alignment} [${record.tags.join(", ")}] ${record.projection.title}`
      );
      printRelationFilterEvidence(record, false, "  ", io);
    }
  }
  printDecisionListWindow(result, io);
}

function printDecisionListFacets(
  result: DecisionListSuccess,
  options: DecisionListOutputOptions,
  io: DecisionRecordsCliIo
): void {
  const { facets } = result;
  writeCliLine(io.stdout, `Index filters (${facets.recordCount} records):`);
  writeCliLine(
    io.stdout,
    `  status: active=${facets.statuses.active}, archived=${facets.statuses.archived}`
  );
  writeCliLine(
    io.stdout,
    "  alignment: " +
      `aligned=${facets.alignments.aligned}, ` +
      `unaligned=${facets.alignments.unaligned}`
  );
  writeCliLine(
    io.stdout,
    "  createdAt: " +
      (facets.createdAt.earliest === null
        ? "none"
        : `${facets.createdAt.earliest} .. ${facets.createdAt.latest}`)
  );
  writeCliLine(
    io.stdout,
    "  tags: " +
      facetPreview(
        facets.tags,
        options.detail ? facets.tags.length : decisionListTagPreviewLimit,
        "tag"
      )
  );
  writeCliLine(
    io.stdout,
    "  months (UTC): " +
      monthPreview(
        facets.createdAt.months,
        options.detail
          ? facets.createdAt.months.length
          : decisionListMonthPreviewLimit
      )
  );
}

function facetPreview(
  facets: DecisionListSuccess["facets"]["tags"],
  limit: number,
  noun: string
): string {
  const sorted = [...facets].sort(
    (left, right) =>
      right.count - left.count || compareText(left.tag, right.tag)
  );
  const displayed = sorted
    .slice(0, limit)
    .map((facet) => `${facet.tag}=${facet.count}`);
  return previewValues(displayed, sorted.length - displayed.length, noun);
}

function monthPreview(
  facets: DecisionListSuccess["facets"]["createdAt"]["months"],
  limit: number
): string {
  const sorted = [...facets].sort((left, right) =>
    compareText(right.month, left.month)
  );
  const displayed = sorted
    .slice(0, limit)
    .map((facet) => `${facet.month}=${facet.count}`);
  return previewValues(displayed, sorted.length - displayed.length, "month");
}

function previewValues(
  displayed: readonly string[],
  omitted: number,
  noun: string
): string {
  const values = displayed.length === 0 ? "none" : displayed.join(", ");
  return omitted === 0 ? values : `${values}; +${omitted} more ${noun}s`;
}

function decisionAppliedFilters(result: DecisionListSuccess): string {
  const filters = result.appliedFilters;
  const values = [
    `status=${filters.status}`,
    `alignment=${filters.alignment}`,
    `tags=${filters.tags.length === 0 ? "any" : filters.tags.join("+")}`,
    `createdAt=${rangeText(filters.createdAtFrom, filters.createdAtTo)}`
  ];
  if (filters.relatedTo !== undefined) {
    values.push(
      `relatedTo=${filters.relatedTo}`,
      `direction=${filters.direction ?? "both"}`
    );
  }
  if (filters.relationType !== undefined) {
    values.push(`relationType=${filters.relationType}`);
  }
  return values.join("; ");
}

function rangeText(from: string | undefined, to: string | undefined): string {
  return from === undefined && to === undefined
    ? "any"
    : `${from ?? "-∞"}..${to ?? "+∞"}`;
}

function displayedDecisionTimestamp(
  timestamp: string,
  options: DecisionListOutputOptions
): string {
  return options.fullTime ? timestamp : timestamp.slice(0, 10);
}

function printDecisionListWindow(
  result: DecisionListSuccess,
  io: DecisionRecordsCliIo
): void {
  const remaining = Math.max(
    0,
    result.total - result.offset - result.records.length
  );
  const next =
    remaining === 0
      ? ""
      : `; next offset ${result.offset + result.records.length}`;
  writeCliLine(
    io.stdout,
    `Showing ${result.records.length} of ${result.total} matches ` +
      `(offset ${result.offset}, limit ${result.limit}); ${remaining} remaining${next}.`
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
