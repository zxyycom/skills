import { classifyHistoricalIndexCauses } from "../../../../record-operations/src/history-index.ts";
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

export function historicalInvestigationDiagnostic(
  source: InvestigationDiagnosticSource,
  causes: readonly InvestigationDiagnosticCause[]
): InvestigationDiagnostic {
  const category = classifyHistoricalIndexCauses(causes);
  return genericInvestigationDiagnostic({
    ...historyDiagnosticIdentity,
    recovery:
      category === "system"
        ? "inspect and resolve the reported version-control or filesystem access failure, then rerun the full check before relying on predecessor warnings"
        : category === "incompatible"
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
