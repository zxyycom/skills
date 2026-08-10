import { compareLexicalText } from "./canonicalization.ts";
import type {
  TestEvidenceDiagnostic,
  TestEvidenceDiagnosticCategory,
  TestEvidenceDiagnosticSeverity
} from "./schemas.ts";

export type CreateTestEvidenceDiagnosticInput = {
  blocking?: boolean;
  caseId?: string;
  category: TestEvidenceDiagnosticCategory;
  code: string;
  column?: number;
  line?: number;
  message: string;
  path?: string;
  severity: TestEvidenceDiagnosticSeverity;
  testId?: string;
};

export type TestEvidenceValidationIssue = {
  message: string;
  path?: readonly { key: unknown }[];
};

export function createTestEvidenceDiagnostic(
  input: CreateTestEvidenceDiagnosticInput
): TestEvidenceDiagnostic {
  return {
    ...input,
    blocking: input.blocking ?? input.severity === "error"
  };
}

export function createInvalidTestEvidenceOptionsDiagnostic(
  issues: readonly TestEvidenceValidationIssue[]
): TestEvidenceDiagnostic {
  return createTestEvidenceDiagnostic({
    category: "query",
    code: "query.options-invalid",
    message: "Invalid ledger API options: "
      + formatTestEvidenceValidationIssues(issues),
    severity: "error"
  });
}

export function formatTestEvidenceValidationIssues(
  issues: readonly TestEvidenceValidationIssue[]
): string {
  return issues.map((issue) => {
    const issuePath = issue.path
      ?.map((segment) => String(segment.key))
      .join(".");
    return issuePath === undefined || issuePath.length === 0
      ? issue.message
      : `${issuePath}: ${issue.message}`;
  }).join("; ");
}

export function sortUniqueTestEvidenceDiagnostics(
  diagnostics: readonly TestEvidenceDiagnostic[]
): TestEvidenceDiagnostic[] {
  const unique = new Map<string, TestEvidenceDiagnostic>();
  for (const diagnostic of diagnostics) {
    const key = [
      diagnostic.severity,
      String(diagnostic.blocking),
      diagnostic.category,
      diagnostic.code,
      diagnostic.path ?? "",
      String(diagnostic.line ?? 0),
      String(diagnostic.column ?? 0),
      diagnostic.caseId ?? "",
      diagnostic.testId ?? "",
      diagnostic.message
    ].join("\0");
    unique.set(key, diagnostic);
  }
  return [...unique.values()].sort(compareDiagnostics);
}

export function hasBlockingTestEvidenceDiagnostics(
  diagnostics: readonly TestEvidenceDiagnostic[]
): boolean {
  return diagnostics.some((diagnostic) => diagnostic.blocking);
}

export function testEvidenceErrorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function compareDiagnostics(
  left: TestEvidenceDiagnostic,
  right: TestEvidenceDiagnostic
): number {
  return compareLexicalText(left.path ?? "", right.path ?? "")
    || (left.line ?? 0) - (right.line ?? 0)
    || (left.column ?? 0) - (right.column ?? 0)
    || compareLexicalText(left.severity, right.severity)
    || compareLexicalText(left.code, right.code)
    || compareLexicalText(left.caseId ?? "", right.caseId ?? "")
    || compareLexicalText(left.testId ?? "", right.testId ?? "")
    || compareLexicalText(left.message, right.message);
}
