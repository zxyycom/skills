import assert from "node:assert/strict";
import { prepareDecisionRelationTransaction } from "../../../src/relations/transactions/decision-relation-transaction.ts";
import { decisionIdForTest } from "../../support/support-record-fixture.ts";
import {
  decisionScanFromSources,
  type DecisionSourceFixture
} from "../../support/domain-fixture.ts";

export async function assertEvolutionRejected(
  sources: readonly DecisionSourceFixture[],
  selected: readonly string[],
  expected: RegExp
): Promise<void> {
  const scan = await decisionScanFromSources(sources);
  assert.deepEqual(scan.sourceErrors, []);
  const result = prepareDecisionRelationTransaction(
    scan,
    {
      kind: "evolve",
      discardId: null,
      deleteRecorded: false,
      keepUnrecordedHistory: true,
      relationOverride: { kind: "source" },
      successors: selected.map((id) => ({
        decisionId: decisionIdForTest(id),
        alignment: "aligned"
      }))
    },
    () => "2026-10-20T00:00:00Z",
    null
  );
  assert.equal(result.status, "error");
  if (result.status !== "error") throw new Error("Expected rejected evolution");
  assert.equal(result.exitCode, 1);
  assert.match(result.errors.join("\n"), expected);
  assert.equal("changes" in result, false);
}

export async function assertLifecycleRejected(
  sources: readonly DecisionSourceFixture[],
  request: import("../../../src/lifecycle/decision-lifecycle-service.ts").DecisionLifecycleRequest,
  expected: RegExp
): Promise<void> {
  const { resolveDecisionLifecycleRequest } =
    await import("../../../src/cli/commands/cli-lifecycle-selection.ts");
  const { prepareDecisionLifecycle } =
    await import("../../../src/lifecycle/decision-lifecycle-service.ts");
  const scan = await decisionScanFromSources(sources);
  assert.deepEqual(scan.sourceErrors, []);
  const selected = resolveDecisionLifecycleRequest(scan, request);
  const result =
    selected.status === "error"
      ? selected.failure
      : prepareDecisionLifecycle(scan, selected.request, {
          historyBaseline: { kind: "outside-git-worktree" },
          currentTimestamp: () => "2026-10-20T00:00:00Z"
        });
  assert.equal(result.status, "error");
  if (result.status !== "error")
    throw new Error("Expected lifecycle rejection");
  assert.match(result.errors.join("\n"), expected);
  assert.equal("changes" in result, false);
}

export function evolutionRequest(
  ids: readonly string[],
  overrides: Partial<
    Extract<
      import("../../../src/lifecycle/decision-lifecycle-service.ts").DecisionLifecycleRequest,
      { action: "evolve" }
    >
  > = {}
): Extract<
  import("../../../src/lifecycle/decision-lifecycle-service.ts").DecisionLifecycleRequest,
  { action: "evolve" }
> {
  return {
    action: "evolve",
    relationOverrideGroups: [],
    discardId: null,
    deleteRecorded: true,
    keepUnrecordedHistory: true,
    relationOverride: { kind: "source" },
    successors: ids.map((id) => ({
      decisionId: decisionIdForTest(id),
      alignment: "aligned"
    })),
    ...overrides
  };
}
