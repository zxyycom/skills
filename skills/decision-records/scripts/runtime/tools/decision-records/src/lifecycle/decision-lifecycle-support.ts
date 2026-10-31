/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/lifecycle/decision-lifecycle-support.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/lifecycle/decision-lifecycle-support.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/lifecycle/decision-lifecycle-support.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import {
  decisionDiagnostic,
  decisionFailure,
  type DecisionApplicationFailure
} from "../application-result.ts";
import {
  isEstablishedDecisionRecord,
  type DecisionId,
  type DecisionRecord,
  type DecisionPreparationContext,
  type EstablishedDecisionRecord
} from "../types.ts";

export function findRecord(
  scan: DecisionPreparationContext,
  value: DecisionId
): DecisionRecord | null {
  return scan.records.find((record) => record.decisionId === value) ?? null;
}

export function findEstablishedRecord(
  scan: DecisionPreparationContext,
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
