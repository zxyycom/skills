import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { executeDecisionQuery } from "../../src/query/decision-query-service.ts";
import type { DecisionLocation } from "../../src/query/decision-query-context.ts";
import {
  decisionNameFromId,
  isDecisionSourcePath
} from "../../src/collection/decision-path.ts";
import type { DecisionId, DecisionIndex } from "../../src/types.ts";
import {
  archivedDecisionId,
  currentDecisionId,
  decisionIdForTest,
  readIndex,
  withFixtureWorkspace,
  writeIndex
} from "../support/support.ts";

function addSnapshotRecord(index: DecisionIndex, id: DecisionId): void {
  const sourcePath = `${id}.md`;
  assert.ok(isDecisionSourcePath(sourcePath));
  index.entries[id] = {
    ...index.entries[currentDecisionId],
    createdAt: "2026-10-20T08:00:00+08:00",
    name: decisionNameFromId(id),
    relations: [
      { type: "修订", target: archivedDecisionId, summary: "保留发布快照" }
    ],
    sourcePath
  };
  index.sourceRevision.entries[id] =
    index.sourceRevision.entries[currentDecisionId]!;
}

type LargePublishedSnapshot = Readonly<{
  ids: readonly DecisionId[];
  index: DecisionIndex;
  location: DecisionLocation;
}>;

async function withLargePublishedSnapshot(
  label: string,
  run: (snapshot: LargePublishedSnapshot) => Promise<void>
): Promise<void> {
  await withFixtureWorkspace(label, async (root) => {
    const original = await readIndex(root);
    const index: DecisionIndex = {
      ...original,
      entries: { ...original.entries },
      sourceRevision: {
        ...original.sourceRevision,
        entries: { ...original.sourceRevision.entries }
      }
    };
    const ids = Array.from({ length: 1001 }, (_, position) =>
      decisionIdForTest(`261020-snapshot-${String(position).padStart(4, "0")}`)
    );
    for (const id of [...ids].reverse()) addSnapshotRecord(index, id);
    await writeIndex(
      path.join(root, "docs/decisions/decision-index.json"),
      index
    );
    await run({
      ids,
      index,
      location: { decisionsDir: "docs/decisions", workspaceRoot: root }
    });
  });
}

test("Decision list paginates a complete published snapshot beyond the reader page limit", async () => {
  await withLargePublishedSnapshot(
    "loaded-snapshot-pages",
    async ({ ids, location }) => {
      const listed = await executeDecisionQuery({
        alignment: "all",
        command: "list",
        limit: 2,
        location,
        offset: 999,
        status: "all",
        tags: []
      });
      assert.ok(listed.status === "ok" && listed.command === "list");
      assert.equal(listed.total, 1003);
      assert.deepEqual(
        listed.records.map(({ decisionId }) => decisionId),
        ids.slice(999)
      );
      assert.equal(listed.facets.recordCount, 1003);
      assert.deepEqual(listed.facets.statuses, { active: 1002, archived: 1 });
      assert.deepEqual(listed.facets.alignments, {
        aligned: 1002,
        unaligned: 1
      });
      assert.deepEqual(
        listed.facets.createdAt.months.find(({ month }) => month === "2026-10"),
        { count: 1001, month: "2026-10" }
      );
      assert.deepEqual(listed.source, {
        kind: "published-index",
        currentness: "unchecked",
        fallback: false
      });
      assert.deepEqual(listed.warnings, []);
    }
  );
});

