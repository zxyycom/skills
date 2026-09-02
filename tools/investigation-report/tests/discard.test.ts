import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import {
  discardInvestigationReport,
  discardInvestigationReportWithWriter
} from "../src/discard.ts";
import { executeInvestigationIndexQuery } from "../src/query.ts";
import {
  executeInvestigationReportCheck,
  synchronizeInvestigationIndex
} from "../src/validation.ts";
import {
  investigationRoot,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";

test("discard rejects reports still used as relation targets or resource owners", async () => {
  await withTempRoot("discard-references", async (root) => {
    const resource = path.join(
      investigationRoot(root),
      "_resources",
      "base",
      "evidence.txt"
    );
    await fs.mkdir(path.dirname(resource), { recursive: true });
    await fs.writeFile(resource, "evidence", "utf8");
    await writeCollection(root, [
      { id: "base.md", resources: ["base/evidence.txt"] },
      {
        id: "next.md",
        relations: [{ target: "base.md", type: "补充" }],
        resources: ["base/evidence.txt"]
      }
    ]);
    const before = await fs.readFile(
      path.join(investigationRoot(root), "investigation-index.json"),
      "utf8"
    );
    const result = await discardInvestigationReport({
      id: "base.md",
      workspaceRoot: root
    });
    assert.equal(result.changed, false);
    assert.ok(
      result.errors.some((error) => error.includes("direct relation target"))
    );
    assert.ok(
      result.errors.some((error) => error.includes("still referenced"))
    );
    assert.equal(
      await fs.readFile(
        path.join(investigationRoot(root), "investigation-index.json"),
        "utf8"
      ),
      before
    );
    await fs.access(path.join(investigationRoot(root), "base.md"));
  });
});

test("discard requires resource confirmation then removes a final report and its owner resources", async () => {
  await withTempRoot("discard-final", async (root) => {
    const resource = path.join(
      investigationRoot(root),
      "_resources",
      "report",
      "evidence.txt"
    );
    await fs.mkdir(path.dirname(resource), { recursive: true });
    await fs.writeFile(resource, "evidence", "utf8");
    await writeCollection(root, [
      { id: "report.md", resources: ["report/evidence.txt"] }
    ]);
    const attention = await discardInvestigationReport({
      id: "report.md",
      workspaceRoot: root
    });
    assert.equal(attention.changed, false);
    assert.ok(
      attention.errors.some((error) =>
        error.includes("--delete-owned-resources")
      )
    );
    const result = await discardInvestigationReport({
      deleteOwnedResources: true,
      id: "report.md",
      workspaceRoot: root
    });
    assert.equal(result.changed, true);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.deletedResourceIds, ["report/evidence.txt"]);
    await assert.rejects(
      fs.access(path.join(investigationRoot(root), "report.md"))
    );
    await assert.rejects(fs.access(resource));
    const check = await executeInvestigationReportCheck({
      workspaceRoot: root
    });
    assert.equal(check.isOk(), true);
    const listed = await executeInvestigationIndexQuery({
      workspaceRoot: root
    });
    assert.equal(listed.isOk(), true);
    if (listed.isOk()) assert.deepEqual(listed.value.entries, []);
    assert.deepEqual(
      (await fs.readdir(path.join(root, "docs"))).filter((entry) =>
        entry.startsWith(".investigation-report-discard-")
      ),
      []
    );
  });
});

test("discard pauses recorded reports until recorded deletion is explicitly confirmed", async () => {
  await withTempRoot("discard-recorded", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
    git(root, ["init", "--quiet"]);
    git(root, ["config", "user.email", "test@example.invalid"]);
    git(root, ["config", "user.name", "Test"]);
    git(root, ["add", "."]);
    git(root, ["commit", "--quiet", "-m", "initial"]);
    const paused = await discardInvestigationReport({
      id: "report.md",
      workspaceRoot: root
    });
    assert.equal(paused.changed, false);
    assert.equal(paused.requiresRecordedDeletionConfirmation, true);
    await fs.access(path.join(investigationRoot(root), "report.md"));
    const discarded = await discardInvestigationReport({
      deleteRecordedReport: true,
      id: "report.md",
      workspaceRoot: root
    });
    assert.equal(discarded.changed, true);
    await assert.rejects(
      fs.access(path.join(investigationRoot(root), "report.md"))
    );
  });
});

