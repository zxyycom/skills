import { withGitFixtureWorkspace } from "./support-git-fixture.ts";
import { syncDecisionIndexBeforeStage } from "./stage/support.ts";
import { stageDecisionRecords } from "../src/decision-stage-service.ts";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  readFilesystemDecisionCandidates,
  verifySelectedFilesystemSources
} from "../src/decision-stage-sources.ts";
import { DecisionStageFileSystemError } from "../src/decision-stage-support.ts";
import type { SelectedFilesystemSource } from "../src/decision-stage-contracts.ts";
import {
  candidateDecisionBody,
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  runGit,
  withTemporaryWorkspace
} from "./support.ts";

async function selectedFiles(
  directory: string
): Promise<SelectedFilesystemSource[]> {
  const discovered = await readFilesystemDecisionCandidates(
    directory,
    "docs/decisions"
  );
  return [...discovered.sources].map(([decisionId, source]) => ({
    decisionId,
    source
  }));
}

test("Decision stage fresh source verification reads N files once independently of S", async () => {
  await withTemporaryWorkspace("stage-source-linear", async (root) => {
    for (const size of [10, 100]) {
      const directory = path.join(root, String(size));
      await fs.mkdir(directory);
      for (let index = 0; index < size; index += 1)
        await fs.writeFile(
          path.join(directory, `record-${index}.md`),
          candidateDecisionBody({ id: `record-${index}` })
        );
      const selected = await selectedFiles(directory);
      const readFile = fs.readFile;
      let reads = 0;
      Object.defineProperty(fs, "readFile", {
        configurable: true,
        value: (...args: Parameters<typeof fs.readFile>) => {
          reads += 1;
          return readFile(...args);
        }
      });
      try {
        for (const count of [1, 5, Math.min(20, size)]) {
          reads = 0;
          await verifySelectedFilesystemSources(
            directory,
            "docs/decisions",
            selected.slice(0, count)
          );
          assert.equal(reads, size, `N=${size}, S=${count}`);
        }
      } finally {
        fs.readFile = readFile;
      }
    }
  });
});

test("Decision stage expected path failures cannot be hidden by the same ID at another path", async () => {
  await withTemporaryWorkspace("stage-source-expected", async (root) => {
    const directory = path.join(root, "decisions");
    await fs.mkdir(directory);
    const file = path.join(directory, "selected.md");
    const text = candidateDecisionBody({ id: "selected" });
    await fs.writeFile(file, text);
    const selected = await selectedFiles(directory);
    await fs.writeFile(path.join(directory, "shadow.md"), text);
    for (const content of [
      Buffer.from([0xff]),
      Buffer.from(text.replace("id: selected", "id: changed"))
    ]) {
      await fs.writeFile(file, content);
      await assert.rejects(
        verifySelectedFilesystemSources(directory, "docs/decisions", selected),
        /UTF-8|no longer declares/
      );
    }
    await fs.rm(file);
    await fs.mkdir(file);
    await assert.rejects(
      verifySelectedFilesystemSources(directory, "docs/decisions", selected),
      /regular non-symlink/
    );
    await fs.rmdir(file);
    await fs.symlink(path.join(directory, "shadow.md"), file);
    await assert.rejects(
      verifySelectedFilesystemSources(directory, "docs/decisions", selected),
      /regular non-symlink/
    );
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
      await assert.rejects(
        verifySelectedFilesystemSources(directory, "docs/decisions", selected),
        DecisionStageFileSystemError
      );
    } finally {
      fs.readFile = readFile;
    }
  });
});

test("Decision stage fresh discovery rejects duplicates moves bytes and reappearing deletions while tolerating unrelated invalid sources", async () => {
  await withTemporaryWorkspace("stage-source-drift", async (root) => {
    const text = candidateDecisionBody({ id: "selected" });
    const file = path.join(root, "selected.md");
    const moved = path.join(root, "moved.md");
    await fs.writeFile(file, text);
    const selected = await selectedFiles(root);
    await fs.writeFile(path.join(root, "unrelated.md"), "invalid");
    await verifySelectedFilesystemSources(root, "docs/decisions", selected);
    await fs.writeFile(moved, text);
    await assert.rejects(
      verifySelectedFilesystemSources(root, "docs/decisions", selected),
      /more than one/
    );
    await fs.rm(file);
    await assert.rejects(
      verifySelectedFilesystemSources(root, "docs/decisions", selected)
    );
    await assert.rejects(
      verifySelectedFilesystemSources(root, "docs/decisions", [
        { decisionId: selected[0]!.decisionId, source: null }
      ])
    );
    await fs.rm(moved);
    await verifySelectedFilesystemSources(root, "docs/decisions", [
      { decisionId: selected[0]!.decisionId, source: null }
    ]);
    await fs.writeFile(file, text + "\nchanged bytes\n");
    await assert.rejects(
      verifySelectedFilesystemSources(root, "docs/decisions", selected)
    );
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
          ++selectedReads === 3
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
      assert.equal(selectedReads, 3);
      assert.equal(runGit(root, ["write-tree"]), before);
    } finally {
      fs.readFile = readFile;
    }
  });
});
