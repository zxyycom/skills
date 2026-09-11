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

test("relation trace selects deterministic predecessor successor and bidirectional slices", () => {
  const states = new Map<string, InvestigationIndexState>([
    [
      "c",
      state("2026-08-28T12:00:00+00:00", [
        { type: "修正", target: "b", summary: "修正边界" }
      ])
    ],
    ["b", state("2026-08-28T11:00:00+00:00", [{ target: "a", type: "补充" }])],
    ["a", state("2026-08-28T10:00:00+00:00")]
  ]);
  assert.deepEqual(
    traceInvestigationRelations(states, "b", {
      direction: "predecessors",
      maxDepth: null,
      maxRecords: 50
    }).traceIds,
    ["a", "b"]
  );
  assert.deepEqual(
    traceInvestigationRelations(states, "b", {
      direction: "successors",
      maxDepth: null,
      maxRecords: 50
    }).traceIds,
    ["b", "c"]
  );
  assert.deepEqual(
    traceInvestigationRelations(states, "b", {
      direction: "both",
      maxDepth: null,
      maxRecords: 50
    }).traceIds,
    ["a", "b", "c"]
  );
  assert.deepEqual(
    traceInvestigationRelations(states, "b", {
      direction: "both",
      maxDepth: 0,
      maxRecords: 50
    }).frontier,
    [
      {
        direction: "predecessors",
        fromId: "b",
        nextIds: ["a"],
        reason: "depth"
      },
      { direction: "successors", fromId: "b", nextIds: ["c"], reason: "depth" }
    ]
  );
  assert.deepEqual(
    traceInvestigationRelations(states, "b", {
      direction: "both",
      maxDepth: 0,
      maxRecords: 50
    }).traceIds,
    ["b"]
  );
});

test("relation trace closes split and merge events without treating context as traversal", () => {
  const splitStates = new Map<string, InvestigationIndexState>([
    ["base", state("2026-08-28T10:00:00+00:00")],
    [
      "first-split",
      state("2026-08-28T11:00:00+00:00", [{ target: "base", type: "拆分" }])
    ],
    [
      "second-split",
      state("2026-08-28T11:00:00+00:00", [{ target: "base", type: "拆分" }])
    ]
  ]);
  const split = traceInvestigationRelations(splitStates, "first-split", {
    direction: "predecessors",
    maxDepth: null,
    maxRecords: 50
  });
  assert.deepEqual(split.traceIds, ["base", "first-split"]);
  assert.deepEqual(split.contextIds, ["second-split"]);

  const mergeStates = new Map<string, InvestigationIndexState>([
    ["first-source", state("2026-08-28T10:00:00+00:00")],
    ["second-source", state("2026-08-28T10:00:00+00:00")],
    [
      "merged",
      state("2026-08-28T11:00:00+00:00", [
        { target: "first-source", type: "归并" },
        { target: "second-source", type: "归并" }
      ])
    ]
  ]);
  const merge = traceInvestigationRelations(mergeStates, "first-source", {
    direction: "successors",
    maxDepth: null,
    maxRecords: 50
  });
  assert.deepEqual(merge.traceIds, ["first-source", "merged"]);
  assert.deepEqual(merge.contextIds, ["second-source"]);
});

test("relation trace blocks an oversized split event at the budget boundary", () => {
  const states = new Map<string, InvestigationIndexState>([
    ["base", state("2026-08-28T10:00:00+00:00")],
    [
      "first-split",
      state("2026-08-28T11:00:00+00:00", [{ target: "base", type: "拆分" }])
    ],
    [
      "second-split",
      state("2026-08-28T11:00:00+00:00", [{ target: "base", type: "拆分" }])
    ]
  ]);
  const trace = traceInvestigationRelations(states, "first-split", {
    direction: "predecessors",
    maxDepth: null,
    maxRecords: 2
  });
  assert.deepEqual(trace.traceIds, ["first-split"]);
  assert.deepEqual(trace.contextIds, []);
  assert.deepEqual(trace.blockedEvent, {
    kind: "split",
    recordIds: ["base", "first-split", "second-split"],
    requiredMaxRecords: 3
  });
  assert.deepEqual(trace.frontier, [
    {
      direction: "predecessors",
      fromId: "first-split",
      nextIds: ["base"],
      reason: "max-records"
    }
  ]);
});

test("relation summaries do not change graph identity or validation", () => {
  const withoutSummary = new Map<string, InvestigationIndexState>([
    ["base", state("2026-08-28T10:00:00+00:00")],
    [
      "next",
      state("2026-08-28T11:00:00+00:00", [
        { type: "补充", target: "base" },
        { type: "复查", target: "base" }
      ])
    ]
  ]);
  const withSummary = new Map<string, InvestigationIndexState>([
    ["base", state("2026-08-28T10:00:00+00:00")],
    [
      "next",
      state("2026-08-28T11:00:00+00:00", [
        { type: "补充", target: "base", summary: "说明一" },
        { type: "复查", target: "base", summary: "说明二" }
      ])
    ]
  ]);
  assert.deepEqual(
    validateInvestigationRelationGraph(withSummary),
    validateInvestigationRelationGraph(withoutSummary)
  );
  assert.deepEqual(validateInvestigationRelationGraph(withSummary), [
    "next ordinary relation report must have exactly one 补充、复查、修正 or 推翻 predecessor",
    "next relations must not repeat target base"
  ]);
});
