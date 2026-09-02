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
      `archive/${currentDecisionId}`
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
      `archive/${currentDecisionId}`
    );

    const reactivated = await runSourceLifecycleCli([
      "activate",
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
    const candidateId = "use-id-relations.md";
    await writeDecision(
      workspaceRoot,
      candidateId,
      candidateDecisionBody({
        relations: [{ type: "修订", target: currentDecisionId }]
      })
    );
    const activated = await runSourceLifecycleCli([
      "activate",
      candidateId,
      "--alignment",
      "unaligned",
      "--root",
      workspaceRoot
    ]);
    assert.equal(activated.exitCode, 0, activated.stderr);
    const index = await readIndex(workspaceRoot);
    assert.equal(findIndexEntry(index, currentDecisionId).status, "archived");
    assert.equal(
      findIndexEntry(index, currentDecisionId).sourcePath,
      `archive/${currentDecisionId}`
    );
    assert.deepEqual(findIndexEntry(index, candidateId).relations, [
      {
        type: "修订",
        target: currentDecisionId
      }
    ]);
  }));

test("lifecycle rejects a source changed after its prewrite scan before moving either path", () =>
  withFixtureWorkspace("lifecycle-drift", async (workspaceRoot) => {
    const currentPath = decisionFilePath(workspaceRoot, currentSourcePath);
    const originalText = await fs.readFile(currentPath, "utf8");
    const originalScan = await scanDecisionRecords({ workspaceRoot });
    await fs.writeFile(
      currentPath,
      originalText.replace("使用生成 CLI", "已漂移的生成 CLI"),
      "utf8"
    );
    const result = await applyDecisionChanges({
      changes: [
        {
          decisionPath: currentPath,
          expectedText: originalText,
          nextText: originalText.replace("status: active", "status: archived"),
          targetPath: decisionFilePath(
            workspaceRoot,
            `archive/${currentDecisionId}`
          )
        }
      ],
      originalScan,
      scanOptions: { workspaceRoot }
    });
    assert.equal(result.status, "error");
    assert.equal(await fileExists(currentPath), true);
    assert.equal(
      await fileExists(
        decisionFilePath(workspaceRoot, `archive/${currentDecisionId}`)
      ),
      false
    );
    assert.equal(
      findIndexEntry(await readIndex(workspaceRoot), archivedDecisionId)
        .sourcePath,
      archivedSourcePath
    );
  }));
