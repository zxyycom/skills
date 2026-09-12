import type { InvestigationIndexQueryResult } from "./types.ts";

export type InvestigationListOutputOptions = Readonly<{
  detail: boolean;
}>;

export type InvestigationListOutputIo = Readonly<{
  stdout: (text: string) => void;
}>;

const investigationListTagPreviewLimit = 30;
const investigationListMonthPreviewLimit = 10;

export function printInvestigationList(
  result: InvestigationIndexQueryResult,
  options: InvestigationListOutputOptions,
  io: InvestigationListOutputIo
): void {
  if (result.facets === null || result.appliedFilters === null) {
    throw new TypeError("Successful investigation list result requires facets");
  }
  const facets = result.facets;
  writeLine(io.stdout, `Index filters (${facets.recordCount} records):`);
  writeLine(
    io.stdout,
    "  formedAt: " +
      (facets.formedAt.earliest === null
        ? "none"
        : `${facets.formedAt.earliest} .. ${facets.formedAt.latest}`)
  );
  writeLine(
    io.stdout,
    "  tags: " +
      tagPreview(
        facets.tags,
        options.detail ? facets.tags.length : investigationListTagPreviewLimit
      )
  );
  writeLine(
    io.stdout,
    "  months (UTC): " +
      monthPreview(
        facets.formedAt.months,
        options.detail
          ? facets.formedAt.months.length
          : investigationListMonthPreviewLimit
      )
  );
  writeLine(
    io.stdout,
    "Applied filters: " + appliedFiltersText(result.appliedFilters)
  );
  writeLine(io.stdout, "Latest matches:");
  printEntries(result, options, io);
  printWindow(result, io);
}

function printEntries(
  result: InvestigationIndexQueryResult,
  options: InvestigationListOutputOptions,
  io: InvestigationListOutputIo
): void {
  if (result.entries.length === 0) {
    writeLine(io.stdout, "- none");
    return;
  }
  if (options.detail) {
    for (const entry of result.entries) {
      writeLine(io.stdout, `${entry.id} ${entry.state.formedAt}`);
      writeLine(io.stdout, `  title: ${entry.state.title}`);
      writeLine(io.stdout, `  question: ${entry.state.question}`);
      writeLine(io.stdout, `  tags: ${entry.state.tags.join(", ")}`);
      printRelationFilterEvidence(entry.filterRelations, options.detail, io);
    }
    return;
  }
  for (const entry of result.entries) {
    writeLine(
      io.stdout,
      `- ${entry.id} ${entry.state.formedAt} [${entry.state.tags.join(", ")}] ${entry.state.title}`
    );
    printRelationFilterEvidence(entry.filterRelations, false, io);
  }
}

function tagPreview(
  facets: NonNullable<InvestigationIndexQueryResult["facets"]>["tags"],
  limit: number
): string {
  const sorted = [...facets].sort(
    (left, right) =>
      right.count - left.count || compareText(left.tag, right.tag)
  );
  const displayed = sorted
    .slice(0, limit)
    .map((facet) => `${facet.tag}=${facet.count}`);
  return previewValues(displayed, sorted.length - displayed.length, "tag");
}

function monthPreview(
  facets: NonNullable<
    InvestigationIndexQueryResult["facets"]
  >["formedAt"]["months"],
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

function appliedFiltersText(
  filters: NonNullable<InvestigationIndexQueryResult["appliedFilters"]>
): string {
  const values = [
    `tags=${filters.tags.length === 0 ? "any" : filters.tags.join("+")}`,
    `formedAt=${rangeText(filters.formedAtFrom, filters.formedAtTo)}`
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

function printWindow(
  result: InvestigationIndexQueryResult,
  io: InvestigationListOutputIo
): void {
  const remaining = Math.max(
    0,
    result.total - result.offset - result.entries.length
  );
  const next =
    remaining === 0
      ? ""
      : `; next offset ${result.offset + result.entries.length}`;
  writeLine(
    io.stdout,
    `Showing ${result.entries.length} of ${result.total} matches ` +
      `(offset ${result.offset}, limit ${result.limit}); ${remaining} remaining${next}.`
  );
}

function writeLine(writer: (text: string) => void, text: string): void {
  writer(`${text}\n`);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function printRelationFilterEvidence(
  relations: import("./types.ts").InvestigationIndexQueryEntry["filterRelations"],
  detail: boolean,
  io: InvestigationListOutputIo
): void {
  if (relations === undefined) return;
  writeLine(io.stdout, "  relation-filter evidence:");
  const visible = detail ? relations : relations.slice(0, 3);
  for (const relation of visible)
    writeLine(
      io.stdout,
      `    - ${relation.sourceId} --${relation.type}--> ${relation.target}: ${relation.summary === undefined ? "[无摘要]" : JSON.stringify(relation.summary)}`
    );
  if (!detail && relations.length > visible.length)
    writeLine(
      io.stdout,
      `    +${relations.length - visible.length} more matching relations`
    );
}
