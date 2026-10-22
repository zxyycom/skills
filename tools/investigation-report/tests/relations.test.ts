import assert from "node:assert/strict";
import { test } from "node:test";
import {
  traceInvestigationRelations,
  validateInvestigationRelationGraph
} from "../src/relation-validation.ts";
import { createInvestigationRelationContext } from "../src/relation-context.ts";
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
  assert.deepEqual(
    validateInvestigationRelationGraph(
      createInvestigationRelationContext(states)
    ),
    []
  );
});

test("relation graph rejects a self target", () => {
  const errors = validateInvestigationRelationGraph(
    createInvestigationRelationContext(
      new Map([
        [
          "self",
          state("2026-08-28T14:00:00+00:00", [{ target: "self", type: "补充" }])
        ]
      ])
    )
  );
  assert.ok(errors.some((error) => error.includes("must not target itself")));
});

test("relation graph rejects a target formed later", () => {
  const errors = validateInvestigationRelationGraph(
    createInvestigationRelationContext(
      new Map([
        [
          "base",
          state("2026-08-28T12:00:00+00:00", [
            { target: "later", type: "补充" }
          ])
        ],
        ["later", state("2026-08-28T13:00:00+00:00")]
      ])
    )
  );
  assert.ok(errors.some((error) => error.includes("formed later")));
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
    traceInvestigationRelations(
      createInvestigationRelationContext(states),
      "b",
      {
        direction: "predecessors",
        maxDepth: null,
        maxRecords: 50
      }
    ).traceIds,
    ["a", "b"]
  );
  assert.deepEqual(
    traceInvestigationRelations(
      createInvestigationRelationContext(states),
      "b",
      {
        direction: "successors",
        maxDepth: null,
        maxRecords: 50
      }
    ).traceIds,
    ["b", "c"]
  );
  assert.deepEqual(
    traceInvestigationRelations(
      createInvestigationRelationContext(states),
      "b",
      {
        direction: "both",
        maxDepth: null,
        maxRecords: 50
      }
    ).traceIds,
    ["a", "b", "c"]
  );
  assert.deepEqual(
    traceInvestigationRelations(
      createInvestigationRelationContext(states),
      "b",
      {
        direction: "both",
        maxDepth: 0,
        maxRecords: 50
      }
    ).frontier,
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
    traceInvestigationRelations(
      createInvestigationRelationContext(states),
      "b",
      {
        direction: "both",
        maxDepth: 0,
        maxRecords: 50
      }
    ).traceIds,
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
  const split = traceInvestigationRelations(
    createInvestigationRelationContext(splitStates),
    "first-split",
    {
      direction: "predecessors",
      maxDepth: null,
      maxRecords: 50
    }
  );
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
  const merge = traceInvestigationRelations(
    createInvestigationRelationContext(mergeStates),
    "first-source",
    {
      direction: "successors",
      maxDepth: null,
      maxRecords: 50
    }
  );
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
  const trace = traceInvestigationRelations(
    createInvestigationRelationContext(states),
    "first-split",
    {
      direction: "predecessors",
      maxDepth: null,
      maxRecords: 2
    }
  );
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
    validateInvestigationRelationGraph(
      createInvestigationRelationContext(withSummary)
    ),
    validateInvestigationRelationGraph(
      createInvestigationRelationContext(withoutSummary)
    )
  );
  assert.deepEqual(
    validateInvestigationRelationGraph(
      createInvestigationRelationContext(withSummary)
    ),
    [
      "next ordinary relation report must have exactly one 补充、复查、修正 or 推翻 predecessor",
      "next relations must not repeat target base"
    ]
  );
});

test("investigation graph accepts same-time deep ordinary chains and preserves late-cycle diagnostics", () => {
  const ids = Array.from(
    { length: 12000 },
    (_, i) => `chain-${String(i).padStart(5, "0")}`
  );
  const states = new Map(
    ids.map((id, i) => [
      id,
      state(
        "2026-08-28T12:00:00Z",
        i + 1 === ids.length ? [] : [{ target: ids[i + 1]!, type: "复查" }]
      )
    ])
  );
  assert.deepEqual(
    validateInvestigationRelationGraph(
      createInvestigationRelationContext(states)
    ),
    []
  );
  states.set(
    ids[11999]!,
    state("2026-08-28T12:00:00Z", [{ target: ids[11997]!, type: "复查" }])
  );
  assert.deepEqual(
    validateInvestigationRelationGraph(
      createInvestigationRelationContext(states)
    ),
    [
      "investigation relations must not form a cycle: chain-11997 -> chain-11998 -> chain-11999 -> chain-11997"
    ]
  );
});

