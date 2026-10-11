import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRelationGraph,
  selectRelationGraphTrace
} from "../src/graph/relations.ts";
import {
  createTraceAdmissionNormalization,
  normalizeAdmissionUnits
} from "../src/graph/trace-ordering.ts";

function proxyArray(
  ids: readonly string[],
  current: () => readonly string[]
): readonly string[] {
  return new Proxy(Object.freeze([...ids]), {
    get(array, key, receiver) {
      if (key === Symbol.iterator) return () => current()[Symbol.iterator]();
      return Reflect.get(array, key, receiver);
    }
  });
}

test("trace normalization shares one proven member representation across distinct stable direct units", () => {
  for (const count of [10, 100, 300]) {
    const ids = Array.from({ length: count }, (_, index) => `member-${index}`);
    const recordIds = Object.freeze([...ids].reverse());
    const units = ids.map((id) =>
      Object.freeze({
        kind: "reallocation" as const,
        recordIds,
        traceIds: Object.freeze([id])
      })
    );
    const context = createTraceAdmissionNormalization<string>();
    let descriptors = 0;
    const descriptor = Object.getOwnPropertyDescriptor;
    Object.getOwnPropertyDescriptor = (object, key) => {
      if (object === recordIds && /^\d+$/u.test(String(key))) descriptors += 1;
      return descriptor(object, key);
    };
    let normalized;
    try {
      normalized = units.map(
        (unit) => normalizeAdmissionUnits([unit], context)[0]!
      );
    } finally {
      Object.getOwnPropertyDescriptor = descriptor;
    }
    const representations = new Set(normalized.map((unit) => unit.recordIds));
    assert.equal(descriptors, count);
    assert.equal(representations.size, 1);
    assert.equal(
      [...representations].reduce((sum, members) => sum + members.length, 0),
      count
    );
    assert.equal(
      context.recordMembersByArray.get(recordIds)?.recordIds,
      normalized[0]?.recordIds
    );
    for (const unit of units)
      assert.equal(
        context.normalizedByUnit.get(unit)?.recordIdentity,
        context.recordMembersByArray.get(recordIds)?.identity
      );
    assert.deepEqual(
      normalized.map((unit) => unit.traceIds),
      ids.map((id) => [id])
    );
  }
});

test("trace normalization keeps member value identity and kind while unioning direct targets", () => {
  const context = createTraceAdmissionNormalization<string>();
  const unit = (kind: "merge" | "split", ids: string[], traceIds: string[]) =>
    Object.freeze({
      kind,
      recordIds: Object.freeze(ids),
      traceIds: Object.freeze(traceIds)
    });
  const units = normalizeAdmissionUnits(
    [
      unit("merge", ["b", "anchor", "a", "a"], ["a", "outside"]),
      unit("merge", ["a", "b", "anchor"], ["b"]),
      unit("split", ["anchor", "b", "a"], ["a"])
    ],
    context
  );
  assert.deepEqual(units, [
    { kind: "split", recordIds: ["a", "anchor", "b"], traceIds: ["a"] },
    { kind: "merge", recordIds: ["a", "anchor", "b"], traceIds: ["a", "b"] }
  ]);
});

test("trace selection snapshots same and distinct frozen units with Proxy direct arrays", () => {
  const graph = buildRelationGraph<string, string>(["anchor", "a", "b"], []);
  for (const reuseUnit of [true, false]) {
    let targets = ["a"];
    const traceIds = proxyArray(targets, () => targets);
    const recordIds = Object.freeze(["anchor", "a", "b"]);
    const make = () =>
      Object.freeze({ kind: "merge" as const, recordIds, traceIds });
    const unit = make();
    const result = selectRelationGraphTrace(
      graph,
      "anchor",
      { direction: "predecessors", maxDepth: null, maxRecords: 3 },
      ({ fromId }) => {
        if (fromId === "anchor") return [unit];
        if (fromId === "a") {
          targets = ["b"];
          return [reuseUnit ? unit : make()];
        }
        return [];
      }
    );
    assert.deepEqual(result, {
      traceIds: ["a", "anchor", "b"],
      contextIds: [],
      coverage: { complete: true, stoppedBy: [] },
      frontier: []
    });
  }
});

