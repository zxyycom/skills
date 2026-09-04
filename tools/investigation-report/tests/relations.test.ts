import assert from "node:assert/strict";
import { test } from "node:test";
import {
  traceInvestigationRelations,
  validateInvestigationRelationGraph
} from "../src/relation-validation.ts";
import type { InvestigationIndexState } from "../src/types.ts";

function state(
  formedAt: string,
  relations: InvestigationIndexState["relations"] = []
): InvestigationIndexState {
  return {
    formedAt,
    name: "state",
    question: "问题",
    relations: [...relations],
    resourceIds: [],
    sourcePath: "state.md",
    tags: ["test"],
    title: "标题"
  };
}

test("relation graph accepts independent ordinary merge and split shapes", () => {
  const states = new Map<string, InvestigationIndexState>([
    ["base", state("2026-08-28T10:00:00+00:00")],
    [
      "ordinary",
      state("2026-08-28T11:00:00+00:00", [{ target: "base", type: "补充" }])
    ],
    ["other", state("2026-08-28T10:30:00+00:00")],
    [
      "merge",
      state("2026-08-28T12:00:00+00:00", [
        { target: "base", type: "归并" },
        { target: "other", type: "归并" }
      ])
    ],
    [
      "split-a",
      state("2026-08-28T13:00:00+00:00", [{ target: "ordinary", type: "拆分" }])
    ],
    [
      "split-b",
      state("2026-08-28T13:00:00+00:00", [{ target: "ordinary", type: "拆分" }])
    ]
  ]);
  assert.deepEqual(validateInvestigationRelationGraph(states), []);
});

test("relation graph rejects a missing target", () => {
  const errors = validateInvestigationRelationGraph(
    new Map([
      [
        "missing",
        state("2026-08-28T14:00:00+00:00", [{ target: "none", type: "补充" }])
      ]
    ])
  );
  assert.ok(errors.some((error) => error.includes("does not exist")));
});

test("relation graph rejects a self target", () => {
  const errors = validateInvestigationRelationGraph(
    new Map([
      [
        "self",
        state("2026-08-28T14:00:00+00:00", [{ target: "self", type: "补充" }])
      ]
    ])
  );
  assert.ok(errors.some((error) => error.includes("must not target itself")));
});

test("relation graph rejects a repeated target", () => {
  const errors = validateInvestigationRelationGraph(
    new Map([
      ["base", state("2026-08-28T12:00:00+00:00")],
      [
        "duplicate",
        state("2026-08-28T14:00:00+00:00", [
          { target: "base", type: "补充" },
          { target: "base", type: "复查" }
        ])
      ]
    ])
  );
  assert.deepEqual(
    errors.filter((error) => error.includes("repeat target")),
    ["duplicate relations must not repeat target base"]
  );
});

test("relation graph rejects a target formed later", () => {
  const errors = validateInvestigationRelationGraph(
    new Map([
      [
        "base",
        state("2026-08-28T12:00:00+00:00", [{ target: "later", type: "补充" }])
      ],
      ["later", state("2026-08-28T13:00:00+00:00")]
    ])
  );
  assert.ok(errors.some((error) => error.includes("formed later")));
});

test("relation graph rejects a cycle", () => {
  const errors = validateInvestigationRelationGraph(
    new Map([
      [
        "first",
        state("2026-08-28T12:00:00+00:00", [{ target: "second", type: "补充" }])
      ],
      [
        "second",
        state("2026-08-28T13:00:00+00:00", [{ target: "first", type: "补充" }])
      ]
    ])
  );
  assert.ok(errors.some((error) => error.includes("cycle")));
});

test("relation trace returns deterministic predecessor successor and bidirectional subgraphs", () => {
  const states = new Map<string, InvestigationIndexState>([
    ["c", state("2026-08-28T12:00:00+00:00", [{ target: "b", type: "修正" }])],
    ["b", state("2026-08-28T11:00:00+00:00", [{ target: "a", type: "补充" }])],
    ["a", state("2026-08-28T10:00:00+00:00")]
  ]);
  assert.deepEqual(
    [
      ...traceInvestigationRelations(states, "b", {
        direction: "predecessors",
        maxDepth: null
      }).ids
    ],
    ["b", "a"]
  );
  assert.deepEqual(
    [
      ...traceInvestigationRelations(states, "b", {
        direction: "successors",
        maxDepth: null
      }).ids
    ],
    ["b", "c"]
  );
  assert.deepEqual(
    [
      ...traceInvestigationRelations(states, "b", {
        direction: "both",
        maxDepth: null
      }).ids
    ],
    ["b", "a", "c"]
  );
  assert.deepEqual(
    traceInvestigationRelations(states, "b", {
      direction: "both",
      maxDepth: null
    }).edges,
    [
      { source: "b", target: "a", type: "补充" },
      { source: "c", target: "b", type: "修正" }
    ]
  );
  assert.deepEqual(
    [
      ...traceInvestigationRelations(states, "b", {
        direction: "both",
        maxDepth: 0
      }).ids
    ],
    ["b"]
  );
});
