import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { renameDecisionRecord } from "../src/decision-rename.ts";
import { applyPreparedDecisionTransaction } from "../src/decision-transaction.ts";
import { loadDecisionMaintenanceContext } from "../src/decision-maintenance-context.ts";
import {
  prepareDecisionLifecycle,
  type DecisionLifecycleRequest
} from "../src/decision-lifecycle-service.ts";
import {
  candidateDecisionBody,
  commitWorkspace,
  decisionFilePath,
  runSourceCli,
  withTemporaryWorkspace,
  writeDecision
} from "./support.ts";
import {
  a,
  b,
  fixture,
  formal,
  parseIndex,
  sync
} from "./support-local-contracts.ts";

const indexPath = (root: string) =>
  path.join(root, "docs/decisions/decision-index.json");

test("Decision lifecycle preflight ignores busy mutation lock and writes neither sources nor index", async () => {
  await withTemporaryWorkspace(
    "transaction-readonly-preflight",
    async (root) => {
      await fixture(root);
      const source = await fs.readFile(decisionFilePath(root, a));
      const index = await fs.readFile(indexPath(root));
      const lock = path.join(root, "docs/.decision-index.json.mutation.lock");
      await fs.writeFile(lock, "cooperating writer\n");
      const result = await runSourceCli([
        "set-relations",
        "--source",
        a,
        "--clear-relations",
        "--preflight",
        "--root",
        root
      ]);
      assert.equal(result.exitCode, 0, result.stderr);
      assert.match(result.stdout, /preflight passed/);
      assert.deepEqual(await fs.readFile(decisionFilePath(root, a)), source);
      assert.deepEqual(await fs.readFile(indexPath(root)), index);
      assert.equal(await fs.readFile(lock, "utf8"), "cooperating writer\n");
      await fs.appendFile(decisionFilePath(root, a), "\n- unpublished edit\n");
      const invalid = await runSourceCli([
        "set-relations",
        "--source",
        a,
        "--clear-relations",
        "--preflight",
        "--root",
        root
      ]);
      assert.equal(invalid.exitCode, 1);
      assert.doesNotMatch(invalid.stderr, /collection-lock-busy/);
      assert.match(invalid.stderr, /sync-index/);
    }
  );
});

test("Decision unchanged maintenance still refuses dependency drift between prepare and fresh", async () => {
  await withTemporaryWorkspace("transaction-unchanged-fresh", async (root) => {
    await fixture(root);
    const request: DecisionLifecycleRequest = {
      action: "set-relations",
      preflight: false,
      relationOverrideGroups: [
        { source: a, relationOverride: { kind: "replace", relations: [] } }
      ]
    };
    const context = await loadDecisionMaintenanceContext(
      { workspaceRoot: root },
      request
    );
    const prepared = prepareDecisionLifecycle(context, request, {
      historyBaseline: null
    });
    assert.equal(prepared.status, "ok");
    if (prepared.status !== "ok")
      throw new Error("Expected relation preparation");
    assert.equal(prepared.changes.length, 0);
    const index = await fs.readFile(indexPath(root));
    const descriptor = Object.getOwnPropertyDescriptor(fs, "readdir");
    assert.ok(descriptor);
    const readdir = fs.readdir.bind(fs);
    let reads = 0;
    Object.defineProperty(fs, "readdir", {
      ...descriptor,
      value: async (...args: Parameters<typeof fs.readdir>) => {
        const entries = await readdir(...args);
        if (String(args[0]) === context.decisionsDirectory && ++reads === 2)
          await fs.appendFile(decisionFilePath(root, a), "\n- winner edit\n");
        return entries;
      }
    });
    try {
      const result = await applyPreparedDecisionTransaction({
        context,
        changes: prepared.changes
      });
      assert.equal(result.status, "error");
      if (result.status === "error") assert.equal(result.outcome, "no-change");
    } finally {
      Object.defineProperty(fs, "readdir", descriptor);
    }
    assert.match(
      await fs.readFile(decisionFilePath(root, a), "utf8"),
      /winner edit/
    );
    assert.deepEqual(await fs.readFile(indexPath(root)), index);
  });
});

test("Decision same identity and path rename preserves noncanonical bytes modes and index without history confirmation", async () => {
  await withTemporaryWorkspace("transaction-rename-noop", async (root) => {
    await fixture(root, true);
    const source = path.join(root, "docs/decisions/local-a.md");
    await fs.rename(decisionFilePath(root, a), source);
    await sync(root);
    commitWorkspace(root);
    await fs.appendFile(
      decisionFilePath(root, b),
      "\n## 决策\n- 重复标题使无关正文失效。\n"
    );
    await fs.writeFile(
      source,
      (await fs.readFile(source, "utf8")).replace(
        "relations: []",
        "relations: [ ]"
      )
    );
    await fs.chmod(source, 0o750);
    const before = await fs.readFile(source);
    const index = await fs.readFile(indexPath(root));
    const inode = (await fs.stat(source)).ino;
    const result = await renameDecisionRecord({
      workspaceRoot: root,
      source: a,
      target: a
    });
    assert.equal(result.status, "ok", JSON.stringify(result));
    if (result.status === "ok") assert.equal(result.changed, false);
    assert.deepEqual(await fs.readFile(source), before);
    assert.equal((await fs.stat(source)).mode & 0o777, 0o750);
    assert.equal((await fs.stat(source)).ino, inode);
    assert.deepEqual(await fs.readFile(indexPath(root)), index);
  });
});

