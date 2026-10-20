import { decisionScanFromSources } from "./domain-fixture.ts";
import { candidateRecords } from "../src/decision-query-records.ts";
import { prepareDecisionLifecycle } from "../src/decision-lifecycle-service.ts";
import { buildDecisionStateSnapshotFromSources } from "../src/decision-state-index.ts";
import { decisionIdForTest } from "./support.ts";
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  candidateDecisionBody,
  findIndexEntry,
  readIndex,
  runSourceCli,
  withTemporaryWorkspace,
  writeDecision
} from "./support.ts";

test("first establishment creates a root Decision ID and definition-eleven index", () =>
  withTemporaryWorkspace("first-establishment", async (workspaceRoot) => {
    const decisionId = "use-first-index.md";
    await writeDecision(workspaceRoot, decisionId, candidateDecisionBody());
    const activated = await runSourceCli([
      "publish",
      decisionId,
      "--alignment",
      "aligned",
      "--root",
      workspaceRoot
    ]);
    assert.equal(activated.exitCode, 0, activated.stderr);
    const index = await readIndex(workspaceRoot);
    assert.equal(index.definitionVersion, 11);
    assert.deepEqual(index.metadata, {});
    assert.equal(findIndexEntry(index, decisionId).sourcePath, decisionId);
    assert.equal(findIndexEntry(index, decisionId).status, "active");
    assert.equal(findIndexEntry(index, decisionId).alignment, "aligned");
    assert.equal(
      path.basename(findIndexEntry(index, decisionId).sourcePath),
      decisionId
    );
  }));

test("date-shaped IDs and titles remain valid candidates and can be activated", async () => {
  const decisionId = "2026-choice";
  const scan = await decisionScanFromSources([
    {
      id: decisionId,
      text: candidateDecisionBody({
        id: decisionId,
        title: "2026-08-15 日期样式标题"
      })
    }
  ]);
  assert.deepEqual(scan.sourceErrors, []);
  assert.deepEqual(
    candidateRecords(scan).map((record) => record.decisionId),
    [decisionId]
  );
  const result = prepareDecisionLifecycle(
    scan,
    {
      action: "publish",
      decisionId: decisionIdForTest(decisionId),
      alignment: "aligned",
      keepUnrecordedHistory: true
    },
    { historyBaseline: null, currentTimestamp: () => "2026-10-20T00:00:00Z" }
  );
  assert.equal(result.status, "ok");
  if (result.status !== "ok") throw new Error("Expected publication plan");
  assert.equal(result.changes.length, 1);
  const snapshot = await buildDecisionStateSnapshotFromSources([
    {
      decisionId,
      sourcePath: `${decisionId}.md`,
      text: result.changes[0]!.nextText!
    }
  ]);
  assert.equal(snapshot.states[decisionId]?.title, "2026-08-15 日期样式标题");
});
