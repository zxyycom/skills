import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createInvestigationCandidate } from "../src/candidate.ts";
import {
  renameInvestigationRecord,
  renameInvestigationRecordWithHooks
} from "../src/rename.ts";
import { synchronizeInvestigationIndex } from "../src/validation.ts";
import {
  investigationRoot,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";

test("Investigation rename rejects source drift before writing and restores its report and index after index publication failure", async () => {
  await withTempRoot("rename-recovery", async (workspaceRoot) => {
    await writeCollection(
      workspaceRoot,
      [{ id: "legacy", resources: ["legacy/evidence.txt"] }],
      false
    );
    const root = investigationRoot(workspaceRoot);
    const owner = path.join(root, "_resources", "legacy");
    await fs.mkdir(owner, { recursive: true });
    await fs.writeFile(path.join(owner, "evidence.txt"), "evidence\n", "utf8");
    assert.deepEqual(
      (await synchronizeInvestigationIndex({ workspaceRoot })).errors,
      []
    );
    const sourcePath = path.join(root, "legacy.md");
    const indexPath = path.join(root, "investigation-index.json");
    const sourceBefore = await fs.readFile(sourcePath, "utf8");
    const indexBefore = await fs.readFile(indexPath, "utf8");
    const drift = await renameInvestigationRecordWithHooks(
      { source: "legacy", target: "migrated", workspaceRoot },
      {
        beforePublish: async () => {
          await fs.writeFile(sourcePath, sourceBefore + "\n", "utf8");
        }
      }
    );
    assert.equal(drift.status, "error");
    assert.equal(drift.mutation?.outcome, "no-change");
    await assert.rejects(fs.access(path.join(root, "migrated.md")));
    assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
    await fs.writeFile(sourcePath, sourceBefore, "utf8");
    const failed = await renameInvestigationRecordWithHooks(
      { source: "legacy", target: "migrated", workspaceRoot },
      {
        writeExisting: async (targetPath, text) => {
          if (targetPath === indexPath) throw new Error("index write failed");
          await fs.writeFile(targetPath, text, "utf8");
        }
      }
    );
    assert.equal(failed.status, "error");
    assert.equal(failed.mutation?.outcome, "rolled-back");
    assert.equal(await fs.readFile(sourcePath, "utf8"), sourceBefore);
    assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
    await assert.rejects(fs.access(path.join(root, "migrated.md")));
    assert.equal(
      await fs.readFile(path.join(owner, "evidence.txt"), "utf8"),
      "evidence\n"
    );
    await assert.rejects(
      fs.access(path.join(root, "_resources", "260828-migrated"))
    );
  });
});

test("Investigation rename requires its recorded report or candidate confirmation without rewriting Git history", async () => {
  await withTempRoot("rename-recorded", async (workspaceRoot) => {
    await writeCollection(workspaceRoot, [{ id: "legacy" }]);
    initializeGit(workspaceRoot);
    const pausedReport = await renameInvestigationRecord({
      source: "legacy",
      target: "migrated",
      workspaceRoot
    });
    assert.equal(pausedReport.status, "attention");
    assert.match(pausedReport.errors.join("\n"), /rename-recorded-report/u);
    const report = await renameInvestigationRecord({
      renameRecordedReport: true,
      source: "legacy",
      target: "migrated",
      workspaceRoot
    });
    assert.equal(report.status, "ok", report.errors.join("\n"));
    const candidate = await createInvestigationCandidate({
      formedAt: "2026-08-30T12:00:00+00:00",
      id: "candidate",
      question: "候选身份如何迁移？",
      relations: [],
      tags: ["investigation-report"],
      title: "候选身份",
      workspaceRoot
    });
    assert.equal(candidate.status, "ok");
    commitAll(workspaceRoot, "add candidate");
    const pausedCandidate = await renameInvestigationRecord({
      source: "candidate",
      target: "renamed-candidate",
      workspaceRoot
    });
    assert.equal(pausedCandidate.status, "attention");
    assert.match(
      pausedCandidate.errors.join("\n"),
      /rename-recorded-candidate/u
    );
    const renamedCandidate = await renameInvestigationRecord({
      renameRecordedCandidate: true,
      source: "candidate",
      target: "renamed-candidate",
      workspaceRoot
    });
    assert.equal(
      renamedCandidate.status,
      "ok",
      renamedCandidate.errors.join("\n")
    );
  });
});

function initializeGit(root: string): void {
  for (const args of [
    ["init", "--quiet"],
    ["config", "user.email", "test@example.invalid"],
    ["config", "user.name", "Test"],
    ["add", "."],
    ["commit", "--quiet", "-m", "initial"]
  ]) {
    execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });
  }
}

function commitAll(root: string, message: string): void {
  execFileSync("git", ["-C", root, "add", "."], { encoding: "utf8" });
  execFileSync("git", ["-C", root, "commit", "--quiet", "-m", message], {
    encoding: "utf8"
  });
}
