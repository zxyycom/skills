import assert from "node:assert/strict";
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

test("Investigation rename moves the report and owner resources while rewriting managed relations and links", async () => {
  await withTempRoot("rename-formal", async (workspaceRoot) => {
    const root = investigationRoot(workspaceRoot);
    await writeCollection(
      workspaceRoot,
      [
        {
          formedAt: "2026-08-28T12:00:00+00:00",
          id: "legacy",
          resources: ["legacy/evidence.txt", "legacy/nested/evidence.txt"]
        },
        {
          formedAt: "2026-08-29T12:00:00+00:00",
          id: "dependent",
          relations: [
            { type: "补充", target: "legacy", summary: "保留迁移缘由" }
          ],
          resources: ["legacy/evidence.txt", "legacy/nested/evidence.txt"]
        }
      ],
      false
    );
    await fs.mkdir(path.join(root, "_resources", "legacy"), {
      recursive: true
    });
    await fs.writeFile(
      path.join(root, "_resources", "legacy", "evidence.txt"),
      "evidence\n",
      "utf8"
    );
    await fs.mkdir(path.join(root, "_resources", "legacy", "nested"));
    await fs.writeFile(
      path.join(root, "_resources", "legacy", "nested", "evidence.txt"),
      "nested evidence\n",
      "utf8"
    );
    assert.deepEqual(
      (await synchronizeInvestigationIndex({ workspaceRoot })).errors,
      []
    );
    const candidate = await createInvestigationCandidate({
      formedAt: "2026-08-30T12:00:00+00:00",
      id: "candidate-dependent",
      question: "候选调查如何引用旧身份？",
      relations: [{ type: "补充", target: "legacy", summary: "保留候选缘由" }],
      tags: ["investigation-report"],
      title: "候选依赖",
      workspaceRoot
    });
    assert.equal(candidate.status, "ok");
    const result = await renameInvestigationRecord({
      source: "legacy.md",
      target: "migrated",
      workspaceRoot
    });
    assert.equal(result.status, "ok", result.errors.join("\n"));
    assert.equal(result.plan?.newId, "260828-migrated");
    assert.equal(result.plan?.newSourcePath, "migrated.md");
    await assert.rejects(fs.access(path.join(root, "legacy.md")));
    await assert.rejects(fs.access(path.join(root, "_resources", "legacy")));
    assert.equal(
      await fs.readFile(
        path.join(root, "_resources", "260828-migrated", "evidence.txt"),
        "utf8"
      ),
      "evidence\n"
    );
    assert.equal(
      await fs.readFile(
        path.join(
          root,
          "_resources",
          "260828-migrated",
          "nested",
          "evidence.txt"
        ),
        "utf8"
      ),
      "nested evidence\n"
    );
    const dependent = await fs.readFile(
      path.join(root, "dependent.md"),
      "utf8"
    );
    assert.match(dependent, /target: "260828-migrated"/u);
    assert.match(dependent, /summary: "保留迁移缘由"/u);
    assert.match(dependent, /\.\/_resources\/260828-migrated\/evidence\.txt/u);
    assert.match(
      dependent,
      /\.\/_resources\/260828-migrated\/nested\/evidence\.txt/u
    );
    const renamedCandidate = await fs.readFile(
      candidate.candidate.path,
      "utf8"
    );
    assert.match(renamedCandidate, /target: "260828-migrated"/u);
    assert.match(renamedCandidate, /summary: "保留候选缘由"/u);
    const index = JSON.parse(
      await fs.readFile(path.join(root, "investigation-index.json"), "utf8")
    ) as {
      entries: Record<string, { relations: unknown; sourcePath: string }>;
    };
    assert.equal(index.entries["260828-migrated"]?.sourcePath, "migrated.md");
    assert.ok(!Object.hasOwn(index.entries, "legacy"));
    assert.deepEqual(index.entries.dependent?.relations, [
      {
        type: "补充",
        target: "260828-migrated",
        summary: "保留迁移缘由"
      }
    ]);
    assert.deepEqual(
      (await synchronizeInvestigationIndex({ mode: "check", workspaceRoot }))
        .errors,
      []
    );
  });
});

