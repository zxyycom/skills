import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  candidateDecisionBody,
  findIndexEntry,
  readIndex,
  runSourceCli,
  withTemporaryWorkspace,
  writeDecision,
} from "./support.ts";

test("first establishment creates a root Decision ID and definition-six index", () =>
  withTemporaryWorkspace("first-establishment", async (workspaceRoot) => {
    const decisionId = "use-first-index.md";
    await writeDecision(workspaceRoot, decisionId, candidateDecisionBody());
    const activated = await runSourceCli([
      "activate",
      decisionId,
      "--alignment",
      "aligned",
      "--root",
      workspaceRoot,
    ]);
    assert.equal(activated.exitCode, 0, activated.stderr);
    const index = await readIndex(workspaceRoot);
    assert.equal(index.definitionVersion, 6);
    assert.deepEqual(index.metadata, {});
    assert.equal(findIndexEntry(index, decisionId).sourcePath, decisionId);
    assert.equal(findIndexEntry(index, decisionId).status, "active");
    assert.equal(
      path.basename(findIndexEntry(index, decisionId).sourcePath),
      decisionId,
    );
  }));

test("date-shaped IDs and titles remain valid candidates and can be activated", () =>
  withTemporaryWorkspace("date-shaped-candidate", async (workspaceRoot) => {
    const decisionId = "2026-choice.md";
    await writeDecision(
      workspaceRoot,
      decisionId,
      candidateDecisionBody({ title: "2026-08-15 日期样式标题" }),
    );
    const candidates = await runSourceCli([
      "candidates",
      "--root",
      workspaceRoot,
    ]);
    assert.equal(candidates.exitCode, 0, candidates.stderr);
    assert.match(candidates.stdout, new RegExp(decisionId));
    const activated = await runSourceCli([
      "activate",
      decisionId,
      "--alignment",
      "aligned",
      "--root",
      workspaceRoot,
    ]);
    assert.equal(activated.exitCode, 0, activated.stderr);
    assert.equal(
      findIndexEntry(await readIndex(workspaceRoot), decisionId).title,
      "2026-08-15 日期样式标题",
    );
  }));
