import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  investigationIndexFixture,
  searchIndexFixture
} from "./index/index-fixture.ts";
import { searchInvestigationReports } from "../../src/query/query.ts";
import { investigationRoot, withTempRoot } from "../support/fixture-support.ts";

import { writeCollection } from "../support/collection-support.ts";

test("investigation metadata search counts all matches and marks only returned-result limits", async () => {
  const index = investigationIndexFixture([{ id: "one" }, { id: "two" }]);
  const result = searchIndexFixture(index, {
    query: "当前",
    in: "metadata",
    limit: 1
  });
  assert.equal(result.status, "ok");
  assert.ok(result.searchInfo !== null);
  assert.deepEqual(result.searchInfo.counts, {
    matched: { value: 2, precision: "exact" },
    returned: 1
  });
  assert.deepEqual(result.searchInfo.coverage, {
    scanComplete: true,
    resultsComplete: false,
    previewsComplete: null,
    reasons: ["max-records"]
  });
  assert.deepEqual(result.truncation, {
    files: true,
    matches: false,
    previewCharacters: false
  });
  assert.deepEqual(result.warnings, ["search results limited: max-records"]);
  const exactBudget = searchIndexFixture(index, {
    query: "当前",
    in: "metadata",
    limit: 2
  });
  assert.ok(exactBudget.searchInfo !== null);
  assert.equal(exactBudget.searchInfo.coverage.resultsComplete, true);
  assert.deepEqual(exactBudget.warnings, []);
});

test("investigation search echoes validated UTC times tags and full resolved relation target", async () => {
  const index = investigationIndexFixture([
    { id: "260828-base" },
    {
      id: "next",
      relations: [{ type: "补充", target: "260828-base" }],
      tags: ["alpha"]
    }
  ]);
  const result = searchIndexFixture(index, {
    query: " 当前 ",
    in: "metadata",
    tags: [" alpha ", "alpha"],
    relatedTo: "base.MD",
    relationType: "补充",
    formedAtFrom: "2026-08-28T13:00:00+01:00",
    formedAtTo: "2026-08-28T12:00:00Z"
  });
  assert.ok(result.status === "ok");
  assert.deepEqual(result.searchInfo.query.filters, {
    tags: ["alpha"],
    formedAtFrom: "2026-08-28T12:00:00.000Z",
    formedAtTo: "2026-08-28T12:00:00.000Z",
    relationType: "补充",
    relatedTo: "260828-base",
    direction: "both"
  });
  assert.equal(result.searchInfo.query.text, "当前");
  assert.deepEqual(
    result.entries.map((entry) => entry.id),
    ["next"]
  );
});

test("investigation search complete zero hits separates content previews from metadata", async () => {
  await withTempRoot("search-info-empty", async (root) => {
    await writeCollection(root, [{ id: "one" }]);
    for (const scope of ["metadata", "content"] as const) {
      const result = await searchInvestigationReports({
        workspaceRoot: root,
        query: "absent",
        in: scope
      });
      assert.ok(result.status === "ok");
      assert.deepEqual(result.searchInfo.counts, {
        matched: { value: 0, precision: "exact" },
        returned: 0
      });
      assert.deepEqual(result.searchInfo.coverage, {
        scanComplete: true,
        resultsComplete: true,
        previewsComplete: scope === "metadata" ? null : true,
        reasons: []
      });
      assert.equal(result.searchInfo.query.limits.maxRecords, 50);
      assert.deepEqual(result.searchInfo.source, {
        kind:
          scope === "metadata"
            ? "published-index"
            : "published-index+current-text",
        currentness: "unchecked",
        fallback: false
      });
    }
  });
});

test("investigation content rejects absent published indexes without implicit recovery", async () => {
  await withTempRoot("search-info-fallback", async (root) => {
    await writeCollection(root, [{ id: "one" }], false);
    const result = await searchInvestigationReports({
      workspaceRoot: root,
      query: "当前"
    });
    assert.equal(result.status, "error");
    assert.equal(result.searchInfo, null);
    await assert.rejects(
      fs.access(path.join(investigationRoot(root), "investigation-index.json"))
    );
    const metadata = await searchInvestigationReports({
      workspaceRoot: root,
      query: "当前",
      in: "metadata"
    });
    assert.equal(metadata.status, "error");
    assert.equal(metadata.searchInfo, null);
  });
});

