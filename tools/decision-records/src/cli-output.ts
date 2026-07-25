import type { DecisionApplicationFailure } from "./application-result.ts";
import type {
  DecisionQuerySuccess
} from "./decision-query-service.ts";
import type { DecisionDomainDefinition } from "./decision-domain-catalog.ts";
import type { DecisionRecord } from "./types.ts";

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

export function printDecisionQuerySuccess(
  result: DecisionQuerySuccess
): void {
  printQueryWarnings(result.warnings);
  switch (result.command) {
    case "check":
      printCheck(result.summary);
      return;
    case "domains":
      printDomainDefinitions(result.domains);
      return;
    case "list":
      printList(result.domains, result.records, result.fullTime);
      return;
    case "show":
      printShow(result);
      return;
    case "sync-index":
      printSyncIndex(result);
      return;
    case "trace":
      printTrace(result.domains, result.records, result.edges);
  }
}

export function printActivationCandidateWarnings(
  relativePaths: readonly string[]
): void {
  if (relativePaths.length === 0) {
    return;
  }
  console.error("Decision records command completed with warnings:");
  for (const relativePath of relativePaths) {
    console.error("- Unactivated decision candidate remains: " + relativePath);
  }
  console.error(
    "- Activate or discard every candidate before strict check; "
      + "check will continue to fail while any remain."
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
  summary: Extract<
    DecisionQuerySuccess,
    { command: "check" }
  >["summary"]
): void {
  console.log(
    "Decision records check passed ("
      + summary.domainCount
      + " domains, "
      + summary.decisionCount
      + " decisions, "
      + summary.activeCount
      + " active, "
      + summary.alignedCount
      + " aligned, "
      + summary.unalignedCount
      + " unaligned, "
      + summary.archivedCount
      + " archived)."
  );
}

function printList(
  domains: readonly DecisionDomainDefinition[],
  records: readonly DecisionRecord[],
  fullTime: boolean
): void {
  printDomainDefinitions(domains);
  console.log("Decisions:");
  if (records.length === 0) {
    console.log("- none");
    return;
  }
  for (const record of records) {
    const timestamp = record.createdAt ?? "unknown";
    console.log(
      "- "
        + record.status
        + " "
        + (record.alignment ?? "null")
        + " "
        + (fullTime ? timestamp : timestamp.slice(0, 10))
        + " "
        + record.relativePath
        + invalidRecordSuffix(record)
    );
    console.log("  title: " + record.projection.title);
    console.log("  purpose: " + record.projection.purpose);
    console.log("  background: " + record.projection.background);
    console.log("  decision: " + record.projection.decision);
  }
}

function printShow(
  result: Extract<DecisionQuerySuccess, { command: "show" }>
): void {
  console.log("path: " + result.record.relativePath);
  console.log("domain: " + result.domain.id);
  console.log("domainDescription: " + result.domain.description);
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
      ? "Rebuilt "
        + result.indexRelativePath
        + " from decision Markdown files ("
        + result.domainCount
        + " domains)."
      : "Decision index is up to date ("
        + result.domainCount
        + " domains)."
  );
  printActivationCandidateWarnings(result.unactivatedPaths);
}

function printTrace(
  domains: readonly DecisionDomainDefinition[],
  records: readonly DecisionRecord[],
  edges: Extract<
    DecisionQuerySuccess,
    { command: "trace" }
  >["edges"]
): void {
  printDomainDefinitions(domains);
  console.log("Decisions:");
  if (records.length === 0) {
    console.log("- none");
  } else {
    for (const record of records) {
      console.log(
        "- "
          + record.status
          + " "
          + (record.alignment ?? "null")
          + " "
          + record.relativePath
          + " - "
          + record.projection.title
          + invalidRecordSuffix(record)
      );
    }
  }
  console.log("Relations:");
  if (edges.length === 0) {
    console.log("- none");
  } else {
    for (const edge of edges) {
      console.log(
        "- " + edge.source + " --" + edge.type + "--> " + edge.target
      );
    }
  }
}

function printDomainDefinitions(
  domains: readonly DecisionDomainDefinition[]
): void {
  console.log("Domains:");
  if (domains.length === 0) {
    console.log("- none");
    return;
  }
  for (const domain of domains) {
    console.log("- " + domain.id + ": " + domain.description);
  }
}

function invalidRecordSuffix(record: DecisionRecord): string {
  return record.markdownExists && record.bodyValid ? "" : " [invalid]";
}
