import { withGitFixtureWorkspace } from "./support-git-fixture.ts";
import { syncDecisionIndexBeforeStage } from "./stage/support.ts";
import { stageDecisionRecords } from "../src/decision-stage-service.ts";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  runGit
} from "./support.ts";

test("Decision stage expected path failures cannot be hidden by the same ID at another path", async () => {
  await withGitFixtureWorkspace("stage-source-expected", async (root) => {
    const file = decisionFilePath(root, currentSourcePath);
    const text = await fs.readFile(file, "utf8");
    await fs.writeFile(path.join(path.dirname(file), "shadow.md"), text);
    const before = runGit(root, ["write-tree"]);
    for (const content of [
      Buffer.from([0xff]),
      Buffer.from(text.replace(`id: ${currentDecisionId}`, "id: changed"))
    ]) {
      await fs.writeFile(file, content);
      const result = await stageDecisionRecords({
        decisionIds: [currentDecisionId],
        location: { workspaceRoot: root, decisionsDir: "docs/decisions" }
      });
      assert.equal(result.status, "error");
      assert.match(
        JSON.stringify(result),
        /UTF-8|differs from the published projection/
      );
      assert.equal(runGit(root, ["write-tree"]), before);
    }
    await fs.rm(file);
    await fs.mkdir(file);
    const directoryResult = await stageDecisionRecords({
      decisionIds: [currentDecisionId],
      location: { workspaceRoot: root, decisionsDir: "docs/decisions" }
    });
    assert.equal(directoryResult.status, "error");
    assert.match(JSON.stringify(directoryResult), /regular non-symlink/);
    assert.equal(runGit(root, ["write-tree"]), before);
    await fs.rmdir(file);
    await fs.symlink(path.join(path.dirname(file), "shadow.md"), file);
    const symlinkResult = await stageDecisionRecords({
      decisionIds: [currentDecisionId],
      location: { workspaceRoot: root, decisionsDir: "docs/decisions" }
    });
    assert.equal(symlinkResult.status, "error");
    assert.match(JSON.stringify(symlinkResult), /regular non-symlink/);
    assert.equal(runGit(root, ["write-tree"]), before);
    await fs.rm(file);
    await fs.writeFile(file, text);
    const readFile = fs.readFile;
    Object.defineProperty(fs, "readFile", {
      configurable: true,
      value: (...args: Parameters<typeof fs.readFile>) => {
        if (typeof args[0] === "string" && args[0] === file)
          throw new Error("selected read failure");
        return readFile(...args);
      }
    });
    try {
      const result = await stageDecisionRecords({
        decisionIds: [currentDecisionId],
        location: { workspaceRoot: root, decisionsDir: "docs/decisions" }
      });
      assert.equal(result.status, "error");
      assert.match(
        JSON.stringify(result),
        /Failed to construct the selected decision snapshot/
      );
      assert.equal(runGit(root, ["write-tree"]), before);
    } finally {
      fs.readFile = readFile;
    }
  });
});

test("Decision stage re-reads selected bytes after preparation and keeps pending unchanged on drift", async () => {
  await withGitFixtureWorkspace("stage-fresh-all", async (root) => {
    await syncDecisionIndexBeforeStage(root);
    const selectedPath = decisionFilePath(root, currentSourcePath);
    const before = runGit(root, ["write-tree"]);
    const readFile = fs.readFile;
    let selectedReads = 0;
    Object.defineProperty(fs, "readFile", {
      configurable: true,
      value: async (...args: Parameters<typeof fs.readFile>) => {
        if (
          typeof args[0] === "string" &&
          args[0] === selectedPath &&
          ++selectedReads === 2
        )
          await fs.appendFile(selectedPath, "\n- fresh-phase drift\n");
        return await readFile(...args);
      }
    });
    try {
      const staged = await stageDecisionRecords({
        decisionIds: [currentDecisionId],
        location: { workspaceRoot: root, decisionsDir: "docs/decisions" },
        scope: "all"
      });
      assert.equal(staged.status, "error");
      assert.match(JSON.stringify(staged), /stage-source-changed/);
      assert.equal(selectedReads, 2);
      assert.equal(runGit(root, ["write-tree"]), before);
    } finally {
      fs.readFile = readFile;
    }
  });
});
