import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildRelationGraph,
  traceRelationGraph
} from "../../shared/src/graph/relations.ts";
import { validateInvestigationRelationGraph } from "../src/relation-validation.ts";
import type { InvestigationIndexState } from "../src/types.ts";

function state(
  formedAt: string,
  relations: InvestigationIndexState["relations"] = []
): InvestigationIndexState {
  return {
    formedAt,
    question: "问题",
    relations: [...relations],
    resourceIds: [],
    tags: ["test"],
    title: "标题"
  };
}

test("relation graph accepts independent ordinary merge and split shapes", () => {
  const states = new Map<string, InvestigationIndexState>([
    ["base.md", state("2026-08-28T10:00:00+00:00")],
    [
      "ordinary.md",
      state("2026-08-28T11:00:00+00:00", [{ target: "base.md", type: "补充" }])
    ],
    ["other.md", state("2026-08-28T10:30:00+00:00")],
    [
      "merge.md",
      state("2026-08-28T12:00:00+00:00", [
        { target: "base.md", type: "归并" },
        { target: "other.md", type: "归并" }
      ])
    ],
    [
      "split-a.md",
      state("2026-08-28T13:00:00+00:00", [
        { target: "ordinary.md", type: "拆分" }
      ])
    ],
    [
      "split-b.md",
      state("2026-08-28T13:00:00+00:00", [
        { target: "ordinary.md", type: "拆分" }
      ])
    ]
  ]);
  assert.deepEqual(validateInvestigationRelationGraph(states), []);
});

test("relation graph rejects a missing target", () => {
  const errors = validateInvestigationRelationGraph(
    new Map([
      [
        "missing.md",
        state("2026-08-28T14:00:00+00:00", [
          { target: "none.md", type: "补充" }
        ])
      ]
    ])
  );
  assert.ok(errors.some((error) => error.includes("does not exist")));
});

test("relation graph rejects a self target", () => {
  const errors = validateInvestigationRelationGraph(
    new Map([
      [
        "self.md",
        state("2026-08-28T14:00:00+00:00", [
          { target: "self.md", type: "补充" }
        ])
      ]
    ])
  );
  assert.ok(errors.some((error) => error.includes("must not target itself")));
});

test("relation graph rejects a repeated target", () => {
  const errors = validateInvestigationRelationGraph(
    new Map([
      ["base.md", state("2026-08-28T12:00:00+00:00")],
      [
        "duplicate.md",
        state("2026-08-28T14:00:00+00:00", [
          { target: "base.md", type: "补充" },
          { target: "base.md", type: "复查" }
        ])
      ]
    ])
  );
  assert.ok(errors.some((error) => error.includes("repeat target")));
});

test("relation graph rejects a target formed later", () => {
  const errors = validateInvestigationRelationGraph(
    new Map([
      [
        "base.md",
        state("2026-08-28T12:00:00+00:00", [
          { target: "later.md", type: "补充" }
        ])
      ],
      ["later.md", state("2026-08-28T13:00:00+00:00")]
    ])
  );
  assert.ok(errors.some((error) => error.includes("formed later")));
});

test("relation graph rejects a cycle", () => {
  const errors = validateInvestigationRelationGraph(
    new Map([
      [
        "first.md",
        state("2026-08-28T12:00:00+00:00", [
          { target: "second.md", type: "补充" }
        ])
      ],
      [
        "second.md",
        state("2026-08-28T13:00:00+00:00", [
          { target: "first.md", type: "补充" }
        ])
      ]
    ])
  );
  assert.ok(errors.some((error) => error.includes("cycle")));
});

test("relation trace returns deterministic predecessor successor and bidirectional subgraphs", () => {
  const graph = buildRelationGraph(
    ["a.md", "b.md", "c.md"],
    [
      { source: "c.md", target: "b.md", type: "修正" },
      { source: "b.md", target: "a.md", type: "补充" }
    ]
  );
  assert.deepEqual(
    [
      ...traceRelationGraph(graph, "b.md", {
        direction: "predecessors",
        maxDepth: null
      }).ids
    ],
    ["b.md", "a.md"]
  );
  assert.deepEqual(
    [
      ...traceRelationGraph(graph, "b.md", {
        direction: "successors",
        maxDepth: null
      }).ids
    ],
    ["b.md", "c.md"]
  );
  assert.deepEqual(
    [
      ...traceRelationGraph(graph, "b.md", {
        direction: "both",
        maxDepth: null
      }).ids
    ],
    ["b.md", "a.md", "c.md"]
  );
});
