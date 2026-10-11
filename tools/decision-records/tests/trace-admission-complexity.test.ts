import assert from "node:assert/strict";
import test from "node:test";
import { buildRelationGraph } from "../../shared/src/graph/relations.ts";
import { decisionTraceAdmissionAdapter } from "../src/decision-trace-admission.ts";
import type { DecisionId, DecisionRelationType } from "../src/types.ts";

test("Decision split and merge admission scan event members once and reuse stable units", () => {
  for (const type of ["拆分", "归并"] as const) {
    for (const count of [10, 100, 1000]) {
      let typeReads = 0;
      const focal = "focal" as DecisionId;
      const neighbors = Array.from(
        { length: count },
        (_, index) => `member-${index}` as DecisionId
      );
      const graph = buildRelationGraph(
        [focal, ...neighbors],
        neighbors.map((id) => ({
          source: type === "拆分" ? id : focal,
          target: type === "拆分" ? focal : id,
          get type(): DecisionRelationType {
            typeReads += 1;
            return type;
          }
        }))
      );
      typeReads = 0;
      for (const edge of graph.edges)
        Object.defineProperty(edge, "type", {
          configurable: true,
          get: () => {
            typeReads += 1;
            return type;
          }
        });
      const adapter = decisionTraceAdmissionAdapter([]);
      const direction = type === "拆分" ? "successors" : "predecessors";
      const first = adapter({ fromId: focal, direction, graph });
      assert.equal(first.length, 1);
      assert.equal(first[0]!.recordIds.length, count + 1);
      assert.equal(Object.isFrozen(first[0]), true);
      assert.equal(Object.isFrozen(first[0]!.recordIds), true);
      const reverse = type === "拆分" ? "predecessors" : "successors";
      let previous = adapter({
        fromId: neighbors[0]!,
        direction: reverse,
        graph
      })[0];
      for (const id of neighbors) {
        const unit = adapter({ fromId: id, direction: reverse, graph });
        assert.equal(unit.length, 1);
        assert.equal(unit[0], previous);
        previous = unit[0];
      }
      assert.ok(
        typeReads <= 6 * count + 2,
        `${type} d=${count}: ${typeReads} edge type accesses`
      );
    }
  }
});
