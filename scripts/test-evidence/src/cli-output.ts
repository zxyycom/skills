import type {
  TestEvidenceCaseView,
  TestEvidenceDiagnostic,
  TestEvidenceQueryResult,
  TestEvidenceReport
} from "./types.ts";
import { hasBlockingDiagnostics } from "./diagnostics.ts";

export type TestEvidenceCliOutput = {
  stderr: string;
  stdout: string;
};

export function formatTestEvidenceCliOutput(
  report: TestEvidenceReport,
  json: boolean
): TestEvidenceCliOutput {
  if (json) {
    return {
      stderr: "",
      stdout: `${JSON.stringify(report, null, 2)}\n`
    };
  }

  const stderrLines = report.diagnostics.map(formatDiagnostic);
  const summary = report.summary;
  const failed = hasBlockingDiagnostics(report.diagnostics);
  return {
    stderr: stderrLines.length === 0 ? "" : `${stderrLines.join("\n")}\n`,
    stdout:
      `Test evidence check ${failed ? "failed" : "passed"}: `
      + `${summary.activeAutomatedCases} automated, `
      + `${summary.reviewCases} review, ${summary.exemptCases} exempt, `
      + `${summary.plannedAutomatedCases} planned, `
      + `${summary.discoveredTestEntries} discovered test entry(s), `
      + `${summary.unregisteredTestEntries} unregistered, `
      + `${summary.reviewTriggers} review trigger(s).\n`
  };
}

export function formatTestEvidenceCaseListOutput(
  result: TestEvidenceQueryResult,
  json: boolean
): TestEvidenceCliOutput {
  if (json) {
    return jsonQueryOutput(result);
  }
  const lines = result.cases.flatMap(formatCaseListItem);
  return {
    stderr: formatQueryDiagnostics(result),
    stdout: lines.length === 0
      ? "No test evidence cases matched.\n"
      : `${lines.join("\n")}\n`
  };
}

export function formatTestEvidenceCaseShowOutput(
  result: TestEvidenceQueryResult,
  json: boolean
): TestEvidenceCliOutput {
  if (json) {
    return jsonQueryOutput(result);
  }
  const entry = result.cases[0];
  return {
    stderr: formatQueryDiagnostics(result),
    stdout: entry === undefined ? "" : `${formatCaseDetails(entry).join("\n")}\n`
  };
}

function jsonQueryOutput(result: TestEvidenceQueryResult): TestEvidenceCliOutput {
  return {
    stderr: "",
    stdout: `${JSON.stringify(result, null, 2)}\n`
  };
}

function formatQueryDiagnostics(result: TestEvidenceQueryResult): string {
  if (result.diagnostics.length === 0) {
    return "";
  }
  return `${result.diagnostics.map(formatDiagnostic).join("\n")}\n`;
}

function formatDiagnostic(diagnostic: TestEvidenceDiagnostic): string {
  return `${diagnostic.blocking ? "blocking" : "non-blocking"} `
    + `${diagnostic.severity} [${diagnostic.code}]: ${diagnostic.message}`;
}

function formatCaseListItem(entry: TestEvidenceCaseView): string[] {
  const lines = [caseHeading(entry)];
  const contract = entry.contract[0];
  if (contract !== undefined) {
    lines.push(`  contract: ${contract}`);
  }
  if (entry.codePath !== null) {
    lines.push(`  code: ${entry.codePath}`);
  } else if (entry.scope.length > 0) {
    lines.push(`  scope: ${entry.scope.join(", ")}`);
  }
  if (entry.sourceMarkers.length > 0) {
    lines.push(
      "  entries: "
      + entry.sourceMarkers.map((marker) =>
        `${marker.role} ${marker.path}:${marker.entryLine ?? marker.markerLine}`
      ).join(", ")
    );
  }
  if (entry.trigger !== null) {
    lines.push(`  trigger: ${entry.trigger.reasons.join("; ")}`);
  }
  return lines;
}

function formatCaseDetails(entry: TestEvidenceCaseView): string[] {
  const lines = [
    caseHeading(entry),
    `catalog-line: ${entry.line}`
  ];
  if (entry.codePath !== null) {
    lines.push(`code: ${entry.codePath}`);
  }
  appendList(lines, "Contract", entry.contract);
  appendList(lines, "Proves", entry.proves);
  appendList(lines, "Scope", entry.scope);
  appendList(lines, "Risk", entry.risk);
  appendList(lines, "Reason", entry.reason);
  appendList(lines, "Review", entry.review);
  if (entry.lastReview !== null) {
    lines.push("Last review:");
    lines.push(`- result: ${entry.lastReview.result}`);
    lines.push(`- at: ${entry.lastReview.at}`);
    lines.push(`- commit: ${entry.lastReview.commit}`);
  }
  if (entry.sourceMarkers.length > 0) {
    lines.push("Source mappings:");
    for (const marker of entry.sourceMarkers) {
      lines.push(
        `- ${marker.role} ${marker.path}:${marker.markerLine}`
        + (marker.attached
          ? ` -> entry ${marker.entryLine}:${marker.entryColumn}`
          : " -> unattached")
      );
    }
  }
  if (entry.trigger !== null) {
    lines.push("Review trigger:");
    for (const reason of entry.trigger.reasons) {
      lines.push(`- ${reason}`);
    }
    for (const path of entry.trigger.paths) {
      lines.push(`- path: ${path}`);
    }
  }
  return lines;
}

function caseHeading(entry: TestEvidenceCaseView): string {
  return `${entry.status ?? "invalid"} ${entry.verification ?? "invalid"} `
    + `${entry.id}${entry.valid ? "" : " [invalid]"} - ${entry.title || "<untitled>"}`;
}

function appendList(lines: string[], label: string, values: readonly string[]): void {
  if (values.length === 0) {
    return;
  }
  lines.push(`${label}:`);
  for (const value of values) {
    lines.push(`- ${value}`);
  }
}
