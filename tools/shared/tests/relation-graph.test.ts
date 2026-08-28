import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRelationGraph,
  relationGraphStructuralIssues,
  traceRelationGraph
} from "../src/graph/relations.ts";

test("relation graph builds deterministic indexes and traces bounded subgraphs", () => {
  const graph = buildRelationGraph(
    ["a", "b", "c", "d"],
    [
      { source: "c", target: "b", type: "review" },
      { source: "a", target: "b", type: "revision" },
      { source: "d", target: "a", type: "split" },
      { source: "a", target: "c", type: "merge" }
    ]
  );

  assert.deepEqual(graph.edges, [
    { source: "a", target: "c", type: "merge" },
    { source: "a", target: "b", type: "revision" },
    { source: "c", target: "b", type: "review" },
    { source: "d", target: "a", type: "split" }
  ]);
  assert.deepEqual(graph.edgesBySource.get("a"), [
    { source: "a", target: "c", type: "merge" },
    { source: "a", target: "b", type: "revision" }
  ]);
  assert.deepEqual(graph.edgesByTarget.get("b"), [
    { source: "a", target: "b", type: "revision" },
    { source: "c", target: "b", type: "review" }
  ]);

  const trace = traceRelationGraph(graph, "a", {
    direction: "both",
    maxDepth: 1
  });
  assert.deepEqual([...trace.ids], ["a", "c", "b", "d"]);
  assert.deepEqual(trace.edges, graph.edges);
  assert.deepEqual(
    [
      ...traceRelationGraph(graph, "a", {
        direction: "both",
        maxDepth: 0
      }).ids
    ],
    ["a"]
  );

  const codeUnitOrderedGraph = buildRelationGraph(
    ["a-a", "a-A", "t-a", "t-A"],
    [
      { source: "a-a", target: "t-a", type: "type-a" },
      { source: "a-A", target: "t-a", type: "type-a" },
      { source: "a-A", target: "t-A", type: "type-a" },
      { source: "a-A", target: "t-a", type: "type-A" }
    ]
  );
  assert.deepEqual(codeUnitOrderedGraph.edges, [
    { source: "a-A", target: "t-a", type: "type-A" },
    { source: "a-A", target: "t-A", type: "type-a" },
    { source: "a-A", target: "t-a", type: "type-a" },
    { source: "a-a", target: "t-a", type: "type-a" }
  ]);

  const codeUnitOrderedCycle = buildRelationGraph(
    ["a-a", "a-A"],
    [
      { source: "a-a", target: "a-A", type: "rel" },
      { source: "a-A", target: "a-a", type: "rel" }
    ]
  );
  assert.deepEqual(relationGraphStructuralIssues(codeUnitOrderedCycle), [
    { cycle: ["a-A", "a-a", "a-A"], kind: "cycle" }
  ]);
});

test("relation graph returns structured missing self duplicate and cycle issues", () => {
  const graph = buildRelationGraph(
    ["a", "b", "c", "x"],
    [
      { source: "a", target: "b", type: "rel" },
      { source: "b", target: "c", type: "rel" },
      { source: "c", target: "a", type: "rel" },
      { source: "x", target: "missing", type: "rel" },
      { source: "x", target: "x", type: "self" },
      { source: "x", target: "a", type: "a" },
      { source: "x", target: "a", type: "b" }
    ]
  );

  assert.deepEqual(relationGraphStructuralIssues(graph), [
    {
      edge: { source: "x", target: "missing", type: "rel" },
      kind: "missing-target"
    },
    {
      edge: { source: "x", target: "x", type: "self" },
      kind: "self-edge"
    },
    {
      edge: { source: "x", target: "a", type: "b" },
      kind: "duplicate-edge",
      repeatedEdge: { source: "x", target: "a", type: "a" }
    },
    {
      cycle: ["a", "b", "c", "a"],
      kind: "cycle"
    }
  ]);

  const trace = traceRelationGraph(graph, "x", {
    direction: "predecessors",
    maxDepth: 1
  });
  assert.equal(trace.ids.has("missing"), false);
  assert.equal(
    trace.edges.some((edge) => edge.target === "missing"),
    false
  );
});