test("relation trace reuses complete events across both directions anchors and depth boundaries", () => {
  for (const kind of ["split", "merge"] as const) {
    const states = new Map<string, InvestigationIndexState>([
      ["center", state("2026-08-28T12:00:00Z")],
      ...["a", "b", "c"].map((id): [string, InvestigationIndexState] => [
        id,
        state(
          "2026-08-28T12:00:00Z",
          kind === "split" ? [{ type: "拆分", target: "center" }] : []
        )
      ])
    ]);
    if (kind === "merge")
      states.set(
        "center",
        state("2026-08-28T12:00:00Z", [
          { type: "归并", target: "a" },
          { type: "归并", target: "b" },
          { type: "归并", target: "c" }
        ])
      );
    assert.deepEqual(
      validateInvestigationRelationGraph(
        createInvestigationRelationContext(states)
      ),
      []
    );
    for (const anchor of states.keys()) {
      const complete = traceInvestigationRelations(
        createInvestigationRelationContext(states),
        anchor,
        {
          direction: "both",
          maxDepth: null,
          maxRecords: 4
        }
      );
      assert.deepEqual(complete, {
        contextIds: [],
        coverage: { complete: true, stoppedBy: [] },
        frontier: [],
        traceIds: ["a", "b", "c", "center"]
      });
      const blocked = traceInvestigationRelations(
        createInvestigationRelationContext(states),
        anchor,
        {
          direction: "both",
          maxDepth: null,
          maxRecords: 3
        }
      );
      assert.deepEqual(blocked.traceIds, [anchor]);
      assert.deepEqual(blocked.contextIds, []);
      assert.deepEqual(blocked.blockedEvent, {
        kind,
        recordIds: ["a", "b", "c", "center"],
        requiredMaxRecords: 4
      });
    }
    const depth = traceInvestigationRelations(
      createInvestigationRelationContext(states),
      "a",
      {
        direction: "both",
        maxDepth: 1,
        maxRecords: 4
      }
    );
    assert.deepEqual(depth.traceIds, ["a", "center"]);
    assert.deepEqual(depth.contextIds, ["b", "c"]);
    assert.deepEqual(depth.frontier, [
      {
        fromId: "center",
        direction: kind === "split" ? "successors" : "predecessors",
        nextIds: ["a", "b", "c"],
        reason: "depth"
      }
    ]);
  }
});

test("relation trace retains already admitted event targets in a later budget frontier", () => {
  const states = new Map<string, InvestigationIndexState>([
    [
      "z",
      state("2026-08-28T12:00:00Z", [
        { type: "归并", target: "b" },
        { type: "归并", target: "p" },
        { type: "归并", target: "q" }
      ])
    ],
    ["b", state("2026-08-28T12:00:00Z")],
    ["p", state("2026-08-28T12:00:00Z")],
    ["q", state("2026-08-28T12:00:00Z")],
    ["a", state("2026-08-28T12:00:00Z", [{ type: "补充", target: "p" }])]
  ]);
  assert.deepEqual(
    validateInvestigationRelationGraph(
      createInvestigationRelationContext(states)
    ),
    []
  );
  const trace = traceInvestigationRelations(
    createInvestigationRelationContext(states),
    "z",
    {
      direction: "both",
      maxDepth: null,
      maxRecords: 4
    }
  );
  assert.deepEqual(trace.traceIds, ["b", "p", "q", "z"]);
  assert.deepEqual(trace.contextIds, []);
  assert.equal(trace.blockedEvent, undefined);
  assert.deepEqual(trace.frontier, [
    {
      fromId: "p",
      direction: "successors",
      nextIds: ["a", "z"],
      reason: "max-records"
    },
    {
      fromId: "q",
      direction: "successors",
      nextIds: ["z"],
      reason: "max-records"
    }
  ]);
});
