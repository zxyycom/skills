import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDecisionListFacets } from "../src/list-facets.ts";
import type {
  DecisionAlignment,
  DecisionTag,
  EstablishedDecisionStatus
} from "../src/types.ts";

type FacetEntry = Readonly<{
  state: Readonly<{
    alignment: DecisionAlignment;
    createdAt: string;
    status: EstablishedDecisionStatus;
    tags: readonly DecisionTag[];
  }>;
}>;

test("decision list facets are deterministic across empty and UTC-boundary snapshots", () => {
  assert.deepEqual(buildDecisionListFacets([]), {
    alignments: { aligned: 0, unaligned: 0 },
    createdAt: { earliest: null, latest: null, months: [] },
    recordCount: 0,
    statuses: { active: 0, archived: 0 },
    tags: []
  });

  const boundaryEntries: FacetEntry[] = [
    entry({
      alignment: "aligned",
      createdAt: "2026-01-31T23:30:00-01:00",
      status: "active",
      tags: [tag("alpha"), tag("shared"), tag("shared")]
    }),
    entry({
      alignment: "unaligned",
      createdAt: "2026-02-01T00:30:00Z",
      status: "active",
      tags: [tag("shared")]
    }),
    entry({
      alignment: "unaligned",
      createdAt: "2026-03-01T00:00:00+00:00",
      status: "archived",
      tags: [tag("omega")]
    })
  ];
  const expected = {
    alignments: { aligned: 1, unaligned: 2 },
    createdAt: {
      earliest: "2026-02-01T00:30:00.000Z",
      latest: "2026-03-01T00:00:00.000Z",
      months: [
        { count: 2, month: "2026-02" },
        { count: 1, month: "2026-03" }
      ]
    },
    recordCount: 3,
    statuses: { active: 2, archived: 1 },
    tags: [
      { count: 1, tag: "alpha" },
      { count: 1, tag: "omega" },
      { count: 2, tag: "shared" }
    ]
  };
  assert.deepEqual(buildDecisionListFacets(boundaryEntries), expected);
  assert.deepEqual(buildDecisionListFacets(boundaryEntries), expected);
});

function entry(state: FacetEntry["state"]): FacetEntry {
  return { state };
}

function tag(value: string): DecisionTag {
  return value as DecisionTag;
}
