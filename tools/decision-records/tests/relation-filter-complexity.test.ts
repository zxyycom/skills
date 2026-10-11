import assert from "node:assert/strict";
import test from "node:test";
import { filterDecisionRelationRecords } from "../src/decision-query-relation-filter.ts";
import type { IndexedDecisionRecord } from "../src/decision-query-contract.ts";
import { decisionIdForTest } from "./support.ts";

function source(
  relations: IndexedDecisionRecord["projection"]["relations"]
): IndexedDecisionRecord {
  return {
    decisionId: decisionIdForTest("source"),
    sourcePath: "source.md" as never,
    alignment: "aligned",
    createdAt: "2026-09-11T00:00:00Z",
    status: "active",
    tags: [],
    projection: {
      title: "source",
      purpose: "purpose",
      background: "background",
      decision: "decision",
      relations
    }
  };
}

test("Decision type-only relation evidence appends linearly and keeps tuple deduplication and code-unit order", () => {
  for (const count of [10, 100, 1000]) {
    const relations = Array.from({ length: count }, (_, index) => ({
      type: "修订" as const,
      target: decisionIdForTest(
        `target-${String(count - index).padStart(4, "0")}`
      ),
      summary: `summary-${index}`
    }));
    const record = source([...relations, relations[0]!]);
    const descriptor = Object.getOwnPropertyDescriptor(
      Array.prototype,
      Symbol.iterator
    )!;
    const iterator = Array.prototype[Symbol.iterator];
    let copiedEvidence = 0;
    Object.defineProperty(Array.prototype, Symbol.iterator, {
      ...descriptor,
      value: function* (this: readonly unknown[]) {
        for (const value of iterator.call(this)) {
          if (
            typeof value === "object" &&
            value !== null &&
            "sourceId" in value &&
            value.sourceId === "source"
          )
            copiedEvidence += 1;
          yield value;
        }
      }
    });
    let result;
    try {
      result = filterDecisionRelationRecords([record], {
        relationType: "修订"
      });
    } finally {
      Object.defineProperty(Array.prototype, Symbol.iterator, descriptor);
    }
    assert.ok(result.status === "ok");
    assert.equal(result.records.length, 1);
    const evidence = result.records[0]!.filterRelations!;
    assert.equal(evidence.length, count);
    assert.deepEqual(
      evidence,
      relations
        .toReversed()
        .map((relation) => ({ sourceId: "source", ...relation }))
    );
    assert.ok(
      copiedEvidence <= count * 4,
      `d=${count}, copied evidence=${copiedEvidence}`
    );
    const repeated = filterDecisionRelationRecords([record], {
      relationType: "修订"
    });
    assert.ok(repeated.status === "ok");
    assert.notEqual(evidence, repeated.records[0]!.filterRelations);
    assert.equal(filterDecisionRelationRecords([record], {}).status, "ok");
    assert.equal("filterRelations" in record, false);
  }
});

test("Decision relation evidence preserves both-direction same-edge filtering and omits unused evidence", () => {
  const anchor = source([
    { type: "修订", target: decisionIdForTest("before"), summary: "earlier" }
  ]);
  const before = { ...source([]), decisionId: decisionIdForTest("before") };
  const after = {
    ...source([
      { type: "修订" as const, target: anchor.decisionId, summary: "later" }
    ]),
    decisionId: decisionIdForTest("after")
  };
  const records = [anchor, before, after];
  const selected = filterDecisionRelationRecords(records, {
    relatedTo: "source",
    direction: "both",
    relationType: "修订"
  });
  assert.ok(selected.status === "ok");
  assert.deepEqual(
    selected.records.map((record) => record.decisionId),
    ["before", "after"]
  );
  assert.deepEqual(
    selected.records.flatMap((record) => record.filterRelations ?? []),
    [
      {
        sourceId: "source",
        type: "修订",
        target: "before",
        summary: "earlier"
      },
      { sourceId: "after", type: "修订", target: "source", summary: "later" }
    ]
  );
  const all = filterDecisionRelationRecords(records, {});
  assert.ok(all.status === "ok");
  assert.equal(
    all.records.some((record) => "filterRelations" in record),
    false
  );
});
