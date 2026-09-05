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
  runInvestigationCli,
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

test("Investigation rename never overwrites an owner target that appears after final validation", async () => {
  await withTempRoot("rename-resource-race", async (workspaceRoot) => {
    await writeCollection(
      workspaceRoot,
      [{ id: "legacy", resources: ["legacy/evidence.txt"] }],
      false
    );
    const root = investigationRoot(workspaceRoot);
    const reportPath = path.join(root, "legacy.md");
    const indexPath = path.join(root, "investigation-index.json");
    const oldOwner = path.join(root, "_resources", "legacy");
    const targetOwner = path.join(root, "_resources", "260828-migrated");
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
    const reportBefore = await fs.readFile(reportPath, "utf8");
    const indexBefore = await fs.readFile(indexPath, "utf8");
    const result = await renameInvestigationRecordWithHooks(
      { source: "legacy", target: "migrated", workspaceRoot },
      {
        beforeResourceMove: async () => {
          await fs.mkdir(targetOwner, { recursive: true });
          await fs.writeFile(
            path.join(targetOwner, "external.txt"),
            "external\n",
            "utf8"
          );
        }
      }
    );
    assert.equal(result.status, "error");
    assert.equal(result.mutation?.outcome, "rolled-back");
    assert.equal(await fs.readFile(reportPath, "utf8"), reportBefore);
    assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
    assert.equal(
      await fs.readFile(path.join(oldOwner, "evidence.txt"), "utf8"),
      "evidence\n"
    );
    assert.equal(
      await fs.readFile(path.join(targetOwner, "external.txt"), "utf8"),
      "external\n"
    );
    await assert.rejects(fs.access(path.join(root, "migrated.md")));
  });
});

test("Investigation rename preserves a changed target owner when index publication then fails", async () => {
  await withTempRoot("rename-resource-target-drift", async (workspaceRoot) => {
    const fixture = await prepareLegacyOwnerRename(workspaceRoot);
    const result = await renameInvestigationRecordWithHooks(
      { source: "legacy", target: "migrated", workspaceRoot },
      {
        writeExisting: async (targetPath, text) => {
          if (targetPath === fixture.indexPath) {
            await fs.writeFile(
              path.join(fixture.targetOwner, "evidence.txt"),
              "external replacement\n",
              "utf8"
            );
            throw new Error("index write failed after target owner changed");
          }
          await fs.writeFile(targetPath, text, "utf8");
        }
      }
    );
    assert.equal(result.status, "error");
    assert.equal(result.mutation?.outcome, "partial-or-unknown");
    assert.equal(
      await fs.readFile(fixture.reportPath, "utf8"),
      fixture.reportBefore
    );
    assert.equal(
      await fs.readFile(fixture.indexPath, "utf8"),
      fixture.indexBefore
    );
    await assert.rejects(fs.access(fixture.oldOwner));
    assert.equal(
      await fs.readFile(path.join(fixture.targetOwner, "evidence.txt"), "utf8"),
      "external replacement\n"
    );
    await assert.rejects(fs.access(path.join(fixture.root, "migrated.md")));
  });
});

test("Investigation rename preserves a changed target report when index publication then fails", async () => {
  await withTempRoot("rename-report-target-drift", async (workspaceRoot) => {
    const fixture = await prepareLegacyOwnerRename(workspaceRoot);
    const targetReport = path.join(fixture.root, "migrated.md");
    const result = await renameInvestigationRecordWithHooks(
      { source: "legacy", target: "migrated", workspaceRoot },
      {
        writeExisting: async (targetPath, text) => {
          if (targetPath === fixture.indexPath) {
            await fs.writeFile(
              targetReport,
              "external report replacement\n",
              "utf8"
            );
            throw new Error("index write failed after target report changed");
          }
          await fs.writeFile(targetPath, text, "utf8");
        }
      }
    );
    assert.equal(result.status, "error");
    assert.equal(result.mutation?.outcome, "partial-or-unknown");
    assert.equal(
      await fs.readFile(fixture.reportPath, "utf8"),
      fixture.reportBefore
    );
    assert.equal(
      await fs.readFile(targetReport, "utf8"),
      "external report replacement\n"
    );
    assert.equal(
      await fs.readFile(fixture.indexPath, "utf8"),
      fixture.indexBefore
    );
  });
});

