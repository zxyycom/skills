import assert from "node:assert/strict";
import { test } from "node:test";
import {
  investigationIndexFixture,
  queryIndexFixture,
  renderIndexFixture
} from "./index-fixture.ts";

test("list uses recent formedAt ordering with an ID tie-break and repeated tag filters use AND", () => {
  const index = investigationIndexFixture([
    {
      formedAt: "2026-08-28T13:00:00+00:00",
      id: "newest-report",
      tags: ["alpha", "shared"]
    },
    {
      formedAt: "2026-08-28T12:00:00+00:00",
      id: "zulu-report",
      tags: ["alpha", "shared"]
    },
    {
      formedAt: "2026-08-28T12:00:00+00:00",
      id: "alpha-report",
      tags: ["alpha", "shared"]
    },
    { id: "shared-report", tags: ["shared"] }
  ]);
  const result = queryIndexFixture(index, {
    tags: ["shared", "alpha"]
  });
  assert.deepEqual(
    result.entries.map((entry) => entry.id),
    ["newest-report", "alpha-report", "zulu-report"]
  );
});

test("list filters reports at an inclusive formedAt range", () => {
  const index = investigationIndexFixture([
    { formedAt: "2026-08-28T09:59:59+00:00", id: "before" },
    { formedAt: "2026-08-28T10:00:00+00:00", id: "start" },
    { formedAt: "2026-08-28T11:00:00+00:00", id: "end" },
    { formedAt: "2026-08-28T11:00:01+00:00", id: "after" }
  ]);
  const result = queryIndexFixture(index, {
    formedAtFrom: "2026-08-28T10:00:00+00:00",
    formedAtTo: "2026-08-28T11:00:00+00:00"
  });
  assert.deepEqual(
    result.entries.map((entry) => entry.id),
    ["end", "start"]
  );
});

test("list returns snapshot facets and renders bounded compact or detailed recent windows", () => {
  const index = investigationIndexFixture(
    Array.from({ length: 32 }, (_, index) => ({
      formedAt: new Date(Date.UTC(2024, index, 15, 12))
        .toISOString()
        .replace(".000Z", "+00:00"),
      id: `report-${String(index + 1).padStart(2, "0")}`,
      tags: ["shared", `topic-${String(index + 1).padStart(2, "0")}`],
      title: `报告 ${index + 1}`
    }))
  );
  const before = structuredClone(index);

  const queried = queryIndexFixture(index);
  assert.equal(queried.errors.length, 0);
  assert.equal(queried.total, 32);
  assert.equal(queried.limit, 10);
  assert.deepEqual(
    queried.entries.map((entry) => entry.id),
    Array.from(
      { length: 10 },
      (_, index) => `report-${String(32 - index).padStart(2, "0")}`
    )
  );
  assert.equal(queried.facets?.recordCount, 32);
  assert.equal(queried.facets?.tags.length, 33);
  assert.equal(queried.facets?.formedAt.months.length, 32);

  const compact = renderIndexFixture(queried);
  assert.match(compact, /^Index filters \(32 records\):/u);
  assert.match(compact, /tags: shared=32[\s\S]*topic-29=1; \+3 more tags/u);
  assert.doesNotMatch(compact, /topic-30=1/u);
  assert.match(compact, /months \(UTC\):[\s\S]*2025-11=1; \+22 more months/u);
  assert.doesNotMatch(compact, /2025-10=1/u);
  assert.equal(
    compact.split("\n").filter((line) => line.startsWith("- report-")).length,
    10
  );
  assert.doesNotMatch(compact, /^  title:/mu);
  assert.match(
    compact,
    /Showing 10 of 32 matches \(offset 0, limit 10\); 22 remaining; next offset 10\./u
  );

  const detailed = renderIndexFixture(
    queryIndexFixture(index, { limit: 1 }),
    true
  );
  assert.match(detailed, /topic-01=1/u);
  assert.match(detailed, /2026-01=1/u);
  assert.match(detailed, /Latest matches:\nreport-32 /u);
  assert.match(detailed, /^  title: 报告 32$/mu);
  assert.match(detailed, /^  question: 当前问题是什么？$/mu);

  const outOfRange = renderIndexFixture(
    queryIndexFixture(index, { offset: 99 })
  );
  assert.match(outOfRange, /^Index filters \(32 records\):/u);
  assert.match(outOfRange, /Latest matches:\n- none/u);
  assert.match(
    outOfRange,
    /Showing 0 of 32 matches \(offset 99, limit 10\); 0 remaining\./u
  );
  assert.deepEqual(index, before);
});

