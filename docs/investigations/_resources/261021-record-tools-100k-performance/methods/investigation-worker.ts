import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { argumentsForWorker, measure, type Summary } from "./measurement.ts";
import {
  queryInvestigationIndex,
  searchInvestigationReports,
  showInvestigationReport,
  traceInvestigationReports
} from "./source/tools/investigation-report/src/query.ts";
import {
  synchronizeInvestigationIndex,
  validateInvestigationReports
} from "./source/tools/investigation-report/src/validation.ts";
import {
  listInvestigationCandidates,
  showInvestigationCandidate
} from "./source/tools/investigation-report/src/candidate.ts";
import { publishInvestigationCandidates } from "./source/tools/investigation-report/src/publish.ts";
import { setInvestigationRelations } from "./source/tools/investigation-report/src/relation-transaction.ts";
import { renameInvestigationRecord } from "./source/tools/investigation-report/src/rename.ts";
import { stageInvestigationReports } from "./source/tools/investigation-report/src/staging.ts";
import {
  createInvestigationStateIndexDefinition,
  loadInvestigationIndex
} from "./source/tools/investigation-report/src/investigation-state-index.ts";
import { inspectInvestigationCollectionLayout } from "./source/tools/investigation-report/src/investigation-layout.ts";
import { parseInvestigationReport } from "./source/tools/investigation-report/src/markdown.ts";
import { buildInvestigationReportState } from "./source/tools/investigation-report/src/report-validation.ts";
import {
  prepareQuery,
  queryLoadedInvestigationIndex
} from "./source/tools/investigation-report/src/query-index.ts";
import { createInvestigationRelationContext } from "./source/tools/investigation-report/src/relation-context.ts";
import { validateInvestigationRelationGraph } from "./source/tools/investigation-report/src/relation-validation.ts";
import {
  buildStateIndexFromSnapshot,
  parseStateIndex
} from "./source/tools/index-runtime/src/index.ts";
import type {
  InvestigationIndexQueryOptions,
  InvestigationIndexQueryResult,
  InvestigationSearchResult
} from "./source/tools/investigation-report/src/types.ts";

const { operation, root, size } = argumentsForWorker();
assert.equal(
  size % 10,
  0,
  "fixture size must consist of complete ten-record groups"
);
const directory = path.join(root, "docs/investigations");
const indexPath = path.join(directory, "investigation-index.json");
const location = { workspaceRoot: root };
const candidateId = "261020-candidate-probe";
const firstId = reportId(0);
const targetId = reportId(1);
const expectedEdges = size * 0.9;
const tagCount = Math.floor(size / 100) * 10 + Math.min(10, size % 100);
const rareCount = Math.floor((size - 2) / 1000) + 1;

function reportId(index: number): string {
  return `261020-record-${String(index).padStart(6, "0")}`;
}

function formedAt(index: number): string {
  return new Date(Date.UTC(2026, 9, 20) + Math.floor(index / 2) * 1000)
    .toISOString()
    .replace(".000Z", "Z");
}

function fixtureMarkdown(index: number, id = reportId(index)): string {
  const body = [
    "## 形成时背景",
    "",
    "本文件是正式格式的隔离测量样本，不代表真实业务结论。",
    "",
    "## 调查目的",
    "",
    "测量当前工具在固定规模、关系与标签分布下的工作量。",
    "",
    "## 调查范围与依据",
    "",
    "固定版本源码与本地合成 Markdown；不包含资源、网络或历史附件执行。",
    "",
    "## 调查结果与边界",
    "",
    "样本只用于性能方法核对，不证明生产数据质量。",
    "benchmark payload baseline. ".repeat(22),
    ""
  ].join("\n");
  assert.ok(Buffer.byteLength(body) >= 950 && Buffer.byteLength(body) <= 1400);
  const relations =
    index % 10 === 0 || id === candidateId
      ? "relations: []"
      : [
          "relations:",
          '  - type: "复查"',
          `    target: "${reportId(Math.floor(index / 10) * 10)}"`,
          '    summary: "固定样本分组复查"'
        ].join("\n");
  return [
    "---",
    `title: "record ${String(index).padStart(6, "0")}"`,
    `id: "${id}"`,
    `formedAt: "${id === candidateId ? "2026-10-20T23:59:59Z" : formedAt(index)}"`,
    `question: "${index % 1000 === 1 ? "needle" : "probe"} coverage"`,
    "tags:",
    `  - "tag-${Math.floor(index / 10) % 10}"`,
    relations,
    "---",
    "",
    body
  ].join("\n");
}

