import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import {
  buildRelationGraph,
  relationGraphStructuralIssues,
  sortRelationEdges,
  traceRelationGraph
} from "../src/graph/relations.ts";

import "./relation-trace-selection.test.ts";
import "./trace-admission-snapshot.test.ts";
import "./lazy-relation-graph.test.ts";

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

test("relation graph preserves optional summaries without using them as identity", () => {
  const graph = buildRelationGraph(
    ["a", "b"],
    [
      { source: "a", summary: "first explanation", target: "b", type: "x" },
      { source: "a", summary: "second explanation", target: "b", type: "y" }
    ]
  );

  assert.deepEqual(graph.edges, [
    { source: "a", summary: "first explanation", target: "b", type: "x" },
    { source: "a", summary: "second explanation", target: "b", type: "y" }
  ]);
  assert.deepEqual(relationGraphStructuralIssues(graph), [
    {
      edge: {
        source: "a",
        summary: "second explanation",
        target: "b",
        type: "y"
      },
      kind: "duplicate-edge",
      repeatedEdge: {
        source: "a",
        summary: "first explanation",
        target: "b",
        type: "x"
      }
    }
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

test("relation structural validation accepts a deep acyclic chain in the actual Node runtime", () => {
  const moduleUrl = new URL("../src/graph/relations.ts", import.meta.url).href;
  const output = execFileSync(
    "node",
    [
      "--input-type=module",
      "-e",
      `
    import { buildRelationGraph, relationGraphStructuralIssues } from ${JSON.stringify(moduleUrl)};
    const ids = Array.from({length: 12000}, (_, i) => String(i).padStart(5, "0"));
    const graph = buildRelationGraph(ids, ids.slice(1).map((target, i) => ({source:ids[i], target, type:"review"})));
    console.log(JSON.stringify(relationGraphStructuralIssues(graph)));
  `
    ],
    { encoding: "utf8" }
  );
  assert.deepEqual(JSON.parse(output), []);
});

test("relation structural validation reports the exact late cycle after a deep chain", () => {
  const ids = Array.from({ length: 12000 }, (_, i) =>
    String(i).padStart(5, "0")
  );
  const graph = buildRelationGraph(ids, [
    ...ids
      .slice(1)
      .map((target, i) => ({ source: ids[i]!, target, type: "review" })),
    { source: ids[11999]!, target: ids[11996]!, type: "review" }
  ]);
  assert.deepEqual(relationGraphStructuralIssues(graph), [
    { kind: "cycle", cycle: ["11996", "11997", "11998", "11999", "11996"] }
  ]);
});

test("relation structural DFS retains branch diamond disconnected and defect ordering without duplicate cycles", () => {
  const edges = [
    { source: "a", target: "c", type: "x" },
    { source: "b", target: "d", type: "x" },
    { source: "a", target: "b", type: "x" },
    { source: "b", target: "c", type: "x" },
    { source: "c", target: "d", type: "x" },
    { source: "c", target: "a", type: "x" },
    { source: "d", target: "b", type: "x" },
    { source: "a", target: "b", type: "y" },
    { source: "d", target: "d", type: "x" },
    { source: "a", target: "missing", type: "x" },
    { source: "y", target: "x", type: "x" },
    { source: "x", target: "y", type: "x" }
  ];
  const graph = buildRelationGraph(
    ["y", "d", "c", "x", "b", "a", "isolated"],
    edges
  );
  assert.deepEqual(relationGraphStructuralIssues(graph), [
    { kind: "missing-target", edge: edges[9] },
    { kind: "self-edge", edge: edges[8] },
    { kind: "duplicate-edge", edge: edges[7], repeatedEdge: edges[2] },
    { kind: "cycle", cycle: ["a", "b", "c", "a"] },
    { kind: "cycle", cycle: ["b", "c", "d", "b"] },
    { kind: "cycle", cycle: ["x", "y", "x"] }
  ]);
});

import "./trace-member-facts.test.ts";
