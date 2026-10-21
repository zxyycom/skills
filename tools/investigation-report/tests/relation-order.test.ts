import assert from "node:assert/strict";
import { test } from "node:test";
import { filterRelationsByEntry } from "../src/query-search-selection.ts";
import { createInvestigationRelationContext } from "../src/relation-context.ts";
import {
  traceInvestigationRelations,
  validateInvestigationRelationGraph
} from "../src/relation-validation.ts";
import { investigationIndexFixture } from "./index-fixture.ts";

function unorderedRelationContexts() {
  const index = investigationIndexFixture([
    { id: "base" },
    { id: "other" },
    { id: "split-z", relations: [{ type: "拆分", target: "base" }] },
    { id: "split-a", relations: [{ type: "拆分", target: "base" }] },
    {
      id: "merged",
      relations: [
        { type: "归并", target: "split-a", summary: "拆分支线" },
        { type: "归并", target: "other", summary: "其他支线" }
      ]
    },
    { id: "after", relations: [{ type: "修正", target: "merged" }] }
  ]);
  const reversed = Object.entries(index.entries)
    .reverse()
    .map(
      ([id, state]) =>
        [id, { ...state, relations: [...state.relations].reverse() }] as const
    );
  return {
    forward: createInvestigationRelationContext(Object.entries(index.entries)),
    reversed: createInvestigationRelationContext(reversed)
  };
}

test("investigation unsorted graph projections preserve relation evidence ordering", () => {
  const contexts = unorderedRelationContexts();
  const expected = [
    { sourceId: "merged", type: "归并", target: "other", summary: "其他支线" },
    { sourceId: "merged", type: "归并", target: "split-a", summary: "拆分支线" }
  ];
  for (const context of Object.values(contexts)) {
    const selected = filterRelationsByEntry(context, { relationType: "归并" });
    assert.ok(selected.isOk());
    assert.deepEqual(selected.value?.get("merged"), expected);
  }
});

test("investigation unsorted graph projections preserve trace event and budget selection", () => {
  const { forward, reversed } = unorderedRelationContexts();
  const blocked = traceInvestigationRelations(reversed, "base", {
    direction: "successors",
    maxDepth: null,
    maxRecords: 2
  });
  assert.deepEqual(blocked.blockedEvent, {
    kind: "split",
    recordIds: ["base", "split-a", "split-z"],
    requiredMaxRecords: 3
  });
  for (const direction of ["both", "predecessors", "successors"] as const)
    for (const maxDepth of [0, 1, null])
      for (const maxRecords of [1, 2, 3, 4, 5, 6])
        for (const anchor of ["base", "split-a", "merged", "after"])
          assert.deepEqual(
            traceInvestigationRelations(reversed, anchor, {
              direction,
              maxDepth,
              maxRecords
            }),
            traceInvestigationRelations(forward, anchor, {
              direction,
              maxDepth,
              maxRecords
            })
          );
});

test("investigation unsorted graph projections preserve complete validation diagnostics", () => {
  const index = investigationIndexFixture([
    { id: "base", relations: [{ type: "补充", target: "next" }] },
    {
      id: "next",
      relations: [
        { type: "补充", target: "base" },
        { type: "复查", target: "base" },
        { type: "修正", target: "missing" }
      ]
    }
  ]);
  const forward = createInvestigationRelationContext(
    Object.entries(index.entries)
  );
  const reversed = createInvestigationRelationContext(
    Object.entries(index.entries)
      .reverse()
      .map(
        ([id, state]) =>
          [id, { ...state, relations: [...state.relations].reverse() }] as const
      )
  );
  const expected = [
    "investigation relations must not form a cycle: base -> next -> base",
    "next ordinary relation report must have exactly one 补充、复查、修正 or 推翻 predecessor",
    "next relation 修正 target does not exist: missing",
    "next relations must not repeat target base"
  ];
  assert.deepEqual(validateInvestigationRelationGraph(forward), expected);
  assert.deepEqual(validateInvestigationRelationGraph(reversed), expected);
});
