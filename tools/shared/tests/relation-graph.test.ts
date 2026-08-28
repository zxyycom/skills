import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRelationGraph,
  relationGraphStructuralIssues,
  sortRelationEdges,
  traceRelationGraph
} from "../src/graph/relations.ts";

test("relation graph builds source and target indexes in supplied edge order", () => {
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
    { source: "c", target: "b", type: "review" },
    { source: "a", target: "b", type: "revision" },
    { source: "d", target: "a", type: "split" },
    { source: "a", target: "c", type: "merge" }
  ]);
  assert.deepEqual(graph.edgesBySource.get("a"), [
    { source: "a", target: "b", type: "revision" },
    { source: "a", target: "c", type: "merge" }
  ]);
  assert.deepEqual(graph.edgesByTarget.get("b"), [
    { source: "c", target: "b", type: "review" },
    { source: "a", target: "b", type: "revision" }
  ]);
});

test("relation graph traces bounded bidirectional subgraphs", () => {
  const graph = buildRelationGraph(
    ["a", "b", "c", "d"],
    [
      { source: "c", target: "b", type: "review" },
      { source: "a", target: "b", type: "revision" },
      { source: "d", target: "a", type: "split" },
      { source: "a", target: "c", type: "merge" }
    ]
  );
  const trace = traceRelationGraph(graph, "a", {
    direction: "both",
    maxDepth: 1
  });
  assert.deepEqual([...trace.ids], ["a", "b", "c", "d"]);
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
});

test("relation edge sorting uses UTF-16 code units without mutating inputs", () => {
  const edges = [
    { source: "a-a", target: "t-a", type: "type-a" },
    { source: "a-A", target: "t-a", type: "type-a" },
    { source: "a-A", target: "t-A", type: "type-a" },
    { source: "a-A", target: "t-a", type: "type-A" }
  ];
  const sortedEdges = sortRelationEdges(edges);

  assert.deepEqual(sortedEdges, [
    { source: "a-A", target: "t-a", type: "type-A" },
    { source: "a-A", target: "t-A", type: "type-a" },
    { source: "a-A", target: "t-a", type: "type-a" },
    { source: "a-a", target: "t-a", type: "type-a" }
  ]);
  assert.deepEqual(edges, [
    { source: "a-a", target: "t-a", type: "type-a" },
    { source: "a-A", target: "t-a", type: "type-a" },
    { source: "a-A", target: "t-A", type: "type-a" },
    { source: "a-A", target: "t-a", type: "type-A" }
  ]);
});

test("relation graph reports a missing target", () => {
  const graph = buildRelationGraph(
    ["x"],
    [{ source: "x", target: "missing", type: "rel" }]
  );
  assert.deepEqual(relationGraphStructuralIssues(graph), [
    {
      edge: { source: "x", target: "missing", type: "rel" },
      kind: "missing-target"
    }
  ]);
});

test("relation graph reports a self edge", () => {
  const graph = buildRelationGraph(
    ["x"],
    [{ source: "x", target: "x", type: "self" }]
  );
  assert.deepEqual(relationGraphStructuralIssues(graph), [
    {
      edge: { source: "x", target: "x", type: "self" },
      kind: "self-edge"
    }
  ]);
});

test("relation graph reports repeated source-target edges", () => {
  const graph = buildRelationGraph(
    ["a", "x"],
    [
      { source: "x", target: "a", type: "a" },
      { source: "x", target: "a", type: "b" }
    ]
  );
  assert.deepEqual(relationGraphStructuralIssues(graph), [
    {
      edge: { source: "x", target: "a", type: "b" },
      kind: "duplicate-edge",
      repeatedEdge: { source: "x", target: "a", type: "a" }
    }
  ]);
});

test("relation graph reports a deterministic cycle", () => {
  const graph = buildRelationGraph(
    ["a-a", "a-A"],
    [
      { source: "a-a", target: "a-A", type: "rel" },
      { source: "a-A", target: "a-a", type: "rel" }
    ]
  );
  assert.deepEqual(relationGraphStructuralIssues(graph), [
    { cycle: ["a-A", "a-a", "a-A"], kind: "cycle" }
  ]);
});

test("relation graph traces do not include missing targets", () => {
  const graph = buildRelationGraph(
    ["x"],
    [{ source: "x", target: "missing", type: "rel" }]
  );
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
