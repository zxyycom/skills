import { executeDecisionQuery } from "../src/decision-query-service.ts";
import { decisionIdForTest } from "./support-record-fixture.ts";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { applyDecisionChanges } from "../src/decision-transaction.ts";
import { scanDecisionRecords } from "../src/scan.ts";
import {
  archivedDecisionId,
  archivedSourcePath,
  candidateDecisionBody,
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  fileExists,
  findIndexEntry,
  readIndex,
  runSourceLifecycleCli,
  runSuccessfulSourceLifecycleCli,
  withFixtureWorkspace,
  writeDecision
} from "./support.ts";

test("archive and reactivate move one Decision ID while preserving its Markdown semantics", () =>
  withFixtureWorkspace("lifecycle-move", async (workspaceRoot) => {
    const before = await fs.readFile(
      decisionFilePath(workspaceRoot, currentSourcePath),
      "utf8"
    );
    const archived = await runSourceLifecycleCli([
      "archive",
      currentDecisionId,
      "--root",
      workspaceRoot
    ]);
    assert.equal(archived.exitCode, 0, archived.stderr);
    const archivedPath = decisionFilePath(
      workspaceRoot,
      `archive/${currentDecisionId}.md`
    );
    assert.equal(
      await fileExists(decisionFilePath(workspaceRoot, currentSourcePath)),
      false
    );
    assert.equal(
      await fs.readFile(archivedPath, "utf8"),
      before.replace("status: active", "status: archived")
    );
    assert.equal(
      findIndexEntry(await readIndex(workspaceRoot), currentDecisionId)
        .sourcePath,
      `archive/${currentDecisionId}.md`
    );

    const reactivated = await runSourceLifecycleCli([
      "reactivate",
      currentDecisionId,
      "--alignment",
      "aligned",
      "--root",
      workspaceRoot
    ]);
    assert.equal(reactivated.exitCode, 0, reactivated.stderr);
    assert.equal(
      await fs.readFile(
        decisionFilePath(workspaceRoot, currentSourcePath),
        "utf8"
      ),
      before
    );
    assert.equal(
      findIndexEntry(await readIndex(workspaceRoot), currentDecisionId)
        .sourcePath,
      currentSourcePath
    );
  }));

test("relations resolve stable IDs across active and archived locations", () =>
  withFixtureWorkspace("relations-id", async (workspaceRoot) => {
    const candidateId = "use-id-relations";
    await writeDecision(
      workspaceRoot,
      candidateId,
      candidateDecisionBody({
        relations: [
          {
            type: "修订",
            target: currentDecisionId,
            summary: "保留稳定 CLI 基线"
          }
        ]
      })
    );
    const published = await runSourceLifecycleCli([
      "publish",
      candidateId,
      "--alignment",
      "unaligned",
      "--root",
      workspaceRoot
    ]);
    assert.equal(published.exitCode, 0, published.stderr);
    const index = await readIndex(workspaceRoot);
    assert.equal(findIndexEntry(index, currentDecisionId).status, "archived");
    assert.equal(
      findIndexEntry(index, currentDecisionId).sourcePath,
      `archive/${currentDecisionId}.md`
    );
    assert.deepEqual(findIndexEntry(index, candidateId).relations, [
      {
        type: "修订",
        target: currentDecisionId,
        summary: "保留稳定 CLI 基线"
      }
    ]);
    const traced = await executeDecisionQuery({
      command: "trace",
      decisionId: decisionIdForTest(candidateId),
      location: { workspaceRoot, decisionsDir: "docs/decisions" }
    });
    assert.ok(traced.status === "ok" && traced.command === "trace");
    assert.equal(
      traced.entries[candidateId]?.relations[0]?.summary,
      "保留稳定 CLI 基线"
    );
  }));

test("lifecycle rejects a source changed after its prewrite scan before moving either path", () =>
  withFixtureWorkspace("lifecycle-drift", async (workspaceRoot) => {
    const currentPath = decisionFilePath(workspaceRoot, currentSourcePath);
    const originalText = await fs.readFile(currentPath, "utf8");
    const indexPath = decisionFilePath(workspaceRoot, "decision-index.json");
    const indexBefore = await fs.readFile(indexPath, "utf8");
    const originalScan = await scanDecisionRecords({ workspaceRoot });
    const driftedText = originalText.replace(
      "使用生成 CLI",
      "已漂移的生成 CLI"
    );
    assert.notEqual(driftedText, originalText);
    await fs.writeFile(currentPath, driftedText, "utf8");
    const result = await applyDecisionChanges({
      changes: [
        {
          decisionPath: currentPath,
          expectedText: originalText,
          nextText: originalText.replace("status: active", "status: archived"),
          targetPath: decisionFilePath(
            workspaceRoot,
            `archive/${currentDecisionId}.md`
          )
        }
      ],
      originalScan,
      scanOptions: { workspaceRoot }
    });
    assert.equal(result.status, "error");
    assert.equal(await fs.readFile(currentPath, "utf8"), driftedText);
    assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
    assert.equal(
      await fileExists(
        decisionFilePath(workspaceRoot, `archive/${currentDecisionId}.md`)
      ),
      false
    );
    assert.equal(
      findIndexEntry(await readIndex(workspaceRoot), archivedDecisionId)
        .sourcePath,
      archivedSourcePath
    );
  }));

test("evolve binds a CLI relation summary after resolving its target selector", () =>
  withFixtureWorkspace("evolve-relation-summary", async (workspaceRoot) => {
    const candidateId = "use-cli-relation-summary";
    await writeDecision(workspaceRoot, candidateId, candidateDecisionBody());
    await runSuccessfulSourceLifecycleCli([
      "evolve",
      "--successor",
      "aligned=" + candidateId,
      "--relation",
      "修订=" + currentDecisionId,
      "--relation-summary",
      currentDecisionId + "=  保留=稳定基线  ",
      "--root",
      workspaceRoot
    ]);

    const index = await readIndex(workspaceRoot);
    assert.deepEqual(findIndexEntry(index, candidateId).relations, [
      {
        type: "修订",
        target: currentDecisionId,
        summary: "保留=稳定基线"
      }
    ]);
    const traced = await executeDecisionQuery({
      command: "trace",
      decisionId: decisionIdForTest(candidateId),
      location: { workspaceRoot, decisionsDir: "docs/decisions" }
    });
    assert.ok(traced.status === "ok" && traced.command === "trace");
    assert.equal(
      traced.entries[candidateId]?.relations[0]?.summary,
      "保留=稳定基线"
    );
  }));
