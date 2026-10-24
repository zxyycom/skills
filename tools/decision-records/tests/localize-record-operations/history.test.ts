import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { loadDecisionMaintenanceContext } from "../../src/decision-maintenance-context.ts";
import { loadDecisionHistoryBaseline } from "../../src/decision-history-baseline.ts";
import { pendingObjectPath } from "../../../shared/tests/record-stage-evidence.ts";
import { a, b, fixture, parseIndex } from "../support-local-contracts.ts";
import {
  candidateDecisionBody,
  decisionFilePath,
  runGit,
  runSourceCli,
  withTemporaryWorkspace,
  writeDecision
} from "../support.ts";

const indexPath = (root: string) =>
  path.join(root, "docs/decisions/decision-index.json");

test("Decision history gates load only selected historical payloads located by the HEAD index", async () => {
  await withTemporaryWorkspace("local-history-payload", async (root) => {
    await fixture(root, true);
    const missing = pendingObjectPath(root, "docs/decisions/" + b + ".md");
    await fs.unlink(missing);
    const result = await runSourceCli(["archive", a, "--root", root]);
    assert.equal(result.exitCode, 0, result.stderr);
    assert.match(
      await fs.readFile(decisionFilePath(root, "archive/" + a), "utf8"),
      /status: archived/
    );
    assert.equal(
      parseIndex(await fs.readFile(indexPath(root), "utf8")).entries[b]?.title,
      "原始 B"
    );
  });
});
test("Decision history gates diagnose a missing historical index instead of scanning formal blobs", async () => {
  await withTemporaryWorkspace("local-history-no-index", async (root) => {
    await fixture(root, true);
    runGit(root, ["rm", "--cached", "docs/decisions/decision-index.json"]);
    runGit(root, ["commit", "-m", "historical collection without index"]);
    const source = await fs.readFile(decisionFilePath(root, a));
    const index = await fs.readFile(indexPath(root));
    const result = await runSourceCli(["archive", a, "--root", root]);
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /Git HEAD Decision index is missing/);
    assert.deepEqual(await fs.readFile(decisionFilePath(root, a)), source);
    assert.deepEqual(await fs.readFile(indexPath(root)), index);
  });
});
test("Decision evolution checks recorded archived override targets without reading their workspace bodies", async () => {
  await withTemporaryWorkspace("history-override-target", async (root) => {
    await fixture(root, true);
    const archived = await runSourceCli(["archive", a, "--root", root]);
    assert.equal(archived.exitCode, 0, archived.stderr);
    runGit(root, ["add", "."]);
    runGit(root, ["commit", "-m", "record archived predecessor"]);
    const archive = decisionFilePath(root, "archive/" + a);
    await fs.writeFile(archive, "unrelated unpublished archived corruption\n");
    const id = "261024-override-successor";
    await writeDecision(root, id, candidateDecisionBody({ id }));
    const result = await runSourceCli([
      "evolve",
      "--successor",
      "aligned=" + id,
      "--relation",
      "修订=" + a,
      "--root",
      root
    ]);
    assert.equal(result.exitCode, 0, result.stderr);
    assert.match(
      await fs.readFile(decisionFilePath(root, id), "utf8"),
      new RegExp("target: " + a)
    );
    assert.equal(
      await fs.readFile(archive, "utf8"),
      "unrelated unpublished archived corruption\n"
    );
  });
});
test("Decision multi-selected history rejects identities swapped between their indexed source paths", async () => {
  await withTemporaryWorkspace(
    "history-path-identity-binding",
    async (root) => {
      await fixture(root, true);
      const sourceA = decisionFilePath(root, a);
      const sourceB = decisionFilePath(root, b);
      const textA = await fs.readFile(sourceA);
      const textB = await fs.readFile(sourceB);
      const index = await fs.readFile(indexPath(root));
      await fs.writeFile(sourceA, textB);
      await fs.writeFile(sourceB, textA);
      runGit(root, ["add", "docs/decisions"]);
      runGit(root, ["commit", "-m", "historical identity swap"]);
      await fs.writeFile(sourceA, textA);
      await fs.writeFile(sourceB, textB);
      const pending = runGit(root, ["write-tree"]);
      const context = await loadDecisionMaintenanceContext(
        { workspaceRoot: root },
        {
          action: "archive",
          decisionIds: [a, b],
          keepUnrecordedHistory: false
        }
      );
      const result = await loadDecisionHistoryBaseline(context, [a, b]);
      assert.equal(result.status, "error");
      assert.match(JSON.stringify(result), /history-baseline-invalid/);
      assert.match(
        JSON.stringify(result),
        /identity differs.*source|identity differs.*260901-local-a/
      );
      assert.deepEqual(await fs.readFile(sourceA), textA);
      assert.deepEqual(await fs.readFile(sourceB), textB);
      assert.deepEqual(await fs.readFile(indexPath(root)), index);
      assert.equal(runGit(root, ["write-tree"]), pending);
    }
  );
});