test("trace selection snapshots Proxy member changes before budget and successful group reuse", () => {
  const graph = buildRelationGraph<string, string>(["anchor", "a", "b"], []);
  for (const reuseUnit of [true, false])
    for (const maxRecords of [2, 3]) {
      let members = ["anchor", "a"];
      const recordIds = proxyArray(members, () => members);
      const make = () =>
        Object.freeze({
          kind: "merge" as const,
          recordIds,
          traceIds: Object.freeze(["a", "b"])
        });
      const unit = make();
      const result = selectRelationGraphTrace(
        graph,
        "anchor",
        { direction: "predecessors", maxDepth: null, maxRecords },
        ({ fromId }) => {
          if (fromId === "anchor") return [unit];
          if (fromId === "a") {
            members = ["anchor", "a", "b"];
            return [reuseUnit ? unit : make()];
          }
          return [];
        }
      );
      if (maxRecords === 2) {
        assert.deepEqual(result.blockedEvent, {
          kind: "merge",
          recordIds: ["a", "anchor", "b"],
          requiredMaxRecords: 3
        });
        assert.deepEqual(result.traceIds, ["a", "anchor"]);
        assert.deepEqual(result.frontier, [
          {
            fromId: "a",
            direction: "predecessors",
            reason: "max-records",
            nextIds: ["a", "b"]
          }
        ]);
      } else
        assert.deepEqual(result, {
          traceIds: ["a", "anchor", "b"],
          contextIds: [],
          coverage: { complete: true, stoppedBy: [] },
          frontier: []
        });
    }
});

test("trace selection restores stable members after inherited iteration changes without losing promotion", () => {
  const graph = buildRelationGraph<string, string>(
    ["anchor", "a", "b", "c"],
    []
  );
  const recordIds = Object.freeze(["anchor", "a", "b", "c"]);
  const targets = Object.freeze(["a"]);
  const first = Object.freeze({
    kind: "merge" as const,
    recordIds,
    traceIds: targets
  });
  const second = Object.freeze({
    kind: "merge" as const,
    recordIds,
    traceIds: Object.freeze(["c"])
  });
  const descriptor = Object.getOwnPropertyDescriptor(
    Array.prototype,
    Symbol.iterator
  )!;
  const iterator = Array.prototype[Symbol.iterator];
  let result;
  try {
    result = selectRelationGraphTrace(
      graph,
      "anchor",
      { direction: "predecessors", maxDepth: null, maxRecords: 4 },
      ({ fromId }) => {
        if (fromId === "anchor") return [first];
        if (fromId === "a") {
          Object.defineProperty(Array.prototype, Symbol.iterator, {
            ...descriptor,
            value: function* (this: readonly string[]) {
              if (this === targets) yield "b";
              else yield* iterator.call(this);
            }
          });
          return [first];
        }
        if (fromId === "b") {
          Object.defineProperty(Array.prototype, Symbol.iterator, descriptor);
          return [second];
        }
        return [];
      }
    );
  } finally {
    Object.defineProperty(Array.prototype, Symbol.iterator, descriptor);
  }
  assert.deepEqual(result, {
    traceIds: ["a", "anchor", "b", "c"],
    contextIds: [],
    coverage: { complete: true, stoppedBy: [] },
    frontier: []
  });
});

test("trace normalization preserves dynamic field and iterator snapshot order", () => {
  const reads: string[] = [];
  const ids = (field: string, values: string[]) => {
    const array = [...values];
    Object.defineProperty(array, Symbol.iterator, {
      get() {
        reads.push(field + ".iterator");
        return values[Symbol.iterator].bind(values);
      }
    });
    return array;
  };
  const records = ids("records", ["b", "a", "a"]);
  const direct = ids("direct", ["b", "outside"]);
  let kinds = 0;
  const unit = {
    get recordIds() {
      reads.push("recordIds");
      return records;
    },
    get traceIds() {
      reads.push("traceIds");
      return direct;
    },
    get kind() {
      reads.push("kind");
      return ++kinds === 1 ? ("ordinary" as const) : ("merge" as const);
    }
  };
  assert.deepEqual(
    normalizeAdmissionUnits([unit], createTraceAdmissionNormalization()),
    [{ kind: "merge", recordIds: ["a", "b"], traceIds: ["b"] }]
  );
  assert.deepEqual(reads, [
    "recordIds",
    "records.iterator",
    "traceIds",
    "direct.iterator",
    "kind",
    "kind"
  ]);
});
