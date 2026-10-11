import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import * as v from "valibot";
import { resolveDecisionLifecycleRequest } from "../src/cli-lifecycle-selection.ts";
import {
  createDecisionRecordLookup,
  findDecisionRecord,
  findEstablishedDecisionRecord
} from "../src/decision-record-lookup.ts";
import { prepareDecisionLifecycle } from "../src/decision-lifecycle-service.ts";
import { directPredecessors } from "../src/decision-relation-transaction-predecessors.ts";
import { prepareSuccessors } from "../src/decision-relation-transaction-successors.ts";
import { scanDecisionRecords } from "../src/scan.ts";
import { isDecisionId } from "../src/decision-path.ts";
import type { DecisionId } from "../src/types.ts";
import {
  candidateDecisionBody,
  withTemporaryWorkspace,
  withGitFixtureWorkspace,
  runSuccessfulSourceCli,
  runSourceCli,
  runGit
} from "./support.ts";
import { writeReallocationRing } from "./reallocation-fixture.ts";

function archive(ids: readonly string[]) {
  // CLI resolution accepts selectors before converting them to stored IDs.
  return {
    action: "archive" as const,
    decisionIds: ids as readonly DecisionId[],
    keepUnrecordedHistory: true
  };
}

test("Decision batch selectors preserve complete ID priority, ambiguous names and duplicate first-record facts", async () => {
  await withTemporaryWorkspace("batch-selector-semantics", async (root) => {
    const { scan, records } = await writeReallocationRing(root, 2);
    const first = records[0]!;
    const ids = ["261001-shared", "261002-shared", "shared", "261332-legacy"];
    const selected = {
      ...scan,
      records: ids.map((decisionId) => ({ ...first, decisionId }))
    };
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
    const candidateFile = path.join(root, "docs/decisions/candidate.md");
    await fs.writeFile(
      candidateFile,
      candidateDecisionBody({ id: "candidate" })
    );
    const fresh = await scanDecisionRecords({ workspaceRoot: root });
    const candidate = fresh.records.find(
      (record) => record.decisionId === "candidate"
    )!;
    const duplicate = {
      ...scan,
      records: [{ ...candidate, decisionId: first.decisionId }, first]
    };
    const lookup = createDecisionRecordLookup(duplicate.records);
    assert.equal(
      findDecisionRecord(lookup, first.decisionId),
      duplicate.records[0]
    );
    assert.equal(findEstablishedDecisionRecord(lookup, first.decisionId), null);
    assert.equal(
      resolveDecisionLifecycleRequest(duplicate, archive([first.decisionId]))
        .status,
      "error"
    );
  });
});

test("Decision batch resolution and fresh preparation perform linear record lookup independently of selection and edge counts", async () => {
  for (const count of [10, 100])
    await withTemporaryWorkspace("batch-lookup-linear", async (root) => {
      const { scan, successorIds } = await writeReallocationRing(root, count);
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
    });
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

test("Decision stage and selected sync resolve mixed short names without changing duplicate and missing-source errors", async () => {
  await withGitFixtureWorkspace("batch-stage-sync-names", async (root) => {
    const { predecessorIds, successorIds } = await writeReallocationRing(
      root,
      10
    );
    await runSuccessfulSourceCli(["sync-index", "--root", root]);
    const selectors = [...predecessorIds, ...successorIds].map((id, index) =>
      index % 2 === 0 ? id.slice(7) : id
    );
    const synchronized = await runSuccessfulSourceCli([
      "sync-index",
      "--root",
      root,
      "--preflight",
      ...selectors.flatMap((selector) => ["--select", selector])
    ]);
    for (const id of successorIds) assert.ok(synchronized.includes(id));
    const before = runGit(root, ["write-tree"]);
    for (const command of ["stage", "sync-index"]) {
      const selected = [successorIds[0]!, successorIds[0]!.slice(7)];
      const duplicate = await runSourceCli([
        command,
        ...(command === "stage"
          ? selected
          : selected.flatMap((id) => ["--select", id])),
        "--root",
        root
      ]);
      assert.equal(
        duplicate.exitCode,
        command === "stage" ? 2 : 1,
        duplicate.stderr
      );
      assert.match(
        duplicate.stderr,
        /repeated Decision ID|selector-duplicate/u
      );
      const missing = await runSourceCli([
        command,
        ...(command === "stage"
          ? ["261002-missing"]
          : ["--select", "261002-missing"]),
        "--root",
        root
      ]);
      assert.equal(
        missing.exitCode,
        command === "stage" ? 2 : 1,
        missing.stderr
      );
      assert.match(
        missing.stderr,
        /does not exist in the revision or filesystem|selector-not-found/u
      );
      assert.equal(runGit(root, ["write-tree"]), before);
    }
    await runSuccessfulSourceCli([
      "stage",
      ...selectors,
      "--scope",
      "index",
      "--root",
      root
    ]);
    const pending = v.parse(
      v.object({ entries: v.record(v.string(), v.unknown()) }),
      JSON.parse(
        runGit(root, ["show", ":docs/decisions/decision-index.json"])
      ) as unknown
    );
    for (const id of successorIds) assert.ok(pending.entries[id]);
  });
});
