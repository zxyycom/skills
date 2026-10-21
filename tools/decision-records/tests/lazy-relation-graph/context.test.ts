import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { executeDecisionQuery } from "../../src/decision-query-service.ts";
import type { IndexedDecisionRecord } from "../../src/decision-query-contract.ts";
import {
  decisionIndexRecordSnapshot,
  decisionRelationRecordSnapshot,
  indexedRecords
} from "../../src/decision-query-records.ts";
import { filterDecisionRelationRecords } from "../../src/decision-query-relation-filter.ts";
import { loadDecisionIndexSnapshot } from "../../src/decision-index-snapshot.ts";
import {
  decisionRelationConsistencyIssues,
  traceDecisionRelations
} from "../../src/relation-graph.ts";
import {
  archivedDecisionId,
  currentDecisionId,
  readIndex,
  withFixtureWorkspace,
  writeIndex
} from "../support.ts";
import { listRequest, withGraphBuildCount } from "./support.ts";

function recordsIn(
  index: Awaited<ReturnType<typeof readIndex>>
): IndexedDecisionRecord[] {
  return indexedRecords(
    Object.entries(index.entries).map(([id, state]) => ({ id, state }))
  );
}

test("Decision record snapshots build lazily once across validation trace and adjacent relation filters", async () => {
  await withFixtureWorkspace("lazy-graph-context", async (root) => {
    const records = recordsIn(await readIndex(root));
    await withGraphBuildCount(async (count) => {
      const snapshot = decisionRelationRecordSnapshot(records);
      assert.equal(count(), 0);
      const plain = filterDecisionRelationRecords(snapshot, {});
      assert.ok(plain.status === "ok");
      assert.deepEqual(plain.records, records);
      const missing = filterDecisionRelationRecords(snapshot, {
        relatedTo: "missing"
      });
      assert.equal(missing.status, "error");
      const direction = filterDecisionRelationRecords(snapshot, {
        direction: "both"
      });
      assert.equal(direction.status, "error");
      assert.equal(count(), 0);
      assert.deepEqual(
        decisionRelationConsistencyIssues(snapshot.getRelationGraph),
        []
      );
      assert.equal(count(), 1);
      const graph = snapshot.getRelationGraph();
      assert.equal(snapshot.getRelationGraph(), graph);
      const trace = traceDecisionRelations(
        snapshot.getRelationGraph,
        currentDecisionId,
        { direction: "both", maxDepth: null, maxRecords: 50 }
      );
      assert.deepEqual(
        new Set(trace.traceIds),
        new Set([currentDecisionId, archivedDecisionId])
      );
      assert.deepEqual(trace.coverage, { complete: true, stoppedBy: [] });
      const edgesDescriptor = Object.getOwnPropertyDescriptor(graph, "edges");
      assert.ok(edgesDescriptor);
      const relationDescriptors = records.map((record) => {
        const descriptor = Object.getOwnPropertyDescriptor(
          record.projection,
          "relations"
        );
        assert.ok(descriptor);
        return descriptor;
      });
      Object.defineProperty(graph, "edges", {
        configurable: true,
        get() {
          throw new Error(
            "relation filters must use adjacency instead of all graph edges"
          );
        }
      });
      for (const record of records)
        Object.defineProperty(record.projection, "relations", {
          configurable: true,
          get() {
            throw new Error(
              "relation filters must not rescan record relations after graph construction"
            );
          }
        });
      try {
        for (const [relatedTo, direction] of [
          [currentDecisionId, "predecessors"],
          [archivedDecisionId, "successors"]
        ] as const) {
          const selected = filterDecisionRelationRecords(snapshot, {
            relatedTo,
            direction,
            relationType: "修订"
          });
          assert.ok(selected.status === "ok");
          assert.deepEqual(
            selected.records.map(({ decisionId }) => decisionId),
            [
              relatedTo === currentDecisionId
                ? archivedDecisionId
                : currentDecisionId
            ]
          );
          assert.deepEqual(selected.records[0]?.filterRelations, [
            {
              sourceId: currentDecisionId,
              type: "修订",
              target: archivedDecisionId
            }
          ]);
        }
      } finally {
        Object.defineProperty(graph, "edges", edgesDescriptor);
        records.forEach((record, index) =>
          Object.defineProperty(
            record.projection,
            "relations",
            relationDescriptors[index]!
          )
        );
      }
      assert.equal(count(), 1);
    });
  });
});

test("Decision freshly loaded snapshots isolate changed relations while earlier snapshots retain their graph", async () => {
  await withFixtureWorkspace("lazy-graph-isolation", async (root) => {
    const decisionsDirectory = path.join(root, "docs/decisions");
    await withGraphBuildCount(async (count) => {
      const first = await loadDecisionIndexSnapshot({ decisionsDirectory });
      assert.ok(first.status === "ok");
      assert.equal(count(), 1);
      const firstGraph = first.value.getRelationGraph();
      const changed = structuredClone(first.value.index);
      changed.entries[currentDecisionId].relations = [];
      await writeIndex(
        path.join(decisionsDirectory, "decision-index.json"),
        changed
      );
      const second = await loadDecisionIndexSnapshot({ decisionsDirectory });
      assert.ok(second.status === "ok");
      assert.equal(count(), 2);
      assert.notEqual(second.value.getRelationGraph(), firstGraph);
      const previous = filterDecisionRelationRecords(
        decisionIndexRecordSnapshot(first.value),
        { relatedTo: archivedDecisionId }
      );
      const current = filterDecisionRelationRecords(
        decisionIndexRecordSnapshot(second.value),
        { relatedTo: archivedDecisionId }
      );
      assert.ok(previous.status === "ok" && current.status === "ok");
      assert.deepEqual(
        previous.records.map(({ decisionId }) => decisionId),
        [currentDecisionId]
      );
      assert.deepEqual(current.records, []);
      assert.equal(first.value.getRelationGraph(), firstGraph);
      assert.equal(count(), 2);
      const reloaded = await executeDecisionQuery({
        ...listRequest(root),
        relatedTo: archivedDecisionId
      });
      assert.ok(reloaded.status === "ok" && reloaded.command === "list");
      assert.equal(reloaded.total, 0);
      assert.equal(count(), 3);
    });
  });
});
