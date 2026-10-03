import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { executeDecisionSearch } from "../src/decision-query-search.ts";
import type { DecisionQueryRequest } from "../src/decision-query-contract.ts";
import {
  archivedDecisionId,
  currentDecisionId,
  currentSourcePath,
  candidateDecisionBody,
  decisionFilePath,
  runBundledCli,
  runSuccessfulSourceCli,
  withFixtureWorkspace,
  withTemporaryWorkspace,
  writeDecision
} from "./support.ts";

function searchRequest(
  workspaceRoot: string,
  overrides: Partial<Extract<DecisionQueryRequest, { command: "search" }>> = {}
): Extract<DecisionQueryRequest, { command: "search" }> {
  return {
    alignment: "all",
    command: "search",
    location: { decisionsDir: "docs/decisions", workspaceRoot },
    match: "all",
    status: "active",
    tags: [],
    text: "索引",
    ...overrides
  };
}

async function writeRecords(root: string, count: number, body = "needle") {
  for (let index = 0; index < count; index += 1) {
    const id = `record-${String(index).padStart(2, "0")}`;
    await writeDecision(
      root,
      id,
      candidateDecisionBody({ id })
        .replace("status: candidate", "status: active")
        .replace("alignment: null", "alignment: aligned")
        .replace("createdAt: null", "createdAt: 2026-08-15T00:00:00Z") +
        `\n- ${body}\n`
    );
  }
  await runSuccessfulSourceCli(["sync-index", "--root", root]);
}

test("decision search metadata returns exact counts applied defaults and resolved relation filters", async () => {
  await withFixtureWorkspace("search-info-filters", async (root) => {
    const result = await executeDecisionSearch(
      searchRequest(root, {
        in: "metadata",
        status: "all",
        relatedTo: "use-generated-cli.MD",
        direction: "predecessors",
        text: "use-source-cli"
      })
    );
    assert.ok(result.status === "ok" && result.command === "search");
    assert.deepEqual(result.searchInfo.query.filters, {
      status: "all",
      alignment: "all",
      tags: [],
      relatedTo: currentDecisionId,
      direction: "predecessors"
    });
    assert.deepEqual(
      result.records.map((record) => record.decisionId),
      [archivedDecisionId]
    );
    assert.deepEqual(result.searchInfo.source, {
      kind: "published-index",
      currentness: "current",
      fallback: false
    });
    assert.deepEqual(result.searchInfo.counts, {
      matched: { value: 1, precision: "exact" },
      returned: 1
    });
    assert.deepEqual(result.searchInfo.query.limits, {
      maxRecords: null,
      resources: null,
      preview: null
    });
  });
});

test("decision search complete zero hits distinguishes content and metadata preview applicability", async () => {
  await withFixtureWorkspace("search-info-empty", async (root) => {
    for (const scope of ["content", "metadata"] as const) {
      const result = await executeDecisionSearch(
        searchRequest(root, { in: scope, text: "absent-unique-term" })
      );
      assert.ok(result.status === "ok" && result.command === "search");
      assert.deepEqual(result.searchInfo.counts, {
        matched: { value: 0, precision: "exact" },
        returned: 0
      });
      assert.deepEqual(result.searchInfo.coverage, {
        scanComplete: true,
        resultsComplete: true,
        previewsComplete: scope === "content" ? true : null,
        reasons: []
      });
    }
  });
});

test("decision search metadata distinguishes stale and unchecked source snapshots", async () => {
  await withFixtureWorkspace("search-info-currentness", async (root) => {
    const file = decisionFilePath(root, currentSourcePath);
    await fs.appendFile(file, "\n- changed content\n");
    const stale = await executeDecisionSearch(
      searchRequest(root, { in: "metadata" })
    );
    assert.ok(stale.status === "ok" && stale.command === "search");
    assert.equal(stale.searchInfo.source.currentness, "stale");
    assert.match(stale.warnings[0]!, /^search source: stale published-index/);
    const text = await fs.readFile(file, "utf8");
    const outside = path.join(root, "outside.md");
    await fs.writeFile(outside, text);
    await fs.rm(file);
    await fs.symlink(outside, file);
    const unchecked = await executeDecisionSearch(
      searchRequest(root, { in: "metadata" })
    );
    assert.ok(unchecked.status === "ok" && unchecked.command === "search");
    assert.equal(unchecked.searchInfo.source.currentness, "unchecked");
    assert.match(
      unchecked.warnings[0]!,
      /^search source: unchecked published-index/
    );
    assert.deepEqual(unchecked.searchInfo.counts, stale.searchInfo.counts);
  });
});