test("discard rejects illegal owner resource IDs without deleting the report", async () => {
  await withTempRoot("discard-illegal-resource", async (root) => {
    const resourceDirectory = path.join(
      investigationRoot(root),
      "_resources",
      "report"
    );
    await fs.mkdir(resourceDirectory, { recursive: true });
    await fs.writeFile(
      path.join(resourceDirectory, "evidence.txt"),
      "evidence",
      "utf8"
    );
    await fs.writeFile(
      path.join(resourceDirectory, "bad%name.txt"),
      "unsafe",
      "utf8"
    );
    await writeCollection(root, [
      { id: "report.md", resources: ["report/evidence.txt"] }
    ]);
    const result = await discardInvestigationReport({
      deleteOwnedResources: true,
      id: "report.md",
      workspaceRoot: root
    });
    assert.equal(result.changed, false);
    assert.ok(
      result.errors.some((error) =>
        error.includes("safe, normalized resource id")
      )
    );
    await fs.access(path.join(investigationRoot(root), "report.md"));
  });
});

test("sync-index accepts an existing empty index but not a new empty collection", async () => {
  await withTempRoot("discard-empty-sync", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
    assert.equal(
      (
        await discardInvestigationReport({
          id: "report.md",
          workspaceRoot: root
        })
      ).changed,
      true
    );
    const current = await synchronizeInvestigationIndex({
      workspaceRoot: root
    });
    assert.deepEqual(current.errors, []);
    await withTempRoot("discard-new-empty", async (otherRoot) => {
      await fs.mkdir(investigationRoot(otherRoot), { recursive: true });
      const fresh = await synchronizeInvestigationIndex({
        workspaceRoot: otherRoot
      });
      assert.ok(
        fresh.errors.some((error) => error.includes("at least one report"))
      );
    });
  });
});

function git(root: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

test("discard rejects a removal that breaks split relation closure", async () => {
  await withTempRoot("discard-split", async (root) => {
    await writeCollection(root, [
      { id: "base.md", formedAt: "2026-08-28T10:00:00+00:00" },
      {
        id: "first.md",
        formedAt: "2026-08-28T11:00:00+00:00",
        relations: [{ target: "base.md", type: "拆分" }]
      },
      {
        id: "second.md",
        formedAt: "2026-08-28T12:00:00+00:00",
        relations: [{ target: "base.md", type: "拆分" }]
      }
    ]);
    const result = await discardInvestigationReport({
      id: "second.md",
      workspaceRoot: root
    });
    assert.equal(result.changed, false);
    assert.ok(result.errors.some((error) => error.includes("at least two")));
    await fs.access(path.join(investigationRoot(root), "second.md"));
  });
});

test("discard fails closed when a Git worktree cannot be inspected", async () => {
  await withTempRoot("discard-git-failure", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
    await fs.mkdir(path.join(root, ".git"));
    const result = await discardInvestigationReport({
      id: "report.md",
      workspaceRoot: root
    });
    assert.equal(result.changed, false);
    assert.ok(
      result.errors.some((error) => /Git|version-control/u.test(error))
    );
    await fs.access(path.join(investigationRoot(root), "report.md"));
  });
});

test("discard rechecks ignored owner resource drift before publishing", async () => {
  await withTempRoot("discard-resource-drift", async (root) => {
    const resource = path.join(
      investigationRoot(root),
      "_resources",
      "report",
      "evidence.txt"
    );
    await fs.mkdir(path.dirname(resource), { recursive: true });
    await fs.writeFile(resource, "evidence", "utf8");
    await writeCollection(root, [
      { id: "report.md", resources: ["report/evidence.txt"] }
    ]);
    git(root, ["init", "--quiet"]);
    git(root, ["config", "user.email", "test@example.invalid"]);
    git(root, ["config", "user.name", "Test"]);
    git(root, ["add", "."]);
    git(root, ["commit", "--quiet", "-m", "initial"]);
    await fs.writeFile(
      path.join(root, ".gitignore"),
      "docs/investigations/_resources/report/ignored.txt\n",
      "utf8"
    );
    const result = await discardInvestigationReportWithWriter(
      {
        deleteOwnedResources: true,
        deleteRecordedReport: true,
        id: "report.md",
        workspaceRoot: root
      },
      async (target, text) => await fs.writeFile(target, text, "utf8"),
      async () => {
        await fs.writeFile(
          path.join(path.dirname(resource), "ignored.txt"),
          "ignored",
          "utf8"
        );
      }
    );
    assert.equal(result.changed, false);
    assert.ok(
      result.errors.some((error) =>
        error.includes("owned resources changed before discard publication")
      )
    );
    await fs.access(path.join(investigationRoot(root), "report.md"));
    await fs.access(resource);
  });
});