test("Investigation rename preserves an old report rebuilt after its move", async () => {
  await withTempRoot("rename-report-source-drift", async (workspaceRoot) => {
    const fixture = await prepareLegacyOwnerRename(workspaceRoot);
    const targetReport = path.join(fixture.root, "migrated.md");
    const result = await renameInvestigationRecordWithHooks(
      { source: "legacy", target: "migrated", workspaceRoot },
      {
        writeExisting: async (targetPath, text) => {
          if (targetPath === fixture.indexPath) {
            await fs.writeFile(
              fixture.reportPath,
              "externally rebuilt source\n",
              "utf8"
            );
            throw new Error("index write failed after old report reappeared");
          }
          await fs.writeFile(targetPath, text, "utf8");
        }
      }
    );
    assert.equal(result.status, "error");
    assert.equal(result.mutation?.outcome, "partial-or-unknown");
    assert.equal(
      await fs.readFile(fixture.reportPath, "utf8"),
      "externally rebuilt source\n"
    );
    await assert.rejects(fs.access(targetReport));
    assert.equal(
      await fs.readFile(fixture.indexPath, "utf8"),
      fixture.indexBefore
    );
  });
});

test("Investigation rename preserves an old owner member that appears after its final validation", async () => {
  await withTempRoot("rename-source-owner-drift", async (workspaceRoot) => {
    const fixture = await prepareLegacyOwnerRename(workspaceRoot);
    const result = await renameInvestigationRecordWithHooks(
      { source: "legacy", target: "migrated", workspaceRoot },
      {
        beforeSourceOwnerRemoval: async () => {
          await fs.writeFile(
            path.join(fixture.oldOwner, "external.txt"),
            "external member\n",
            "utf8"
          );
        }
      }
    );
    assert.equal(result.status, "error");
    assert.equal(result.mutation?.outcome, "partial-or-unknown");
    assert.equal(
      await fs.readFile(fixture.reportPath, "utf8"),
      fixture.reportBefore
    );
    assert.equal(
      await fs.readFile(fixture.indexPath, "utf8"),
      fixture.indexBefore
    );
    assert.equal(
      await fs.readFile(path.join(fixture.oldOwner, "evidence.txt"), "utf8"),
      "original evidence\n"
    );
    assert.equal(
      await fs.readFile(path.join(fixture.oldOwner, "external.txt"), "utf8"),
      "external member\n"
    );
    assert.equal(
      await fs.readFile(path.join(fixture.targetOwner, "evidence.txt"), "utf8"),
      "original evidence\n"
    );
    await assert.rejects(fs.access(path.join(fixture.root, "migrated.md")));
  });
});

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

async function prepareLegacyOwnerRename(workspaceRoot: string): Promise<
  Readonly<{
    indexBefore: string;
    indexPath: string;
    oldOwner: string;
    reportBefore: string;
    reportPath: string;
    root: string;
    targetOwner: string;
  }>
> {
  await writeCollection(
    workspaceRoot,
    [{ id: "legacy", resources: ["legacy/evidence.txt"] }],
    false
  );
  const root = investigationRoot(workspaceRoot);
  const reportPath = path.join(root, "legacy.md");
  const indexPath = path.join(root, "investigation-index.json");
  const oldOwner = path.join(root, "_resources", "legacy");
  const targetOwner = path.join(root, "_resources", "260828-migrated");
  await fs.mkdir(oldOwner, { recursive: true });
  await fs.writeFile(
    path.join(oldOwner, "evidence.txt"),
    "original evidence\n",
    "utf8"
  );
  assert.deepEqual(
    (await synchronizeInvestigationIndex({ workspaceRoot })).errors,
    []
  );
  return {
    indexBefore: await fs.readFile(indexPath, "utf8"),
    indexPath,
    oldOwner,
    reportBefore: await fs.readFile(reportPath, "utf8"),
    reportPath,
    root,
    targetOwner
  };
}

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
