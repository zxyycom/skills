import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { searchInvestigationReports } from "../src/query.ts";
import {
  investigationRoot,
  reportMarkdown,
  runGeneratedInvestigationCliSmoke,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";

test("investigation metadata search counts all matches and marks only returned-result limits", async () => {
  await withTempRoot("search-info-metadata", async (root) => {
    await writeCollection(root, [{ id: "one" }, { id: "two" }]);
    const result = await searchInvestigationReports({
      workspaceRoot: root,
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
    const exactBudget = await searchInvestigationReports({
      workspaceRoot: root,
      query: "当前",
      in: "metadata",
      limit: 2
    });
    assert.ok(exactBudget.searchInfo !== null);
    assert.equal(exactBudget.searchInfo.coverage.resultsComplete, true);
    assert.deepEqual(exactBudget.warnings, []);
  });
});

test("investigation search echoes validated UTC times tags and full resolved relation target", async () => {
  await withTempRoot("search-info-filters", async (root) => {
    await writeCollection(root, [
      { id: "260828-base" },
      {
        id: "next",
        relations: [{ type: "补充", target: "260828-base" }],
        tags: ["alpha"]
      }
    ]);
    const result = await searchInvestigationReports({
      workspaceRoot: root,
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
        kind: scope === "metadata" ? "published-index" : "validated-source",
        currentness: scope === "metadata" ? "unchecked" : "current",
        fallback: false
      });
    }
  });
});

test("investigation metadata search always reports an unchecked published snapshot without source warnings", async () => {
  await withTempRoot("search-info-currentness", async (root) => {
    await writeCollection(root, [{ id: "one" }]);
    const file = path.join(investigationRoot(root), "one.md");
    await fs.appendFile(file, "\nchanged source\n");
    const stale = await searchInvestigationReports({
      workspaceRoot: root,
      query: "当前",
      in: "metadata"
    });
    assert.ok(stale.status === "ok");
    assert.equal(stale.searchInfo.source.currentness, "unchecked");
    assert.deepEqual(stale.warnings, []);
    await fs.rm(file);
    const outside = path.join(root, "outside.md");
    await fs.writeFile(outside, reportMarkdown({ id: "one" }));
    await fs.symlink(outside, file);
    const unchecked = await searchInvestigationReports({
      workspaceRoot: root,
      query: "当前",
      in: "metadata"
    });
    assert.ok(unchecked.status === "ok");
    assert.equal(unchecked.searchInfo.source.currentness, "unchecked");
    assert.deepEqual(unchecked.searchInfo.counts, stale.searchInfo.counts);
    assert.deepEqual(unchecked.warnings, []);
    const content = await searchInvestigationReports({
      workspaceRoot: root,
      query: "当前"
    });
    assert.equal(content.status, "error");
    assert.equal(content.searchInfo, null);
  });
});

test("investigation content validates fallback without writing an absent published index", async () => {
  await withTempRoot("search-info-fallback", async (root) => {
    await writeCollection(root, [{ id: "one" }], false);
    const result = await searchInvestigationReports({
      workspaceRoot: root,
      query: "当前"
    });
    assert.ok(result.status === "ok");
    assert.deepEqual(result.searchInfo.source, {
      kind: "validated-source",
      currentness: "current",
      fallback: true
    });
    assert.match(
      result.warnings[0]!,
      /^search source: validated-source fallback/
    );
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
    await writeCollection(root, [{ id: "a" }, { id: "b" }], false);
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

test("distributed investigation search prints exact metadata and lower-bound content summaries on proper channels", async () => {
  await withTempRoot("search-info-cli", async (root) => {
    await writeCollection(root, [{ id: "a" }, { id: "b" }, { id: "c" }]);
    const metadata = runGeneratedInvestigationCliSmoke(root, [
      "search",
      "当前",
      "--in",
      "metadata",
      "--limit",
      "1"
    ]);
    assert.equal(metadata.status, 0, metadata.stderr);
    assert.deepEqual(metadata.stdout.split("\n").slice(0, 6), [
      'Query: text="当前" in=metadata match=all',
      'Filters: {"tags":[]}',
      "Source: kind=published-index currentness=unchecked fallback=false",
      "Limits: maxRecords=1",
      "Counts: matched=3 precision=exact returned=1",
      "Coverage: scan=complete results=limited previews=n/a reasons=max-records"
    ]);
    assert.match(metadata.stderr, /search results limited: max-records/);
    assert.doesNotMatch(
      metadata.stderr,
      /search previews limited|sync-index|resolve the warning|source problem/
    );
    const content = runGeneratedInvestigationCliSmoke(root, [
      "search",
      "当前",
      "--limit",
      "1"
    ]);
    assert.equal(content.status, 0, content.stderr);
    assert.match(
      content.stdout,
      /Counts: matched>=2 precision=lower-bound returned=1/
    );
    assert.match(
      content.stdout,
      /Coverage: scan=limited results=limited previews=complete reasons=max-records/
    );
    const zero = runGeneratedInvestigationCliSmoke(root, ["search", "absent"]);
    assert.equal(zero.status, 0, zero.stderr);
    assert.match(zero.stdout, /Counts: matched=0 precision=exact returned=0/);
    assert.match(
      zero.stdout,
      /Coverage: scan=complete results=complete previews=complete reasons=none\nNo investigation reports matched/
    );
  });
});
