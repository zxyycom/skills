import assert from "node:assert/strict";
import test from "node:test";
import { filterDecisionRelationRecords } from "../src/decision-query-relation-filter.ts";
import type { IndexedDecisionRecord } from "../src/decision-query-contract.ts";
import { isDecisionSourcePath } from "../src/decision-path.ts";
import { decisionIdForTest } from "./support.ts";

function source(
  relations: IndexedDecisionRecord["projection"]["relations"]
): IndexedDecisionRecord {
  const sourcePath = "source.md";
  assert.ok(isDecisionSourcePath(sourcePath));
  return {
    decisionId: decisionIdForTest("source"),
    sourcePath,
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

test("Decision type-only relation evidence keeps first summaries tuple deduplication and stable target order", () => {
  for (const count of [3, 10]) {
    const relations = Array.from({ length: count }, (_, index) => ({
      type: "修订" as const,
      target: decisionIdForTest(
        `target-${String(count - index).padStart(4, "0")}`
      ),
      summary: `summary-${index}`
    }));
    const record = source([...relations, relations[0]!]);
    const result = filterDecisionRelationRecords([record], {
      relationType: "修订"
    });
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