function noErrors(result: Readonly<{ errors: readonly string[] }>): void {
  assert.deepEqual(result.errors, []);
}

async function prepare(): Promise<void> {
  await fs.mkdir(root);
  await fs.mkdir(directory, { recursive: true });
  let markdownBytes = 0;
  for (let start = 0; start < size; start += 32) {
    await Promise.all(
      Array.from({ length: Math.min(32, size - start) }, async (_, offset) => {
        const index = start + offset;
        const markdown = fixtureMarkdown(index);
        markdownBytes += Buffer.byteLength(markdown);
        await fs.writeFile(
          path.join(directory, `${reportId(index)}.md`),
          markdown,
          { flag: "wx" }
        );
      })
    );
  }
  await fs.writeFile(
    path.join(directory, "_candidate.candidate-probe"),
    fixtureMarkdown(0, candidateId),
    { flag: "wx" }
  );
  const synced = await synchronizeInvestigationIndex(location);
  noErrors(synced);
  assert.equal(synced.reportCount, size);
  assert.equal(synced.changed, true);
  const loaded = await loadInvestigationIndex({
    investigationsDirectory: directory
  });
  assert.equal(loaded.status, "ok");
  assert.equal(Object.keys(loaded.value.entries).length, size);
  assert.equal(
    Object.values(loaded.value.entries).reduce(
      (sum, state) => sum + state.relations.length,
      0
    ),
    expectedEdges
  );
  const checked = await validateInvestigationReports(location);
  noErrors(checked);
  assert.equal(checked.availableReportCount, size);
  assert.equal(checked.selectedReportCount, size);
  assert.equal(checked.indexChecked, true);
  const summary = {
    status: "ok",
    formalRecords: size,
    candidateRecords: 1,
    edges: expectedEdges,
    markdownBytes,
    indexBytes: (await fs.stat(indexPath)).size,
    setupNotMeasured: true
  };
  await fs.writeFile(
    path.join(root, "measurement-fixture.json"),
    `${JSON.stringify(summary)}\n`,
    {
      flag: "wx"
    }
  );
  process.stdout.write(
    `${JSON.stringify({ domain: "investigation", operation, size, summary })}\n`
  );
}

function checkList(
  result: InvestigationIndexQueryResult,
  total: number,
  length: number
): Summary {
  noErrors(result);
  assert.equal(result.total, total);
  assert.equal(result.entries.length, length);
  return {
    status: "ok",
    total,
    returned: result.entries.length,
    offset: result.offset
  };
}

function checkSearch(
  result: InvestigationSearchResult,
  matched: number,
  returned: number
): Summary {
  noErrors(result);
  assert.equal(result.status, "ok");
  assert.equal(result.entries.length, returned);
  assert.equal(result.searchInfo.counts.matched.value, matched);
  assert.equal(result.searchInfo.counts.matched.precision, "exact");
  assert.equal(result.searchInfo.counts.returned, returned);
  assert.equal(result.searchInfo.coverage.scanComplete, true);
  assert.equal(
    result.searchInfo.coverage.resultsComplete,
    matched === returned
  );
  return {
    status: "ok",
    matched,
    returned,
    source: result.searchInfo.source,
    coverage: result.searchInfo.coverage
  };
}

async function list(
  options: Omit<InvestigationIndexQueryOptions, "workspaceRoot">,
  total: number,
  length: number
): Promise<Summary> {
  const result = await queryInvestigationIndex({ ...location, ...options });
  const summary = checkList(result, total, length);
  if (options.relatedTo !== undefined || options.relationType !== undefined) {
    assert.ok(
      result.entries.every((entry) => entry.filterRelations?.length === 1)
    );
  } else {
    assert.ok(
      result.entries.every((entry) => entry.filterRelations === undefined)
    );
  }
  if (options.tags !== undefined)
    assert.ok(
      result.entries.every((entry) => entry.state.tags.includes("tag-0"))
    );
  return summary;
}

