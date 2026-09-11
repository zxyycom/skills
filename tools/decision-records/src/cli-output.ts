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
import { writeCliLine } from "./cli-output-writer.ts";
import { printDecisionTrace } from "./cli-output-trace.ts";

export function printDecisionFailure(
  failure: DecisionApplicationFailure,
  io: DecisionRecordsCliIo = processDecisionRecordsCliIo
): void {
  if (failure.presentation === "command") {
    writeCliLine(io.stderr, "Decision records command failed:");
  }
  for (const diagnostic of failure.diagnostics) {
    printDiagnostic(diagnostic, io);
  }
}

export function printDecisionAttention(
  attention: DecisionApplicationAttention,
  io: DecisionRecordsCliIo = processDecisionRecordsCliIo
): void {
  writeCliLine(io.stderr, "Decision records command paused with warnings:");
  for (const diagnostic of attention.diagnostics) {
    printDiagnostic(diagnostic, io);
  }
}

function printDiagnostic(
  diagnostic: DecisionDiagnostic,
  io: DecisionRecordsCliIo
): void {
  writeCliLine(io.stderr, "- code: " + diagnostic.code);
  writeCliLine(io.stderr, "  object: " + diagnostic.target);
  writeCliLine(io.stderr, "  reason: " + diagnostic.reason);
  if (diagnostic.causeCategory !== undefined) {
    writeCliLine(io.stderr, "  causeCategory: " + diagnostic.causeCategory);
  }
  if (diagnostic.detail !== undefined && diagnostic.detail !== null) {
    writeCliLine(io.stderr, "  detail: " + diagnostic.detail);
  }
  if (diagnostic.scope !== undefined) {
    writeCliLine(io.stderr, "  scope: " + diagnostic.scope);
  }
  if (diagnostic.outcome !== undefined) {
    writeCliLine(io.stderr, "  outcome: " + diagnostic.outcome);
  }
  writeCliLine(io.stderr, "  next: " + diagnostic.recovery);
}

type PrintableDecisionQuerySuccess = Exclude<
  DecisionQuerySuccess,
  { command: "list" }
>;
type DecisionQuerySuccessPrinter = (
  result: PrintableDecisionQuerySuccess,
  io: DecisionRecordsCliIo,
  traceJson: boolean
) => void;

export function printDecisionQuerySuccess(
  result: PrintableDecisionQuerySuccess,
  io: DecisionRecordsCliIo = processDecisionRecordsCliIo,
  traceJson = false
): void {
  printQueryWarnings(result.warnings, io);
  decisionQuerySuccessPrinters[result.command](result, io, traceJson);
}

const decisionQuerySuccessPrinters: Readonly<
  Record<PrintableDecisionQuerySuccess["command"], DecisionQuerySuccessPrinter>
> = {
  candidates: (result, io) =>
    printCandidates(
      (
        result as Extract<
          PrintableDecisionQuerySuccess,
          { command: "candidates" }
        >
      ).records,
      io
    ),
  check: (result, io) =>
    printCheck(
      (result as Extract<PrintableDecisionQuerySuccess, { command: "check" }>)
        .summary,
      io
    ),
  search: (result, io) =>
    printSearch(
      result as Extract<PrintableDecisionQuerySuccess, { command: "search" }>,
      io
    ),
  show: (result, io) =>
    printShow(
      result as Extract<PrintableDecisionQuerySuccess, { command: "show" }>,
      io
    ),
  "show-candidate": (result, io) =>
    printShow(
      result as Extract<
        PrintableDecisionQuerySuccess,
        { command: "show-candidate" }
      >,
      io
    ),
  "sync-index": (result, io) =>
    printSyncIndex(
      result as Extract<
        PrintableDecisionQuerySuccess,
        { command: "sync-index" }
      >,
      io
    ),
  trace: (result, io, traceJson) => {
    const trace = result as Extract<
      PrintableDecisionQuerySuccess,
      { command: "trace" }
    >;
    printDecisionTrace(trace, traceJson, io);
  }
};

function printCandidates(
  records: Extract<DecisionQuerySuccess, { command: "candidates" }>["records"],
  io: DecisionRecordsCliIo
): void {
  writeCliLine(io.stdout, "Candidates:");
  if (records.length === 0) {
    writeCliLine(io.stdout, "- none");
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
    writeCliLine(io.stdout, "  title: " + record.projection.title);
    writeCliLine(io.stdout, "  purpose: " + record.projection.purpose);
    writeCliLine(io.stdout, "  scaffoldValid: " + record.scaffoldValid);
    writeCliLine(io.stdout, "  bodyReady: " + record.bodyReady);
  }
}

export function printCandidateWarnings(
  sourcePaths: readonly string[],
  io: DecisionRecordsCliIo = processDecisionRecordsCliIo
): void {
  if (sourcePaths.length === 0) {
    return;
  }
  writeCliLine(io.stderr, "Decision records command completed with warnings:");
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
  writeCliLine(io.stderr, "Decision records query completed with warnings:");
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
  writeCliLine(
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

export {
  printDecisionListSuccess,
  type DecisionListOutputOptions
} from "./cli-output-list.ts";

import { printSearch } from "./cli-output-search.ts";

function printShow(
  result: Extract<DecisionQuerySuccess, { command: "show" | "show-candidate" }>,
  io: DecisionRecordsCliIo
): void {
  writeCliLine(io.stdout, "id: " + result.record.decisionId);
  writeCliLine(io.stdout, "sourcePath: " + result.record.sourcePath);
  writeCliLine(io.stdout, "tags: " + result.record.tags.join(", "));
  writeCliLine(io.stdout, "status: " + result.record.status);
  writeCliLine(io.stdout, "alignment: " + result.record.alignment);
  writeCliLine(io.stdout, "createdAt: " + result.record.createdAt);
  if (result.command === "show-candidate") {
    writeCliLine(io.stdout, "scaffoldValid: " + result.record.scaffoldValid);
    writeCliLine(io.stdout, "bodyReady: " + result.record.bodyReady);
  }
  writeCliLine(io.stdout, "");
  writeCliLine(io.stdout, result.body.trimEnd());
}

function printSyncIndex(
  result: Extract<DecisionQuerySuccess, { command: "sync-index" }>,
  io: DecisionRecordsCliIo
): void {
  if (result.scope === "selected") {
    writeCliLine(
      io.stdout,
      "Selected Decision selectors: " + result.selectors.join(", ") + "."
    );
    writeCliLine(
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
  writeCliLine(
    io.stdout,
    result.state === "written"
      ? "Rebuilt " + result.indexRelativePath + " from decision Markdown files."
      : "Decision index is up to date."
  );
  printCandidateWarnings(result.unactivatedPaths, io);
}

function printRecordHeader(
  status: string,
  decisionId: string,
  sourcePath: string,
  tags: readonly string[],
  io: DecisionRecordsCliIo
): void {
  writeCliLine(io.stdout, "- " + status + " " + decisionId);
  writeCliLine(io.stdout, "  sourcePath: " + sourcePath);
  writeCliLine(io.stdout, "  tags: " + tags.join(", "));
}
