import type {
  DecisionApplicationAttention,
  DecisionApplicationFailure,
  DecisionDiagnostic
} from "./application-result.ts";
import { decisionDiagnosticFromReason } from "./application-result.ts";
import type { DecisionQuerySuccess } from "./decision-query-service.ts";

import {
  processDecisionRecordsCliIo,
  type DecisionRecordsCliIo
} from "./cli-io.ts";

function writeLine(writer: (text: string) => void, text: string): void {
  writer(`${text}\n`);
}

export function printDecisionFailure(
  failure: DecisionApplicationFailure,
  io: DecisionRecordsCliIo = processDecisionRecordsCliIo
): void {
  if (failure.presentation === "command") {
    writeLine(io.stderr, "Decision records command failed:");
  }
  for (const diagnostic of failure.diagnostics) {
    printDiagnostic(diagnostic, io);
  }
}

export function printDecisionAttention(
  attention: DecisionApplicationAttention,
  io: DecisionRecordsCliIo = processDecisionRecordsCliIo
): void {
  writeLine(io.stderr, "Decision records command paused with warnings:");
  for (const diagnostic of attention.diagnostics) {
    printDiagnostic(diagnostic, io);
  }
}

function printDiagnostic(
  diagnostic: DecisionDiagnostic,
  io: DecisionRecordsCliIo
): void {
  writeLine(io.stderr, "- code: " + diagnostic.code);
  writeLine(io.stderr, "  object: " + diagnostic.target);
  writeLine(io.stderr, "  reason: " + diagnostic.reason);
  if (diagnostic.causeCategory !== undefined) {
    writeLine(io.stderr, "  causeCategory: " + diagnostic.causeCategory);
  }
  if (diagnostic.detail !== undefined && diagnostic.detail !== null) {
    writeLine(io.stderr, "  detail: " + diagnostic.detail);
  }
  if (diagnostic.scope !== undefined) {
    writeLine(io.stderr, "  scope: " + diagnostic.scope);
  }
  if (diagnostic.outcome !== undefined) {
    writeLine(io.stderr, "  outcome: " + diagnostic.outcome);
  }
  writeLine(io.stderr, "  next: " + diagnostic.recovery);
}

export function printDecisionQuerySuccess(
  result: Exclude<DecisionQuerySuccess, { command: "list" }>,
  io: DecisionRecordsCliIo = processDecisionRecordsCliIo
): void {
  printQueryWarnings(result.warnings, io);
  switch (result.command) {
    case "candidates":
      printCandidates(result.records, io);
      return;
    case "check":
      printCheck(result.summary, io);
      return;
    case "search":
      printSearch(result, io);
      return;
    case "show":
    case "show-candidate":
      printShow(result, io);
      return;
    case "sync-index":
      printSyncIndex(result, io);
      return;
    case "trace":
      printTrace(result.records, result.edges, io);
  }
}

function printCandidates(
  records: Extract<DecisionQuerySuccess, { command: "candidates" }>["records"],
  io: DecisionRecordsCliIo
): void {
  writeLine(io.stdout, "Candidates:");
  if (records.length === 0) {
    writeLine(io.stdout, "- none");
    return;
  }
  for (const record of records) {
    printRecordHeader(
      "candidate",
      record.decisionId,
      record.sourcePath,
      record.tags,
      io
    );
    writeLine(io.stdout, "  title: " + record.projection.title);
    writeLine(io.stdout, "  purpose: " + record.projection.purpose);
    writeLine(io.stdout, "  scaffoldValid: " + record.scaffoldValid);
    writeLine(io.stdout, "  bodyReady: " + record.bodyReady);
  }
}

export function printCandidateWarnings(
  sourcePaths: readonly string[],
  io: DecisionRecordsCliIo = processDecisionRecordsCliIo
): void {
  if (sourcePaths.length === 0) {
    return;
  }
  writeLine(io.stderr, "Decision records command completed with warnings:");
  for (const sourcePath of sourcePaths) {
    printDiagnostic(
      {
        code: "decision-records.candidate-remains",
        reason: "Decision candidate scaffold remains: " + sourcePath,
        recovery:
          "Use candidates to inspect readiness, then edit, activate, or discard it explicitly.",
        target: sourcePath
      },
      io
    );
  }
}

