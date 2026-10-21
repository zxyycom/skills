import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { argumentsForWorker, measure, type Summary } from "./measurement.ts";
import {
  executeDecisionQuery,
  type DecisionLocation,
  type DecisionQueryRequest,
  type DecisionQueryResult
} from "./source/tools/decision-records/src/decision-query-service.ts";
import {
  loadDecisionIndex,
  parseDecisionIndex,
  readDecisionSourceRevision
} from "./source/tools/decision-records/src/decision-state-index.ts";
import {
  loadDecisionIndexSnapshot,
  type DecisionIndexSnapshot
} from "./source/tools/decision-records/src/decision-index-snapshot.ts";
import {
  prepareDecisionListRequest,
  projectDecisionList
} from "./source/tools/decision-records/src/decision-query-list.ts";
import { indexedRecords } from "./source/tools/decision-records/src/decision-query-records.ts";
import {
  createDecisionRelationGraphProvider,
  decisionRelationConsistencyIssues
} from "./source/tools/decision-records/src/relation-graph.ts";
import {
  isDecisionId,
  isDecisionTag
} from "./source/tools/decision-records/src/decision-path.ts";
import { validateDecisionBody } from "./source/tools/decision-records/src/record.ts";

// Formation-time investigation attachment, not a repository maintenance tool.
// Each invocation measures one operation. Fixture setup is outside measure().
const { operation, root, size } = argumentsForWorker();
const operations = [
  "prepare",
  "list",
  "list-page",
  "list-tag",
  "list-related",
  "list-type",
  "show-id",
  "show-name",
  "trace",
  "metadata-rare",
  "metadata-common",
  "metadata-zero",
  "content-unfiltered-cap",
  "content-tag",
  "content-related",
  "check-full",
  "sync-preflight",
  "sync-write",
  "candidates",
  "micro-index-read",
  "micro-json-parse",
  "micro-parse-index",
  "micro-load-index",
  "micro-source-revision",
  "micro-markdown-parse",
  "micro-list-projection",
  "micro-relation-build",
  "micro-relation-validate"
];
assert.ok(
  operations.includes(operation),
  "unknown Decision worker operation: " + operation
);
assert.equal(size % 10, 0, "the fixture requires complete groups of ten");
const datasetParent = path.join(import.meta.dirname, "datasets");
assert.ok(
  root.startsWith(datasetParent + path.sep),
  "only isolated fixture roots may be accessed"
);
const decisionsDir = "docs/decisions";
const directory = path.join(root, decisionsDir);
const indexPath = path.join(directory, "decision-index.json");
const location: DecisionLocation = { decisionsDir, workspaceRoot: root };
const activeCount = size * 0.9;
const archivedCount = size / 10;
const markerPath = path.join(root, ".decision-fixture.json");
const fixtureIdentity = {
  domain: "decision",
  version: 1,
  size,
  source: "5c95358b"
};
const padding =
  "workload evidence retains stable boundaries and independent rationale. ".repeat(
    13
  );

