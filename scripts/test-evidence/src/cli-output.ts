import type { TestEvidenceReport } from "./types.ts";

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

  const stderrLines = [
    ...report.warnings.map((warning) => `warning: ${warning}`),
    ...report.errors.map((error) => `error: ${error}`)
  ];
  const summary = report.summary;
  return {
    stderr: stderrLines.length === 0 ? "" : `${stderrLines.join("\n")}\n`,
    stdout:
      `Test evidence check ${report.errors.length === 0 ? "passed" : "failed"}: `
      + `${summary.activeAutomatedCases} automated, `
      + `${summary.reviewCases} review, ${summary.exemptCases} exempt, `
      + `${summary.plannedAutomatedCases} planned, `
      + `${summary.discoveredTestEntries} discovered test entry(s), `
      + `${summary.unregisteredTestEntries} unregistered, `
      + `${summary.reviewTriggers} review trigger(s).\n`
  };
}
