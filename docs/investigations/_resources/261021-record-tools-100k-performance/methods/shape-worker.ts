import assert from "node:assert/strict";
import { argumentsForWorker, measure, type Summary } from "./measurement.ts";
import {
  createInvestigationRelationContext,
  type InvestigationRelationContext
} from "./source/tools/investigation-report/src/relation-context.ts";
import { validateInvestigationRelationGraph } from "./source/tools/investigation-report/src/relation-validation.ts";
import { filterRelationsByEntry } from "./source/tools/investigation-report/src/query-search-selection.ts";
import { traceLoadedInvestigation } from "./source/tools/investigation-report/src/query-trace.ts";
import {
  investigationNameFromId,
  isInvestigationId
} from "./source/tools/investigation-report/src/report-path.ts";
import type {
  InvestigationIndexState,
  InvestigationRelation
} from "./source/tools/investigation-report/src/types.ts";
import {
  createDecisionRelationGraphProvider,
  decisionRelationConsistencyIssues,
  traceDecisionRelations,
  type DecisionRelationGraphProvider
} from "./source/tools/decision-records/src/relation-graph.ts";
import {
  isDecisionId,
  isDecisionSourcePath,
  isDecisionTag
} from "./source/tools/decision-records/src/decision-path.ts";
import {
  decisionPublishedSnapshotSource,
  type DecisionTraceEntry,
  type DecisionTraceSuccess,
  type IndexedDecisionRecord
} from "./source/tools/decision-records/src/decision-query-contract.ts";
import type {
  DecisionId,
  DecisionRelation
} from "./source/tools/decision-records/src/types.ts";

// Formation-time, pure-memory microbenchmarks. This file never accesses root.
// Typed inputs and one legal graph are prepared before measure(); process peak
// RSS therefore includes untimed fixture allocation and graph validation.
const { operation, root, size } = argumentsForWorker();
const [domain, rawShape, action, extra] = operation.split("-");
assert.ok(domain === "decision" || domain === "investigation");
assert.ok(
  rawShape === "merge" ||
    rawShape === "star" ||
    rawShape === "chain" ||
    rawShape === "split"
);
assert.ok(
  action === "build" ||
    action === "validate" ||
    action === "trace" ||
    action === "evidence"
);
assert.equal(extra, undefined);
const shape: Shape = rawShape;
assert.ok(action !== "evidence" || domain === "investigation");
assert.ok(action !== "evidence" || shape === "merge");

type Shape = "merge" | "star" | "chain" | "split";
const expectedEdges = size - 1;
const traceOptions = {
  direction: "both",
  maxDepth: null,
  maxRecords: 50
} as const;
const identity = {
  micro: true,
  pureMemory: true,
  publicCli: false,
  shape,
  nodes: size,
  edges: expectedEdges,
  maxOutDegree: shape === "merge" ? expectedEdges : 1,
  maxInDegree: shape === "star" || shape === "split" ? expectedEdges : 1,
  fixtureRootArgument: root,
  fixtureRootAccessed: false,
  setupOutsideTimer:
    "typed projections; one graph build and full graph validation",
  processPeakIncludesUntimedSetup: true
};

function decisionId(index: number): DecisionId {
  const id = `261020-shape-${String(index).padStart(6, "0")}`;
  assert.ok(isDecisionId(id));
  return id;
}

function investigationId(index: number): string {
  const id = `261020-shape-${String(index).padStart(6, "0")}`;
  assert.ok(isInvestigationId(id));
  return id;
}

function targetIndexes(index: number, topology: Shape): readonly number[] {
  if (topology === "merge")
    return index === 0
      ? Array.from({ length: size - 1 }, (_, position) => position + 1)
      : [];
  if (index === 0) return [];
  return [topology === "chain" ? index - 1 : 0];
}

function investigationStates(): readonly (readonly [
  string,
  InvestigationIndexState
])[] {
  return Array.from({ length: size }, (_, index) => {
    const id = investigationId(index);
    const relations: InvestigationRelation[] = targetIndexes(index, shape).map(
      (target) => ({
        target: investigationId(target),
        type: shape === "merge" ? "归并" : shape === "split" ? "拆分" : "复查",
        summary: "固定合法内存图形"
      })
    );
    return [
      id,
      {
        formedAt: "2026-10-20T00:00:00Z",
        name: investigationNameFromId(id),
        question: "固定图形中的查询成本",
        relations,
        resourceIds: [],
        sourcePath: `${id}.md`,
        tags: ["shape-probe"],
        title: `shape ${index}`
      }
    ];
  });
}

