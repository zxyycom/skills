import { hasBlockingDiagnostics } from "./diagnostics.ts";
import type {
  VerificationCaseShowResult,
  VerificationCaseState,
  VerificationEvidenceDiagnostic,
  VerificationEvidenceIndexSyncResult,
  VerificationEvidenceQueryResult,
  VerificationEvidenceReport
} from "./types.ts";

export type VerificationEvidenceCliOutput = {
  stderr: string;
  stdout: string;
};

export function formatVerificationEvidenceReport(
  report: VerificationEvidenceReport,
  json: boolean
): VerificationEvidenceCliOutput {
  if (json) {
    return jsonOutput(report);
  }
  const summary = report.summary;
  const failed = hasBlockingDiagnostics(report.diagnostics);
  return {
    stderr: formatDiagnostics(report.diagnostics),
    stdout:
      `Verification evidence check ${failed ? "failed" : "passed"}: `
      + `${summary.testCases} test case(s), ${summary.checkCases} check case(s).\n`
  };
}

export function formatVerificationCaseList(
  result: VerificationEvidenceQueryResult,
  json: boolean
): VerificationEvidenceCliOutput {
  if (json) {
    return jsonOutput(result);
  }
  const lines = result.cases.flatMap((entry) =>
    formatCaseListItem(entry, result.catalogPath)
  );
  const page = `Showing ${result.cases.length} of ${result.total} case(s) `
    + `from offset ${result.offset}.`;
  return {
    stderr: formatDiagnostics(result.diagnostics),
    stdout: lines.length === 0
      ? `No verification cases matched. ${page}\n`
      : `${lines.join("\n")}\n${page}\n`
  };
}

export function formatVerificationCaseShow(
  result: VerificationCaseShowResult,
  json: boolean
): VerificationEvidenceCliOutput {
  if (json) {
    return jsonOutput(result);
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

export function formatVerificationEvidenceIndexSync(
  result: VerificationEvidenceIndexSyncResult,
  json: boolean
): VerificationEvidenceCliOutput {
  if (json) {
    return jsonOutput(result);
  }
  return {
    stderr: formatDiagnostics(result.diagnostics),
    stdout: result.status === "error"
      ? ""
      : result.state === "written"
        ? `Rebuilt ${result.indexPath} from ${result.catalogPath}.\n`
        : `Verification evidence index is up to date: ${result.indexPath}.\n`
  };
}

export function formatVerificationQueryFailure(
  result: VerificationEvidenceQueryResult,
  json: boolean
): VerificationEvidenceCliOutput {
  return json ? jsonOutput(result) : {
    stderr: formatDiagnostics(result.diagnostics),
    stdout: ""
  };
}

function jsonOutput(value: unknown): VerificationEvidenceCliOutput {
  return {
    stderr: "",
    stdout: `${JSON.stringify(value, null, 2)}\n`
  };
}

function formatDiagnostics(
  diagnostics: readonly VerificationEvidenceDiagnostic[]
): string {
  if (diagnostics.length === 0) {
    return "";
  }
  return `${diagnostics.map(formatDiagnostic).join("\n")}\n`;
}

function formatDiagnostic(
  diagnostic: VerificationEvidenceDiagnostic
): string {
  return `${diagnostic.blocking ? "blocking" : "non-blocking"} `
    + `${diagnostic.severity} [${diagnostic.code}]: ${diagnostic.message}`;
}

function formatCaseListItem(
  entry: VerificationCaseState,
  catalogPath: string
): string[] {
  return [
    caseHeading(entry),
    `  Catalog: ${catalogPath}:${entry.line}`,
    `  Entry: ${entry.entries.join(", ")}`,
    `  Summary: ${entry.summary}`
  ];
}

function caseHeading(entry: VerificationCaseState): string {
  return `${entry.id || "<missing-id>"} [${entry.verification}] `
    + (entry.title || "<untitled>");
}
