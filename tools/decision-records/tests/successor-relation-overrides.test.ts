import { createDecisionRecordLookup } from "../src/decision-record-lookup.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { prepareSuccessors } from "../src/decision-relation-transaction-successors.ts";
import { decisionScanFromSources } from "./domain-fixture.ts";
import type {
  DecisionRelation,
  DecisionRelationOverride
} from "../src/types.ts";
import { currentDecisionId } from "./support.ts";

test("successor relation overrides take precedence over transaction defaults", async () => {
  const candidate = "local-relation-override";
  const scan = await decisionScanFromSources([
    { id: currentDecisionId, status: "active" },
    { id: candidate, relations: [{ target: currentDecisionId, type: "修订" }] }
  ]);
  assert.deepEqual(scan.sourceErrors, []);
  const record = scan.records.find((item) => item.decisionId === candidate);
  assert.ok(record);
  const requested = {
    alignment: "aligned" as const,
    decisionId: record.decisionId as typeof currentDecisionId
  };
  const transactionOverride = {
    kind: "replace" as const,
    relations: [{ target: currentDecisionId, type: "替代" as const }]
  };
  const variants: Array<{
    expected: DecisionRelation[];
    relationOverride: DecisionRelationOverride;
  }> = [
    {
      expected: [{ target: currentDecisionId, type: "修订" }],
      relationOverride: { kind: "source" }
    },
    { expected: [], relationOverride: { kind: "replace", relations: [] } },
    {
      expected: [{ target: currentDecisionId, type: "拆分" }],
      relationOverride: {
        kind: "replace",
        relations: [{ target: currentDecisionId, type: "拆分" }]
      }
    }
  ];
  for (const { relationOverride, expected } of variants) {
    const prepared = prepareSuccessors(
      { scan, records: createDecisionRecordLookup(scan.records) },
      [{ ...requested, relationOverride }],
      transactionOverride,
      "2026-09-12T00:00:00Z",
      false
    );
    assert.equal(prepared.status, "ok");
    if (prepared.status === "ok") {
      assert.deepEqual(prepared.records[0]?.finalRelations, expected);
    }
  }
});
