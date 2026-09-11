import {
  decisionDiagnostic,
  decisionDiagnosticFromReason,
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import {
  decisionIndexDiagnostics,
  decisionIndexRecovery
} from "./decision-state-index.ts";
import {
  compareDecisionRecords,
  isActivationCandidateRecord,
  isDecisionCandidateRecord,
  type DecisionCandidateRecord,
  type DecisionRecord,
  type DecisionScan
} from "./types.ts";
import { isDecisionId } from "./decision-path.ts";
import type { StateIndexDiagnostic } from "../../index-runtime/src/index.ts";
import type {
  CandidateDecisionRecord,
  IndexedDecisionRecord,
  IndexedDecisionState
} from "./decision-query-contract.ts";

export function indexedRecords(
  entries: readonly IndexedDecisionState[]
): IndexedDecisionRecord[] {
  return entries.map(indexedRecord);
}

export function indexedRecord(
  entry: IndexedDecisionState
): IndexedDecisionRecord {
  const state = entry.state;
  if (!isDecisionId(entry.id))
    throw new TypeError("indexed decision entry uses an invalid Decision ID");
  return {
    alignment: state.alignment,
    createdAt: state.createdAt,
    decisionId: entry.id,
    projection: {
      title: state.title,
      purpose: state.purpose,
      background: state.background,
      decision: state.decision,
      relations: state.relations.map((relation) => ({ ...relation }))
    },
    sourcePath: state.sourcePath,
    status: state.status,
    tags: [...state.tags]
  };
}

export function activationCandidates(
  scan: DecisionScan
): DecisionCandidateRecord[] {
  return scan.records
    .filter(isActivationCandidateRecord)
    .sort(compareDecisionRecords);
}

export function candidateRecords(
  scan: DecisionScan
): CandidateDecisionRecord[] {
  return scan.records
    .filter(isDecisionCandidateRecord)
    .sort(compareDecisionRecords)
    .filter((record) => record.relationshipErrors.length === 0)
    .map((record) => ({
      alignment: null,
      bodyReady: record.bodyReady,
      createdAt: null,
      decisionId: record.decisionId,
      projection: record.projection,
      sourcePath: record.sourcePath,
      scaffoldValid: true,
      status: "candidate",
      tags: [...record.tags]
    }));
}

export function sourceWarningsForRecord(
  warnings: readonly string[],
  record: DecisionRecord
): string[] {
  return [
    ...new Set([
      ...warnings.filter((warning) =>
        warning.startsWith(record.sourcePath + " ")
      ),
      ...record.relationshipErrors
    ])
  ];
}

export function indexFailure(
  result: { diagnostics: readonly StateIndexDiagnostic[] },
  indexRelativePath: string,
  additionalReasons: readonly string[] = []
): DecisionApplicationFailure {
  const recovery = decisionIndexRecovery(
    result.diagnostics,
    "Run sync-index after correcting the decision Markdown or index problem."
  );
  return decisionFailure([
    ...decisionIndexDiagnostics(result.diagnostics, {
      code: "decision-records.index-query-failed",
      recovery,
      target: indexRelativePath
    }),
    ...additionalReasons.map((reason) =>
      decisionDiagnosticFromReason(
        {
          code: "decision-records.index-query-failed",
          recovery,
          target: indexRelativePath
        },
        reason
      )
    )
  ]);
}

export function sourceFailure(
  reasons: readonly string[],
  target: string
): DecisionApplicationFailure {
  return decisionFailure(
    reasons.map((reason) =>
      decisionDiagnosticFromReason(
        {
          code: "decision-records.source-scan-failed",
          recovery:
            "Restore a readable, valid decision source collection. For a reported established alignment, restore the trusted historical alignment before running sync-index or another maintenance command.",
          target
        },
        reason
      )
    )
  );
}

export function mergeDecisionFailures(
  failures: readonly DecisionApplicationFailure[]
): DecisionApplicationFailure {
  return decisionFailure(failures.flatMap((failure) => failure.diagnostics));
}

export function syncIndexNoChange(
  failure: DecisionApplicationFailure
): DecisionApplicationFailure {
  return {
    ...failure,
    diagnostics: failure.diagnostics.map((diagnostic) => ({
      ...diagnostic,
      outcome: "no-change" as const,
      scope: "Derived decision index"
    }))
  };
}

export function selectorNotFound(
  label: string,
  selector: string
): DecisionApplicationFailure {
  return decisionFailure(
    [
      decisionDiagnostic({
        code: "decision-records.decision-not-found",
        reason: `${label} does not exist: ${selector}`,
        recovery:
          "Use list to choose a Decision ID or unique name, then retry the command.",
        target: selector
      })
    ],
    { presentation: "plain" }
  );
}
