import assert from "node:assert/strict";

import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { discardInvestigationReportWithWriter } from "../src/discard.ts";

import { executeInvestigationReportCheck } from "../src/validation.ts";
import { investigationRoot, withTempRoot } from "./fixture-support.ts";
import { writeCollection } from "./collection-support.ts";

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
      { id: "report", resources: ["report/evidence.txt"] }
    ]);
    const indexPath = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    const beforeIndex = await fs.readFile(indexPath, "utf8");
    const result = await discardInvestigationReportWithWriter(
      { deleteOwnedResources: true, id: "report", workspaceRoot: root },
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
    assert.equal(result.changed, true);
    assert.equal(result.mutation?.outcome, "partial-or-unknown");
    assert.ok(
      result.errors.some((error) =>
        error.includes("tombstoned owner resources")
      )
    );
    assert.equal(await fs.readFile(indexPath, "utf8"), beforeIndex);
    await fs.access(path.join(investigationRoot(root), "report.md"));
    assert.equal(await fs.readFile(resource, "utf8"), "evidence");
    const trash = (
      await fs.readdir(path.dirname(investigationRoot(root)))
    ).find((entry) => entry.startsWith(".investigation-report-discard-"));
    assert.notEqual(trash, undefined);
    assert.equal(
      (
        await fs.lstat(
          path.join(
            path.dirname(investigationRoot(root)),
            trash!,
            "resources",
            "injected"
          )
        )
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
      { id: "report", resources: ["report/evidence.txt"] }
    ]);
    const indexPath = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    const docsDirectory = path.dirname(investigationRoot(root));
    const result = await discardInvestigationReportWithWriter(
      { deleteOwnedResources: true, id: "report", workspaceRoot: root },
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
      { id: "report", resources: ["report/evidence.txt"] }
    ]);
    const indexPath = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    const beforeIndex = await fs.readFile(indexPath, "utf8");
    const report = path.join(investigationRoot(root), "report.md");
    const beforeFiles = await Promise.all(
      [report, resource, indexPath].map(async (file) => ({
        file,
        bytes: await fs.readFile(file),
        mode: (await fs.stat(file)).mode & 0o777
      }))
    );
    let writes = 0;
    const result = await discardInvestigationReportWithWriter(
      { deleteOwnedResources: true, id: "report", workspaceRoot: root },
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
    assert.ok(writes >= 1, "index publication failure was injected");
    assert.match(result.errors.join("\n"), /simulated index failure/u);
    for (const before of beforeFiles) {
      assert.deepEqual(await fs.readFile(before.file), before.bytes);
      assert.equal((await fs.stat(before.file)).mode & 0o777, before.mode);
    }
  });
});