function idFor(index: number) {
  const id = "261020-record-" + String(index).padStart(6, "0");
  assert.ok(isDecisionId(id));
  return id;
}
function tagFor(index: number) {
  const tag = "topic-" + String(Math.floor(index / 10) % 10).padStart(2, "0");
  assert.ok(isDecisionTag(tag));
  return tag;
}
function sourcePathFor(index: number): string {
  return (index % 10 === 0 ? "archive/" : "") + idFor(index) + ".md";
}
function markdownFor(index: number): string {
  const archived = index % 10 === 0;
  const needle = index % 1000 === 1 ? " needle" : "";
  return [
    "---",
    "title: record " + String(index).padStart(6, "0") + needle,
    "id: " + idFor(index),
    "status: " + (archived ? "archived" : "active"),
    "alignment: aligned",
    "createdAt: 2026-10-20T00:00:00Z",
    "purpose: preserve stable direction",
    "background: bounded workload evidence",
    "decision: maintain explicit boundary",
    "tags:",
    "  - " + tagFor(index),
    ...(archived
      ? ["relations: []"]
      : [
          "relations:",
          "  - type: 修订",
          "    target: " + idFor(Math.floor(index / 10) * 10),
          "    summary: refine prior direction"
        ]),
    "---",
    "",
    "## 目的",
    "- Preserve independent rationale for this workload.",
    "",
    "## 背景",
    "- " + padding,
    "",
    "## 决策",
    "- 采用: maintain explicit ownership and bounded implementation.",
    ""
  ].join("\n");
}
function okResult(result: DecisionQueryResult) {
  assert.ok(
    result.status === "ok",
    result.status === "error"
      ? JSON.stringify(result.diagnostics)
      : "query failed"
  );
  return result;
}
async function query(request: DecisionQueryRequest) {
  return okResult(await executeDecisionQuery(request));
}
function listRequest(): Extract<DecisionQueryRequest, { command: "list" }> {
  return {
    command: "list",
    location,
    status: "active",
    alignment: "all",
    tags: [],
    limit: 20,
    offset: 0
  };
}
function searchRequest(): Extract<DecisionQueryRequest, { command: "search" }> {
  return {
    command: "search",
    location,
    status: "active",
    alignment: "all",
    tags: [],
    match: "all",
    text: "record",
    in: "metadata"
  };
}
function tagActiveCount(): number {
  return Math.ceil(size / 100) * 9;
}

async function snapshot(): Promise<DecisionIndexSnapshot> {
  const loaded = await loadDecisionIndexSnapshot({
    decisionsDirectory: directory
  });
  assert.ok(loaded.status === "ok", JSON.stringify(loaded.diagnostics));
  assert.equal(loaded.value.entries.length, size);
  return loaded.value;
}
async function prepare(): Promise<void> {
  await fs.mkdir(root, { recursive: false });
  await fs.mkdir(path.join(directory, "archive"), { recursive: true });
  for (let start = 0; start < size; start += 32) {
    const batch = Array.from(
      { length: Math.min(32, size - start) },
      (_, offset) => start + offset
    );
    await Promise.all(
      batch.map(async (index) => {
        await fs.writeFile(
          path.join(directory, sourcePathFor(index)),
          markdownFor(index),
          { flag: "wx" }
        );
      })
    );
  }
  const sync = await query({
    command: "sync-index",
    location,
    preflight: false
  });
  assert.ok(sync.command === "sync-index");
  assert.equal(sync.state, "written");
  const loaded = await snapshot();
  assert.equal(loaded.getRelationGraph().edges.length, activeCount);
  const checked = await query({ command: "check", location });
  assert.ok(checked.command === "check");
  assert.equal(checked.summary.decisionCount, size);
  assert.equal(checked.summary.activeCount, activeCount);
  assert.equal(checked.summary.archivedCount, archivedCount);
  await fs.writeFile(markerPath, JSON.stringify(fixtureIdentity) + "\n", {
    flag: "wx"
  });
  process.stdout.write(
    JSON.stringify({
      domain: "decision",
      operation: "prepare",
      size,
      status: "ok",
      timing: "excluded",
      records: size,
      active: activeCount,
      archived: archivedCount,
      edges: activeCount,
      tagVocabulary: 10,
      tagsPerRecord: 1,
      bodyBytes: Buffer.byteLength(markdownFor(1).split("---\n")[2] ?? ""),
      indexBytes: (await fs.stat(indexPath)).size
    }) + "\n"
  );
}
async function verifyFixture(): Promise<void> {
  const marker: unknown = JSON.parse(await fs.readFile(markerPath, "utf8"));
  assert.deepEqual(marker, fixtureIdentity);
}

