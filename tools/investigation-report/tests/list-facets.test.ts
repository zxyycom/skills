import assert from "node:assert/strict";
import { test } from "node:test";
import { buildInvestigationListFacets } from "../src/list-facets.ts";

type FacetEntry = Readonly<{
  state: Readonly<{
    formedAt: string;
    tags: readonly string[];
  }>;
}>;

test("investigation list facets are deterministic across empty, UTC-boundary, and ten-thousand-entry snapshots", () => {
  assert.deepEqual(buildInvestigationListFacets([]), {
    formedAt: { earliest: null, latest: null, months: [] },
    recordCount: 0,
    tags: []
  });

  const boundaryEntries: FacetEntry[] = [
    entry("2026-01-31T23:30:00-01:00", ["alpha", "shared", "shared"]),
    entry("2026-02-01T00:30:00Z", ["shared"]),
    entry("2026-03-01T00:00:00+00:00", ["omega"])
  ];
  const expected = {
    formedAt: {
      earliest: "2026-02-01T00:30:00.000Z",
      latest: "2026-03-01T00:00:00.000Z",
      months: [
        { count: 2, month: "2026-02" },
        { count: 1, month: "2026-03" }
      ]
    },
    recordCount: 3,
    tags: [
      { count: 1, tag: "alpha" },
      { count: 1, tag: "omega" },
      { count: 2, tag: "shared" }
    ]
  };
  assert.deepEqual(buildInvestigationListFacets(boundaryEntries), expected);
  assert.deepEqual(buildInvestigationListFacets(boundaryEntries), expected);

  const large = buildInvestigationListFacets(
    Array.from({ length: 10_000 }, () =>
      entry("2026-09-08T00:00:00Z", ["scale"])
    )
  );
  assert.equal(large.recordCount, 10_000);
  assert.deepEqual(large.tags, [{ count: 10_000, tag: "scale" }]);
  assert.deepEqual(large.formedAt.months, [
    { count: 10_000, month: "2026-09" }
  ]);
});

function entry(formedAt: string, tags: readonly string[]): FacetEntry {
  return { state: { formedAt, tags } };
}
