import {
  diagnosticFromError,
  genericInvestigationDiagnostic,
  type InvestigationDiagnostic,
  type InvestigationDiagnosticCause,
  type InvestigationDiagnosticSource
} from "../../diagnostics.ts";

const historyDiagnosticIdentity: Pick<
  InvestigationDiagnostic,
  "code" | "reason"
> = {
  code: "investigation-report.history-check-unavailable",
  reason: "the Git HEAD predecessor check could not be completed"
};

const incompatibleIndexCodes: ReadonlySet<string> = new Set([
  "state-index.schema-version-unsupported",
  "state-index.definition-version-mismatch",
  "state-index.namespace-mismatch",
  "state-index.definition-mismatch",
  "state-index.definition-invalid"
]);

export function historicalInvestigationDiagnostic(
  source: InvestigationDiagnosticSource,
  causes: readonly InvestigationDiagnosticCause[]
): InvestigationDiagnostic {
  const incompatible = causes.some((cause) =>
    incompatibleIndexCodes.has(cause.code)
  );
  return genericInvestigationDiagnostic({
    ...historyDiagnosticIdentity,
    recovery: incompatible
      ? "verify tool/index version and namespace compatibility and follow the supported migration procedure, then rerun the full check before relying on predecessor warnings"
      : "validate the current index and selected sources against trusted reports and commit any verified repair to restore the Git HEAD baseline, then rerun the full check before relying on predecessor warnings",
    source,
    target: source.path,
    causes
  });
}

export function historicalInvestigationErrorDiagnostic(
  error: unknown,
  target: string
): InvestigationDiagnostic {
  return diagnosticFromError({
    ...historyDiagnosticIdentity,
    error,
    recovery:
      "inspect and resolve the reported failure, restoring version-control or filesystem access when indicated, then rerun the full check before relying on predecessor warnings",
    target
  });
}