async function runList(): Promise<Summary> {
  const base = listRequest();
  const request =
    operation === "list-page"
      ? { ...base, offset: Math.min(100, Math.max(0, activeCount - 1)) }
      : operation === "list-tag"
        ? { ...base, tags: [tagFor(0)] }
        : operation === "list-related"
          ? { ...base, relatedTo: idFor(0), direction: "both" as const }
          : operation === "list-type"
            ? { ...base, relationType: "修订" as const }
            : base;
  const result = await query(request);
  assert.ok(result.command === "list");
  const total =
    operation === "list-tag"
      ? tagActiveCount()
      : operation === "list-related"
        ? 9
        : activeCount;
  assert.equal(result.total, total);
  assert.equal(
    result.records.length,
    Math.min(20, Math.max(0, total - request.offset))
  );
  assert.deepEqual(result.source, {
    kind: "published-index",
    currentness: "unchecked",
    fallback: false
  });
  assert.equal(result.warnings.length, 0);
  if (operation === "list-related" || operation === "list-type")
    assert.ok(
      result.records.every((record) => record.filterRelations?.length === 1)
    );
  if (operation === "list-tag")
    assert.ok(
      result.records.every((record) => record.tags.includes(tagFor(0)))
    );
  return {
    status: "ok",
    total: result.total,
    returned: result.records.length,
    offset: result.offset,
    source: result.source
  };
}
async function runSearch(): Promise<Summary> {
  const content = operation.startsWith("content-");
  const request = {
    ...searchRequest(),
    in: content ? ("content" as const) : ("metadata" as const),
    text:
      operation === "metadata-rare"
        ? "needle"
        : operation === "metadata-zero"
          ? "absent-term-no-fixture-match"
          : "record",
    ...(operation === "content-tag" ? { tags: [tagFor(0)] } : {}),
    ...(operation === "content-related"
      ? { relatedTo: idFor(0), direction: "both" as const }
      : {})
  };
  const result = await executeDecisionQuery(request);
  if (operation === "content-unfiltered-cap" && activeCount > 10000) {
    assert.ok(
      result.status === "error",
      "the real candidate limit must reject >10000 source paths"
    );
    assert.equal(result.exitCode, 1);
    assert.equal(result.diagnostics.length, 1);
    assert.equal(result.diagnostics[0]?.code, "decision-records.search-failed");
    assert.equal(
      result.diagnostics[0]?.reason,
      "File text search candidate file limit was exceeded."
    );
    return {
      status: "error",
      expected: "content-candidate-resource-limit",
      code: result.diagnostics[0]?.code,
      reason: result.diagnostics[0]?.reason,
      candidates: activeCount
    };
  }
  const success = okResult(result);
  assert.ok(success.command === "search");
  const { counts, coverage, source } = success.searchInfo;
  assert.equal(success.in, content ? "content" : "metadata");
  assert.equal(counts.returned, success.records.length);
  assert.deepEqual(
    source,
    content
      ? { kind: "validated-source", currentness: "current", fallback: false }
      : { kind: "published-index", currentness: "unchecked", fallback: false }
  );
  if (!content) {
    const expected =
      operation === "metadata-rare"
        ? Math.ceil(size / 1000)
        : operation === "metadata-zero"
          ? 0
          : activeCount;
    assert.equal(counts.matched.value, expected);
    assert.equal(counts.returned, expected);
    assert.equal(counts.matched.precision, "exact");
    assert.deepEqual(coverage, {
      scanComplete: true,
      resultsComplete: true,
      previewsComplete: null,
      reasons: []
    });
    assert.equal(success.warnings.length, 0);
  } else {
    const total =
      operation === "content-related"
        ? 9
        : operation === "content-tag"
          ? tagActiveCount()
          : activeCount;
    assert.equal(counts.returned, Math.min(20, total));
    assert.equal(counts.matched.value, Math.min(21, total));
    assert.equal(
      counts.matched.precision,
      total > 21 ? "lower-bound" : "exact"
    );
    assert.equal(coverage.scanComplete, total <= 21);
    assert.equal(coverage.resultsComplete, total <= 20);
    assert.equal(coverage.previewsComplete, true);
    assert.deepEqual(coverage.reasons, total > 20 ? ["max-records"] : []);
    assert.deepEqual(
      success.warnings,
      total > 20 ? ["search results limited: max-records"] : []
    );
  }
  return {
    status: "ok",
    counts,
    coverage,
    source,
    warnings: success.warnings.length
  };
}
async function runQuery(): Promise<Summary> {
  if (
    ["list", "list-page", "list-tag", "list-related", "list-type"].includes(
      operation
    )
  )
    return runList();
  if (operation.startsWith("metadata-") || operation.startsWith("content-"))
    return runSearch();
  if (operation === "show-id" || operation === "show-name") {
    const result = await query({
      command: "show",
      location,
      decisionId: operation === "show-id" ? idFor(1) : "record-000001"
    });
    assert.ok(result.command === "show");
    assert.equal(result.record.decisionId, idFor(1));
    assert.ok(result.body.includes("## 决策"));
    assert.equal(result.warnings.length, 0);
    return {
      status: "ok",
      records: 1,
      bodyBytes: Buffer.byteLength(result.body),
      warnings: 0
    };
  }
  if (operation === "trace") {
    const result = await query({
      command: "trace",
      location,
      decisionId: idFor(0),
      direction: "both",
      maxDepth: 5,
      maxRecords: 50
    });
    assert.ok(result.command === "trace");
    assert.equal(result.traceIds.length, 10);
    assert.equal(result.contextIds.length, 0);
    assert.equal(Object.keys(result.entries).length, 10);
    assert.deepEqual(result.coverage, { complete: true, stoppedBy: [] });
    assert.equal(result.frontier.length, 0);
    return { status: "ok", trace: 10, context: 0, coverage: result.coverage };
  }
  if (operation === "check-full") {
    const result = await query({ command: "check", location });
    assert.ok(result.command === "check");
    assert.deepEqual(result.summary, {
      activeCount,
      activationCandidateCount: 0,
      bodyReadyCandidateCount: 0,
      alignedCount: activeCount,
      archivedCount,
      decisionCount: size,
      scaffoldCandidateCount: 0,
      unalignedCount: 0
    });
    return { status: "ok", ...result.summary };
  }
  if (operation === "candidates") {
    const result = await query({ command: "candidates", location });
    assert.ok(result.command === "candidates");
    assert.equal(result.records.length, 0);
    assert.equal(result.warnings.length, 0);
    return { status: "ok", candidates: 0, warnings: 0 };
  }
  if (operation === "sync-preflight" || operation === "sync-write") {
    const result = await query({
      command: "sync-index",
      location,
      preflight: operation === "sync-preflight"
    });
    assert.ok(result.command === "sync-index");
    assert.equal(
      result.state,
      operation === "sync-write" ? "written" : "unchanged"
    );
    assert.equal(result.scope, "all");
    assert.equal(result.unactivatedPaths.length, 0);
    assert.equal(result.changedIds.length, 0);
    return {
      status: "ok",
      state: result.state,
      returnedChangedIds: result.changedIds.length,
      preparedSourceChanges: operation === "sync-write" ? 1 : 0,
      scope: result.scope
    };
  }
  throw new Error("Unknown Decision worker operation: " + operation);
}