test("discard rejects unsafe owner resource members without deleting the report", async () => {
  await withTempRoot("discard-unsafe-resource", async (root) => {
    const resourceDirectory = path.join(
      investigationRoot(root),
      "_resources",
      "report"
    );
    await fs.mkdir(resourceDirectory, { recursive: true });
    await fs.writeFile(
      path.join(resourceDirectory, "evidence.txt"),
      "evidence",
      "utf8"
    );
    await fs.symlink(
      "evidence.txt",
      path.join(resourceDirectory, "linked.txt")
    );
    await writeCollection(root, [
      { id: "report.md", resources: ["report/evidence.txt"] }
    ]);
    const result = await discardInvestigationReport({
      deleteOwnedResources: true,
      id: "report.md",
      workspaceRoot: root
    });
    assert.equal(result.changed, false);
    assert.ok(result.errors.some((error) => error.includes("symbolic link")));
    await fs.access(path.join(investigationRoot(root), "report.md"));
  });
});

test("discard restores tombstoned resources when a rename-window member appears", async () => {
  await withTempRoot("discard-tombstone-window", async (root) => {
    const resource = path.join(
      investigationRoot(root),
      "_resources",
      "report",
      "evidence.txt"
    );
    await fs.mkdir(path.dirname(resource), { recursive: true });
    await fs.writeFile(resource, "evidence", "utf8");
    await writeCollection(root, [
      { id: "report.md", resources: ["report/evidence.txt"] }
    ]);
    const indexPath = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    const beforeIndex = await fs.readFile(indexPath, "utf8");
    const result = await discardInvestigationReportWithWriter(
      { deleteOwnedResources: true, id: "report.md", workspaceRoot: root },
      async (target, text) => await fs.writeFile(target, text, "utf8"),
      undefined,
      async () => {
        const docsDirectory = path.dirname(investigationRoot(root));
        const trash = (await fs.readdir(docsDirectory)).find((entry) =>
          entry.startsWith(".investigation-report-discard-")
        );
        assert.notEqual(trash, undefined);
        await fs.mkdir(
          path.join(docsDirectory, trash!, "resources", "injected")
        );
      }
    );
    assert.equal(result.changed, false);
    assert.ok(
      result.errors.some((error) =>
        error.includes("tombstoned owner resources")
      )
    );
    assert.equal(await fs.readFile(indexPath, "utf8"), beforeIndex);
    await fs.access(path.join(investigationRoot(root), "report.md"));
    assert.equal(
      (
        await fs.lstat(path.join(path.dirname(resource), "injected"))
      ).isDirectory(),
      true
    );
  });
});

test("discard reports a committed result when safe tombstone cleanup cannot finish", async () => {
  await withTempRoot("discard-cleanup-failure", async (root) => {
    const resource = path.join(
      investigationRoot(root),
      "_resources",
      "report",
      "evidence.txt"
    );
    await fs.mkdir(path.dirname(resource), { recursive: true });
    await fs.writeFile(resource, "evidence", "utf8");
    await writeCollection(root, [
      { id: "report.md", resources: ["report/evidence.txt"] }
    ]);
    const indexPath = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    const docsDirectory = path.dirname(investigationRoot(root));
    const result = await discardInvestigationReportWithWriter(
      { deleteOwnedResources: true, id: "report.md", workspaceRoot: root },
      async (target, text) => {
        await fs.writeFile(target, text, "utf8");
        if (target !== indexPath) return;
        const trash = (await fs.readdir(docsDirectory)).find((entry) =>
          entry.startsWith(".investigation-report-discard-")
        );
        assert.notEqual(trash, undefined);
        await fs.mkdir(
          path.join(docsDirectory, trash!, "resources", "injected")
        );
      }
    );
    assert.equal(result.changed, true);
    assert.deepEqual(result.mutation, {
      outcome: "committed-cleanup-pending",
      scope: "investigation report discard collection"
    });
    assert.equal(
      result.diagnostics[0]?.code,
      "investigation-report.discard-cleanup-pending"
    );
    assert.ok(
      result.errors.some((error) => error.includes("discard committed"))
    );
    await assert.rejects(
      fs.access(path.join(investigationRoot(root), "report.md"))
    );
    await assert.rejects(fs.access(resource));
    const trash = (await fs.readdir(docsDirectory)).find((entry) =>
      entry.startsWith(".investigation-report-discard-")
    );
    assert.notEqual(trash, undefined);
    await fs.access(path.join(docsDirectory, trash!, "resources", "injected"));
    const check = await executeInvestigationReportCheck({
      workspaceRoot: root
    });
    assert.equal(check.isOk(), true);
  });
});