function printQueryWarnings(
  warnings: readonly string[],
  io: DecisionRecordsCliIo
): void {
  if (warnings.length === 0) {
    return;
  }
  writeLine(io.stderr, "Decision records query completed with warnings:");
  for (const warning of warnings) {
    printDiagnostic(
      decisionDiagnosticFromReason(
        {
          code: "decision-records.query-warning",
          recovery:
            "Correct the reported source problem before relying on this query result.",
          target: "Decision query source"
        },
        warning
      ),
      io
    );
  }
}

function printCheck(
  summary: Extract<DecisionQuerySuccess, { command: "check" }>["summary"],
  io: DecisionRecordsCliIo
): void {
  writeLine(
    io.stdout,
    "Decision records check passed (" +
      summary.decisionCount +
      " decisions, " +
      summary.activeCount +
      " active, " +
      summary.alignedCount +
      " aligned, " +
      summary.unalignedCount +
      " unaligned, " +
      summary.archivedCount +
      " archived, " +
      summary.scaffoldCandidateCount +
      " candidate scaffolds, " +
      summary.bodyReadyCandidateCount +
      " body-ready candidates)."
  );
}

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
  writeLine(io.stdout, "Applied filters: " + decisionAppliedFilters(result));
  writeLine(io.stdout, "Latest matches:");
  if (result.records.length === 0) {
    writeLine(io.stdout, "- none");
  } else if (options.detail) {
    for (const record of result.records) {
      const timestamp = displayedDecisionTimestamp(record.createdAt, options);
      writeLine(
        io.stdout,
        `- ${record.status} ${record.alignment} ${timestamp} ${record.decisionId}`
      );
      writeLine(io.stdout, "  sourcePath: " + record.sourcePath);
      writeLine(io.stdout, "  tags: " + record.tags.join(", "));
      writeLine(io.stdout, "  title: " + record.projection.title);
      writeLine(io.stdout, "  purpose: " + record.projection.purpose);
    }
  } else {
    for (const record of result.records) {
      const timestamp = displayedDecisionTimestamp(record.createdAt, options);
      writeLine(
        io.stdout,
        `- ${record.decisionId} ${timestamp} ${record.status}/${record.alignment} [${record.tags.join(", ")}] ${record.projection.title}`
      );
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
  writeLine(io.stdout, `Index filters (${facets.recordCount} records):`);
  writeLine(
    io.stdout,
    `  status: active=${facets.statuses.active}, archived=${facets.statuses.archived}`
  );
  writeLine(
    io.stdout,
    "  alignment: " +
      `aligned=${facets.alignments.aligned}, ` +
      `unaligned=${facets.alignments.unaligned}`
  );
  writeLine(
    io.stdout,
    "  createdAt: " +
      (facets.createdAt.earliest === null
        ? "none"
        : `${facets.createdAt.earliest} .. ${facets.createdAt.latest}`)
  );
  writeLine(
    io.stdout,
    "  tags: " +
      facetPreview(
        facets.tags,
        options.detail ? facets.tags.length : decisionListTagPreviewLimit,
        "tag"
      )
  );
  writeLine(
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
  writeLine(
    io.stdout,
    `Showing ${result.records.length} of ${result.total} matches ` +
      `(offset ${result.offset}, limit ${result.limit}); ${remaining} remaining${next}.`
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function printSearch(
  result: Extract<DecisionQuerySuccess, { command: "search" }>,
  io: DecisionRecordsCliIo
): void {
  writeLine(io.stdout, "Decision search results:");
  if (result.records.length === 0) {
    writeLine(io.stdout, "- none");
    return;
  }
  for (const record of result.records) {
    writeLine(
      io.stdout,
      "- " +
        record.status +
        " " +
        record.alignment +
        " " +
        record.createdAt.slice(0, 10) +
        " " +
        record.decisionId
    );
    writeLine(io.stdout, "  sourcePath: " + record.sourcePath);
    writeLine(io.stdout, "  tags: " + record.tags.join(", "));
    writeLine(io.stdout, "  title: " + record.projection.title);
    writeLine(io.stdout, "  purpose: " + record.projection.purpose);
    if ("matchedFields" in record) {
      writeLine(
        io.stdout,
        "  matchedFields: " + record.matchedFields.join(", ")
      );
      writeLine(io.stdout, "  matchedRelations:");
      if (record.matchedRelations.length === 0) {
        writeLine(io.stdout, "    - none");
      } else {
        for (const relation of record.matchedRelations) {
          writeLine(
            io.stdout,
            "    - " +
              relation.type +
              " " +
              relation.target +
              ": " +
              relation.summary
          );
        }
      }
      continue;
    }
    writeLine(io.stdout, "  previews:");
    for (const preview of record.previews) {
      writeLine(
        io.stdout,
        "    " +
          preview.line +
          (preview.column === null ? ":" : ":" + preview.column + ":") +
          " " +
          preview.preview
      );
    }
  }
}

function printShow(
  result: Extract<DecisionQuerySuccess, { command: "show" | "show-candidate" }>,
  io: DecisionRecordsCliIo
): void {
  writeLine(io.stdout, "id: " + result.record.decisionId);
  writeLine(io.stdout, "sourcePath: " + result.record.sourcePath);
  writeLine(io.stdout, "tags: " + result.record.tags.join(", "));
  writeLine(io.stdout, "status: " + result.record.status);
  writeLine(io.stdout, "alignment: " + result.record.alignment);
  writeLine(io.stdout, "createdAt: " + result.record.createdAt);
  if (result.command === "show-candidate") {
    writeLine(io.stdout, "scaffoldValid: " + result.record.scaffoldValid);
    writeLine(io.stdout, "bodyReady: " + result.record.bodyReady);
  }
  writeLine(io.stdout, "");
  writeLine(io.stdout, result.body.trimEnd());
}

function printSyncIndex(
  result: Extract<DecisionQuerySuccess, { command: "sync-index" }>,
  io: DecisionRecordsCliIo
): void {
  if (result.scope === "selected") {
    writeLine(
      io.stdout,
      "Selected Decision selectors: " + result.selectors.join(", ") + "."
    );
    writeLine(
      io.stdout,
      result.state === "written"
        ? "Published the complete Decision index projection for resolved IDs: " +
            result.selectedIds.join(", ") +
            "."
        : "Resolved Decision IDs are already current: " +
            result.selectedIds.join(", ") +
            "."
    );
    printCandidateWarnings(result.unactivatedPaths, io);
    return;
  }
  writeLine(
    io.stdout,
    result.state === "written"
      ? "Rebuilt " + result.indexRelativePath + " from decision Markdown files."
      : "Decision index is up to date."
  );
  printCandidateWarnings(result.unactivatedPaths, io);
}

function printTrace(
  records: Extract<DecisionQuerySuccess, { command: "trace" }>["records"],
  edges: Extract<DecisionQuerySuccess, { command: "trace" }>["edges"],
  io: DecisionRecordsCliIo
): void {
  writeLine(io.stdout, "Decisions:");
  if (records.length === 0) {
    writeLine(io.stdout, "- none");
  } else {
    for (const record of records) {
      writeLine(
        io.stdout,
        "- " +
          record.status +
          " " +
          record.alignment +
          " " +
          record.decisionId +
          " [" +
          record.sourcePath +
          "] - " +
          record.projection.title
      );
      writeLine(io.stdout, "  tags: " + record.tags.join(", "));
    }
  }
  writeLine(io.stdout, "Relations:");
  if (edges.length === 0) {
    writeLine(io.stdout, "- none");
  } else {
    for (const edge of edges) {
      writeLine(
        io.stdout,
        "- " +
          edge.source +
          " --" +
          edge.type +
          "--> " +
          edge.target +
          (edge.summary === undefined ? "" : " [" + edge.summary + "]")
      );
    }
  }
}

function printRecordHeader(
  status: string,
  decisionId: string,
  sourcePath: string,
  tags: readonly string[],
  io: DecisionRecordsCliIo
): void {
  writeLine(io.stdout, "- " + status + " " + decisionId);
  writeLine(io.stdout, "  sourcePath: " + sourcePath);
  writeLine(io.stdout, "  tags: " + tags.join(", "));
}