test("Investigation rename is a zero-write no-op when ID name path and owner already match", async () => {
  await withTempRoot("rename-no-change", async (workspaceRoot) => {
    await writeCollection(workspaceRoot, [
      { id: "260828-legacy", sourcePath: "legacy.md" }
    ]);
    const root = investigationRoot(workspaceRoot);
    const owner = path.join(root, "_resources", "260828-legacy");
    await fs.mkdir(owner, { recursive: true });
    await fs.writeFile(path.join(owner, "evidence.txt"), "evidence\n", "utf8");
    const reportPath = path.join(root, "legacy.md");
    const indexPath = path.join(root, "investigation-index.json");
    const reportBefore = await fs.readFile(reportPath, "utf8");
    const indexBefore = await fs.readFile(indexPath, "utf8");
    const result = await renameInvestigationRecordWithHooks(
      {
        source: "260828-legacy",
        target: "legacy",
        workspaceRoot
      },
      {
        beforePublish: async () => {
          throw new Error("no-op rename must not publish");
        },
        beforeResourceMove: async () => {
          throw new Error("no-op rename must not move resources");
        },
        writeExisting: async () => {
          throw new Error("no-op rename must not write existing files");
        },
        writeNew: async () => {
          throw new Error("no-op rename must not create files");
        }
      }
    );
    assert.equal(result.status, "ok", result.errors.join("\n"));
    assert.equal(result.changed, false);
    assert.deepEqual(result.plan, {
      affectedCandidateRelationCount: 0,
      affectedEstablishedRelationCount: 0,
      affectedResourceReferenceCount: 0,
      newId: "260828-legacy",
      newName: "legacy",
      newSourcePath: "legacy.md",
      oldId: "260828-legacy",
      oldName: "legacy",
      oldSourcePath: "legacy.md",
      outcome: "ready",
      resourceOwnerMoved: false
    });
    assert.equal(await fs.readFile(reportPath, "utf8"), reportBefore);
    assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
    assert.equal(
      await fs.readFile(path.join(owner, "evidence.txt"), "utf8"),
      "evidence\n"
    );
  });
});

test("Investigation rename migrates a legacy ID while retaining an unchanged source path", async () => {
  await withTempRoot("rename-legacy-path", async (workspaceRoot) => {
    await writeCollection(
      workspaceRoot,
      [
        { id: "legacy", resources: ["legacy/evidence.txt"] },
        {
          id: "dependent",
          relations: [{ target: "legacy", type: "补充" }]
        }
      ],
      false
    );
    const root = investigationRoot(workspaceRoot);
    const oldOwner = path.join(root, "_resources", "legacy");
    await fs.mkdir(oldOwner, { recursive: true });
    await fs.writeFile(
      path.join(oldOwner, "evidence.txt"),
      "evidence\n",
      "utf8"
    );
    assert.deepEqual(
      (await synchronizeInvestigationIndex({ workspaceRoot })).errors,
      []
    );
    const result = await renameInvestigationRecord({
      source: "legacy",
      target: "legacy",
      workspaceRoot
    });
    assert.equal(result.status, "ok", result.errors.join("\n"));
    assert.equal(result.changed, true);
    assert.equal(result.plan?.oldId, "legacy");
    assert.equal(result.plan?.newId, "260828-legacy");
    assert.equal(result.plan?.oldSourcePath, "legacy.md");
    assert.equal(result.plan?.newSourcePath, "legacy.md");
    assert.equal(result.plan?.resourceOwnerMoved, true);
    assert.match(
      await fs.readFile(path.join(root, "legacy.md"), "utf8"),
      /id: "260828-legacy"/u
    );
    assert.match(
      await fs.readFile(path.join(root, "dependent.md"), "utf8"),
      /target: "260828-legacy"/u
    );
    await assert.rejects(fs.access(oldOwner));
    await fs.access(
      path.join(root, "_resources", "260828-legacy", "evidence.txt")
    );
    const index = JSON.parse(
      await fs.readFile(path.join(root, "investigation-index.json"), "utf8")
    ) as { entries: Record<string, { sourcePath: string }> };
    assert.ok(!Object.hasOwn(index.entries, "legacy"));
    assert.equal(index.entries["260828-legacy"]?.sourcePath, "legacy.md");
  });
});
