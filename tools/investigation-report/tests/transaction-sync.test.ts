import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { test } from "node:test";
import {} from "../src/collection-mutation-lock.ts";
import {} from "../src/diagnostics.ts";
import { setInvestigationRelations } from "../src/relation-transaction.ts";
import { parseInvestigationReport } from "../src/markdown.ts";
import { synchronizeInvestigationIndex } from "../src/validation.ts";
import {
  investigationRoot,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";

test("sync-index preserves post-rename uncertainty when lock cleanup also fails", async () => {
  await withTempRoot("sync-post-rename-release-failure", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    await fs.appendFile(`${investigationRoot(root)}/report.md`, "\n", "utf8");
    const indexPath = `${investigationRoot(root)}/investigation-index.json`;
    const lockPath = `${root}/docs/.investigation-index.json.mutation.lock`;
    const originalReadFile = fs.readFile;
    const originalRm = fs.rm;
    let indexReadCount = 0;
    let racedAfterRename = false;
    fs.readFile = (async (...args) => {
      if (args[0] === indexPath) {
        indexReadCount += 1;
        if (indexReadCount === 2) {
          racedAfterRename = true;
          await fs.writeFile(indexPath, "interleaving index write\n", "utf8");
        }
      }
      return await originalReadFile(...args);
    }) as typeof fs.readFile;
    fs.rm = (async (...args) => {
      if (args[0] === lockPath) {
        throw Object.assign(new Error("injected lock release failure"), {
          code: "EIO"
        });
      }
      return await originalRm(...args);
    }) as typeof fs.rm;
    let result;
    try {
      result = await synchronizeInvestigationIndex({
        workspaceRoot: root
      });
    } finally {
      fs.readFile = originalReadFile;
      fs.rm = originalRm;
    }
    assert.equal(racedAfterRename, true);
    assert.equal(result.changed, false);
    assert.ok(result.errors.length > 0);
    assert.equal(result.diagnostics.length, 2);
    assert.match(
      result.diagnostics[0]?.code ?? "",
      /^state-index\.index-write-failed$/u
    );
    assert.deepEqual(result.mutation, {
      outcome: "partial-or-unknown",
      scope: "investigation report index collection"
    });
    assert.deepEqual(
      result.diagnostics.find(
        (diagnostic) =>
          diagnostic.code ===
          "investigation-report.collection-lock-release-failed"
      )?.mutation,
      result.mutation
    );
    assert.equal(
      await fs.readFile(indexPath, "utf8"),
      "interleaving index write\n"
    );
    await fs.rm(lockPath, { force: true });
  });
});

test("set-relations atomically applies multi-source replacements and explicit clears", async () => {
  await withTempRoot("replace", async (root) => {
    await writeCollection(root, [
      { id: "base" },
      { id: "split-a" },
      { id: "split-b", sourcePath: "semantic-split.md" }
    ]);
    const applied = await setInvestigationRelations({
      replacements: [
        {
          relations: [
            { type: "拆分", target: "base", summary: "  第二条拆分  " }
          ],
          source: "split-b"
        },
        {
          relations: [{ type: "拆分", target: "base", summary: "第一条拆分" }],
          source: "split-a"
        }
      ],
      workspaceRoot: root
    });
    assert.deepEqual(applied.errors, []);
    assert.equal(applied.changed, true);
    for (const [id, sourcePath] of [
      ["split-a", "split-a.md"],
      ["split-b", "semantic-split.md"]
    ] as const) {
      const parsed = parseInvestigationReport(
        await fs.readFile(`${investigationRoot(root)}/${sourcePath}`, "utf8"),
        id
      );
      assert.deepEqual(parsed.errors, []);
      assert.deepEqual(parsed.report?.relations, [
        {
          type: "拆分",
          target: "base",
          summary: id === "split-a" ? "第一条拆分" : "第二条拆分"
        }
      ]);
      assert.deepEqual(Object.keys(parsed.report?.relations[0] ?? {}), [
        "type",
        "target",
        "summary"
      ]);
    }
    const appliedIndexText = await fs.readFile(
      `${investigationRoot(root)}/investigation-index.json`,
      "utf8"
    );
    const appliedIndex = JSON.parse(appliedIndexText) as {
      entries: Record<string, { relations: unknown; sourcePath: string }>;
    };
    assert.deepEqual(appliedIndex.entries["split-a"]?.relations, [
      { type: "拆分", target: "base", summary: "第一条拆分" }
    ]);
    assert.deepEqual(appliedIndex.entries["split-b"]?.relations, [
      { type: "拆分", target: "base", summary: "第二条拆分" }
    ]);
    assert.equal(
      appliedIndex.entries["split-b"]?.sourcePath,
      "semantic-split.md"
    );
    const cleared = await setInvestigationRelations({
      replacements: [
        { relations: [], source: "split-a" },
        { relations: [], source: "split-b" }
      ],
      workspaceRoot: root
    });
    assert.deepEqual(cleared.errors, []);
    for (const [id, sourcePath] of [
      ["split-a", "split-a.md"],
      ["split-b", "semantic-split.md"]
    ] as const) {
      const parsed = parseInvestigationReport(
        await fs.readFile(`${investigationRoot(root)}/${sourcePath}`, "utf8"),
        id
      );
      assert.deepEqual(parsed.errors, []);
      assert.deepEqual(parsed.report?.relations, []);
    }
    const clearedIndex = JSON.parse(
      await fs.readFile(
        `${investigationRoot(root)}/investigation-index.json`,
        "utf8"
      )
    ) as {
      entries: Record<string, { relations: unknown }>;
    };
    assert.deepEqual(clearedIndex.entries["split-a"]?.relations, []);
    assert.deepEqual(clearedIndex.entries["split-b"]?.relations, []);
  });
});
