import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { resolveDecisionLifecycleRequest } from "../src/cli-lifecycle-selection.ts";
import {
  createDecisionRecordLookup,
  findDecisionRecord
} from "../src/decision-record-lookup.ts";
import { prepareDecisionLifecycle } from "../src/decision-lifecycle-service.ts";
import { directPredecessors } from "../src/decision-relation-transaction-predecessors.ts";
import { prepareSuccessors } from "../src/decision-relation-transaction-successors.ts";
import { scanDecisionRecords } from "../src/scan.ts";
import { isDecisionId } from "../src/decision-path.ts";
import type { DecisionId } from "../src/types.ts";
import {
  withTemporaryWorkspace,
  withFixtureWorkspace,
  writeDecision,
  candidateDecisionBody,
  runSourceCli
} from "./support.ts";
import {
  memoryReallocationRing,
  writeReallocationRing
} from "./reallocation-fixture.ts";

function archive(ids: readonly string[]) {
  // CLI resolution accepts selectors before converting them to stored IDs.
  return {
    action: "archive" as const,
    decisionIds: ids as readonly DecisionId[],
    keepUnrecordedHistory: true
  };
}

test("Decision batch selectors preserve complete ID priority and ambiguous names", async () => {
  await withFixtureWorkspace("batch-lookup-selectors", async (root) => {
    const ids = ["261001-shared", "261002-shared", "shared", "261332-legacy"];
    for (const id of ids) {
      await writeDecision(
        root,
        id,
        candidateDecisionBody({ id })
          .replace("status: candidate", "status: active")
          .replace("alignment: null", "alignment: aligned")
          .replace("createdAt: null", "createdAt: 2026-10-01T00:00:00Z")
      );
    }
    const synced = await runSourceCli(["sync-index", "--root", root]);
    assert.equal(synced.exitCode, 0, synced.stderr);
    const selected = await scanDecisionRecords({ workspaceRoot: root });
    assert.deepEqual(selected.errors, []);
    const result = resolveDecisionLifecycleRequest(
      selected,
      archive(["shared.MD"])
    );
    assert.equal(result.status, "error");
    if (result.status === "error")
      assert.match(
        JSON.stringify(result.failure),
        /261001-shared, 261002-shared, shared/u
      );
    assert.equal(
      resolveDecisionLifecycleRequest(selected, archive(["261003-shared"]))
        .status,
      "error"
    );
    for (const id of ["261001-shared", "261332-legacy"]) {
      const resolved = resolveDecisionLifecycleRequest(
        selected,
        archive([id + ".md"])
      );
      assert.equal(resolved.status, "ok");
      if (resolved.status === "ok" && resolved.request.action === "archive")
        assert.deepEqual(resolved.request.decisionIds, [id]);
    }
  });
});

test("Decision batch resolution and fresh preparation perform linear record lookup independently of selection and edge counts", async () => {
  for (const count of [10, 100]) {
    const { scan, successorIds } = await memoryReallocationRing(count);
    let visits = 0;
    const measured = {
      ...scan,
      records: scan.records.map((record) => ({
        ...record,
        get decisionId() {
          visits += 1;
          return record.decisionId;
        }
      }))
    };
    for (const size of [1, 5, Math.min(20, count)]) {
      visits = 0;
      const resolved = resolveDecisionLifecycleRequest(
        measured,
        archive(successorIds.slice(0, size))
      );
      assert.equal(resolved.status, "ok");
      assert.ok(
        visits <= 3 * scan.records.length + size,
        `resolution N=${scan.records.length}, S=${size}, visits=${visits}`
      );
      visits = 0;
      const prepared = prepareDecisionLifecycle(
        measured,
        archive(successorIds.slice(0, size)),
        { historyBaseline: null }
      );
      assert.equal(prepared.status, "ok");
      assert.ok(
        visits <= 4 * scan.records.length + 10 * size,
        `preparation visits=${visits}`
      );
    }
    visits = 0;
    const lookup = createDecisionRecordLookup(measured.records);
    const successors = prepareSuccessors(
      { scan: measured, records: lookup },
      archive(successorIds).decisionIds.map((decisionId) => ({
        decisionId,
        alignment: "aligned"
      })),
      { kind: "source" },
      "2026-10-11T00:00:00Z",
      false
    );
    assert.equal(successors.status, "ok");
    if (successors.status === "ok")
      assert.deepEqual(
        directPredecessors(lookup, successors.records).errors,
        []
      );
    assert.ok(
      visits <= 4 * scan.records.length + 12 * count,
      `ring N=${scan.records.length}, E=${2 * count}, visits=${visits}`
    );
  }
});

test("Decision lookup facts belong to their source phase and fresh scans observe identity changes", async () => {
  await withTemporaryWorkspace("batch-lookup-fresh", async (root) => {
    const { scan, successorIds } = await writeReallocationRing(root, 2);
    const id = successorIds[0]!;
    assert.ok(isDecisionId(id));
    const before = createDecisionRecordLookup(scan.records);
    const file = path.join(root, "docs/decisions", id + ".md");
    const text = await fs.readFile(file, "utf8");
    await fs.writeFile(file, text.replace(`id: ${id}`, "id: changed-phase-id"));
    const fresh = await scanDecisionRecords({ workspaceRoot: root });
    const after = createDecisionRecordLookup(fresh.records);
    assert.ok(findDecisionRecord(before, id));
    assert.equal(findDecisionRecord(after, id), null);
    assert.equal(
      prepareDecisionLifecycle(fresh, archive([id]), { historyBaseline: null })
        .status,
      "error"
    );
  });
});
