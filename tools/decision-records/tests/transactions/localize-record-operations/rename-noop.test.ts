import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { renameDecisionRecord } from "../../../src/rename/decision-rename.ts";
import { a, b, fixture, sync } from "../../support/support-local-contracts.ts";
import {
  candidateDecisionBody,
  decisionFilePath,
  withTemporaryWorkspace,
  writeDecision
} from "../../support/support.ts";

const indexPath = (root: string) =>
  path.join(root, "docs/decisions/decision-index.json");

test("Decision no-op rename rejects unpublished selected source drift without changing any bytes or identity", async () => {
  await withTemporaryWorkspace("noop-selected-revision", async (root) => {
    await fixture(root);
    const source = path.join(root, "docs/decisions/local-a.md");
    await fs.rename(decisionFilePath(root, a), source);
    await sync(root);
    await fs.appendFile(source, "\n- 所选未同步修订\n");
    const before = await fs.readFile(source);
    const stats = await fs.stat(source);
    const index = await fs.readFile(indexPath(root));
    for (const preflight of [true, false]) {
      const result = await renameDecisionRecord({
        workspaceRoot: root,
        source: a,
        target: a,
        preflight
      });
      assert.equal(result.status, "error");
      assert.match(
        JSON.stringify(result),
        /differs from published index; run sync-index/
      );
      assert.deepEqual(await fs.readFile(source), before);
      const after = await fs.stat(source);
      assert.equal(after.ino, stats.ino);
      assert.equal(after.mode, stats.mode);
      assert.deepEqual(await fs.readFile(indexPath(root)), index);
    }
  });
});
test("Decision exact ID no-op rename permits a different-date candidate with the same name", async () => {
  await withTemporaryWorkspace("noop-cross-date-name", async (root) => {
    await fixture(root);
    const source = path.join(root, "docs/decisions/local-a.md");
    await fs.rename(decisionFilePath(root, a), source);
    await sync(root);
    const other = "260902-local-a";
    await writeDecision(root, other, candidateDecisionBody({ id: other }));
    const before = await fs.readFile(source);
    const index = await fs.readFile(indexPath(root));
    const candidate = await fs.readFile(decisionFilePath(root, other));
    const result = await renameDecisionRecord({
      workspaceRoot: root,
      source: a,
      target: a
    });
    assert.equal(result.status, "ok", JSON.stringify(result));
    if (result.status !== "ok") assert.fail("Expected exact identity no-op");
    assert.equal(result.changed, false);
    assert.deepEqual(await fs.readFile(source), before);
    assert.deepEqual(await fs.readFile(indexPath(root)), index);
    assert.deepEqual(
      await fs.readFile(decisionFilePath(root, other)),
      candidate
    );
  });
});
test("Decision candidate no-op rename keeps its original local selection in fresh and ignores unrelated broken candidates", async () => {
  await withTemporaryWorkspace("noop-local-selection", async (root) => {
    await fixture(root);
    const occupied = path.join(root, "docs/decisions/local-a.md");
    await fs.rename(decisionFilePath(root, b), occupied);
    await sync(root);
    const id = "260902-local-a";
    await writeDecision(root, id, candidateDecisionBody({ id }));
    const source = decisionFilePath(root, id);
    const other = decisionFilePath(root, "261024-unselected-noop");
    const before = await fs.readFile(source);
    const index = await fs.readFile(indexPath(root));
    const originalOpen = fs.open;
    const forbidden: string[] = [];
    for (const unrelated of [
      candidateDecisionBody({ id: "261024-unselected-noop" }),
      "unclassifiable unrelated candidate\n"
    ]) {
      await fs.writeFile(other, unrelated);
      fs.open = (async (...args) => {
        if (args[0] === other) {
          forbidden.push(other);
          throw new Error("Unselected candidate must not be read");
        }
        return originalOpen(...args);
      }) as typeof fs.open;
      try {
        const result = await renameDecisionRecord({
          workspaceRoot: root,
          source: id,
          target: id
        });
        assert.equal(result.status, "ok", JSON.stringify(result));
        if (result.status === "ok") assert.equal(result.changed, false);
      } finally {
        fs.open = originalOpen;
      }
      assert.deepEqual(forbidden, []);
      assert.deepEqual(await fs.readFile(source), before);
      assert.deepEqual(await fs.readFile(indexPath(root)), index);
      assert.equal(await fs.readFile(other, "utf8"), unrelated);
    }
  });
});
