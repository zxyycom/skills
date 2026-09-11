import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { renameInvestigationRecordWithHooks } from "../src/rename.ts";
import { synchronizeInvestigationIndex } from "../src/validation.ts";
import {
  investigationRoot,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";

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
