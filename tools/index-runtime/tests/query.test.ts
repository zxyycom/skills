import assert from "node:assert/strict";
import {
  buildStateIndex,
  findStateIndexEntry,
  queryStateIndex
} from "../src/index.ts";
import {
  decisionDefinition,
  decisionStates,
  investigationDefinition,
  investigationStates,
  resultValue,
  testEvidenceDefinition,
  testEvidenceStates,
  type MemoryStateSource,
  type TestEvidenceState
} from "./support.ts";

export async function testQueries(): Promise<void> {
  const decisionSource = {
    revision: "decision-revision-1",
    states: await decisionStates()
  };
  const decisionIndex = resultValue(await buildStateIndex(
    decisionDefinition(decisionSource),
    { root: "." }
  ));

  const text = queryStateIndex({
    index: decisionIndex,
    query: {
      filters: [{
        key: "text",
        kind: "text",
        operator: "all",
        text: "共享 缓存"
      }]
    }
  });
  assert.deepEqual(
    resultValue(text).entries.map((entry) => entry.id),
    ["architecture/use-shared-cache.md"]
  );

  const range = queryStateIndex({
    index: decisionIndex,
    query: {
      filters: [{
        key: "created-at",
        kind: "range",
        operator: "gte",
        value: Date.parse("2026-07-21T00:00:00Z")
      }]
    }
  });
  assert.deepEqual(
    resultValue(range).entries.map((entry) => entry.id),
    ["architecture/shared-id.md"]
  );

  const temporalSource = {
    revision: "temporal-revision-1",
    states: [
      {
        ...decisionSource.states[0]!,
        createdAt: "2026-07-22T10:00:00+08:00",
        path: "time/earlier-offset.md"
      },
      {
        ...decisionSource.states[1]!,
        createdAt: "2026-07-22T03:00:00Z",
        path: "time/later-z.md"
      }
    ]
  };
  const temporalIndex = resultValue(await buildStateIndex(
    decisionDefinition(temporalSource),
    { root: "." }
  ));
  const temporalOrder = queryStateIndex({
    index: temporalIndex,
    query: { sort: [{ direction: "asc", key: "created-at" }] }
  });
  assert.deepEqual(
    resultValue(temporalOrder).entries.map((entry) => entry.id),
    ["time/earlier-offset.md", "time/later-z.md"]
  );

  const exact = queryStateIndex({
    index: decisionIndex,
    query: {
      filters: [{
        key: "alignment",
        kind: "exact",
        operator: "none",
        values: ["aligned"]
      }]
    }
  });
  assert.deepEqual(
    resultValue(exact).entries.map((entry) => entry.id),
    ["architecture/shared-id.md"]
  );
  assert.equal(
    resultValue(findStateIndexEntry(decisionIndex, "architecture/shared-id.md"))?.state.title,
    "共享身份决策"
  );

  const investigationSource = {
    revision: "investigation-revision-1",
    states: await investigationStates()
  };
  const investigationIndex = resultValue(await buildStateIndex(
    investigationDefinition(investigationSource),
    { root: "." }
  ));
  const investigation = queryStateIndex({
    index: investigationIndex,
    query: {
      filters: [{
        key: "text",
        kind: "text",
        operator: "all",
        text: "怎样 快速"
      }]
    }
  });
  assert.deepEqual(
    resultValue(investigation).entries.map((entry) => entry.id),
    ["index-cost/lookup-cost.md"]
  );

  const originalTestStates = await testEvidenceStates();
  const duplicateReference: TestEvidenceState = {
    ...originalTestStates[0]!,
    line: 100,
    title: "Second occurrence of the same case id",
    trigger: null
  };
  const staticStates = originalTestStates.map((state) => ({
    ...state,
    trigger: null
  }));
  const testSource: MemoryStateSource<TestEvidenceState> = {
    revision: "test-revision-1",
    states: [...staticStates, duplicateReference]
  };
  const testDefinition = testEvidenceDefinition(testSource);
  const testIndex = resultValue(await buildStateIndex(testDefinition, { root: "." }));

  const duplicateKey = queryStateIndex({
    index: testIndex,
    query: {
      filters: [{
        key: "case-id",
        kind: "exact",
        operator: "all",
        values: ["state-query"]
      }],
      sort: [{ direction: "asc", key: "line" }]
    }
  });
  assert.deepEqual(
    resultValue(duplicateKey).entries.map((entry) => entry.id),
    ["state-query@42", "state-query@100"]
  );

  const runtimeState: TestEvidenceState = {
    ...staticStates[0]!,
    trigger: originalTestStates[0]!.trigger
  };
  const dynamic = queryStateIndex({
    definition: testDefinition,
    index: testIndex,
    query: {
      filters: [{
        key: "review-triggered",
        kind: "exact",
        operator: "all",
        values: [true]
      }]
    },
    runtimeStates: [runtimeState]
  });
  assert.deepEqual(
    resultValue(dynamic).entries.map((entry) => entry.id),
    ["state-query@42"]
  );
  assert.equal(testIndex.entries.find((entry) => (
    entry.id === "state-query@42"
  ))?.keys["review-triggered"], undefined);

  const paged = queryStateIndex({
    index: testIndex,
    query: {
      limit: 1,
      offset: 1,
      sort: [{ direction: "desc", key: "line" }]
    }
  });
  assert.equal(resultValue(paged).entries.length, 1);
  assert.equal(resultValue(paged).total, 3);

  const wrongMode = queryStateIndex({
    index: decisionIndex,
    query: {
      filters: [{
        key: "status",
        kind: "text",
        operator: "all",
        text: "active"
      }]
    }
  });
  assert.equal(wrongMode.status, "error");
  assert.ok(wrongMode.diagnostics.some((entry) => (
    entry.code === "state-index.query-key-mode-mismatch"
  )));

  const unknownKey = queryStateIndex({
    index: decisionIndex,
    query: {
      filters: [{ key: "missing", kind: "exists", value: true }]
    }
  });
  assert.equal(unknownKey.status, "error");

  const multivaluedSort = queryStateIndex({
    index: decisionIndex,
    query: { sort: [{ direction: "asc", key: "text" }] }
  });
  assert.equal(multivaluedSort.status, "error");
  assert.ok(multivaluedSort.diagnostics.some((entry) => (
    entry.code === "state-index.sort-key-multivalued"
  )));
}