test("decision search validated fallback remains read only and required source failure stays a failure", async () => {
  await withFixtureWorkspace("search-info-fallback", async (root) => {
    const index = path.join(root, "docs/decisions/decision-index.json");
    await fs.rm(index);
    const result = await executeDecisionSearch(searchRequest(root));
    assert.ok(result.status === "ok" && result.command === "search");
    assert.deepEqual(result.searchInfo.source, {
      kind: "validated-source",
      currentness: "current",
      fallback: true
    });
    await assert.rejects(fs.access(index));
    await fs.writeFile(
      decisionFilePath(root, currentSourcePath),
      "invalid formal source"
    );
    const failure = await executeDecisionSearch(searchRequest(root));
    assert.equal(failure.status, "error");
    assert.equal("searchInfo" in failure, false);
  });
});

test("decision search distinguishes first hidden match early stop and exact final-file counts", async () => {
  await withTemporaryWorkspace("search-info-record-limit", async (root) => {
    await writeRecords(root, 22);
    const lower = await executeDecisionSearch(
      searchRequest(root, { text: "needle" })
    );
    assert.ok(lower.status === "ok" && lower.command === "search");
    assert.deepEqual(lower.searchInfo.counts, {
      matched: { value: 21, precision: "lower-bound" },
      returned: 20
    });
    assert.deepEqual(lower.searchInfo.coverage, {
      scanComplete: false,
      resultsComplete: false,
      previewsComplete: true,
      reasons: ["max-records"]
    });
    assert.deepEqual(lower.warnings, ["search results limited: max-records"]);
    await fs.rm(decisionFilePath(root, "record-21"));
    await runSuccessfulSourceCli(["sync-index", "--root", root]);
    const exact = await executeDecisionSearch(
      searchRequest(root, { text: "needle" })
    );
    assert.ok(exact.status === "ok" && exact.command === "search");
    assert.deepEqual(exact.searchInfo.counts, {
      matched: { value: 21, precision: "exact" },
      returned: 20
    });
    assert.equal(exact.searchInfo.coverage.scanComplete, true);
  });
});

test("decision search returns empty-preview record identities after the fixed character budget", async () => {
  await withTemporaryWorkspace("search-info-preview-limit", async (root) => {
    await writeRecords(root, 2, `needle ${"x".repeat(13_000)}`);
    const result = await executeDecisionSearch(
      searchRequest(root, { text: "needle" })
    );
    assert.ok(
      result.status === "ok" &&
        result.command === "search" &&
        result.in === "content"
    );
    assert.equal(result.records.length, 2);
    assert.deepEqual(result.records[1]?.previews, []);
    assert.deepEqual(result.searchInfo.counts, {
      matched: { value: 2, precision: "exact" },
      returned: 2
    });
    assert.deepEqual(result.searchInfo.coverage, {
      scanComplete: true,
      resultsComplete: true,
      previewsComplete: false,
      reasons: ["preview-characters"]
    });
    assert.deepEqual(result.warnings, [
      "search previews limited: preview-characters"
    ]);
    assert.equal(
      result.searchInfo.query.limits.preview?.maxPreviewCharacters,
      12_000
    );
  });
});

test("distributed decision search prints six escaped summary lines before zero-hit and record output", async () => {
  await withFixtureWorkspace("search-info-cli", async (root) => {
    const output = await runBundledCli([
      "search",
      'absent"term',
      "--in",
      "metadata",
      "--root",
      root
    ]);
    assert.equal(output.exitCode, 0, output.stderr);
    assert.equal(output.stderr, "");
    assert.deepEqual(output.stdout.split("\n").slice(0, 6), [
      'Query: text="absent\\"term" in=metadata match=all',
      'Filters: {"status":"active","alignment":"all","tags":[]}',
      "Source: kind=published-index currentness=current fallback=false",
      "Limits: maxRecords=unlimited",
      "Counts: matched=0 precision=exact returned=0",
      "Coverage: scan=complete results=complete previews=n/a reasons=none"
    ]);
    assert.match(output.stdout, /Decision search results:\n- none/);
  });
});

test("distributed decision preview warnings do not diagnose a current source as needing repair", async () => {
  await withTemporaryWorkspace("search-info-preview-warning", async (root) => {
    await writeRecords(root, 1, "needle needle needle needle");
    const result = await runBundledCli(["search", "needle", "--root", root]);
    assert.equal(result.exitCode, 0, result.stderr);
    assert.match(
      result.stdout,
      /Source: kind=validated-source currentness=current fallback=false/
    );
    assert.match(
      result.stdout,
      /Coverage: scan=complete results=complete previews=limited reasons=match-previews/
    );
    assert.equal(
      result.stderr,
      "[decision-records.query-warning] search previews limited: match-previews\n"
    );
    assert.doesNotMatch(
      result.stderr,
      /source problem|Decision query source|sync-index|Correct the reported/
    );
  });
});
