import test from "node:test";
import assert from "node:assert/strict";
import { assertEvolutionRejected } from "./domain-support.ts";
import { relationStrategyFor } from "../../src/decision-relation-transaction-strategy.ts";
import { decisionIdForTest } from "../support-record-fixture.ts";
import type { PreparedSuccessor } from "../../src/decision-relation-transaction-types.ts";
import type { DecisionRelationConsistencyRecord } from "../../src/relation-graph.ts";

function closureFixture(componentSizes: readonly number[]) {
  const records: DecisionRelationConsistencyRecord[] = [];
  const groups = componentSizes.map((size, group) =>
    Array.from({ length: size }, (_, index) =>
      decisionIdForTest(`group-${group}-member-${index}`)
    )
  );
  for (const [group, ids] of groups.entries()) {
    for (const id of ids)
      records.push({
        decisionId: id,
        sourcePath: `${id}.md`,
        status: "active",
        projection: {
          title: id,
          purpose: "",
          background: "",
          decision: "",
          relations: [
            { type: "重划", target: decisionIdForTest(`prior-${group}`) }
          ]
        }
      });
  }
  const successors = (ids: readonly ReturnType<typeof decisionIdForTest>[]) =>
    ids.map(
      (id) =>
        ({
          record: { decisionId: id },
          finalRelations: [{ type: "重划", target: decisionIdForTest("prior") }]
        }) as PreparedSuccessor
    );
  return { records, groups, successors };
}

test("reallocation closure scans smaller membership sets", () => {
  const { records, groups, successors } = closureFixture([2, 2, 6]);
  const selected = successors(groups[2]!);
  const strategy = relationStrategyFor(selected);
  const selectedIds = new Set(groups[2]);
  const oldIds = new Set([...groups[0]!, ...groups[1]!]);
  const originalHas: Set<unknown>["has"] = Reflect.get(Set.prototype, "has");
  let oldComponentChecks = 0;
  let selectedChecks = 0;
  let errors: string[];
  try {
    Set.prototype.has = function (id) {
      if (
        this.size === selectedIds.size &&
        originalHas.call(this, groups[2]![0]) &&
        originalHas.call(oldIds, id)
      )
        selectedChecks++;
      if (
        this.size === 2 &&
        [...groups[0]!, ...groups[1]!].some((old) =>
          originalHas.call(this, old)
        ) &&
        originalHas.call(selectedIds, id)
      )
        oldComponentChecks++;
      return originalHas.call(this, id);
    };
    errors = strategy.closureErrors(selected, records);
  } finally {
    Set.prototype.has = originalHas;
  }
  assert.deepEqual(errors, []);
  assert.equal(oldComponentChecks, 0);
  assert.equal(selectedChecks, 4);
});

test("reallocation closure reports the first matching component for either set size", () => {
  const { records, groups, successors } = closureFixture([2, 2, 6]);
  const strategy = relationStrategyFor(successors(groups[2]!));
  const across = successors([groups[0]![0]!, groups[1]![0]!]);
  assert.deepEqual(strategy.closureErrors(across, records), [
    "The selected successor set must equal every final 重划 successor in its connected component. Omitted: " +
      groups[0]![1] +
      ". Outside component: " +
      groups[1]![0] +
      "."
  ]);
  const subset = successors(groups[2]!.slice(0, 2));
  assert.deepEqual(strategy.closureErrors(subset, records), [
    "The selected successor set must equal every final 重划 successor in its connected component. Omitted: " +
      groups[2]!.slice(2).sort().join(", ") +
      "."
  ]);
});

test("evolve rejects a one-predecessor reallocation", async () => {
  await assertEvolutionRejected(
    [
      { id: "predecessor", status: "active" },
      { id: "first", relations: [{ type: "重划", target: "predecessor" }] },
      { id: "second", relations: [{ type: "重划", target: "predecessor" }] }
    ],
    ["first", "second"],
    /requires at least two distinct predecessors/u
  );
});

test("evolve rejects mixed reallocation and other successor relations", async () => {
  await assertEvolutionRejected(
    [
      { id: "predecessor", status: "active" },
      { id: "another", status: "active" },
      {
        id: "first",
        relations: [
          { type: "重划", target: "predecessor" },
          { type: "修订", target: "another" }
        ]
      },
      {
        id: "second",
        relations: [
          { type: "重划", target: "predecessor" },
          { type: "重划", target: "another" }
        ]
      }
    ],
    ["first", "second"],
    /at least one 重划 relation and no other/u
  );
});

test("evolve rejects a disconnected reallocation graph", async () => {
  await assertEvolutionRejected(
    [
      { id: "predecessor", status: "active" },
      { id: "another", status: "active" },
      { id: "first", relations: [{ type: "重划", target: "predecessor" }] },
      { id: "second", relations: [{ type: "重划", target: "another" }] }
    ],
    ["first", "second"],
    /successor-predecessor graph must be connected/u
  );
});

test("evolve rejects a reallocation that overlaps successor and predecessor roles", async () => {
  await assertEvolutionRejected(
    [
      { id: "predecessor", status: "archived" },
      { id: "another", status: "archived" },
      {
        id: "first",
        status: "active",
        relations: [
          { type: "重划", target: "predecessor" },
          { type: "重划", target: "another" }
        ]
      },
      {
        id: "second",
        status: "active",
        relations: [{ type: "重划", target: "predecessor" }]
      },
      {
        id: "overlapping",
        relations: [
          { type: "重划", target: "first" },
          { type: "重划", target: "predecessor" }
        ]
      }
    ],
    ["first", "overlapping"],
    /both successor and predecessor/u
  );
});

test("evolve requires every established successor in a reallocation component", async () => {
  await assertEvolutionRejected(
    [
      { id: "older-predecessor", status: "archived" },
      { id: "older-another", status: "archived" },
      {
        id: "older-first",
        status: "active",
        relations: [
          { type: "重划", target: "older-predecessor" },
          { type: "重划", target: "older-another" }
        ]
      },
      {
        id: "older-second",
        status: "active",
        relations: [{ type: "重划", target: "older-predecessor" }]
      },
      { id: "predecessor", status: "archived" },
      { id: "another", status: "archived" },
      {
        id: "first",
        status: "active",
        relations: [
          { type: "重划", target: "predecessor" },
          { type: "重划", target: "another" }
        ]
      },
      {
        id: "second",
        status: "active",
        relations: [{ type: "重划", target: "predecessor" }]
      },
      {
        id: "use-third-reallocation-successor",
        status: "active",
        relations: [
          { type: "重划", target: "predecessor" },
          { type: "重划", target: "another" }
        ]
      }
    ],
    ["first", "second"],
    /equal every final 重划 successor.*use-third-reallocation-successor/u
  );
});
