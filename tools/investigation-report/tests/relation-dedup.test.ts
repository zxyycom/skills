import assert from "node:assert/strict";
import { test } from "node:test";
import { filterRelationsByEntry } from "../src/query-search-selection.ts";
import { createInvestigationRelationContext } from "../src/relation-context.ts";
import type {
  InvestigationFilterRelation,
  InvestigationRelation
} from "../src/types.ts";
import { investigationIndexFixture } from "./index-fixture.ts";

function projectionContext(
  reports: readonly Readonly<{
    id: string;
    relations?: readonly InvestigationRelation[];
  }>[]
) {
  const index = investigationIndexFixture(reports.map(({ id }) => ({ id })));
  // 投影输入有意保留重复边与原始顺序；完整图合法性属于另一验证边界。
  return createInvestigationRelationContext(
    reports.map(({ id, relations = [] }) => {
      const state = index.entries[id];
      assert.ok(state !== undefined);
      return [id, { ...state, relations }] as const;
    })
  );
}

test("investigation type-only evidence deduplicates merge triples and keeps first summaries", () => {
  const targets = ["base-a", "base-b", "base-z"];
  const context = projectionContext([
    ...targets.map((id) => ({ id })),
    {
      id: "merged",
      relations: [
        ...targets.toReversed().flatMap((target) => [
          {
            type: "归并" as const,
            target,
            ...(target === "base-a" ? {} : { summary: `first ${target}` })
          },
          { type: "归并" as const, target, summary: `later ${target}` }
        ]),
        { type: "补充", target: "base-a", summary: "other type" }
      ]
    },
    {
      id: "second",
      relations: [
        { type: "归并", target: "base-a", summary: "other source" },
        { type: "归并", target: "base-a", summary: "later source" }
      ]
    }
  ]);
  const selected = filterRelationsByEntry(context, { relationType: "归并" });
  assert.ok(selected.isOk());
  assert.deepEqual(
    [...(selected.value ?? [])],
    [
      [
        "merged",
        targets.map((target) => ({
          sourceId: "merged",
          type: "归并",
          target,
          ...(target === "base-a" ? {} : { summary: `first ${target}` })
        }))
      ],
      [
        "second",
        [
          {
            sourceId: "second",
            type: "归并",
            target: "base-a",
            summary: "other source"
          }
        ]
      ]
    ]
  );
});

test("investigation neighbor evidence deduplicates triples across query directions", () => {
  const context = projectionContext([
    { id: "older" },
    {
      id: "center",
      relations: [
        { type: "补充", target: "older" },
        { type: "补充", target: "older", summary: "later ordinary" },
        { type: "归并", target: "older", summary: "first predecessor" },
        { type: "归并", target: "older", summary: "later predecessor" },
        { type: "归并", target: "center" },
        { type: "归并", target: "center", summary: "later self" },
        { type: "归并", target: "newer", summary: "outbound" }
      ]
    },
    {
      id: "newer",
      relations: [
        { type: "归并", target: "center", summary: "first successor" },
        { type: "归并", target: "center", summary: "later successor" },
        { type: "复查", target: "center", summary: "other successor type" }
      ]
    }
  ]);
  const predecessor: InvestigationFilterRelation = {
    sourceId: "center",
    type: "归并",
    target: "older",
    summary: "first predecessor"
  };
  const ordinary: InvestigationFilterRelation = {
    sourceId: "center",
    type: "补充",
    target: "older"
  };
  const self: InvestigationFilterRelation = {
    sourceId: "center",
    type: "归并",
    target: "center"
  };
  const outbound: InvestigationFilterRelation = {
    sourceId: "center",
    type: "归并",
    target: "newer",
    summary: "outbound"
  };
  const successor: InvestigationFilterRelation = {
    sourceId: "newer",
    type: "归并",
    target: "center",
    summary: "first successor"
  };
  const recheck: InvestigationFilterRelation = {
    sourceId: "newer",
    type: "复查",
    target: "center",
    summary: "other successor type"
  };
  const predecessors = [
    ["older", [predecessor, ordinary]],
    ["center", [self]],
    ["newer", [outbound]]
  ];
  const successors = [
    ["center", [self]],
    ["newer", [recheck, successor]]
  ];
  const both = [
    ["older", [predecessor, ordinary]],
    ["center", [self]],
    ["newer", [outbound, recheck, successor]]
  ];
  for (const [direction, expected] of [
    ["predecessors", predecessors],
    ["successors", successors],
    ["both", both]
  ] as const) {
    const selected = filterRelationsByEntry(context, {
      relatedTo: "center",
      direction
    });
    assert.ok(selected.isOk());
    assert.deepEqual([...(selected.value ?? [])], expected, direction);
  }
  const defaultDirection = filterRelationsByEntry(context, {
    relatedTo: "center"
  });
  assert.ok(defaultDirection.isOk());
  assert.deepEqual([...(defaultDirection.value ?? [])], both);
  const mergeOnly = filterRelationsByEntry(context, {
    relatedTo: "center",
    relationType: "归并"
  });
  assert.ok(mergeOnly.isOk());
  assert.deepEqual(
    [...(mergeOnly.value ?? [])],
    [
      ["older", [predecessor]],
      ["center", [self]],
      ["newer", [outbound, successor]]
    ]
  );
});

test("investigation relation evidence deduplication is isolated to each call", () => {
  const context = projectionContext([
    { id: "base" },
    {
      id: "next",
      relations: [
        { type: "归并", target: "base", summary: "original" },
        { type: "归并", target: "base", summary: "ignored" }
      ]
    }
  ]);
  const query = { relationType: "归并" as const };
  const first = filterRelationsByEntry(context, query);
  const repeated = filterRelationsByEntry(context, query);
  assert.ok(first.isOk());
  assert.ok(repeated.isOk());
  const expected = new Map([
    [
      "next",
      [
        {
          sourceId: "next",
          type: "归并",
          target: "base",
          summary: "original"
        }
      ]
    ]
  ]);
  assert.deepEqual(first.value, expected);
  assert.deepEqual(repeated.value, expected);
  assert.notStrictEqual(repeated.value, first.value);
  assert.notStrictEqual(repeated.value?.get("next"), first.value?.get("next"));
  const changed = filterRelationsByEntry(
    projectionContext([
      { id: "base" },
      {
        id: "next",
        relations: [{ type: "归并", target: "base", summary: "changed" }]
      }
    ]),
    query
  );
  assert.ok(changed.isOk());
  assert.deepEqual(changed.value?.get("next"), [
    { sourceId: "next", type: "归并", target: "base", summary: "changed" }
  ]);
  assert.deepEqual(first.value, expected);
});
