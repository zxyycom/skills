import type {
  VerificationEvidenceDiagnostic,
  VerificationEvidenceDiagnosticCategory,
  VerificationEvidenceDiagnosticSeverity
} from "./types.ts";

export type CreateDiagnosticInput = {
  blocking?: boolean;
  caseId?: string;
  category: VerificationEvidenceDiagnosticCategory;
  code: string;
  column?: number;
  line?: number;
  message: string;
  path?: string;
  severity: VerificationEvidenceDiagnosticSeverity;
};

export function createDiagnostic(
  input: CreateDiagnosticInput
): VerificationEvidenceDiagnostic {
  return {
    ...input,
    blocking: input.blocking ?? input.severity === "error"
  };
}

export function sortUniqueDiagnostics(
  diagnostics: readonly VerificationEvidenceDiagnostic[]
): VerificationEvidenceDiagnostic[] {
  const unique = new Map<string, VerificationEvidenceDiagnostic>();
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
  diagnostics: readonly VerificationEvidenceDiagnostic[]
): boolean {
  return diagnostics.some((diagnostic) => diagnostic.blocking);
}

function compareDiagnostics(
  left: VerificationEvidenceDiagnostic,
  right: VerificationEvidenceDiagnostic
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
