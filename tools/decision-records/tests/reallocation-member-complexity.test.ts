import assert from "node:assert/strict";
import test from "node:test";
import {
  traceDecisionRelations,
  decisionRelationConsistencyIssues
} from "../src/relation-graph.ts";
import { relationStrategyFor } from "../src/decision-relation-transaction-strategy.ts";
import { prepareSuccessors } from "../src/decision-relation-transaction-successors.ts";
import { createDecisionRecordLookup } from "../src/decision-record-lookup.ts";
import { isDecisionId } from "../src/decision-path.ts";
import { memoryReallocationRing } from "./reallocation-fixture.ts";

test("Decision sparse reallocation shares full members once while completing direct traversal", async () => {
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
    const descriptor = Object.getOwnPropertyDescriptor;
    const filter = Array.prototype.filter;
    let descriptors = 0;
    let fullFilters = 0;
    Object.getOwnPropertyDescriptor = (object, key) => {
      if (
        Array.isArray(object) &&
        object.length === 2 * count &&
        /^\d+$/u.test(String(key))
      )
        descriptors += 1;
      return descriptor(object, key);
    };
    Array.prototype.filter = function <T>(
      this: T[],
      callback: (value: T, index: number, array: T[]) => unknown,
      thisArg?: unknown
    ): T[] {
      if (this.length === 2 * count && typeof this[0] === "string")
        fullFilters += this.length;
      return filter.call(this, callback, thisArg) as T[];
    };
    let trace;
    try {
      trace = traceDecisionRelations(records, successorIds[0]!, {
        direction: "both",
        maxDepth: null,
        maxRecords: 2 * count
      });
    } finally {
      Object.getOwnPropertyDescriptor = descriptor;
      Array.prototype.filter = filter;
    }
    assert.equal(trace.traceIds.length, 2 * count);
    assert.deepEqual(trace.contextIds, []);
    assert.deepEqual(trace.coverage, { complete: true, stoppedBy: [] });
    assert.ok(descriptors <= 2 * count, `descriptor=${descriptors}`);
    assert.ok(fullFilters <= 2 * count, `filter inputs=${fullFilters}`);
  }
});
