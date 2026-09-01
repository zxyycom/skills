import type {
  DecisionApplicationAttention,
  DecisionApplicationFailure
} from "./application-result.ts";
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
    for (const error of failure.errors) {
      writeLine(io.stderr, "- " + error);
    }
    return;
  }
  for (const error of failure.errors) {
    writeLine(io.stderr, error);
  }
}

export function printDecisionAttention(
  attention: DecisionApplicationAttention,
  io: DecisionRecordsCliIo = processDecisionRecordsCliIo
): void {
  writeLine(io.stderr, "Decision records command paused with warnings:");
  for (const warning of attention.warnings) {
    writeLine(io.stderr, "- " + warning);
  }
}

export function printDecisionQuerySuccess(
  result: DecisionQuerySuccess,
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
    case "list":
      printList(result.records, result.fullTime, io);
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
    writeLine(
      io.stderr,
      "- Reviewable decision candidate remains: " + sourcePath
    );
  }
  writeLine(
    io.stderr,
    "- Candidates remain outside the decision index; use candidates to review " +
      "them, then activate or discard them explicitly."
  );
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
    writeLine(io.stderr, "- " + warning);
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
      summary.activationCandidateCount +
      " candidates)."
  );
}

function printList(
  records: Extract<DecisionQuerySuccess, { command: "list" }>["records"],
  fullTime: boolean,
  io: DecisionRecordsCliIo
): void {
  writeLine(io.stdout, "Decisions:");
  if (records.length === 0) {
    writeLine(io.stdout, "- none");
    return;
  }
  for (const record of records) {
    const timestamp = record.createdAt ?? "unknown";
    writeLine(
      io.stdout,
      "- " +
        record.status +
        " " +
        (record.alignment ?? "null") +
        " " +
        (fullTime ? timestamp : timestamp.slice(0, 10)) +
        " " +
        record.decisionId
    );
    writeLine(io.stdout, "  sourcePath: " + record.sourcePath);
    writeLine(io.stdout, "  tags: " + record.tags.join(", "));
    writeLine(io.stdout, "  title: " + record.projection.title);
    writeLine(io.stdout, "  purpose: " + record.projection.purpose);
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
  writeLine(io.stdout, "");
  writeLine(io.stdout, result.body.trimEnd());
}

function printSyncIndex(
  result: Extract<DecisionQuerySuccess, { command: "sync-index" }>,
  io: DecisionRecordsCliIo
): void {
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
          (record.alignment ?? "null") +
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
        "- " + edge.source + " --" + edge.type + "--> " + edge.target
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
