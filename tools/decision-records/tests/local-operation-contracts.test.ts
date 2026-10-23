import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { executeDecisionQuery } from "../src/decision-query-service.ts";
import { loadDecisionMaintenanceContext } from "../src/decision-maintenance-context.ts";
import { applyPreparedDecisionTransaction } from "../src/decision-transaction.ts";
import { prepareDecisionLifecycle } from "../src/decision-lifecycle-service.ts";
import { isDecisionSourcePath } from "../src/decision-path.ts";
import {
  candidateDecisionBody,
  decisionFilePath,
  runGit,
  runSourceCli,
  withTemporaryWorkspace,
  writeDecision
} from "./support.ts";
import { a, b, fixture, stage, parseIndex } from "./support-local-contracts.ts";

test("Decision ordinary maintenance preserves unrelated unpublished broken sources for explicit check", async () => {
  await withTemporaryWorkspace("local-maintenance", async (root) => {
    await fixture(root);
    await fs.writeFile(
      decisionFilePath(root, b),
      "unrelated invalid Markdown\n"
    );
    const result = await runSourceCli(["mark-aligned", a, "--root", root]);
    assert.equal(result.exitCode, 0, result.stderr);
    assert.match(
      await fs.readFile(decisionFilePath(root, a), "utf8"),
      /alignment: aligned/
    );
    const index = parseIndex(
      await fs.readFile(
        path.join(root, "docs/decisions/decision-index.json"),
        "utf8"
      )
    );
    assert.equal(index.entries[b]!.title, "原始 B");
    assert.equal((await runSourceCli(["check", "--root", root])).exitCode, 1);
    assert.equal(
      await fs.readFile(decisionFilePath(root, b), "utf8"),
      "unrelated invalid Markdown\n"
    );
  });
});

test("Decision ordinary maintenance rejects relevant source drift without writing", async () => {
  await withTemporaryWorkspace("local-maintenance-relevant", async (root) => {
    await fixture(root);
    const indexFile = path.join(root, "docs/decisions/decision-index.json");
    const before = await fs.readFile(indexFile, "utf8");
    await fs.appendFile(decisionFilePath(root, a), "\n- unpublished change\n");
    const source = await fs.readFile(decisionFilePath(root, a), "utf8");
    const result = await runSourceCli(["mark-aligned", a, "--root", root]);
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /sync-index/);
    assert.equal(await fs.readFile(indexFile, "utf8"), before);
    assert.equal(await fs.readFile(decisionFilePath(root, a), "utf8"), source);
  });
});

test("Decision published maintenance rechecks prepared dependency bytes before writing", async () => {
  await withTemporaryWorkspace("local-maintenance-cas", async (root) => {
    await fixture(root);
    const request = { action: "mark-aligned" as const, decisionId: a };
    const context = await loadDecisionMaintenanceContext(
      { workspaceRoot: root },
      request
    );
    const prepared = prepareDecisionLifecycle(context, request, {
      historyBaseline: null
    });
    assert.equal(prepared.status, "ok");
    if (prepared.status !== "ok") return;
    await fs.appendFile(decisionFilePath(root, a), "\n- concurrent source\n");
    const current = await fs.readFile(decisionFilePath(root, a), "utf8");
    const index = await fs.readFile(context.indexPath, "utf8");
    const result = await applyPreparedDecisionTransaction({
      context,
      changes: prepared.changes
    });
    assert.equal(result.status, "error");
    if (result.status === "error") assert.equal(result.outcome, "no-change");
    assert.equal(await fs.readFile(decisionFilePath(root, a), "utf8"), current);
    assert.equal(await fs.readFile(context.indexPath, "utf8"), index);
  });
});