async function content(
  kind: "unfiltered" | "tag" | "related"
): Promise<Summary> {
  const selected = kind === "unfiltered" ? size : kind === "tag" ? tagCount : 9;
  const result = await searchInvestigationReports({
    ...location,
    query: "record",
    in: "content",
    limit: 50,
    ...(kind === "related"
      ? { relatedTo: firstId, direction: "successors" }
      : {}),
    ...(kind === "tag" ? { tags: ["tag-0"] } : {})
  });
  if (selected > 2000) {
    assert.equal(result.status, "error");
    assert.equal(result.failureKind, "operation");
    assert.equal(result.searchInfo, null);
    assert.equal(result.entries.length, 0);
    assert.ok(result.errors.length > 0);
    assert.ok(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "investigation-report.file-search-resource-limit"
      )
    );
    return {
      status: "error",
      errorCategory: "native-resource-limit",
      failureKind: result.failureKind,
      diagnostics: result.diagnostics.map((diagnostic) => diagnostic.code),
      selectedCandidates: selected,
      maxCandidateFiles: 2000,
      expectedFailure: true,
      noSearchCountsAvailable: true
    };
  }
  noErrors(result);
  assert.equal(result.status, "ok");
  const returned = Math.min(50, selected);
  assert.equal(result.entries.length, returned);
  assert.equal(result.searchInfo.counts.matched.value, Math.min(selected, 51));
  assert.equal(
    result.searchInfo.counts.matched.precision,
    selected <= 51 ? "exact" : "lower-bound"
  );
  assert.equal(result.searchInfo.coverage.scanComplete, selected <= 51);
  assert.equal(result.searchInfo.coverage.resultsComplete, selected <= 50);
  assert.equal(result.searchInfo.source.fallback, false);
  assert.equal(result.searchInfo.source.kind, "validated-source");
  if (kind === "related")
    assert.ok(
      result.entries.every((entry) => entry.filterRelations?.length === 1)
    );
  return {
    status: "ok",
    selectedCandidates: selected,
    counts: result.searchInfo.counts,
    coverage: result.searchInfo.coverage,
    source: result.searchInfo.source
  };
}

