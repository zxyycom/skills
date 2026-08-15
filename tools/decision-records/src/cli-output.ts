import type {
  DecisionApplicationAttention,
  DecisionApplicationFailure
} from "./application-result.ts";
import type { DecisionQuerySuccess } from "./decision-query-service.ts";

export function printDecisionFailure(
  failure: DecisionApplicationFailure
): void {
  if (failure.presentation === "command") {
    console.error("Decision records command failed:");
    for (const error of failure.errors) {
      console.error("- " + error);
    }
    return;
  }
  for (const error of failure.errors) {
    console.error(error);
  }
}

export function printDecisionAttention(
  attention: DecisionApplicationAttention
): void {
  console.error("Decision records command paused with warnings:");
  for (const warning of attention.warnings) {
    console.error("- " + warning);
  }
}

export function printDecisionQuerySuccess(
  result: DecisionQuerySuccess
): void {
  printQueryWarnings(result.warnings);
  switch (result.command) {
    case "candidates":
      printCandidates(result.records);
      return;
    case "check":
      printCheck(result.summary);
      return;
    case "list":
      printList(result.records, result.fullTime);
      return;
    case "show":
    case "show-candidate":
      printShow(result);
      return;
    case "sync-index":
      printSyncIndex(result);
      return;
    case "trace":
      printTrace(result.records, result.edges);
  }
}

function printCandidates(
  records: Extract<DecisionQuerySuccess, { command: "candidates" }>["records"]
): void {
  console.log("Candidates:");
  if (records.length === 0) {
    console.log("- none");
    return;
  }
  for (const record of records) {
    printRecordHeader("candidate", record.decisionId, record.sourcePath, record.tags);
    console.log("  title: " + record.projection.title);
    console.log("  purpose: " + record.projection.purpose);
  }
}

export function printCandidateWarnings(
  sourcePaths: readonly string[]
): void {
  if (sourcePaths.length === 0) {
    return;
  }
  console.error("Decision records command completed with warnings:");
  for (const sourcePath of sourcePaths) {
    console.error("- Reviewable decision candidate remains: " + sourcePath);
  }
  console.error(
    "- Candidates remain outside the decision index; use candidates to review "
      + "them, then activate or discard them explicitly."
  );
}

function printQueryWarnings(warnings: readonly string[]): void {
  if (warnings.length === 0) {
    return;
  }
  console.error("Decision records query completed with warnings:");
  for (const warning of warnings) {
    console.error("- " + warning);
  }
}

function printCheck(
  summary: Extract<DecisionQuerySuccess, { command: "check" }>["summary"]
): void {
  console.log(
    "Decision records check passed ("
      + summary.decisionCount + " decisions, "
      + summary.activeCount + " active, "
      + summary.alignedCount + " aligned, "
      + summary.unalignedCount + " unaligned, "
      + summary.archivedCount + " archived, "
      + summary.activationCandidateCount + " candidates)."
  );
}

function printList(
  records: Extract<DecisionQuerySuccess, { command: "list" }>["records"],
  fullTime: boolean
): void {
  console.log("Decisions:");
  if (records.length === 0) {
    console.log("- none");
    return;
  }
  for (const record of records) {
    const timestamp = record.createdAt ?? "unknown";
    console.log(
      "- " + record.status + " " + (record.alignment ?? "null") + " "
        + (fullTime ? timestamp : timestamp.slice(0, 10)) + " "
        + record.decisionId
    );
    console.log("  sourcePath: " + record.sourcePath);
    console.log("  tags: " + record.tags.join(", "));
    console.log("  title: " + record.projection.title);
    console.log("  purpose: " + record.projection.purpose);
  }
}

function printShow(
  result: Extract<DecisionQuerySuccess, { command: "show" | "show-candidate" }>
): void {
  console.log("id: " + result.record.decisionId);
  console.log("sourcePath: " + result.record.sourcePath);
  console.log("tags: " + result.record.tags.join(", "));
  console.log("status: " + result.record.status);
  console.log("alignment: " + result.record.alignment);
  console.log("createdAt: " + result.record.createdAt);
  console.log("");
  console.log(result.body.trimEnd());
}

function printSyncIndex(
  result: Extract<DecisionQuerySuccess, { command: "sync-index" }>
): void {
  console.log(
    result.state === "written"
      ? "Rebuilt " + result.indexRelativePath + " from decision Markdown files."
      : "Decision index is up to date."
  );
  printCandidateWarnings(result.unactivatedPaths);
}

function printTrace(
  records: Extract<DecisionQuerySuccess, { command: "trace" }>["records"],
  edges: Extract<DecisionQuerySuccess, { command: "trace" }>["edges"]
): void {
  console.log("Decisions:");
  if (records.length === 0) {
    console.log("- none");
  } else {
    for (const record of records) {
      console.log(
        "- " + record.status + " " + (record.alignment ?? "null") + " "
          + record.decisionId + " [" + record.sourcePath + "] - "
          + record.projection.title
      );
      console.log("  tags: " + record.tags.join(", "));
    }
  }
  console.log("Relations:");
  if (edges.length === 0) {
    console.log("- none");
  } else {
    for (const edge of edges) {
      console.log("- " + edge.source + " --" + edge.type + "--> " + edge.target);
    }
  }
}

function printRecordHeader(
  status: string,
  decisionId: string,
  sourcePath: string,
  tags: readonly string[]
): void {
  console.log("- " + status + " " + decisionId);
  console.log("  sourcePath: " + sourcePath);
  console.log("  tags: " + tags.join(", "));
}