test("list filters reports by direct relation type", () => {
  const index = investigationIndexFixture([
    { id: "base" },
    {
      id: "supplement",
      relations: [{ target: "base", type: "补充" }]
    },
    { id: "independent" }
  ]);
  const result = queryIndexFixture(index, {
    relationType: "补充"
  });
  assert.deepEqual(
    result.entries.map((entry) => entry.id),
    ["supplement"]
  );
});

test("relation filters project full matching edges from the same query snapshot", () => {
  const index = investigationIndexFixture([
    { id: "base" },
    {
      id: "anchor",
      relations: [{ target: "base", type: "补充", summary: "anchor evidence" }]
    },
    {
      id: "successor",
      relations: [{ target: "anchor", type: "复查" }]
    }
  ]);
  const predecessors = queryIndexFixture(index, {
    direction: "predecessors",
    relatedTo: "anchor"
  });
  assert.deepEqual(predecessors.entries, [
    {
      id: "base",
      state: predecessors.entries[0]!.state,
      filterRelations: [
        {
          sourceId: "anchor",
          target: "base",
          type: "补充",
          summary: "anchor evidence"
        }
      ]
    }
  ]);
  const successor = queryIndexFixture(index, {
    direction: "successors",
    relatedTo: "anchor"
  });
  assert.deepEqual(successor.entries[0]?.filterRelations, [
    { sourceId: "successor", target: "anchor", type: "复查" }
  ]);
  const unfiltered = queryIndexFixture(index, {});
  assert.ok(
    unfiltered.entries.every((entry) => entry.filterRelations === undefined)
  );

  const compact = renderIndexFixture(
    queryIndexFixture(index, { relatedTo: "anchor" })
  );
  assert.match(
    compact,
    /relation-filter evidence:[\s\S]*anchor --补充--> base: "anchor evidence"/u
  );
});

test("relation-filter evidence preserves complete UTF-16 ordering and CLI preview budgets", () => {
  const index = investigationIndexFixture([
    { id: "alpha" },
    { id: "bravo" },
    { id: "charlie" },
    { id: "delta" },
    {
      id: "merged",
      relations: [
        { target: "delta", type: "归并", summary: "d" },
        { target: "bravo", type: "归并", summary: "b" },
        { target: "alpha", type: "归并", summary: "a" },
        { target: "charlie", type: "归并" }
      ]
    }
  ]);
  const queried = queryIndexFixture(index, {
    relationType: "归并"
  });
  assert.deepEqual(queried.entries[0]?.filterRelations, [
    { sourceId: "merged", target: "alpha", type: "归并", summary: "a" },
    { sourceId: "merged", target: "bravo", type: "归并", summary: "b" },
    { sourceId: "merged", target: "charlie", type: "归并" },
    { sourceId: "merged", target: "delta", type: "归并", summary: "d" }
  ]);
  const compact = renderIndexFixture(queried);
  assert.match(compact, /merged --归并--> alpha: "a"/u);
  assert.match(compact, /merged --归并--> bravo: "b"/u);
  assert.match(compact, /merged --归并--> charlie: \[无摘要\]/u);
  assert.match(compact, /\+1 more matching relations/u);
  assert.doesNotMatch(compact, /merged --归并--> delta/u);
  const detailed = renderIndexFixture(queried, true);
  assert.match(detailed, /merged --归并--> delta: "d"/u);
});
