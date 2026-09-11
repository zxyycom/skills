import {
  decisionDiagnostic,
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import {
  isEstablishedDecisionRecord,
  type DecisionId,
  type DecisionRecord,
  type DecisionScan,
  type EstablishedDecisionRecord
} from "./types.ts";

export function findRecord(
  scan: DecisionScan,
  value: DecisionId
): DecisionRecord | null {
  return scan.records.find((record) => record.decisionId === value) ?? null;
}

export function findEstablishedRecord(
  scan: DecisionScan,
  value: DecisionId
): EstablishedDecisionRecord | null {
  const record = findRecord(scan, value);
  return record !== null && isEstablishedDecisionRecord(record) ? record : null;
}

export function plainFailure(error: string): DecisionApplicationFailure {
  return decisionFailure(
    [
      decisionDiagnostic({
        code: "decision-records.lifecycle-invalid",
        reason: error,
        recovery:
          "Correct the lifecycle request or decision state, then retry the command.",
        target: "Decision lifecycle"
      })
    ],
    { presentation: "plain" }
  );
}

export function currentDecisionTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}