test("Decision list preserves filter intersections facets and relation evidence in a large published snapshot", async () => {
  await withLargePublishedSnapshot(
    "loaded-snapshot-filters",
    async ({ ids, index, location }) => {
      for (const [suffix, changes] of [
        ["alignment", { alignment: "unaligned" }],
        ["tags", { tags: ["unrelated"] }],
        ["type", { relations: [{ type: "替代", target: archivedDecisionId }] }],
        ["direction", { relations: [] }]
      ] as const) {
        const id = decisionIdForTest(`261020-interference-${suffix}`);
        addSnapshotRecord(index, id);
        Object.assign(index.entries[id], changes);
      }
      await writeIndex(
        path.join(location.workspaceRoot, "docs/decisions/decision-index.json"),
        index
      );

      const listed = await executeDecisionQuery({
        alignment: "all",
        command: "list",
        limit: 2,
        location,
        offset: 999,
        status: "all",
        tags: []
      });
      assert.ok(listed.status === "ok" && listed.command === "list");
      const filtered = await executeDecisionQuery({
        alignment: "aligned",
        command: "list",
        createdAtFrom: "2026-10-20T00:00:00Z",
        createdAtTo: "2026-10-20T08:00:00+08:00",
        direction: "successors",
        limit: 2,
        location,
        offset: 999,
        relatedTo: archivedDecisionId,
        relationType: "修订",
        status: "active",
        tags: [...index.entries[currentDecisionId].tags]
      });
      assert.ok(filtered.status === "ok" && filtered.command === "list");
      assert.equal(filtered.total, 1001);
      assert.deepEqual(filtered.facets, listed.facets);
      assert.deepEqual(
        filtered.records.map(({ decisionId }) => decisionId),
        ids.slice(999)
      );
      assert.deepEqual(filtered.records[0]?.filterRelations, [
        {
          sourceId: ids[999],
          type: "修订",
          target: archivedDecisionId,
          summary: "保留发布快照"
        }
      ]);
    }
  );
});

test("Decision trace resolves exact IDs and names beyond the reader page limit", async () => {
  await withLargePublishedSnapshot(
    "loaded-snapshot-trace",
    async ({ ids, location }) => {
      for (const selector of [ids[1000]!, "snapshot-1000.MD"]) {
        const traced = await executeDecisionQuery({
          command: "trace",
          decisionId: selector,
          direction: "predecessors",
          location
        });
        assert.ok(traced.status === "ok" && traced.command === "trace");
        assert.equal(traced.anchorId, ids[1000]);
        assert.deepEqual(
          new Set(traced.traceIds),
          new Set([ids[1000], archivedDecisionId])
        );
        assert.deepEqual(
          Object.keys(traced.entries),
          [archivedDecisionId, ids[1000]!].sort()
        );
        assert.deepEqual(traced.entries[ids[1000]!]!.relations, [
          { type: "修订", target: archivedDecisionId, summary: "保留发布快照" }
        ]);
        assert.deepEqual(traced.source, {
          kind: "published-index",
          currentness: "unchecked",
          fallback: false
        });
        assert.deepEqual(traced.warnings, []);
        assert.deepEqual(traced.coverage, { complete: true, stoppedBy: [] });
      }
    }
  );
});

test("Decision loaded snapshot selectors retain exact IDs missing errors and lexically ordered name ambiguity", async () => {
  await withFixtureWorkspace("loaded-snapshot-selectors", async (root) => {
    const original = await readIndex(root);
    const index: DecisionIndex = {
      ...original,
      entries: { ...original.entries },
      sourceRevision: {
        ...original.sourceRevision,
        entries: { ...original.sourceRevision.entries }
      }
    };
    for (const id of [
      "shared-name",
      "261020-shared-name",
      "261019-shared-name"
    ]) {
      addSnapshotRecord(index, decisionIdForTest(id));
    }
    await writeIndex(
      path.join(root, "docs/decisions/decision-index.json"),
      index
    );
    const location = { decisionsDir: "docs/decisions", workspaceRoot: root };
    for (const command of ["show", "trace"] as const) {
      const ambiguous = await executeDecisionQuery({
        command,
        decisionId: "shared-name.md",
        location
      });
      assert.equal(ambiguous.status, "error");
      assert.deepEqual(ambiguous.errors, [
        "Established decision name is ambiguous: shared-name; choose one standard ID: 261019-shared-name, 261020-shared-name, shared-name"
      ]);
      assert.equal(ambiguous.exitCode, 1);
      for (const selector of ["missing-name", "261020-missing-name"]) {
        const missing = await executeDecisionQuery({
          command,
          decisionId: selector,
          location
        });
        assert.equal(missing.status, "error");
        assert.deepEqual(missing.errors, [
          `Established decision does not exist: ${selector}`
        ]);
        assert.equal(missing.exitCode, 1);
      }
    }
    const exact = await executeDecisionQuery({
      command: "trace",
      decisionId: "261020-shared-name.MD",
      direction: "predecessors",
      location
    });
    assert.ok(exact.status === "ok" && exact.command === "trace");
    assert.equal(exact.anchorId, "261020-shared-name");
  });
});