async function microOperation(): Promise<() => Promise<Summary>> {
  if (operation === "micro-index-read") {
    const expectedBytes = (await fs.stat(indexPath)).size;
    return async () => {
      const text = await fs.readFile(indexPath, "utf8");
      assert.equal(Buffer.byteLength(text), expectedBytes);
      return { status: "ok", micro: true, bytes: expectedBytes };
    };
  }
  if (operation === "micro-json-parse" || operation === "micro-parse-index") {
    const text = await fs.readFile(indexPath, "utf8");
    return async () => {
      if (operation === "micro-json-parse") {
        const parsed: unknown = JSON.parse(text);
        assert.ok(
          parsed !== null &&
            typeof parsed === "object" &&
            "entries" in parsed &&
            parsed.entries !== null &&
            typeof parsed.entries === "object"
        );
        assert.equal(Object.keys(parsed.entries).length, size);
      } else {
        const parsed = parseDecisionIndex(text, indexPath);
        assert.ok(parsed.status === "ok", JSON.stringify(parsed.diagnostics));
        assert.equal(Object.keys(parsed.value.entries).length, size);
      }
      return { status: "ok", micro: true, entries: size };
    };
  }
  if (operation === "micro-load-index")
    return async () => {
      const loaded = await loadDecisionIndex({ decisionsDirectory: directory });
      assert.ok(loaded.status === "ok", JSON.stringify(loaded.diagnostics));
      assert.equal(Object.keys(loaded.value.entries).length, size);
      return { status: "ok", micro: true, entries: size };
    };
  if (operation === "micro-source-revision")
    return async () => {
      const revision = await readDecisionSourceRevision(directory, undefined);
      assert.equal(Object.keys(revision.entries).length, size);
      return { status: "ok", micro: true, entries: size };
    };
  if (operation === "micro-markdown-parse") {
    const inputs: { sourcePath: string; body: string }[] = [];
    for (let i = 0; i < size; i++)
      inputs.push({
        sourcePath: sourcePathFor(i),
        body: await fs.readFile(path.join(directory, sourcePathFor(i)), "utf8")
      });
    const ids = new Set(Array.from({ length: size }, (_, i) => idFor(i)));
    return async () => {
      const errors: string[] = [];
      let records = 0;
      for (const input of inputs) {
        const parsed = await validateDecisionBody({
          ...input,
          errors,
          targetExists: (id) => ids.has(id)
        });
        assert.ok(parsed !== null && parsed.bodyReady);
        records++;
      }
      assert.deepEqual(errors, []);
      assert.equal(records, size);
      return { status: "ok", micro: true, records };
    };
  }
  const loaded = await snapshot();
  if (operation === "micro-list-projection") {
    const request = listRequest();
    const prepared = prepareDecisionListRequest(request);
    assert.ok(prepared.status === "ok");
    return async () => {
      const result = okResult(projectDecisionList(loaded, request, prepared));
      assert.ok(result.command === "list");
      assert.equal(result.total, activeCount);
      assert.equal(result.records.length, Math.min(20, activeCount));
      return {
        status: "ok",
        micro: true,
        total: result.total,
        returned: result.records.length
      };
    };
  }
  const records = indexedRecords(loaded.entries);
  if (operation === "micro-relation-build")
    return async () => {
      const graph = createDecisionRelationGraphProvider(records)();
      assert.equal(graph.recordById.size, size);
      assert.equal(graph.edges.length, activeCount);
      return {
        status: "ok",
        micro: true,
        nodes: graph.recordById.size,
        edges: graph.edges.length
      };
    };
  if (operation === "micro-relation-validate") {
    const provider = createDecisionRelationGraphProvider(records);
    assert.equal(provider().edges.length, activeCount);
    return async () => {
      const issues = decisionRelationConsistencyIssues(provider);
      assert.deepEqual(issues, []);
      return {
        status: "ok",
        micro: true,
        nodes: size,
        edges: activeCount,
        issues: 0
      };
    };
  }
  throw new Error("Unknown Decision micro operation: " + operation);
}

if (operation === "prepare") {
  await prepare();
} else {
  await verifyFixture();
  // An idempotent sync is separately measured by preflight. This operation forces
  // one real, legal source change in this isolated fixture before its timed write.
  if (operation === "sync-write") {
    const target = path.join(directory, sourcePathFor(1));
    const previous = await fs.readFile(target, "utf8");
    const replacement = previous.includes("purpose: preserve stable direction")
      ? previous.replace(
          "purpose: preserve stable direction",
          "purpose: preserve stable ownership"
        )
      : previous.replace(
          "purpose: preserve stable ownership",
          "purpose: preserve stable direction"
        );
    assert.notEqual(replacement, previous);
    await fs.writeFile(target, replacement);
  }
  const run = operation.startsWith("micro-")
    ? await microOperation()
    : runQuery;
  await measure("decision", operation, size, run);
}
