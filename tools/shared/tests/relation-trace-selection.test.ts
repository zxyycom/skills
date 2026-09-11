import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRelationGraph,
  selectRelationGraphTrace
} from "../src/graph/relations.ts";

test("trace selection stops breadth-first in UTF-16 order and exposes ordinary budget frontiers", () => {
  const graph = buildRelationGraph(
    ["anchor", "a-A", "a-a", "b", "c"],
    [
      { source: "anchor", target: "a-a", type: "rel" },
      { source: "anchor", target: "a-A", type: "rel" },
      { source: "a-A", target: "b", type: "rel" },
      { source: "a-a", target: "c", type: "rel" }
    ]
  );

  const trace = selectRelationGraphTrace(
    graph,
    "anchor",
    { direction: "predecessors", maxDepth: null, maxRecords: 3 },
    ({ direction, fromId, graph: currentGraph }) =>
      (direction === "predecessors"
        ? (currentGraph.edgesBySource.get(fromId) ?? [])
        : (currentGraph.edgesByTarget.get(fromId) ?? [])
      ).map((edge) => {
        const nextId = direction === "predecessors" ? edge.target : edge.source;
        return {
          kind: "ordinary" as const,
          recordIds: [nextId],
          traceIds: [nextId]
        };
      })
  );

  assert.deepEqual(trace.traceIds, ["a-A", "a-a", "anchor"]);
  assert.deepEqual(trace.contextIds, []);
  assert.deepEqual(trace.coverage, {
    complete: false,
    stoppedBy: ["max-records"]
  });
  assert.equal(trace.blockedEvent, undefined);
  assert.deepEqual(trace.frontier, [
    {
      direction: "predecessors",
      fromId: "a-A",
      nextIds: ["b"],
      reason: "max-records"
    },
    {
      direction: "predecessors",
      fromId: "a-a",
      nextIds: ["c"],
      reason: "max-records"
    }
  ]);
});

test("trace selection sorts each both-direction depth layer before applying a record budget", () => {
  const graph = buildRelationGraph(
    ["a", "a-child", "anchor", "z", "z-child"],
    [
      { source: "anchor", target: "z", type: "rel" },
      { source: "a", target: "anchor", type: "rel" },
      { source: "a", target: "a-child", type: "rel" },
      { source: "z", target: "z-child", type: "rel" }
    ]
  );

  const trace = selectRelationGraphTrace(
    graph,
    "anchor",
    { direction: "both", maxDepth: null, maxRecords: 4 },
    ({ direction, fromId, graph: currentGraph }) =>
      (direction === "predecessors"
        ? (currentGraph.edgesBySource.get(fromId) ?? [])
        : (currentGraph.edgesByTarget.get(fromId) ?? [])
      ).map((edge) => {
        const nextId = direction === "predecessors" ? edge.target : edge.source;
        return {
          kind: "ordinary" as const,
          recordIds: [nextId],
          traceIds: [nextId]
        };
      })
  );

  assert.deepEqual(trace.traceIds, ["a", "a-child", "anchor", "z"]);
  assert.equal(trace.blockedEvent, undefined);
  assert.deepEqual(trace.coverage, {
    complete: false,
    stoppedBy: ["max-records"]
  });
  assert.deepEqual(trace.frontier, [
    {
      direction: "successors",
      fromId: "a-child",
      nextIds: ["a"],
      reason: "max-records"
    },
    {
      direction: "predecessors",
      fromId: "z",
      nextIds: ["z-child"],
      reason: "max-records"
    },
    {
      direction: "successors",
      fromId: "z",
      nextIds: ["anchor"],
      reason: "max-records"
    }
  ]);
});

