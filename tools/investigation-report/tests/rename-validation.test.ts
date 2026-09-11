import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createInvestigationCandidate } from "../src/candidate.ts";
import { renameInvestigationRecord } from "../src/rename.ts";
import {
  investigationRoot,
  runInvestigationCli,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";

test("Investigation candidate rename has a read-only preflight and retains formedAt date", async () => {
  await withTempRoot("rename-candidate", async (workspaceRoot) => {
    await writeCollection(workspaceRoot, [{ id: "260828-formal" }]);
    const created = await createInvestigationCandidate({
      formedAt: "2026-08-30T01:00:00+00:00",
      id: "candidate",
      question: "候选调查的问题是什么？",
      relations: [],
      tags: ["investigation-report"],
      title: "候选调查",
      workspaceRoot
    });
    assert.equal(created.status, "ok");
    const root = investigationRoot(workspaceRoot);
    const candidatePath = created.candidate.path;
    const before = await fs.readFile(candidatePath, "utf8");
    const preflight = await renameInvestigationRecord({
      preflight: true,
      source: "candidate",
      target: "renamed-candidate.md",
      workspaceRoot
    });
    assert.equal(preflight.status, "ok", preflight.errors.join("\n"));
    assert.equal(preflight.changed, false);
    assert.equal(await fs.readFile(candidatePath, "utf8"), before);
    const renamed = await renameInvestigationRecord({
      source: "candidate",
      target: "renamed-candidate",
      workspaceRoot
    });
    assert.equal(renamed.status, "ok", renamed.errors.join("\n"));
    const candidate = await fs.readFile(
      path.join(root, "_candidate.renamed-candidate"),
      "utf8"
    );
    assert.match(candidate, /id: "260830-renamed-candidate"/u);
    await assert.rejects(fs.access(candidatePath));
  });
});

test("Investigation rename rejects target date conflicts without writes", async () => {
  await withTempRoot("rename-date", async (workspaceRoot) => {
    await writeCollection(workspaceRoot, [
      { id: "legacy" },
      { id: "260828-taken" }
    ]);
    const root = investigationRoot(workspaceRoot);
    const before = await fs.readFile(path.join(root, "legacy.md"), "utf8");
    const result = await renameInvestigationRecord({
      source: "legacy",
      target: "260829-migrated",
      workspaceRoot
    });
    assert.equal(result.status, "error");
    assert.match(result.errors.join("\n"), /date must match formedAt/u);
    assert.equal(
      await fs.readFile(path.join(root, "legacy.md"), "utf8"),
      before
    );
    const conflict = await renameInvestigationRecord({
      source: "legacy",
      target: "260828-taken",
      workspaceRoot
    });
    assert.equal(conflict.status, "error");
    assert.match(conflict.errors.join("\n"), /already exists/u);
    assert.equal(
      await fs.readFile(path.join(root, "legacy.md"), "utf8"),
      before
    );
  });
});

test("Investigation rename uses dated source IDs exactly and reports ambiguous name selectors", async () => {
  await withTempRoot("rename-selectors", async (workspaceRoot) => {
    await writeCollection(workspaceRoot, [
      { id: "260828-topic" },
      { formedAt: "2026-08-29T12:00:00+00:00", id: "260829-topic" }
    ]);
    const ambiguous = await renameInvestigationRecord({
      preflight: true,
      source: "topic",
      target: "renamed",
      workspaceRoot
    });
    assert.equal(ambiguous.status, "error");
    assert.match(ambiguous.errors.join("\n"), /source is ambiguous/u);
    const targetConflict = await renameInvestigationRecord({
      preflight: true,
      source: "260828-topic",
      target: "topic",
      workspaceRoot
    });
    assert.equal(targetConflict.status, "error");
    assert.match(targetConflict.errors.join("\n"), /name already exists/u);
    const exact = await runInvestigationCli(workspaceRoot, [
      "rename",
      "260828-topic.md",
      "renamed"
    ]);
    assert.equal(exact.status, 0, exact.stderr);
    assert.match(exact.stdout, /260828-topic -> 260828-renamed/u);
  });
});

test("Investigation rename falls back to an ID basename without overwriting another report path", async () => {
  await withTempRoot("rename-path-fallback", async (workspaceRoot) => {
    await writeCollection(workspaceRoot, [
      { id: "legacy" },
      { id: "unrelated", sourcePath: "migrated.md" }
    ]);
    const root = investigationRoot(workspaceRoot);
    const occupiedPath = path.join(root, "migrated.md");
    const occupiedBefore = await fs.readFile(occupiedPath, "utf8");
    const renamed = await renameInvestigationRecord({
      source: "legacy",
      target: "migrated",
      workspaceRoot
    });
    assert.equal(renamed.status, "ok", renamed.errors.join("\n"));
    assert.equal(renamed.plan?.newSourcePath, "260828-migrated.md");
    await fs.access(path.join(root, "260828-migrated.md"));
    assert.equal(await fs.readFile(occupiedPath, "utf8"), occupiedBefore);
  });
});

test("Investigation rename rejects an unsafe owner tree before moving its report or resources", async () => {
  await withTempRoot("rename-unsafe-owner", async (workspaceRoot) => {
    await writeCollection(workspaceRoot, [{ id: "legacy" }]);
    const root = investigationRoot(workspaceRoot);
    const reportPath = path.join(root, "legacy.md");
    const reportBefore = await fs.readFile(reportPath, "utf8");
    const owner = path.join(root, "_resources", "legacy");
    await fs.mkdir(owner, { recursive: true });
    await fs.symlink("missing-resource", path.join(owner, "unsafe"));
    const preflight = await renameInvestigationRecord({
      preflight: true,
      source: "legacy",
      target: "migrated",
      workspaceRoot
    });
    assert.equal(preflight.status, "error");
    assert.match(preflight.errors.join("\n"), /must not be a symbolic link/u);
    assert.equal(await fs.readFile(reportPath, "utf8"), reportBefore);
    await fs.access(owner);
  });
});
