import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import * as v from "valibot";
import {
  traceDecisionRelations,
  decisionRelationConsistencyIssues
} from "../src/relation-graph.ts";
import { relationStrategyFor } from "../src/decision-relation-transaction-strategy.ts";
import { prepareSuccessors } from "../src/decision-relation-transaction-successors.ts";
import { createDecisionRecordLookup } from "../src/decision-record-lookup.ts";
import { isDecisionId } from "../src/decision-path.ts";
import {
  generatedCliPath,
  runSuccessfulSourceCli,
  withTemporaryWorkspace
} from "./support.ts";
import {
  memoryReallocationRing,
  writeReallocationRing
} from "./reallocation-fixture.ts";

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

test("Decision generated Node trace handles a complete sparse event and default atomic budget blockage", async () => {
  await withTemporaryWorkspace("reallocation-node", async (root) => {
    const { successorIds } = await writeReallocationRing(root, 100);
    await runSuccessfulSourceCli(["sync-index", "--root", root]);
    const traceOutput = v.object({
      source: v.unknown(),
      traceIds: v.array(v.string()),
      contextIds: v.array(v.string()),
      blockedEvent: v.optional(v.object({ requiredMaxRecords: v.number() })),
      coverage: v.object({ complete: v.boolean() })
    });
    const run = (budget: number) =>
      v.parse(
        traceOutput,
        JSON.parse(
          execFileSync(
            "node",
            [
              generatedCliPath,
              "--root",
              root,
              "trace",
              successorIds[0]!,
              "--json",
              "--depth",
              "all",
              "--max-records",
              String(budget)
            ],
            { encoding: "utf8" }
          )
        ) as unknown
      );
    const complete = run(200);
    assert.equal(complete.traceIds.length, 200);
    assert.deepEqual(complete.contextIds, []);
    assert.equal(complete.coverage.complete, true);
    assert.deepEqual(complete.source, {
      kind: "published-index",
      currentness: "unchecked",
      fallback: false
    });
    const blocked = run(50);
    assert.equal(blocked.traceIds.length, 1);
    assert.equal(blocked.blockedEvent?.requiredMaxRecords, 200);
    assert.equal(blocked.coverage.complete, false);
  });
});
