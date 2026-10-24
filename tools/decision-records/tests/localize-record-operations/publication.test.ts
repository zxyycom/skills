import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { renameDecisionRecord } from "../../src/decision-rename.ts";
import { a, b, fixture, sync } from "../support-local-contracts.ts";
import {
  candidateDecisionBody,
  decisionFilePath,
  runSourceCli,
  withTemporaryWorkspace,
  writeDecision
} from "../support.ts";

const indexPath = (root: string) =>
  path.join(root, "docs/decisions/decision-index.json");

test("Decision publication rejects drift of an active predecessor that it must archive", async () => {
  await withTemporaryWorkspace("actual-predecessor-drift", async (root) => {
    await fixture(root);
    const id = "261024-new-successor";
    await writeDecision(
      root,
      id,
      candidateDecisionBody({ id, relations: [{ type: "修订", target: a }] })
    );
    const before = await fs.readFile(decisionFilePath(root, id));
    const index = await fs.readFile(indexPath(root));
    await fs.appendFile(
      decisionFilePath(root, a),
      "\n- 未同步的实际改写来源\n"
    );
    const result = await runSourceCli([
      "publish",
      id,
      "--alignment",
      "aligned",
      "--keep-unrecorded-history",
      "--root",
      root
    ]);
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /sync-index/);
    assert.deepEqual(await fs.readFile(decisionFilePath(root, id)), before);
    assert.deepEqual(await fs.readFile(indexPath(root)), index);
    assert.match(
      await fs.readFile(decisionFilePath(root, a), "utf8"),
      /未同步的实际改写来源/
    );
  });
});
test("Decision rename discovers published referrers and rejects drift before rewriting any source", async () => {
  await withTemporaryWorkspace("actual-referrer-drift", async (root) => {
    await fixture(root);
    const archive = decisionFilePath(root, "archive/" + a);
    await fs.mkdir(path.dirname(archive), { recursive: true });
    await fs.rename(decisionFilePath(root, a), archive);
    await fs.writeFile(
      archive,
      (await fs.readFile(archive, "utf8")).replace(
        "status: active",
        "status: archived"
      )
    );
    await fs.writeFile(
      decisionFilePath(root, b),
      (await fs.readFile(decisionFilePath(root, b), "utf8")).replace(
        "relations: []",
        "relations:\n  - type: 修订\n    target: " + a
      )
    );
    await sync(root);
    const source = await fs.readFile(archive);
    const index = await fs.readFile(indexPath(root));
    await fs.appendFile(decisionFilePath(root, b), "\n- 未同步引用者\n");
    const result = await renameDecisionRecord({
      workspaceRoot: root,
      source: a,
      target: "renamed-local"
    });
    assert.equal(result.status, "error");
    assert.match(JSON.stringify(result), /sync-index/);
    assert.deepEqual(await fs.readFile(archive), source);
    assert.deepEqual(await fs.readFile(indexPath(root)), index);
    assert.match(
      await fs.readFile(decisionFilePath(root, b), "utf8"),
      /未同步引用者/
    );
  });
});
test("Decision rename rejects a target ID already held by a noncanonical candidate without modifying either source", async () => {
  await withTemporaryWorkspace("rename-candidate-id-conflict", async (root) => {
    await fixture(root);
    const sourceId = "261024-before-conflict";
    const targetId = "261024-held-target";
    await writeDecision(
      root,
      sourceId,
      candidateDecisionBody({ id: sourceId })
    );
    const targetPath = path.join(
      root,
      "docs/decisions/arbitrary-candidate-path.md"
    );
    await fs.writeFile(targetPath, candidateDecisionBody({ id: targetId }));
    const source = await fs.readFile(decisionFilePath(root, sourceId));
    const target = await fs.readFile(targetPath);
    const index = await fs.readFile(indexPath(root));
    const result = await renameDecisionRecord({
      workspaceRoot: root,
      source: sourceId,
      target: targetId
    });
    assert.equal(result.status, "error");
    assert.match(JSON.stringify(result), /rename-id-conflict/);
    assert.deepEqual(
      await fs.readFile(decisionFilePath(root, sourceId)),
      source
    );
    assert.deepEqual(await fs.readFile(targetPath), target);
    assert.deepEqual(await fs.readFile(indexPath(root)), index);
  });
});
