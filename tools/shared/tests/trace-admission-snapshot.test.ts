import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRelationGraph,
  selectRelationGraphTrace
} from "../src/graph/relations.ts";
import type { RelationGraphTraceEventKind } from "../src/graph/trace-contract.ts";

test("trace selection snapshots frozen unit getters on each expansion", () => {
  const graph = buildRelationGraph<string, string>(["anchor", "a", "b"], []);
  let targets = Object.freeze(["a"]);
  const unit = Object.freeze({
    kind: "merge" as const,
    recordIds: Object.freeze(["anchor", "a", "b"]),
    get traceIds() {
      return targets;
    }
  });
  const trace = selectRelationGraphTrace(
    graph,
    "anchor",
    { direction: "predecessors", maxDepth: null, maxRecords: 3 },
    ({ fromId }) => {
      if (fromId === "anchor") return [unit];
      if (fromId === "a") {
        targets = Object.freeze(["b"]);
        return [unit];
      }
      return [];
    }
  );
  assert.deepEqual(trace, {
    contextIds: [],
    coverage: { complete: true, stoppedBy: [] },
    frontier: [],
    traceIds: ["a", "anchor", "b"]
  });
});

test("trace selection preserves frozen inherited kind and member snapshots", () => {
  const graph = buildRelationGraph<string, string>(["anchor", "a", "b"], []);
  let kind: RelationGraphTraceEventKind = "ordinary";
  let records = Object.freeze(["anchor", "a"]);
  let targets = Object.freeze(["a"]);
  class AdapterUnit {
    get kind() {
      return kind;
    }
    get recordIds() {
      return records;
    }
    get traceIds() {
      return targets;
    }
  }
  const unit = Object.freeze(new AdapterUnit());
  const trace = selectRelationGraphTrace(
    graph,
    "anchor",
    { direction: "predecessors", maxDepth: null, maxRecords: 2 },
    ({ fromId }) => {
      if (fromId === "anchor") return [unit];
      if (fromId === "a") {
        kind = "split";
        records = Object.freeze(["anchor", "a", "b"]);
        targets = Object.freeze(["b"]);
        return [unit];
      }
      return [];
    }
  );
  assert.deepEqual(trace, {
    blockedEvent: {
      kind: "split",
      recordIds: ["a", "anchor", "b"],
      requiredMaxRecords: 3
    },
    contextIds: [],
    coverage: { complete: false, stoppedBy: ["max-records"] },
    frontier: [
      {
        fromId: "a",
        direction: "predecessors",
        reason: "max-records",
        nextIds: ["b"]
      }
    ],
    traceIds: ["a", "anchor"]
  });
});

test("trace selection snapshots frozen array accessors and custom iterators", () => {
  const graph = buildRelationGraph<string, string>(["anchor", "a", "b"], []);
  for (const customIterator of [false, true]) {
    let target = "a";
    const targets = ["a"];
    if (customIterator) {
      Object.defineProperty(targets, Symbol.iterator, {
        value: function* () {
          yield target;
        }
      });
    } else {
      Object.defineProperty(targets, "0", { get: () => target });
    }
    const unit = Object.freeze({
      kind: "merge" as const,
      recordIds: Object.freeze(["anchor", "a", "b"]),
      traceIds: Object.freeze(targets)
    });
    const trace = selectRelationGraphTrace(
      graph,
      "anchor",
      { direction: "predecessors", maxDepth: null, maxRecords: 3 },
      ({ fromId }) => {
        if (fromId === "anchor") return [unit];
        if (fromId === "a") {
          target = "b";
          return [unit];
        }
        return [];
      }
    );
    assert.deepEqual(trace, {
      contextIds: [],
      coverage: { complete: true, stoppedBy: [] },
      frontier: [],
      traceIds: ["a", "anchor", "b"]
    });
  }
});

test("trace selection rechecks inherited array iteration before a cache hit", () => {
  const graph = buildRelationGraph<string, string>(["anchor", "a", "b"], []);
  const targets = Object.freeze(["a"]);
  const unit = Object.freeze({
    kind: "merge" as const,
    recordIds: Object.freeze(["anchor", "a", "b"]),
    traceIds: targets
  });
  const iterator = Object.getOwnPropertyDescriptor(
    Array.prototype,
    Symbol.iterator
  );
  assert.ok(iterator);
  const originalIterator = Array.prototype[Symbol.iterator];
  try {
    const trace = selectRelationGraphTrace(
      graph,
      "anchor",
      { direction: "predecessors", maxDepth: null, maxRecords: 3 },
      ({ fromId }) => {
        if (fromId === "anchor") return [unit];
        if (fromId === "a") {
          Object.defineProperty(Array.prototype, Symbol.iterator, {
            ...iterator,
            value: function* (this: readonly string[]) {
              if (this === targets) yield "b";
              else yield* originalIterator.call(this);
            }
          });
          return [unit];
        }
        return [];
      }
    );
    assert.deepEqual(trace, {
      contextIds: [],
      coverage: { complete: true, stoppedBy: [] },
      frontier: [],
      traceIds: ["a", "anchor", "b"]
    });
  } finally {
    Object.defineProperty(Array.prototype, Symbol.iterator, iterator);
  }
});