test("investigation content reports lower bounds and exact last-file overflow independently from previews", async () => {
  await withTempRoot("search-info-overflow", async (root) => {
    await writeCollection(root, [{ id: "a" }, { id: "b" }, { id: "c" }]);
    const lower = await searchInvestigationReports({
      workspaceRoot: root,
      query: "当前",
      limit: 1
    });
    assert.ok(lower.status === "ok");
    assert.deepEqual(lower.searchInfo.counts, {
      matched: { value: 2, precision: "lower-bound" },
      returned: 1
    });
    assert.deepEqual(lower.searchInfo.coverage, {
      scanComplete: false,
      resultsComplete: false,
      previewsComplete: true,
      reasons: ["max-records"]
    });
    const last = await searchInvestigationReports({
      workspaceRoot: root,
      query: "当前",
      limit: 2
    });
    assert.ok(last.status === "ok");
    assert.deepEqual(last.searchInfo.counts, {
      matched: { value: 3, precision: "exact" },
      returned: 2
    });
    assert.equal(last.searchInfo.coverage.scanComplete, true);
    assert.deepEqual(last.warnings, ["search results limited: max-records"]);
  });
});

test("investigation content retains empty-preview hits and classifies preview restrictions once", async () => {
  await withTempRoot("search-info-previews", async (root) => {
    await writeCollection(root, [{ id: "a" }, { id: "b" }]);
    for (const id of ["a", "b"])
      await fs.appendFile(
        path.join(investigationRoot(root), `${id}.md`),
        `\nneedle needle needle needle ${"x".repeat(25_000)}\n`
      );
    const result = await searchInvestigationReports({
      workspaceRoot: root,
      query: "needle"
    });
    assert.ok(result.status === "ok");
    assert.equal(result.entries.length, 2);
    assert.ok(
      result.entries[1] !== undefined && "previews" in result.entries[1]
    );
    assert.deepEqual(result.entries[1].previews, []);
    assert.deepEqual(result.searchInfo.counts, {
      matched: { value: 2, precision: "exact" },
      returned: 2
    });
    assert.deepEqual(result.searchInfo.coverage, {
      scanComplete: true,
      resultsComplete: true,
      previewsComplete: false,
      reasons: ["match-previews", "preview-characters"]
    });
    assert.equal(
      result.warnings.filter((warning) =>
        warning.startsWith("search previews limited:")
      ).length,
      1
    );
    assert.equal(
      result.searchInfo.query.limits.resources?.maxCandidateFiles,
      2_000
    );
  });
});

test("investigation content search checks nonmatching identity without validating current report semantics", async () => {
  await withTempRoot("search-current-identity", async (root) => {
    await writeCollection(root, [{ id: "one" }]);
    const source = path.join(investigationRoot(root), "one.md");
    const original = await fs.readFile(source, "utf8");
    await fs.writeFile(source, original.replace("question:", "unknownField:"));
    const valid = await searchInvestigationReports({
      workspaceRoot: root,
      query: "absent-unique-term"
    });
    assert.equal(valid.status, "ok");
    await fs.writeFile(
      source,
      original.replace('id: "one"', 'id: "changed-identity"')
    );
    const invalid = await searchInvestigationReports({
      workspaceRoot: root,
      query: "absent-unique-term"
    });
    assert.equal(invalid.status, "error");
    assert.match(JSON.stringify(invalid), /identity does not match/);
  });
});

test("metadata all matching preserves cross-field evidence without ranges", () => {
  const index = investigationIndexFixture([
    {
      id: "one",
      title: "alpha title",
      question: "beta question",
      tags: ["other"]
    },
    { id: "two", title: "alpha title", question: "unrelated", tags: ["other"] }
  ]);
  const result = searchIndexFixture(index, {
    query: "alpha beta",
    in: "metadata",
    match: "all"
  });
  assert.equal(result.status, "ok");
  assert.deepEqual(
    result.entries.map((entry) => entry.id),
    ["one"]
  );
  const entry = result.entries[0];
  assert.ok(entry !== undefined && "matchedFields" in entry);
  assert.deepEqual(entry.matchedFields, ["title", "question"]);
});

test("Investigation metadata counts and projects fields without constructing grapheme ranges", () => {
  const index = investigationIndexFixture(
    Array.from({ length: 100 }, (_, i) => ({
      id: `report-${i}`,
      title: "needle title"
    }))
  );
  const original = Reflect.get(
    Intl.Segmenter.prototype,
    "segment"
  ) as typeof Intl.Segmenter.prototype.segment;
  let calls = 0;
  Intl.Segmenter.prototype.segment = function (...args) {
    calls += 1;
    return original.apply(this, args);
  };
  try {
    const result = searchIndexFixture(index, {
      query: "needle",
      in: "metadata"
    });
    assert.equal(result.status, "ok");
    assert.deepEqual(result.searchInfo.counts.matched, {
      value: 100,
      precision: "exact"
    });
    const entry = result.entries[0];
    assert.ok(entry !== undefined && "matchedFields" in entry);
    assert.deepEqual(entry.matchedFields, ["title"]);
    assert.equal(calls, 0);
  } finally {
    Intl.Segmenter.prototype.segment = original;
  }
});
