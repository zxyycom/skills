import { createDecisionRecordLookup } from "./decision-record-lookup.ts";
import {
  decisionDiagnosticFromReason,
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import {
  loadDecisionHistoryBaseline,
  type DecisionHistoryBaseline
} from "./decision-history-baseline.ts";
import {
  prepareDecisionLifecycle,
  requiresDecisionHistoryBaseline,
  type DecisionLifecyclePreparation,
  type DecisionLifecycleRequest
} from "./decision-lifecycle-service.ts";
import type { DecisionPreparationContext } from "./types.ts";
import { printDecisionAttention, printDecisionFailure } from "./cli-output.ts";
import { printDecisionRelationReview } from "./cli-output-relation-review.ts";
import type { DecisionRecordsCliIo } from "./cli-io.ts";

export async function prepareLifecycleWithCurrentHistory(
  scan: DecisionPreparationContext,
  request: DecisionLifecycleRequest,
  io: DecisionRecordsCliIo
): Promise<Extract<DecisionLifecyclePreparation, { status: "ok" }> | null> {
  const records = createDecisionRecordLookup(scan.records);
  let historyBaseline: DecisionHistoryBaseline | null = null;
  if (requiresDecisionHistoryBaseline(scan, request, records)) {
    const loadedBaseline = await loadDecisionHistoryBaseline(
      scan,
      lifecycleHistoryIds(scan, request)
    );
    if (loadedBaseline.status === "error") {
      printDecisionFailure(withLifecycleNoChange(loadedBaseline), io);
      return null;
    }
    historyBaseline = loadedBaseline.baseline;
  }
  const prepared = prepareDecisionLifecycle(scan, request, {
    historyBaseline,
    records
  });
  if (prepared.status === "attention") {
    printDecisionAttention(prepared, io);
    return null;
  }
  if (prepared.status === "error") {
    printDecisionFailure(withLifecycleNoChange(prepared), io);
    return null;
  }
  return prepared;
}

function lifecycleHistoryIds(
  scan: DecisionPreparationContext,
  request: DecisionLifecycleRequest
) {
  switch (request.action) {
    case "archive":
      return [...request.decisionIds];
    case "discard":
      return [request.decisionId];
    case "publish":
    case "evolve":
      return publicationHistoryIds(scan, request);
    default:
      return [];
  }
}

function publicationHistoryIds(
  scan: DecisionPreparationContext,
  request: Extract<DecisionLifecycleRequest, { action: "publish" | "evolve" }>
) {
  const successors =
    request.action === "publish"
      ? [{ decisionId: request.decisionId }]
      : request.successors;
  const selected = createDecisionRecordLookup(scan.records);
  const ids = successors.flatMap((successor) =>
    successorHistoryIds(request, successor, selected)
  );
  if (request.action === "evolve" && request.discardId !== null)
    ids.push(request.discardId);
  return [...new Set(ids)];
}

function successorHistoryIds(
  request: Extract<DecisionLifecycleRequest, { action: "publish" | "evolve" }>,
  successor: Pick<
    import("./types.ts").DecisionSuccessor,
    "decisionId" | "relationOverride"
  >,
  records: import("./decision-record-lookup.ts").DecisionRecordLookup
) {
  const record = records.get(successor.decisionId)?.[0];
  const override =
    successor.relationOverride ??
    (request.action === "evolve"
      ? request.relationOverride
      : { kind: "source" as const });
  const relations =
    override.kind === "replace"
      ? override.relations
      : (record?.projection.relations ?? []);
  return [
    successor.decisionId,
    ...relations.map((relation) => relation.target)
  ];
}

export function printLifecyclePreflight(
  action: "evolve" | "publish" | "reactivate" | "set-relations",
  prepared: Extract<DecisionLifecyclePreparation, { status: "ok" }>,
  io: DecisionRecordsCliIo
): number {
  io.stdout(
    "Decision " + action + " preflight passed: " + prepared.message + "\n"
  );
  if (prepared.relationReview !== undefined)
    printDecisionRelationReview(prepared.relationReview, io);
  io.stdout(
    "No Decision Markdown, derived index, or pending state was changed. Re-run the lifecycle command with the complete current parameters to establish it.\n"
  );
  return 0;
}

export function printLifecycleCompletion(
  prepared: Extract<DecisionLifecyclePreparation, { status: "ok" }>,
  io: DecisionRecordsCliIo
): void {
  io.stdout(prepared.message + "\n");
  if (prepared.relationReview !== undefined)
    printDecisionRelationReview(
      { ...prepared.relationReview, phase: "committed" },
      io
    );
}

export function lifecyclePreflightFailure(
  errors: readonly string[]
): DecisionApplicationFailure {
  return decisionFailure(
    errors.map((reason) =>
      decisionDiagnosticFromReason(
        {
          code: "decision-records.lifecycle-preflight-failed",
          outcome: "no-change",
          recovery:
            "Correct the reported decision collection problem. For an established alignment, restore the trusted historical alignment, run sync-index, then retry the command.",
          scope: "Decision Markdown files and derived decision index",
          target: "Decision lifecycle preflight"
        },
        reason
      )
    )
  );
}

function withLifecycleNoChange(
  failure: DecisionApplicationFailure
): DecisionApplicationFailure {
  return {
    ...failure,
    diagnostics: failure.diagnostics.map((diagnostic) => ({
      ...diagnostic,
      ...(diagnostic.code === "decision-records.command-failed"
        ? { code: "decision-records.lifecycle-preflight-failed" }
        : {}),
      outcome: "no-change" as const,
      scope: "Decision Markdown files and derived decision index"
    }))
  };
}