test("trace selection closes events and promotes context that becomes directly reachable", () => {
  const graph = buildRelationGraph(
    ["direction-a", "direction-b", "original"],
    [
      { source: "direction-a", target: "original", type: "split" },
      { source: "direction-b", target: "original", type: "split" }
    ]
  );

  const trace = selectRelationGraphTrace(
    graph,
    "direction-a",
    { direction: "both", maxDepth: null, maxRecords: 3 },
    ({ direction, fromId }) => {
      if (fromId === "direction-a" && direction === "predecessors") {
        return [
          {
            kind: "split" as const,
            recordIds: ["direction-a", "direction-b", "original"],
            traceIds: ["original"]
          }
        ];
      }
      if (fromId === "original" && direction === "successors") {
        return [
          {
            kind: "split" as const,
            recordIds: ["direction-a", "direction-b", "original"],
            traceIds: ["direction-a", "direction-b"]
          }
        ];
      }
      return [];
    }
  );

  assert.deepEqual(trace.traceIds, ["direction-a", "direction-b", "original"]);
  assert.deepEqual(trace.contextIds, []);
  assert.deepEqual(trace.coverage, { complete: true, stoppedBy: [] });
  assert.deepEqual(trace.frontier, []);
});

test("trace selection preserves a depth frontier when a later direction hits the record budget", () => {
  const graph = buildRelationGraph(
    ["anchor", "predecessor", "depth-next", "successor"],
    [
      { source: "anchor", target: "predecessor", type: "rel" },
      { source: "predecessor", target: "depth-next", type: "rel" },
      { source: "successor", target: "anchor", type: "rel" }
    ]
  );

  const trace = selectRelationGraphTrace(
    graph,
    "anchor",
    { direction: "both", maxDepth: 1, maxRecords: 2 },
    ({ direction, fromId, graph: currentGraph }) =>
      (direction === "predecessors"
        ? (currentGraph.edgesBySource.get(fromId) ?? [])
        : (currentGraph.edgesByTarget.get(fromId) ?? [])
      ).map((edge) => {
        const nextId = direction === "predecessors" ? edge.target : edge.source;
        return {
          kind: "ordinary" as const,
          recordIds: [nextId],
          traceIds: [nextId]
        };
      })
  );

  assert.deepEqual(trace.traceIds, ["anchor", "predecessor"]);
  assert.deepEqual(trace.coverage, {
    complete: false,
    stoppedBy: ["depth", "max-records"]
  });
  assert.deepEqual(trace.frontier, [
    {
      direction: "successors",
      fromId: "anchor",
      nextIds: ["successor"],
      reason: "max-records"
    },
    {
      direction: "predecessors",
      fromId: "predecessor",
      nextIds: ["depth-next"],
      reason: "depth"
    },
    {
      direction: "successors",
      fromId: "predecessor",
      nextIds: ["anchor"],
      reason: "depth"
    }
  ]);
});

test("trace selection returns the anchor at depth zero and reports blocked atomic events", () => {
  const graph = buildRelationGraph(
    ["anchor", "sibling", "original"],
    [
      { source: "anchor", target: "original", type: "split" },
      { source: "sibling", target: "original", type: "split" }
    ]
  );

  const depthZero = selectRelationGraphTrace(
    graph,
    "anchor",
    { direction: "predecessors", maxDepth: 0, maxRecords: 3 },
    () => []
  );
  assert.deepEqual(depthZero.traceIds, ["anchor"]);
  assert.deepEqual(depthZero.frontier, [
    {
      direction: "predecessors",
      fromId: "anchor",
      nextIds: ["original"],
      reason: "depth"
    }
  ]);

  const blocked = selectRelationGraphTrace(
    graph,
    "anchor",
    { direction: "predecessors", maxDepth: null, maxRecords: 2 },
    ({ fromId }) =>
      fromId === "anchor"
        ? [
            {
              kind: "split" as const,
              recordIds: ["anchor", "sibling", "original"],
              traceIds: ["original"]
            }
          ]
        : []
  );
  assert.deepEqual(blocked.traceIds, ["anchor"]);
  assert.deepEqual(blocked.contextIds, []);
  assert.deepEqual(blocked.blockedEvent, {
    kind: "split",
    recordIds: ["anchor", "original", "sibling"],
    requiredMaxRecords: 3
  });
  assert.deepEqual(blocked.frontier, [
    {
      direction: "predecessors",
      fromId: "anchor",
      nextIds: ["original"],
      reason: "max-records"
    }
  ]);
});