test("Decision ordinary publication evolution relations archive and reactivation reuse the published baseline", async () => {
  await withTemporaryWorkspace("local-maintenance-actions", async (root) => {
    await fixture(root);
    await fs.writeFile(
      decisionFilePath(root, b),
      "unrelated invalid Markdown\n"
    );
    for (const command of [
      ["archive", a, "--keep-unrecorded-history"],
      ["reactivate", a, "--alignment", "unaligned"],
      ["set-relations", "--source", a, "--clear-relations"]
    ]) {
      const result = await runSourceCli([...command, "--root", root]);
      assert.equal(result.exitCode, 0, result.stderr);
    }
    const c = "local-candidate";
    await writeDecision(root, c, candidateDecisionBody({ id: c }));
    const published = await runSourceCli([
      "publish",
      c,
      "--alignment",
      "unaligned",
      "--root",
      root
    ]);
    assert.equal(published.exitCode, 0, published.stderr);
    const evolved = await runSourceCli([
      "evolve",
      "--successor",
      "unaligned=" + c,
      "--relation",
      "修订=" + a,
      "--keep-unrecorded-history",
      "--root",
      root
    ]);
    assert.equal(evolved.exitCode, 0, evolved.stderr);
    assert.match(
      await fs.readFile(decisionFilePath(root, "archive/" + a), "utf8"),
      /status: archived/
    );
    assert.match(
      await fs.readFile(decisionFilePath(root, c), "utf8"),
      new RegExp("target: " + a)
    );
    assert.equal(
      await fs.readFile(decisionFilePath(root, b), "utf8"),
      "unrelated invalid Markdown\n"
    );
    assert.equal((await runSourceCli(["check", "--root", root])).exitCode, 1);
  });
});

test("Decision local operations reject a symbolic archive directory before any source or pending write", async () => {
  await withTemporaryWorkspace("local-source-parent-safety", async (root) => {
    await fixture(root, true);
    const outside = path.join(root, "outside");
    await fs.mkdir(outside);
    const archive = path.join(root, "docs/decisions/archive");
    const source = (
      await fs.readFile(decisionFilePath(root, a), "utf8")
    ).replace("status: active", "status: archived");
    await fs.writeFile(path.join(outside, a + ".md"), source);
    await fs.symlink(outside, archive);
    const indexFile = path.join(root, "docs/decisions/decision-index.json");
    const index = parseIndex(await fs.readFile(indexFile, "utf8"));
    const archivedPath = "archive/" + a + ".md";
    assert.ok(isDecisionSourcePath(archivedPath));
    await fs.writeFile(
      indexFile,
      JSON.stringify({
        ...index,
        entries: {
          ...index.entries,
          [a]: {
            ...index.entries[a],
            sourcePath: archivedPath,
            status: "archived"
          }
        }
      })
    );
    const before = runGit(root, ["write-tree"]);
    assert.equal((await stage(root, [a], "all")).status, "error");
    assert.equal(
      (
        await runSourceCli([
          "reactivate",
          a,
          "--alignment",
          "unaligned",
          "--root",
          root
        ])
      ).exitCode,
      1
    );
    assert.equal(runGit(root, ["write-tree"]), before);
    assert.equal(
      await fs.readFile(path.join(outside, a + ".md"), "utf8"),
      source
    );
  });
});

test("Decision candidate SDK selectors normalize one case-insensitive Markdown suffix", async () => {
  await withTemporaryWorkspace("local-candidate-sdk-selector", async (root) => {
    const id = "261022-topic";
    await writeDecision(
      root,
      id,
      candidateDecisionBody({ id, title: "SDK 选择候选" })
    );
    for (const selector of [id + ".MD", "topic.md"]) {
      const result = await executeDecisionQuery({
        command: "show-candidate",
        decisionId: selector,
        location: { workspaceRoot: root, decisionsDir: "docs/decisions" }
      });
      assert.equal(result.status, "ok", JSON.stringify(result));
      if (result.status !== "ok" || result.command !== "show-candidate")
        throw new Error("Expected the selected candidate result");
      assert.equal(result.record.decisionId, id);
      assert.match(result.body, /title: SDK 选择候选/);
    }
    const repeatedSuffix = await executeDecisionQuery({
      command: "show-candidate",
      decisionId: "topic.md.md",
      location: { workspaceRoot: root, decisionsDir: "docs/decisions" }
    });
    assert.equal(repeatedSuffix.status, "error");
  });
});
