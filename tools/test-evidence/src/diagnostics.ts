import type {
  TestEvidenceDiagnostic,
  TestEvidenceDiagnosticCategory,
  TestEvidenceDiagnosticSeverity
} from "./types.ts";

export type CreateDiagnosticInput = {
  blocking?: boolean;
  caseId?: string;
  category: TestEvidenceDiagnosticCategory;
  code: string;
  column?: number;
  line?: number;
  message: string;
  path?: string;
  severity: TestEvidenceDiagnosticSeverity;
};

export function createDiagnostic(
  input: CreateDiagnosticInput
): TestEvidenceDiagnostic {
  return {
    ...input,
    blocking: input.blocking ?? input.severity === "error"
  };
}

export function sortUniqueDiagnostics(
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
      diagnostic.message
    ].join("\0");
    unique.set(key, diagnostic);
  }
  return [...unique.values()].sort(compareDiagnostics);
}

export function hasBlockingDiagnostics(
  diagnostics: readonly TestEvidenceDiagnostic[]
): boolean {
  return diagnostics.some((diagnostic) => diagnostic.blocking);
}

function compareDiagnostics(
  left: TestEvidenceDiagnostic,
  right: TestEvidenceDiagnostic
): number {
  const leftKey = diagnosticSortKey(left);
  const rightKey = diagnosticSortKey(right);
  const comparisons = [
    compareText(leftKey.path, rightKey.path),
    leftKey.line - rightKey.line,
    leftKey.column - rightKey.column,
    compareText(leftKey.severity, rightKey.severity),
    compareText(leftKey.code, rightKey.code),
    compareText(leftKey.message, rightKey.message)
  ];
  return comparisons.find((comparison) => comparison !== 0) ?? 0;
}

function diagnosticSortKey(diagnostic: TestEvidenceDiagnostic): Readonly<{
  code: string;
  column: number;
  line: number;
  message: string;
  path: string;
  severity: TestEvidenceDiagnosticSeverity;
}> {
  return {
    code: diagnostic.code,
    column: diagnostic.column ?? 0,
    line: diagnostic.line ?? 0,
    message: diagnostic.message,
    path: diagnostic.path ?? "",
    severity: diagnostic.severity
  };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
