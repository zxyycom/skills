import { hasBlockingDiagnostics } from "./diagnostics.ts";
import type {
  TestEvidenceCaseShowResult,
  TestEvidenceCaseState,
  TestEvidenceDiagnostic,
  TestEvidenceIndexSyncResult,
  TestEvidenceQueryResult,
  TestEvidenceReport,
  TestEvidenceTopicDefinition,
  TestEvidenceTopicsResult
} from "./types.ts";

export type TestEvidenceCliOutput = {
  stderr: string;
  stdout: string;
};

export function formatTestEvidenceReport(
  report: TestEvidenceReport,
  json: boolean
): TestEvidenceCliOutput {
  if (json) {
    return jsonOutput(report);
  }
  const summary = report.summary;
  const failed = hasBlockingDiagnostics(report.diagnostics);
  return {
    stderr: formatDiagnostics(report.diagnostics),
    stdout:
      `Test evidence check ${failed ? "failed" : "passed"}: `
      + `${report.topics.length} topic(s), `
      + `${summary.testCases} test case(s).\n`
  };
}

export function formatTestEvidenceCaseList(
  result: TestEvidenceQueryResult,
  json: boolean
): TestEvidenceCliOutput {
  if (json) {
    return jsonOutput(result);
  }
  const lines = result.cases.flatMap((entry) =>
    formatCaseListItem(entry, result.catalogPath, result.topics)
  );
  const page = `Showing ${result.cases.length} of ${result.total} case(s) `
    + `from offset ${result.offset}.`;
  return {
    stderr: formatDiagnostics(result.diagnostics),
    stdout: lines.length === 0
      ? `No test cases matched. ${page}\n`
      : `${lines.join("\n")}\n${page}\n`
  };
}

export function formatTestEvidenceCaseShow(
  result: TestEvidenceCaseShowResult,
  json: boolean
): TestEvidenceCliOutput {
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
        `Topic: ${formatTopic(result.topic)}`,
        `Catalog: ${result.catalogPath}/${entry.sourcePath}:${entry.line}`,
        `Summary: ${entry.summary}`,
        "",
        result.markdown
      ].join("\n") + "\n"
  };
}

export function formatTestEvidenceTopics(
  result: TestEvidenceTopicsResult,
  json: boolean
): TestEvidenceCliOutput {
  if (json) {
    return jsonOutput(result);
  }
  return {
    stderr: formatDiagnostics(result.diagnostics),
    stdout: result.topics.length === 0
      ? ""
      : `${result.topics.map((topic) => formatTopic(topic)).join("\n")}\n`
  };
}

export function formatTestEvidenceIndexSync(
  result: TestEvidenceIndexSyncResult,
  json: boolean
): TestEvidenceCliOutput {
  if (json) {
    return jsonOutput(result);
  }
  return {
    stderr: formatDiagnostics(result.diagnostics),
    stdout: result.status === "error"
      ? ""
      : result.state === "written"
        ? `Rebuilt ${result.indexPath} from ${result.catalogPath}.\n`
        : `Test evidence index is up to date: ${result.indexPath}.\n`
  };
}

export function formatTestEvidenceQueryFailure(
  result: TestEvidenceQueryResult,
  json: boolean
): TestEvidenceCliOutput {
  return json ? jsonOutput(result) : {
    stderr: formatDiagnostics(result.diagnostics),
    stdout: ""
  };
}

function jsonOutput(value: unknown): TestEvidenceCliOutput {
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
  return `${diagnostics.map(formatDiagnostic).join("\n")}\n`;
}

function formatDiagnostic(
  diagnostic: TestEvidenceDiagnostic
): string {
  return `${diagnostic.blocking ? "blocking" : "non-blocking"} `
    + `${diagnostic.severity} [${diagnostic.code}]: ${diagnostic.message}`;
}

function formatCaseListItem(
  entry: TestEvidenceCaseState,
  catalogPath: string,
  topics: readonly TestEvidenceTopicDefinition[]
): string[] {
  const topicId = entry.sourcePath.split("/", 1)[0] ?? "";
  const topic = topics.find((candidate) => candidate.id === topicId) ?? null;
  return [
    caseHeading(entry),
    `  Topic: ${formatTopic(topic)}`,
    `  Catalog: ${catalogPath}/${entry.sourcePath}:${entry.line}`,
    `  Entry: ${entry.entries.join(", ")}`,
    `  Summary: ${entry.summary}`
  ];
}

function formatTopic(topic: TestEvidenceTopicDefinition | null): string {
  return topic === null
    ? "<unknown-topic>"
    : `${topic.id} - ${topic.description}`;
}

function caseHeading(entry: TestEvidenceCaseState): string {
  return `${entry.id || "<missing-id>"} `
    + (entry.title || "<untitled>");
}