function decisionRecords(): readonly IndexedDecisionRecord[] {
  const tag = "shape-probe";
  assert.ok(isDecisionTag(tag));
  return Array.from({ length: size }, (_, index) => {
    const id = decisionId(index);
    const sourcePath = `archive/${id}.md`;
    assert.ok(isDecisionSourcePath(sourcePath));
    const relations: DecisionRelation[] = targetIndexes(index, shape).map(
      (target) => ({
        target: decisionId(target),
        type: shape === "merge" ? "归并" : shape === "split" ? "拆分" : "修订",
        summary: "固定合法内存图形"
      })
    );
    // All targets are archived, including every internal long-chain node.
    return {
      alignment: "aligned",
      createdAt: "2026-10-20T00:00:00Z",
      decisionId: id,
      projection: {
        title: `shape ${index}`,
        purpose: "保持可核对的固定样本",
        background: "固定版本纯内存图形",
        decision: "测量图形对应的实现路径",
        relations
      },
      sourcePath,
      status: "archived",
      tags: [tag]
    };
  });
}

function traceSummary(
  trace: Readonly<{
    traceIds: readonly string[];
    contextIds: readonly string[];
    entries: Readonly<
      Record<string, Readonly<{ relations: readonly unknown[] }>>
    >;
    frontier: readonly Readonly<{ nextIds: readonly string[] }>[];
    blockedEvent?: Readonly<{
      recordIds: readonly string[];
      requiredMaxRecords: number;
    }>;
    coverage: Readonly<{ complete: boolean; stoppedBy: readonly string[] }>;
  }>
): Summary {
  const entries = Object.values(trace.entries);
  const memberCount = trace.traceIds.length + trace.contextIds.length;
  assert.equal(entries.length, memberCount);
  assert.equal(
    new Set([...trace.traceIds, ...trace.contextIds]).size,
    memberCount
  );
  assert.ok(memberCount <= traceOptions.maxRecords);
  if (
    (shape === "merge" || shape === "split") &&
    size > traceOptions.maxRecords
  ) {
    assert.equal(memberCount, 1);
    assert.equal(trace.blockedEvent?.recordIds.length, size);
    assert.equal(trace.blockedEvent.requiredMaxRecords, size);
  } else {
    assert.equal(memberCount, Math.min(size, traceOptions.maxRecords));
    assert.equal(trace.blockedEvent, undefined);
  }
  assert.equal(trace.coverage.complete, size <= traceOptions.maxRecords);
  return {
    status: "ok",
    ...identity,
    includes:
      "bounded trace selection, entry projection, count assertions and JSON serialization",
    excludes:
      "graph construction/validation, index loading, Markdown, filesystem, CLI renderer",
    traceDepth: "all",
    maxRecords: traceOptions.maxRecords,
    entries: entries.length,
    trace: trace.traceIds.length,
    context: trace.contextIds.length,
    selectedEntryRelations: entries.reduce(
      (sum, entry) => sum + entry.relations.length,
      0
    ),
    frontier: trace.frontier.length,
    frontierNextIds: trace.frontier.reduce(
      (sum, item) => sum + item.nextIds.length,
      0
    ),
    blockedEventRecords: trace.blockedEvent?.recordIds.length ?? 0,
    requiredMaxRecords: trace.blockedEvent?.requiredMaxRecords ?? null,
    coverage: trace.coverage,
    jsonBytes: Buffer.byteLength(JSON.stringify(trace))
  };
}