test("discard restores report resources and index when index publication fails", async () => {
  await withTempRoot("discard-restore", async (root) => {
    const resource = path.join(
      investigationRoot(root),
      "_resources",
      "report",
      "evidence.txt"
    );
    await fs.mkdir(path.dirname(resource), { recursive: true });
    await fs.writeFile(resource, "evidence", "utf8");
    await writeCollection(root, [
      { id: "report.md", resources: ["report/evidence.txt"] }
    ]);
    const indexPath = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    const beforeIndex = await fs.readFile(indexPath, "utf8");
    let writes = 0;
    const result = await discardInvestigationReportWithWriter(
      { deleteOwnedResources: true, id: "report.md", workspaceRoot: root },
      async (target, text) => {
        writes += 1;
        if (writes === 1) throw new Error("simulated index failure");
        await fs.writeFile(target, text, "utf8");
      }
    );
    assert.equal(result.changed, false);
    assert.ok(result.errors.some((error) => error.includes("publish failed")));
    assert.deepEqual(result.mutation, {
      outcome: "rolled-back",
      scope: "investigation report discard collection"
    });
    assert.equal(
      result.diagnostics[0]?.code,
      "investigation-report.discard-publish-failed"
    );
    assert.equal(await fs.readFile(indexPath, "utf8"), beforeIndex);
    await fs.access(path.join(investigationRoot(root), "report.md"));
    await fs.access(resource);
  });
});

test("discard preserves existing Git pending content", async () => {
  await withTempRoot("discard-pending", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
    git(root, ["init", "--quiet"]);
    git(root, ["config", "user.email", "test@example.invalid"]);
    git(root, ["config", "user.name", "Test"]);
    git(root, ["add", "."]);
    git(root, ["commit", "--quiet", "-m", "initial"]);
    await fs.writeFile(path.join(root, "pending.txt"), "pending", "utf8");
    git(root, ["add", "pending.txt"]);
    const pendingBefore = git(root, ["diff", "--cached", "--binary"]);
    const result = await discardInvestigationReport({
      deleteRecordedReport: true,
      id: "report.md",
      workspaceRoot: root
    });
    assert.equal(result.changed, true);
    assert.equal(git(root, ["diff", "--cached", "--binary"]), pendingBefore);
  });
});

test("sync-index rejects a concurrent rebuild while discard owns the collection", async () => {
  await withTempRoot("discard-sync-lock", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
    const indexPath = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    const before = await fs.readFile(indexPath, "utf8");
    let allowDiscardPublish: () => void = () => {};
    const discardPublish = new Promise<void>((resolve) => {
      allowDiscardPublish = resolve;
    });
    let discardAtCommit: () => void = () => {};
    const discardCommit = new Promise<void>((resolve) => {
      discardAtCommit = resolve;
    });
    const discard = discardInvestigationReportWithWriter(
      { id: "report.md", workspaceRoot: root },
      async (target, text) => {
        assert.equal(target, indexPath);
        discardAtCommit();
        await discardPublish;
        await fs.writeFile(target, text, "utf8");
      }
    );
    await discardCommit;

    const blocked = await synchronizeInvestigationIndex({
      workspaceRoot: root
    });
    assert.equal(blocked.changed, false);
    assert.ok(
      blocked.errors.some((error) =>
        error.includes("investigation-report.collection-lock-busy")
      )
    );
    assert.equal(
      blocked.diagnostics[0]?.code,
      "investigation-report.collection-lock-busy"
    );
    assert.equal(blocked.diagnostics[0]?.causeCategory, "busy");
    assert.deepEqual(blocked.mutation, {
      outcome: "no-change",
      scope: "investigation report index collection"
    });
    assert.equal(await fs.readFile(indexPath, "utf8"), before);

    allowDiscardPublish();
    assert.equal((await discard).changed, true);
    const retried = await synchronizeInvestigationIndex({
      workspaceRoot: root
    });
    assert.deepEqual(retried.errors, []);
    const index = JSON.parse(await fs.readFile(indexPath, "utf8")) as {
      entries: Record<string, unknown>;
    };
    assert.deepEqual(index.entries, {});
  });
});
