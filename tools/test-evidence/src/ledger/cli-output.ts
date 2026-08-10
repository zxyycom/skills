import { hasBlockingTestEvidenceDiagnostics } from "./diagnostics.ts";
import type {
  TestEvidenceCaseQueryResult,
  TestEvidenceCaseShowResult,
  TestEvidenceDiagnostic,
  TestEvidenceLedgerIndexSyncResult,
  TestEvidenceLedgerReport,
  TestEvidenceTestQueryResult
} from "./schemas.ts";

export type TestEvidenceLedgerCliOutput = {
  stderr: string;
  stdout: string;
};

export function formatLedgerReport(
  report: TestEvidenceLedgerReport,
  json: boolean
): TestEvidenceLedgerCliOutput {
  if (json) {
    return jsonOutput(report);
  }
  const failed = hasBlockingTestEvidenceDiagnostics(report.diagnostics);
  return {
    stderr: formatDiagnostics(report.diagnostics),
    stdout: `Test evidence ledger check ${failed ? "failed" : "passed"}: `
      + `${report.summary.tests} Test(s), ${report.summary.cases} Case(s), `
      + `${report.summary.relations} relation(s), ${report.summary.tags} Tag(s).\n`
  };
}

export function formatLedgerSync(
  result: TestEvidenceLedgerIndexSyncResult,
  json: boolean
): TestEvidenceLedgerCliOutput {
  if (json) {
    return jsonOutput(result);
  }
  return {
    stderr: formatDiagnostics(result.diagnostics),
    stdout: result.status === "error"
      ? ""
      : result.state === "written"
        ? `Rebuilt ${result.indexPath} from ${result.ledgerPath}.\n`
        : `Test evidence ledger index is current: ${result.indexPath}.\n`
  };
}

export function formatLedgerCaseQuery(
  result: TestEvidenceCaseQueryResult,
  json: boolean
): TestEvidenceLedgerCliOutput {
  if (json) {
    return jsonOutput(result);
  }
  const lines = result.cases.flatMap((entry) => [
    `${entry.id} ${entry.title}`,
    `  Source: ${result.ledgerPath}/${entry.sourcePath}`,
    `  Tests: ${entry.testIds.join(", ")}`,
    `  Tags: ${entry.tags.length === 0 ? "<none>" : entry.tags.join(", ")}`,
    `  Summary: ${entry.summary}`
  ]);
  const page = `Showing ${result.cases.length} of ${result.total} Case(s) from offset ${result.offset}.`;
  return {
    stderr: formatDiagnostics(result.diagnostics),
    stdout: lines.length === 0
      ? `No Cases matched. ${page}\n`
      : `${lines.join("\n")}\n${page}\n`
  };
}

export function formatLedgerCaseShow(
  result: TestEvidenceCaseShowResult,
  json: boolean
): TestEvidenceLedgerCliOutput {
  if (json) {
    return jsonOutput(result);
  }
  return {
    stderr: formatDiagnostics(result.diagnostics),
    stdout: result.case === null || result.markdown === null
      ? ""
      : [
        `${result.case.id} ${result.case.title}`,
        `Source: ${result.ledgerPath}/${result.case.sourcePath}`,
        `Tests: ${result.tests.map((entry) => entry.id).join(", ")}`,
        "",
        result.markdown.trimEnd()
      ].join("\n") + "\n"
  };
}

export function formatLedgerTestQuery(
  result: TestEvidenceTestQueryResult,
  json: boolean
): TestEvidenceLedgerCliOutput {
  if (json) {
    return jsonOutput(result);
  }
  const lines = result.tests.flatMap((entry) => [
    `${entry.id} ${entry.name}`,
    `  Locators: ${entry.locators.join(", ")}`,
    `  Cases: ${entry.caseIds.join(", ")}`
  ]);
  const page = `Showing ${result.tests.length} of ${result.total} Test(s) from offset ${result.offset}.`;
  return {
    stderr: formatDiagnostics(result.diagnostics),
    stdout: lines.length === 0
      ? `No Tests matched. ${page}\n`
      : `${lines.join("\n")}\n${page}\n`
  };
}

function jsonOutput(value: unknown): TestEvidenceLedgerCliOutput {
  return {
    stderr: "",
    stdout: `${JSON.stringify(value, null, 2)}\n`
  };
}

function formatDiagnostics(
  diagnostics: readonly TestEvidenceDiagnostic[]
): string {
  if (diagnostics.length === 0) {
    return "";
  }
  return `${diagnostics.map((diagnostic) => (
    `${diagnostic.blocking ? "blocking" : "non-blocking"} `
      + `${diagnostic.severity} [${diagnostic.code}]: ${diagnostic.message}`
  )).join("\n")}\n`;
}
