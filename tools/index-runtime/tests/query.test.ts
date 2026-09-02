import assert from "node:assert/strict";
import test from "node:test";
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

async function buildDecisionFixture() {
  const source = {
    revision: "decision-revision-1",
    states: await decisionStates()
  };
  return {
    index: resultValue(
      await buildStateIndex(decisionDefinition(source), { root: "." })
    ),
    source
  };
}

async function buildTestEvidenceFixture() {
  const originalStates = await testEvidenceStates();
  const staticStates = originalStates.map((state) => ({
    ...state,
    trigger: null
  }));
  const source: MemoryStateSource<TestEvidenceState> = {
    revision: "test-revision-1",
    states: staticStates
  };
  const definition = testEvidenceDefinition(source);
  return {
    definition,
    index: resultValue(await buildStateIndex(definition, { root: "." })),
    originalStates,
    staticStates
  };
}

test("filters decision states and finds entries by stable identity", async () => {
  const { index } = await buildDecisionFixture();
  const text = queryStateIndex({
    index,
    query: {
      filters: [
        {
          key: "text",
          kind: "text",
          operator: "all",
          text: "共享 缓存"
        }
      ]
    }
  });
  assert.deepEqual(
    resultValue(text).entries.map((entry) => entry.id),
    ["architecture/use-shared-cache.md"]
  );

  const range = queryStateIndex({
    index,
    query: {
      filters: [
        {
          key: "created-at",
          kind: "range",
          operator: "gte",
          value: Date.parse("2026-07-21T00:00:00Z")
        }
      ]
    }
  });
  assert.deepEqual(
    resultValue(range).entries.map((entry) => entry.id),
    ["architecture/shared-id.md"]
  );

  const exact = queryStateIndex({
    index,
    query: {
      filters: [
        {
          key: "alignment",
          kind: "exact",
          operator: "none",
          values: ["aligned"]
        }
      ]
    }
  });
  assert.deepEqual(
    resultValue(exact).entries.map((entry) => entry.id),
    ["architecture/shared-id.md"]
  );
  assert.equal(
    resultValue(findStateIndexEntry(index, "architecture/shared-id.md"))?.state
      .title,
    "共享身份决策"
  );
});

test("sorts temporal keys by instants across timezone offsets", async () => {
  const { source } = await buildDecisionFixture();
  const temporalSource = {
    revision: "temporal-revision-1",
    states: [
      {
        ...source.states[0]!,
        createdAt: "2026-07-22T10:00:00+08:00",
        path: "time/earlier-offset.md"
      },
      {
        ...source.states[1]!,
        createdAt: "2026-07-22T03:00:00Z",
        path: "time/later-z.md"
      }
    ]
  };
  const index = resultValue(
    await buildStateIndex(decisionDefinition(temporalSource), { root: "." })
  );
  const result = queryStateIndex({
    index,
    query: { sort: [{ direction: "asc", key: "created-at" }] }
  });
  assert.deepEqual(
    resultValue(result).entries.map((entry) => entry.id),
    ["time/earlier-offset.md", "time/later-z.md"]
  );
});

test("searches text keys across investigation and test-evidence states", async () => {
  const investigationSource = {
    revision: "investigation-revision-1",
    states: await investigationStates()
  };
  const investigationIndex = resultValue(
    await buildStateIndex(investigationDefinition(investigationSource), {
      root: "."
    })
  );
  const investigation = queryStateIndex({
    index: investigationIndex,
    query: {
      filters: [
        {
          key: "text",
          kind: "text",
          operator: "all",
          text: "怎样 快速"
        }
      ]
    }
  });
  assert.deepEqual(
    resultValue(investigation).entries.map((entry) => entry.id),
    ["index-cost/lookup-cost.md"]
  );

  const { index } = await buildTestEvidenceFixture();
  assert.deepEqual(Object.keys(index.entries), ["read-error", "state-query"]);
  const searched = queryStateIndex({
    index,
    query: {
      filters: [
        {
          key: "search",
          kind: "text",
          operator: "all",
          text: "state query"
        }
      ]
    }
  });
  assert.deepEqual(
    resultValue(searched).entries.map((entry) => entry.id),
    ["state-query"]
  );
});

test("requires the domain source to reject duplicate identities", async () => {
  const { staticStates } = await buildTestEvidenceFixture();
  const result = await buildStateIndex(
    testEvidenceDefinition({
      revision: "test-revision-duplicate",
      states: [
        ...staticStates,
        { ...staticStates[0]!, title: "Duplicate stable case identity" }
      ]
    }),
    { root: "." }
  );
  assert.equal(result.status, "error");
  assert.ok(
    result.diagnostics.some(
      (entry) =>
        entry.code === "state-index.source-read-failed" &&
        entry.message ===
          "failed to read the state-index source; inspect source availability and access, then retry" &&
        entry.filesystem === undefined
    )
  );
});

test("merges runtime states without mutating persisted index entries", async () => {
  const { definition, index, originalStates, staticStates } =
    await buildTestEvidenceFixture();
  const runtimeState: TestEvidenceState = {
    ...staticStates[0]!,
    trigger: originalStates[0]!.trigger
  };
  const result = queryStateIndex({
    definition,
    index,
    query: {
      filters: [
        {
          key: "review-triggered",
          kind: "exact",
          operator: "all",
          values: [true]
        }
      ]
    },
    runtimeStates: { [runtimeState.caseId]: runtimeState }
  });
  assert.deepEqual(
    resultValue(result).entries.map((entry) => entry.id),
    ["state-query"]
  );
  assert.equal(
    index.entries["state-query"]?.keys["review-triggered"],
    undefined
  );

  const invalidOverlay = queryStateIndex({
    definition,
    index,
    runtimeStates: [runtimeState] as never
  });
  assert.equal(invalidOverlay.status, "error");
  assert.equal(
    invalidOverlay.diagnostics[0]?.code,
    "state-index.runtime-states-invalid"
  );
});

test("paginates sorted results while preserving the total count", async () => {
  const { index } = await buildTestEvidenceFixture();
  const result = queryStateIndex({
    index,
    query: {
      limit: 1,
      offset: 1,
      sort: [{ direction: "desc", key: "id" }]
    }
  });
  assert.equal(resultValue(result).entries.length, 1);
  assert.equal(resultValue(result).total, 2);
});

test("rejects unknown, mode-mismatched, and multivalued sort keys", async () => {
  const { index } = await buildDecisionFixture();
  const wrongMode = queryStateIndex({
    index,
    query: {
      filters: [
        {
          key: "status",
          kind: "text",
          operator: "all",
          text: "active"
        }
      ]
    }
  });
  assert.equal(wrongMode.status, "error");
  assert.ok(
    wrongMode.diagnostics.some(
      (entry) => entry.code === "state-index.query-key-mode-mismatch"
    )
  );

  const unknownKey = queryStateIndex({
    index,
    query: {
      filters: [{ key: "missing", kind: "exists", value: true }]
    }
  });
  assert.equal(unknownKey.status, "error");

  const multivaluedSort = queryStateIndex({
    index,
    query: { sort: [{ direction: "asc", key: "text" }] }
  });
  assert.equal(multivaluedSort.status, "error");
  assert.ok(
    multivaluedSort.diagnostics.some(
      (entry) => entry.code === "state-index.sort-key-multivalued"
    )
  );
});
