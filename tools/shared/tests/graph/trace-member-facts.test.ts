import assert from "node:assert/strict";
import test from "node:test";
import {
  createTraceAdmissionNormalization,
  normalizeAdmissionUnits
} from "../../src/graph/trace-ordering.ts";

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