test("Decision real rename retains full collection body validation", async () => {
  await withTemporaryWorkspace("transaction-rename-strict", async (root) => {
    await fixture(root);
    await fs.appendFile(
      decisionFilePath(root, b),
      "\n## 决策\n- 无关正文仍必须完整合法。\n"
    );
    const source = await fs.readFile(decisionFilePath(root, a));
    const index = await fs.readFile(indexPath(root));
    const result = await renameDecisionRecord({
      workspaceRoot: root,
      source: a,
      target: "changed-name"
    });
    assert.equal(result.status, "error");
    assert.deepEqual(await fs.readFile(decisionFilePath(root, a)), source);
    assert.deepEqual(await fs.readFile(indexPath(root)), index);
  });
});

test("Decision deleting final formal member keeps an empty usable index and permits later publication", async () => {
  await withTemporaryWorkspace("transaction-final-discard", async (root) => {
    await formal(root, a, "最后正式决策");
    await sync(root);
    const discarded = await runSourceCli(["discard", a, "--root", root]);
    assert.equal(discarded.exitCode, 0, discarded.stderr);
    assert.deepEqual(
      Object.keys(
        parseIndex(await fs.readFile(indexPath(root), "utf8")).entries
      ),
      []
    );
    assert.equal((await runSourceCli(["list", "--root", root])).exitCode, 0);
    await writeDecision(
      root,
      "261023-after-empty",
      candidateDecisionBody({ id: "261023-after-empty" })
    );
    const published = await runSourceCli([
      "publish",
      "261023-after-empty",
      "--alignment",
      "unaligned",
      "--root",
      root
    ]);
    assert.equal(published.exitCode, 0, published.stderr);
    assert.deepEqual(
      Object.keys(
        parseIndex(await fs.readFile(indexPath(root), "utf8")).entries
      ),
      ["261023-after-empty"]
    );
  });
});

test("Decision candidate rename and discard use their own commit point without manufacturing a formal index", async () => {
  await withTemporaryWorkspace("transaction-candidate-commit", async (root) => {
    await writeDecision(
      root,
      "261023-before",
      candidateDecisionBody({ id: "261023-before" })
    );
    const renamed = await renameDecisionRecord({
      workspaceRoot: root,
      source: "261023-before",
      target: "after"
    });
    assert.equal(renamed.status, "ok", JSON.stringify(renamed));
    if (renamed.status === "ok") assert.equal(renamed.changed, true);
    await assert.rejects(fs.access(indexPath(root)));
    const discarded = await runSourceCli([
      "discard",
      "261023-after",
      "--root",
      root
    ]);
    assert.equal(discarded.exitCode, 0, discarded.stderr);
    await assert.rejects(fs.access(indexPath(root)));
    assert.deepEqual(await fs.readdir(path.dirname(indexPath(root))), []);
  });
});

test("Decision bootstrap publication and index writer rejection retain the committed source and mutation fact", async () => {
  await withTemporaryWorkspace("transaction-bootstrap-commit", async (root) => {
    await writeDecision(
      root,
      "261023-first",
      candidateDecisionBody({ id: "261023-first" })
    );
    const descriptor = Object.getOwnPropertyDescriptor(fs, "link");
    assert.ok(descriptor);
    const link = fs.link.bind(fs);
    Object.defineProperty(fs, "link", {
      ...descriptor,
      value: async (...args: Parameters<typeof fs.link>) => {
        await link(...args);
        if (String(args[1]) === indexPath(root))
          throw new Error("writer rejected after actual index publication");
      }
    });
    try {
      const result = await runSourceCli([
        "publish",
        "261023-first",
        "--alignment",
        "unaligned",
        "--root",
        root
      ]);
      assert.equal(result.exitCode, 1);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /partial-or-unknown/);
      assert.doesNotMatch(result.stderr, /phase: committed/);
    } finally {
      Object.defineProperty(fs, "link", descriptor);
    }
    assert.match(
      await fs.readFile(decisionFilePath(root, "261023-first"), "utf8"),
      /status: active/
    );
    assert.deepEqual(
      Object.keys(
        parseIndex(await fs.readFile(indexPath(root), "utf8")).entries
      ),
      ["261023-first"]
    );
    assert.equal((await runSourceCli(["check", "--root", root])).exitCode, 0);
  });
});

import "./transaction-creation-modes.test.ts";
