import type {
  TestEvidenceCaseShowResult,
  TestEvidenceCaseState,
  TestEvidenceDiagnostic,
  TestEvidenceIndexSyncResult,
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
  const lines = result.cases.flatMap((entry) =>
    formatCaseListItem(entry, result.catalogPath)
  );
  const page = `Showing ${result.cases.length} of ${result.total} case(s) `
    + `from offset ${result.offset}.`;
  return {
    stderr: formatQueryDiagnostics(result),
    stdout: lines.length === 0
      ? `No test evidence cases matched. ${page}\n`
      : `${lines.join("\n")}\n${page}\n`
  };
}

export function formatTestEvidenceCaseShowOutput(
  result: TestEvidenceCaseShowResult,
  json: boolean
): TestEvidenceCliOutput {
  if (json) {
    return {
      stderr: "",
      stdout: `${JSON.stringify(result, null, 2)}\n`
    };
  }
  const entry = result.case;
  return {
    stderr: formatDiagnostics(result.diagnostics),
    stdout: entry === null || result.markdown === null
      ? ""
      : [
        caseHeading(entry),
        `Catalog: ${result.catalogPath}:${entry.line}`,
        `Summary: ${entry.summary}`,
        "",
        result.markdown
      ].join("\n") + "\n"
  };
}

export function formatTestEvidenceIndexSyncOutput(
  result: TestEvidenceIndexSyncResult,
  json: boolean
): TestEvidenceCliOutput {
  if (json) {
    return {
      stderr: "",
      stdout: `${JSON.stringify(result, null, 2)}\n`
    };
  }
  return {
    stderr: result.diagnostics.length === 0
      ? ""
      : `${result.diagnostics.map(formatDiagnostic).join("\n")}\n`,
    stdout: result.status === "error"
      ? ""
      : result.state === "written"
        ? `Rebuilt ${result.indexPath} from ${result.catalogPath}.\n`
        : `Test evidence index is up to date: ${result.indexPath}.\n`
  };
}

export function formatTestEvidenceQueryFailureOutput(
  result: TestEvidenceQueryResult,
  json: boolean
): TestEvidenceCliOutput {
  if (json) {
    return jsonQueryOutput(result);
  }
  return {
    stderr: formatQueryDiagnostics(result),
    stdout: ""
  };
}

function jsonQueryOutput(result: TestEvidenceQueryResult): TestEvidenceCliOutput {
  return {
    stderr: "",
    stdout: `${JSON.stringify(result, null, 2)}\n`
  };
}

function formatQueryDiagnostics(result: TestEvidenceQueryResult): string {
  return formatDiagnostics(result.diagnostics);
}

function formatDiagnostics(
  diagnostics: readonly TestEvidenceDiagnostic[]
): string {
  if (diagnostics.length === 0) {
    return "";
  }
  return `${diagnostics.map(formatDiagnostic).join("\n")}\n`;
}

function formatDiagnostic(diagnostic: TestEvidenceDiagnostic): string {
  return `${diagnostic.blocking ? "blocking" : "non-blocking"} `
    + `${diagnostic.severity} [${diagnostic.code}]: ${diagnostic.message}`;
}

function formatCaseListItem(
  entry: TestEvidenceCaseState,
  catalogPath: string
): string[] {
  const lines = [
    caseHeading(entry),
    `  Catalog: ${catalogPath}:${entry.line}`,
    `  Summary: ${entry.summary}`
  ];
  if (entry.codePath !== null) {
    lines.push(`  Code: ${entry.codePath}`);
  } else if (entry.scope.length > 0) {
    lines.push(`  Scope: ${entry.scope.join(", ")}`);
  }
  if (entry.trigger !== null) {
    for (const reason of entry.trigger.reasons) {
      lines.push(`  Trigger reason: ${reason}`);
    }
    for (const triggerPath of entry.trigger.paths) {
      lines.push(`  Trigger path: ${triggerPath}`);
    }
  }
  return lines;
}

function caseHeading(entry: TestEvidenceCaseState): string {
  const attributes = [entry.status, entry.verification];
  return `${entry.id || "<missing-id>"} [${attributes.join(", ")}] `
    + (entry.title || "<untitled>");
}
