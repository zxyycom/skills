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
  detectorId?: string;
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
      diagnostic.detectorId ?? "",
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
  return compareText(left.path ?? "", right.path ?? "")
    || (left.line ?? 0) - (right.line ?? 0)
    || (left.column ?? 0) - (right.column ?? 0)
    || compareText(left.severity, right.severity)
    || compareText(left.code, right.code)
    || compareText(left.message, right.message);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