async function prepareMeasuredOperation(): Promise<() => Promise<Summary>> {
  switch (operation) {
    case "list":
      return async () => await list({}, size, 10);
    case "list-page":
      return async () =>
        await list({ limit: 10, offset: 10 }, size, Math.min(10, size - 10));
    case "list-tag":
      return async () =>
        await list(
          { tags: ["tag-0"], limit: 10 },
          tagCount,
          Math.min(10, tagCount)
        );
    case "list-related":
      return async () =>
        await list({ relatedTo: firstId, direction: "successors" }, 9, 9);
    case "list-type":
      return async () =>
        await list(
          { relationType: "复查", limit: 10 },
          expectedEdges,
          Math.min(10, expectedEdges)
        );
    case "show-id":
    case "show-name":
      return async () => {
        const shown = await showInvestigationReport({
          ...location,
          id: operation === "show-id" ? targetId : "record-000001"
        });
        noErrors(shown);
        assert.equal(shown.status, "ok");
        assert.equal(shown.id, targetId);
        assert.ok(shown.markdown.includes(`id: "${targetId}"`));
        assert.equal(shown.state.relations[0]?.target, firstId);
        return {
          status: "ok",
          id: shown.id,
          markdownBytes: Buffer.byteLength(shown.markdown),
          warnings: shown.warnings
        };
      };
    case "trace":
    case "trace-capped":
      return async () => {
        const capped = operation === "trace-capped";
        const traced = await traceInvestigationReports({
          ...location,
          id: firstId,
          maxDepth: 2,
          maxRecords: capped ? 5 : 20
        });
        assert.equal(traced.status, "ok");
        assert.equal(traced.anchorId, firstId);
        assert.equal(traced.traceIds.length, capped ? 5 : 10);
        assert.equal(traced.contextIds.length, 0);
        assert.equal(Object.keys(traced.entries).length, capped ? 5 : 10);
        assert.equal(traced.coverage.complete, !capped);
        if (capped)
          assert.ok(traced.coverage.stoppedBy.includes("max-records"));
        return {
          status: "ok",
          traceRecords: traced.traceIds.length,
          coverage: traced.coverage,
          frontierCount: traced.frontier.length
        };
      };
    case "metadata-rare":
    case "metadata-common":
    case "metadata-zero":
      return async () => {
        const query =
          operation === "metadata-rare"
            ? "needle"
            : operation === "metadata-common"
              ? "record"
              : "absentuniquezz";
        const expected =
          operation === "metadata-rare"
            ? rareCount
            : operation === "metadata-common"
              ? size
              : 0;
        const result = await searchInvestigationReports({
          ...location,
          in: "metadata",
          query,
          limit: 50
        });
        const summary = checkSearch(result, expected, Math.min(expected, 50));
        assert.equal(result.status, "ok");
        assert.equal(result.searchInfo.source.kind, "published-index");
        assert.equal(result.searchInfo.coverage.previewsComplete, null);
        return summary;
      };
    case "content-unfiltered":
      return async () => await content("unfiltered");
    case "content-tag":
      return async () => await content("tag");
    case "content-related":
      return async () => await content("related");
    case "check-id":
    case "check-full":
      return async () => {
        const full = operation === "check-full";
        const result = await validateInvestigationReports({
          ...location,
          ...(full ? {} : { ids: [targetId] })
        });
        noErrors(result);
        assert.equal(result.selectedReportCount, full ? size : 1);
        assert.equal(result.indexChecked, full);
        if (full) assert.equal(result.availableReportCount, size);
        return {
          status: "ok",
          selected: result.selectedReportCount,
          available: result.availableReportCount,
          indexChecked: result.indexChecked,
          warnings: result.warnings.length
        };
      };
    case "sync-preflight":
    case "sync-current":
    case "sync-write": {
      if (operation === "sync-write") {
        const target = path.join(directory, `${targetId}.md`);
        const text = await fs.readFile(target, "utf8");
        const marker = "\n测量同步字节变化。\n";
        await fs.writeFile(
          target,
          text.endsWith(marker) ? text.slice(0, -marker.length) : text + marker
        );
      }
      return async () => {
        const result = await synchronizeInvestigationIndex({
          ...location,
          preflight: operation === "sync-preflight"
        });
        noErrors(result);
        assert.equal(result.reportCount, size);
        assert.equal(result.changed, operation === "sync-write");
        assert.equal(result.changedIds.length, 0);
        return {
          status: "ok",
          changed: result.changed,
          changedIds: result.changedIds.length,
          state: result.state,
          reportCount: result.reportCount,
          setupOutsideTimer:
            operation === "sync-write"
              ? "one body suffix toggled before sync"
              : "none"
        };
      };
    }
    case "relations-preflight":
      return async () => {
        const result = await setInvestigationRelations({
          ...location,
          preflight: true,
          replacements: [
            {
              source: targetId,
              relations: [
                { type: "补充", target: firstId, summary: "测量预检关系替换" }
              ]
            }
          ]
        });
        noErrors(result);
        assert.equal(result.preflight, true);
        assert.equal(result.changed, false);
        assert.equal(result.relationReview?.phase, "preflight");
        assert.equal(result.relationReview.sources.length, 1);
        assert.equal(result.relationReview.sources[0]?.action, "replace");
        return {
          status: "ok",
          phase: result.relationReview.phase,
          sources: result.relationReview.sources.length,
          changed: result.changed
        };
      };
    case "rename-preflight":
      return async () => {
        const result = await renameInvestigationRecord({
          ...location,
          preflight: true,
          source: targetId,
          target: "261020-renamed-probe"
        });
        noErrors(result);
        assert.equal(result.status, "ok");
        assert.equal(result.changed, false);
        assert.equal(result.plan?.outcome, "preflight");
        assert.equal(result.plan.oldId, targetId);
        assert.equal(result.plan.newId, "261020-renamed-probe");
        return { status: "ok", changed: result.changed, plan: result.plan };
      };
    case "publish-preflight":
      return async () => {
        const result = await publishInvestigationCandidates({
          ...location,
          ids: [candidateId],
          preflight: true
        });
        noErrors(result);
        assert.equal(result.preflight, true);
        assert.equal(result.changed, false);
        assert.equal(result.relationReview?.phase, "preflight");
        assert.equal(result.relationReview.sources[0]?.sourceId, candidateId);
        assert.equal(result.relationReview.sources[0]?.action, "establish");
        return {
          status: "ok",
          changed: result.changed,
          phase: result.relationReview.phase,
          sources: result.relationReview.sources.length
        };
      };
    case "candidates":
    case "show-candidate":
      return async () => {
        const result =
          operation === "candidates"
            ? await listInvestigationCandidates(location)
            : await showInvestigationCandidate({
                ...location,
                id: candidateId
              });
        noErrors(result);
        assert.equal(result.status, "ok");
        const candidates =
          "candidates" in result ? result.candidates : [result.candidate];
        assert.equal(candidates.length, 1);
        assert.equal(candidates[0]?.id, candidateId);
        assert.deepEqual(candidates[0]?.readiness, {
          bodyReady: true,
          resourceReady: true,
          scaffoldValid: true
        });
        return {
          status: "ok",
          candidateRecords: 1,
          readiness: candidates[0]?.readiness
        };
      };
    case "stage-index":
    case "stage-domain":
    case "stage-all":
      return async () => {
        const scope =
          operation === "stage-index"
            ? "index"
            : operation === "stage-domain"
              ? "domain"
              : "all";
        const result = await stageInvestigationReports({
          ...location,
          reportIds: [targetId],
          scope
        });
        assert.equal(result.status, "ok", JSON.stringify(result.diagnostics));
        assert.deepEqual(result.selectedIds, [targetId]);
        assert.equal(result.scope, scope);
        assert.ok(result.state === "unchanged" || result.state === "staged");
        return {
          status: "ok",
          state: result.state,
          scope: result.scope,
          changed: result.changed,
          writtenPaths: result.writtenPaths,
          preservedPendingPaths: result.preservedPendingPaths
        };
      };
    default:
      return await prepareMicroOperation();
  }
}

