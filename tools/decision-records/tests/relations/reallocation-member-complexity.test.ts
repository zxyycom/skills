import assert from "node:assert/strict";
import test from "node:test";
import {
  traceDecisionRelations,
  decisionRelationConsistencyIssues
} from "../../src/relations/relation-graph.ts";
import { relationStrategyFor } from "../../src/relations/transactions/decision-relation-transaction-strategy.ts";
import { prepareSuccessors } from "../../src/relations/transactions/decision-relation-transaction-successors.ts";
import { createDecisionRecordLookup } from "../../src/records/decision-record-lookup.ts";
import { isDecisionId } from "../../src/collection/decision-path.ts";
import { memoryReallocationRing } from "./reallocation-fixture.ts";

test("Decision sparse reallocation completes direct traversal without adding context members", async () => {
  for (const count of [10, 100, 300]) {
    const { records, scan, successorIds } = await memoryReallocationRing(count);
    assert.deepEqual(decisionRelationConsistencyIssues(records), []);
    assert.ok(successorIds.every(isDecisionId));
    const successors = prepareSuccessors(
      { scan, records: createDecisionRecordLookup(scan.records) },
      successorIds.map((decisionId) => ({
        decisionId,
        alignment: "aligned"
      })),
      { kind: "source" },
      "2026-10-11T00:00:00Z",
      false
    );
    assert.equal(successors.status, "ok");
    if (successors.status === "ok") {
      const strategy = relationStrategyFor(successors.records);
      assert.deepEqual(strategy.shapeErrors(successors.records), []);
      assert.deepEqual(strategy.closureErrors(successors.records, records), []);
    }
    const trace = traceDecisionRelations(records, successorIds[0]!, {
      direction: "both",
      maxDepth: null,
      maxRecords: 2 * count
    });
    assert.deepEqual(
      new Set(trace.traceIds),
      new Set(records.map(({ decisionId }) => decisionId))
    );
    assert.equal(trace.traceIds.length, 2 * count);
    assert.deepEqual(trace.contextIds, []);
    assert.deepEqual(trace.coverage, { complete: true, stoppedBy: [] });
  }
});
