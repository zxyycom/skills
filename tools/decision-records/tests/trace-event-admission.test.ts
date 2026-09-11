import assert from "node:assert/strict";
import test from "node:test";
import {
  traceDecisionRelations,
  type DecisionRelationConsistencyRecord
} from "../src/relation-graph.ts";
import type { DecisionId, DecisionRelationType } from "../src/types.ts";

function decisionId(value: string): DecisionId {
  return value as DecisionId;
}

function record(
  id: string,
  relations: readonly { target: string; type: DecisionRelationType }[] = []
): DecisionRelationConsistencyRecord {
  return {
    decisionId: decisionId(id),
    projection: {
      background: "trace test",
      decision: "trace test",
      purpose: "trace test",
      relations: relations.map(({ target, type }) => ({
        target: decisionId(target),
        type
      })),
      title: id
    },
    sourcePath: `${id}.md`,
    status: "archived"
  };
}

test("Decision trace closes split events and rejects partial split admission", () => {
  const records = [
    record("original"),
    record("split-a", [{ target: "original", type: "拆分" }]),
    record("split-b", [{ target: "original", type: "拆分" }])
  ];
  const complete = traceDecisionRelations(records, decisionId("split-a"), {
    direction: "predecessors",
    maxDepth: null,
    maxRecords: 3
  });
  assert.deepEqual(complete.traceIds, [
    decisionId("original"),
    decisionId("split-a")
  ]);
  assert.deepEqual(complete.contextIds, [decisionId("split-b")]);
  assert.equal(complete.blockedEvent, undefined);

  const blocked = traceDecisionRelations(records, decisionId("split-a"), {
    direction: "predecessors",
    maxDepth: null,
    maxRecords: 2
  });
  assert.deepEqual(blocked.traceIds, [decisionId("split-a")]);
  assert.deepEqual(blocked.contextIds, []);
  assert.deepEqual(blocked.blockedEvent, {
    kind: "split",
    recordIds: [
      decisionId("original"),
      decisionId("split-a"),
      decisionId("split-b")
    ],
    requiredMaxRecords: 3
  });
});

test("Decision trace closes pure merge events and rejects partial merge admission", () => {
  const records = [
    record("first"),
    record("second"),
    record("merged", [
      { target: "first", type: "归并" },
      { target: "second", type: "归并" }
    ])
  ];
  const complete = traceDecisionRelations(records, decisionId("first"), {
    direction: "successors",
    maxDepth: null,
    maxRecords: 3
  });
  assert.deepEqual(complete.traceIds, [
    decisionId("first"),
    decisionId("merged")
  ]);
  assert.deepEqual(complete.contextIds, [decisionId("second")]);
  assert.equal(complete.blockedEvent, undefined);

  const blocked = traceDecisionRelations(records, decisionId("first"), {
    direction: "successors",
    maxDepth: null,
    maxRecords: 2
  });
  assert.deepEqual(blocked.traceIds, [decisionId("first")]);
  assert.deepEqual(blocked.contextIds, []);
  assert.deepEqual(blocked.blockedEvent, {
    kind: "merge",
    recordIds: [
      decisionId("first"),
      decisionId("merged"),
      decisionId("second")
    ],
    requiredMaxRecords: 3
  });
});

test("Decision trace closes sparse reallocation events and rejects partial admission", () => {
  const records = [
    record("predecessor-a"),
    record("predecessor-b"),
    record("successor-a", [
      { target: "predecessor-a", type: "重划" },
      { target: "predecessor-b", type: "重划" }
    ]),
    record("successor-b", [{ target: "predecessor-a", type: "重划" }])
  ];
  const complete = traceDecisionRelations(records, decisionId("successor-a"), {
    direction: "predecessors",
    maxDepth: null,
    maxRecords: 4
  });
  assert.deepEqual(complete.traceIds, [
    decisionId("predecessor-a"),
    decisionId("predecessor-b"),
    decisionId("successor-a")
  ]);
  assert.deepEqual(complete.contextIds, [decisionId("successor-b")]);
  assert.equal(complete.blockedEvent, undefined);

  const blocked = traceDecisionRelations(records, decisionId("successor-a"), {
    direction: "predecessors",
    maxDepth: null,
    maxRecords: 3
  });
  assert.deepEqual(blocked.traceIds, [decisionId("successor-a")]);
  assert.deepEqual(blocked.contextIds, []);
  assert.deepEqual(blocked.blockedEvent, {
    kind: "reallocation",
    recordIds: [
      decisionId("predecessor-a"),
      decisionId("predecessor-b"),
      decisionId("successor-a"),
      decisionId("successor-b")
    ],
    requiredMaxRecords: 4
  });
});
