import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { applyDecisionChanges } from "../src/decision-transaction.ts";
import { scanDecisionRecords } from "../src/scan.ts";
import {
  archivedDecisionId,
  archivedSourcePath,
  candidateDecisionBody,
  commitWorkspace,
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  fileExists,
  initializeGitRepository,
  readIndex,
  runSourceCli,
  withFixtureWorkspace,
  writeDecision,
} from "./support.ts";

test("archive and reactivate move one Decision ID while preserving its Markdown semantics", () =>
  withFixtureWorkspace("lifecycle-move", async (workspaceRoot) => {
    const before = await fs.readFile(
      decisionFilePath(workspaceRoot, currentSourcePath),
      "utf8",
    );
    const archived = await runSourceCli([
      "archive",
      currentDecisionId,
      "--root",
      workspaceRoot,
    ]);
    assert.equal(archived.exitCode, 0, archived.stderr);
    const archivedPath = decisionFilePath(
      workspaceRoot,
      `archive/${currentDecisionId}`,
    );
    assert.equal(
      await fileExists(decisionFilePath(workspaceRoot, currentSourcePath)),
      false,
    );
    assert.equal(
      await fs.readFile(archivedPath, "utf8"),
      before.replace("status: active", "status: archived"),
    );
    assert.equal(
      (await readIndex(workspaceRoot)).entries[currentDecisionId].state
        .sourcePath,
      `archive/${currentDecisionId}`,
    );

    const reactivated = await runSourceCli([
      "activate",
      currentDecisionId,
      "--alignment",
      "aligned",
      "--root",
      workspaceRoot,
    ]);
    assert.equal(reactivated.exitCode, 0, reactivated.stderr);
    assert.equal(
      await fs.readFile(
        decisionFilePath(workspaceRoot, currentSourcePath),
        "utf8",
      ),
      before,
    );
    assert.equal(
      (await readIndex(workspaceRoot)).entries[currentDecisionId].state
        .sourcePath,
      currentSourcePath,
    );
  }));

test("relations resolve stable IDs across active and archived locations", () =>
  withFixtureWorkspace("relations-id", async (workspaceRoot) => {
    initializeGitRepository(workspaceRoot);
    commitWorkspace(workspaceRoot);
    const candidateId = "use-id-relations.md";
    await writeDecision(
      workspaceRoot,
      candidateId,
      candidateDecisionBody({
        relations: [{ type: "修订", target: currentDecisionId }],
      }),
    );
    const activated = await runSourceCli([
      "activate",
      candidateId,
      "--alignment",
      "unaligned",
      "--root",
      workspaceRoot,
    ]);
    assert.equal(activated.exitCode, 0, activated.stderr);
    const index = await readIndex(workspaceRoot);
    assert.equal(index.entries[currentDecisionId].state.status, "archived");
    assert.equal(
      index.entries[currentDecisionId].state.sourcePath,
      `archive/${currentDecisionId}`,
    );
    assert.deepEqual(index.entries[candidateId].state.relations, [
      {
        type: "修订",
        target: currentDecisionId,
      },
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
      "utf8",
    );
    const errors = await applyDecisionChanges({
      changes: [
        {
          decisionPath: currentPath,
          expectedText: originalText,
          nextText: originalText.replace("status: active", "status: archived"),
          targetPath: decisionFilePath(
            workspaceRoot,
            `archive/${currentDecisionId}`,
          ),
        },
      ],
      originalScan,
      scanOptions: { workspaceRoot },
    });
    assert.notEqual(errors.length, 0);
    assert.equal(await fileExists(currentPath), true);
    assert.equal(
      await fileExists(
        decisionFilePath(workspaceRoot, `archive/${currentDecisionId}`),
      ),
      false,
    );
    assert.equal(
      (await readIndex(workspaceRoot)).entries[archivedDecisionId].state
        .sourcePath,
      archivedSourcePath,
    );
  }));
