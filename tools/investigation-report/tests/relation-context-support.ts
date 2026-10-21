import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import type { InvestigationIndexState } from "../src/types.ts";

/** 在独立 fixture 上观察原始关系数组的构图投影，不替换图实现。 */
export function observeGraphBuilds(
  t: TestContext,
  states: Iterable<InvestigationIndexState>
): (expected: number) => void {
  const projections = [...states].map((state) => {
    const relations = [...state.relations];
    Object.defineProperty(state, "relations", { value: relations });
    const projection = { map: relations.map.bind(relations) };
    const observed = t.mock.method(projection, "map");
    Object.defineProperty(relations, "map", { value: observed });
    return observed;
  });
  return (expected) => {
    assert.ok(projections.length > 0);
    for (const projection of projections)
      assert.equal(projection.mock.callCount(), expected);
  };
}
