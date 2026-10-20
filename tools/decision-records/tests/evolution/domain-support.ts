import assert from "node:assert/strict";
import { prepareDecisionRelationTransaction } from "../../src/decision-relation-transaction.ts";
import { decisionIdForTest } from "../support.ts";
import {
  decisionScanFromSources,
  type DecisionSourceFixture
} from "../domain-fixture.ts";

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