async function loadedIndex() {
  const loaded = await loadInvestigationIndex({
    investigationsDirectory: directory
  });
  assert.equal(loaded.status, "ok", JSON.stringify(loaded.diagnostics));
  assert.equal(Object.keys(loaded.value.entries).length, size);
  return loaded;
}

async function prepareMicroOperation(): Promise<() => Promise<Summary>> {
  if (operation === "micro-read-index")
    return async () => {
      const text = await fs.readFile(indexPath, "utf8");
      assert.ok(text.length > size * 100);
      return {
        status: "ok",
        micro: true,
        bytes: Buffer.byteLength(text),
        excludes: "parse, validation, source reads"
      };
    };
  if (operation === "micro-json-parse" || operation === "micro-parse-index") {
    const text = await fs.readFile(indexPath, "utf8");
    const definition = createInvestigationStateIndexDefinition();
    return async () => {
      if (operation === "micro-json-parse") {
        const parsed: unknown = JSON.parse(text);
        assert.ok(
          typeof parsed === "object" && parsed !== null && "entries" in parsed
        );
        const entries = parsed.entries;
        assert.ok(
          typeof entries === "object" &&
            entries !== null &&
            !Array.isArray(entries)
        );
        assert.equal(Object.keys(entries).length, size);
      } else {
        const parsed = parseStateIndex({
          definition,
          sourcePath: indexPath,
          text
        });
        assert.equal(parsed.status, "ok");
        assert.equal(Object.keys(parsed.value.entries).length, size);
      }
      return {
        status: "ok",
        micro: true,
        records: size,
        setupOutsideTimer: "index text read; definition created",
        excludes: "filesystem source reads"
      };
    };
  }
  if (operation === "micro-load-index")
    return async () => {
      await loadedIndex();
      return {
        status: "ok",
        micro: true,
        records: size,
        includes: "read, JSON parse, schema, normalize, validate"
      };
    };
  if (
    operation === "micro-read-sources" ||
    operation === "micro-parse-markdown"
  ) {
    if (operation === "micro-read-sources")
      return async () => {
        const layout = await inspectInvestigationCollectionLayout(directory);
        assert.deepEqual(layout.errors, []);
        assert.equal(layout.formalSources.length, size);
        assert.equal(layout.candidateSources.length, 1);
        return {
          status: "ok",
          micro: true,
          records: size,
          includes: "directory discovery, lstat, read, identity parse",
          excludes: "full body/state parse, graph/index validation"
        };
      };
    const layout = await inspectInvestigationCollectionLayout(directory);
    assert.deepEqual(layout.errors, []);
    assert.equal(layout.formalSources.length, size);
    return async () => {
      let count = 0;
      for (const source of layout.formalSources) {
        const parsed = parseInvestigationReport(source.text, source.id);
        const built = buildInvestigationReportState(
          source.id,
          parsed,
          source.sourcePath
        );
        assert.equal(built.status, "valid", JSON.stringify(built.errors));
        count += 1;
      }
      assert.equal(count, size);
      return {
        status: "ok",
        micro: true,
        records: count,
        setupOutsideTimer: "all source text and paths read",
        includes: "Markdown parse, body and state validation",
        excludes: "I/O, source revision, graph/index build"
      };
    };
  }
  const loaded = await loadedIndex();
  if (operation === "micro-query-loaded") {
    const prepared = prepareQuery({ ...location, limit: 10 });
    assert.ok(prepared.isOk());
    return async () => {
      const result = queryLoadedInvestigationIndex(
        loaded,
        prepared.value.validated,
        indexPath
      );
      assert.ok(
        result.isOk(),
        JSON.stringify(result.isErr() ? result.error : null)
      );
      return {
        ...checkList(result.value, size, 10),
        micro: true,
        setupOutsideTimer: "loaded, validated index; query options",
        includes: "relation context entries, facets, queryStateIndex"
      };
    };
  }
  if (operation === "micro-build-index") {
    const definition = createInvestigationStateIndexDefinition();
    const snapshot = {
      metadata: loaded.value.metadata,
      sourceRevision: loaded.value.sourceRevision,
      states: loaded.value.entries
    };
    return async () => {
      const built = buildStateIndexFromSnapshot(definition, snapshot);
      assert.equal(built.status, "ok");
      assert.equal(Object.keys(built.value.entries).length, size);
      return {
        status: "ok",
        micro: true,
        records: size,
        setupOutsideTimer: "real validated published snapshot",
        includes: "projection, canonicalization, complete index validation",
        excludes: "Markdown source reads/parse, source fingerprint generation"
      };
    };
  }
  if (operation === "micro-graph-build")
    return async () => {
      const context = createInvestigationRelationContext(
        Object.entries(loaded.value.entries)
      );
      const graph = context.graph();
      assert.equal(graph.ids.size, size);
      assert.equal(graph.edges.length, expectedEdges);
      return {
        status: "ok",
        micro: true,
        records: size,
        edges: graph.edges.length,
        setupOutsideTimer: "loaded validated index",
        includes: "context allocation, forward/reverse graph build"
      };
    };
  if (operation === "micro-graph-validate") {
    const context = createInvestigationRelationContext(
      Object.entries(loaded.value.entries)
    );
    assert.equal(context.graph().edges.length, expectedEdges);
    return async () => {
      assert.deepEqual(validateInvestigationRelationGraph(context), []);
      return {
        status: "ok",
        micro: true,
        records: size,
        edges: expectedEdges,
        setupOutsideTimer: "loaded index; built graph",
        includes: "structural, chronological, shape and split validation"
      };
    };
  }
  throw new Error(`Unknown operation: ${operation}`);
}

if (operation === "prepare") await prepare();
else {
  const run = await prepareMeasuredOperation();
  await measure("investigation", operation, size, run);
}
