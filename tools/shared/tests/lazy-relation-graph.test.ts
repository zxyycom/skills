import assert from "node:assert/strict";
import test from "node:test";
import { createLazyRelationGraph } from "../src/graph/lazy-relation-graph.ts";
import {
  buildRelationGraph,
  relationGraphStructuralIssues,
  traceRelationGraph
} from "../src/graph/relations.ts";

test("lazy relation graph does not acquire graph inputs before use", () => {
  let builds = 0;
  const getGraph = createLazyRelationGraph(() => {
    builds += 1;
    return buildRelationGraph(["a", "b"], []);
  });

  assert.equal(typeof getGraph, "function");
  assert.equal(builds, 0);
});

test("lazy relation graph shares one construction across graph operations", () => {
  let builds = 0;
  const getGraph = createLazyRelationGraph(() => {
    builds += 1;
    return buildRelationGraph(
      ["a", "b"],
      [{ source: "a", target: "b", type: "review" }]
    );
  });

  const graph = getGraph();
  assert.deepEqual(relationGraphStructuralIssues(getGraph()), []);
  assert.deepEqual(
    [
      ...traceRelationGraph(getGraph(), "a", {
        direction: "predecessors",
        maxDepth: 1
      }).ids
    ],
    ["a", "b"]
  );
  assert.strictEqual(getGraph(), graph);
  assert.equal(builds, 1);
});

test("lazy relation graph accessors isolate different relation snapshots", () => {
  const previous = createLazyRelationGraph(() =>
    buildRelationGraph(
      ["a", "b", "c"],
      [{ source: "a", target: "b", type: "review" }]
    )
  );
  const next = createLazyRelationGraph(() =>
    buildRelationGraph(
      ["a", "b", "c"],
      [{ source: "a", target: "c", type: "review" }]
    )
  );

  assert.notStrictEqual(previous(), next());
  assert.deepEqual(previous().edgesBySource.get("a"), [
    { source: "a", target: "b", type: "review" }
  ]);
  assert.deepEqual(next().edgesBySource.get("a"), [
    { source: "a", target: "c", type: "review" }
  ]);
});