function investigationOperation(): () => Promise<Summary> {
  const states = investigationStates();
  const context = createInvestigationRelationContext(states);
  assert.equal(context.graph().ids.size, size);
  assert.equal(context.graph().edges.length, expectedEdges);
  assert.deepEqual(validateInvestigationRelationGraph(context), []);
  if (action === "build")
    return async () => {
      const built = createInvestigationRelationContext(states).graph();
      assert.equal(built.ids.size, size);
      assert.equal(built.edges.length, expectedEdges);
      return {
        status: "ok",
        ...identity,
        includes:
          "relation context and forward/reverse graph construction; count assertions"
      };
    };
  if (action === "validate")
    return async () => {
      const errors = validateInvestigationRelationGraph(context);
      assert.deepEqual(errors, []);
      return {
        status: "ok",
        ...identity,
        issues: errors.length,
        includes: "full graph validation on already built graph"
      };
    };
  if (action === "evidence") return investigationEvidenceOperation(context);
  return async () => {
    const anchorId = investigationId(shape === "chain" ? size - 1 : 0);
    const traced = traceLoadedInvestigation(
      context,
      "pure-memory-no-index.json",
      anchorId,
      traceOptions
    );
    assert.equal(traced.status, "ok");
    return traceSummary(traced);
  };
}

function investigationEvidenceOperation(
  context: InvestigationRelationContext
): () => Promise<Summary> {
  return async () => {
    const result = filterRelationsByEntry(context, { relationType: "归并" });
    assert.ok(result.isOk());
    assert.ok(result.value !== null);
    assert.equal(result.value.size, 1);
    const evidence = result.value.get(investigationId(0));
    assert.ok(evidence !== undefined);
    assert.equal(evidence.length, expectedEdges);
    assert.equal(
      new Set(evidence.map((edge) => edge.target)).size,
      expectedEdges
    );
    assert.ok(
      evidence.every(
        (edge) => edge.sourceId === investigationId(0) && edge.type === "归并"
      )
    );
    return {
      status: "ok",
      ...identity,
      includes:
        "type-only filterRelationsByEntry, evidence dedup/sort and linear count assertions",
      excludes:
        "graph build/validation, list sorting/paging, index loading, filesystem, CLI output",
      returnedRecords: result.value.size,
      evidence: evidence.length,
      distinctTargets: expectedEdges,
      expectedSomeComparisons: (expectedEdges * (expectedEdges - 1)) / 2
    };
  };
}

function decisionTrace(
  provider: DecisionRelationGraphProvider,
  recordsById: ReadonlyMap<string, IndexedDecisionRecord>
): DecisionTraceSuccess {
  const anchorId = decisionId(shape === "chain" ? size - 1 : 0);
  const traced = traceDecisionRelations(provider, anchorId, traceOptions);
  const entries: Record<string, DecisionTraceEntry> = {};
  for (const id of [
    ...new Set([...traced.traceIds, ...traced.contextIds])
  ].sort()) {
    const record = recordsById.get(id);
    assert.ok(record !== undefined);
    entries[id] = {
      ...record.projection,
      alignment: record.alignment,
      status: record.status,
      createdAt: record.createdAt,
      tags: [...record.tags],
      relations: record.projection.relations.map((relation) => ({
        ...relation
      }))
    };
  }
  // This local wrapper mirrors the public entry projection; it is not a CLI/API call.
  return {
    ...traced,
    anchorId,
    direction: traceOptions.direction,
    entries,
    limits: { depth: "all", maxRecords: traceOptions.maxRecords },
    source: decisionPublishedSnapshotSource,
    status: "ok"
  };
}

function decisionOperation(): () => Promise<Summary> {
  const records = decisionRecords();
  const provider = createDecisionRelationGraphProvider(records);
  assert.equal(provider().ids.size, size);
  assert.equal(provider().edges.length, expectedEdges);
  assert.deepEqual(decisionRelationConsistencyIssues(provider), []);
  if (action === "build")
    return async () => {
      const graph = createDecisionRelationGraphProvider(records)();
      assert.equal(graph.ids.size, size);
      assert.equal(graph.edges.length, expectedEdges);
      return {
        status: "ok",
        ...identity,
        includes:
          "Decision graph provider and sorted forward/reverse graph construction; count assertions"
      };
    };
  if (action === "validate")
    return async () => {
      const issues = decisionRelationConsistencyIssues(provider);
      assert.deepEqual(issues, []);
      return {
        status: "ok",
        ...identity,
        issues: issues.length,
        includes:
          "full Decision graph consistency validation on already built graph"
      };
    };
  const recordsById = new Map(
    records.map((record) => [record.decisionId, record])
  );
  return async () => traceSummary(decisionTrace(provider, recordsById));
}

const run =
  domain === "investigation" ? investigationOperation() : decisionOperation();
await measure(domain, operation, size, run);
