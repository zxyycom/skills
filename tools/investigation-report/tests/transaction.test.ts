import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import { test } from "node:test";
import { runInvestigationReportCheckCli } from "../src/cli.ts";
import {
  setInvestigationRelations,
  setInvestigationRelationsWithWriter
} from "../src/relation-transaction.ts";
import { parseInvestigationReport } from "../src/markdown.ts";
import { synchronizeInvestigationIndex } from "../src/validation.ts";
import {
  investigationRoot,
  reportMarkdown,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";

test("set-relations parses complete source groups and rejects ambiguous grouping", async () => {
  await withTempRoot("groups", async (root) => {
    await writeCollection(root, [{ id: "base.md" }, { id: "next.md" }]);
    const invalid = await runInvestigationReportCheckCli([
      "set-relations",
      "--root",
      root,
      "--relation",
      "补充=base.md"
    ]);
    assert.equal(invalid, 2);
    const nonCanonicalSource = await setInvestigationRelations({
      replacements: [
        {
          relations: [{ target: "base.md", type: "补充" }],
          source: "./next.md"
        }
      ],
      workspaceRoot: root
    });
    assert.ok(
      nonCanonicalSource.errors.some((error) =>
        error.includes("source must use")
      )
    );
    const nonCanonicalTarget = await setInvestigationRelations({
      replacements: [
        {
          relations: [
            { target: "./base.md", type: "补充" },
            { target: " base.md ", type: "复查" }
          ],
          source: "next.md"
        }
      ],
      workspaceRoot: root
    });
    assert.ok(
      nonCanonicalTarget.errors.some((error) => error.includes("target"))
    );
  });
});

test("set-relations atomically applies multi-source replacements and explicit clears", async () => {
  await withTempRoot("replace", async (root) => {
    await writeCollection(root, [
      { id: "base.md" },
      { id: "split-a.md" },
      { id: "split-b.md" }
    ]);
    const applied = await setInvestigationRelations({
      replacements: [
        {
          relations: [{ target: "base.md", type: "拆分" }],
          source: "split-b.md"
        },
        {
          relations: [{ target: "base.md", type: "拆分" }],
          source: "split-a.md"
        }
      ],
      workspaceRoot: root
    });
    assert.deepEqual(applied.errors, []);
    assert.equal(applied.changed, true);
    for (const id of ["split-a.md", "split-b.md"]) {
      const parsed = parseInvestigationReport(
        await fs.readFile(`${investigationRoot(root)}/${id}`, "utf8"),
        id
      );
      assert.deepEqual(parsed.errors, []);
      assert.deepEqual(parsed.report?.relations, [
        { target: "base.md", type: "拆分" }
      ]);
    }
    const appliedIndex = JSON.parse(
      await fs.readFile(
        `${investigationRoot(root)}/investigation-index.json`,
        "utf8"
      )
    ) as {
      entries: Record<string, { state: { relations: unknown } }>;
    };
    assert.deepEqual(appliedIndex.entries["split-a.md"]?.state.relations, [
      { target: "base.md", type: "拆分" }
    ]);
    assert.deepEqual(appliedIndex.entries["split-b.md"]?.state.relations, [
      { target: "base.md", type: "拆分" }
    ]);
    const cleared = await setInvestigationRelations({
      replacements: [
        { relations: [], source: "split-a.md" },
        { relations: [], source: "split-b.md" }
      ],
      workspaceRoot: root
    });
    assert.deepEqual(cleared.errors, []);
    for (const id of ["split-a.md", "split-b.md"]) {
      const parsed = parseInvestigationReport(
        await fs.readFile(`${investigationRoot(root)}/${id}`, "utf8"),
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
      entries: Record<string, { state: { relations: unknown } }>;
    };
    assert.deepEqual(clearedIndex.entries["split-a.md"]?.state.relations, []);
    assert.deepEqual(clearedIndex.entries["split-b.md"]?.state.relations, []);
  });
});

test("set-relations rejects source or index drift before publishing", async () => {
  await withTempRoot("drift", async (root) => {
    await writeCollection(root, [{ id: "base.md" }, { id: "next.md" }]);
    const indexPath = `${investigationRoot(root)}/investigation-index.json`;
    await fs.appendFile(indexPath, "\n", "utf8");
    const indexDrift = await setInvestigationRelations({
      replacements: [
        {
          relations: [{ target: "base.md", type: "补充" }],
          source: "next.md"
        }
      ],
      workspaceRoot: root
    });
    assert.ok(indexDrift.errors.some((error) => error.includes("index")));
    await writeCollection(root, [{ id: "base.md" }, { id: "next.md" }]);
    const basePath = `${investigationRoot(root)}/base.md`;
    const nextPath = `${investigationRoot(root)}/next.md`;
    const beforeBase = await fs.readFile(basePath, "utf8");
    const beforeReport = await fs.readFile(nextPath, "utf8");
    const beforeIndex = await fs.readFile(indexPath, "utf8");
    const addedPath = `${investigationRoot(root)}/newly-added.md`;
    const externallyChangedIndex = `${beforeIndex}\n`;
    const collectionDrift = await setInvestigationRelationsWithWriter(
      {
        replacements: [
          {
            relations: [{ target: "base.md", type: "补充" }],
            source: "next.md"
          }
        ],
        workspaceRoot: root
      },
      async (target, text) => await fs.writeFile(target, text, "utf8"),
      async () => {
        await fs.writeFile(
          addedPath,
          reportMarkdown({ id: "newly-added.md" }),
          "utf8"
        );
        await fs.writeFile(indexPath, externallyChangedIndex, "utf8");
      }
    );
    assert.ok(
      collectionDrift.errors.some((error) =>
        error.includes("collection changed")
      )
    );
    assert.equal(await fs.readFile(basePath, "utf8"), beforeBase);
    assert.equal(await fs.readFile(nextPath, "utf8"), beforeReport);
    assert.equal(await fs.readFile(indexPath, "utf8"), externallyChangedIndex);
    assert.equal(
      await fs.readFile(addedPath, "utf8"),
      reportMarkdown({ id: "newly-added.md" })
    );

    await fs.rm(addedPath);
    await writeCollection(root, [{ id: "base.md" }, { id: "next.md" }]);
    const indexBeforeHook = await fs.readFile(indexPath, "utf8");
    const sourceBeforeHook = await fs.readFile(nextPath, "utf8");
    const indexDriftDuringPublish = await setInvestigationRelationsWithWriter(
      {
        replacements: [
          {
            relations: [{ target: "base.md", type: "补充" }],
            source: "next.md"
          }
        ],
        workspaceRoot: root
      },
      async (target, text) => await fs.writeFile(target, text, "utf8"),
      async () => await fs.appendFile(indexPath, "\n", "utf8")
    );
    assert.ok(
      indexDriftDuringPublish.errors.some((error) =>
        error.includes("index changed")
      )
    );
    assert.equal(await fs.readFile(nextPath, "utf8"), sourceBeforeHook);
    assert.equal(await fs.readFile(indexPath, "utf8"), `${indexBeforeHook}\n`);
  });
});

test("set-relations restores all report and index bytes after publish failure", async () => {
  await withTempRoot("restore", async (root) => {
    await writeCollection(root, [
      { id: "base.md" },
      { id: "first.md" },
      { id: "second.md" }
    ]);
    const paths = [
      `${investigationRoot(root)}/first.md`,
      `${investigationRoot(root)}/second.md`,
      `${investigationRoot(root)}/investigation-index.json`
    ];
    const before = await Promise.all(
      paths.map(async (path) => await fs.readFile(path, "utf8"))
    );
    let writes = 0;
    const result = await setInvestigationRelationsWithWriter(
      {
        replacements: [
          {
            relations: [{ target: "base.md", type: "补充" }],
            source: "first.md"
          },
          {
            relations: [{ target: "base.md", type: "补充" }],
            source: "second.md"
          }
        ],
        workspaceRoot: root
      },
      async (target, text) => {
        writes += 1;
        if (writes === 3) throw new Error("simulated publish failure");
        await fs.writeFile(target, text, "utf8");
      }
    );
    assert.ok(result.errors.some((error) => error.includes("publish failed")));
    assert.deepEqual(
      await Promise.all(
        paths.map(async (path) => await fs.readFile(path, "utf8"))
      ),
      before
    );
  });
});

test("set-relations is idempotent and leaves unrelated report fields unchanged", async () => {
  await withTempRoot("idempotent", async (root) => {
    await writeCollection(root, [
      { id: "base.md", title: "Base" },
      { id: "next.md", title: "Next" }
    ]);
    const options = {
      replacements: [
        {
          relations: [{ target: "base.md", type: "补充" as const }],
          source: "next.md"
        }
      ],
      workspaceRoot: root
    };
    assert.equal((await setInvestigationRelations(options)).changed, true);
    const path = `${investigationRoot(root)}/next.md`;
    const bytes = await fs.readFile(path, "utf8");
    assert.equal((await setInvestigationRelations(options)).changed, false);
    assert.equal(await fs.readFile(path, "utf8"), bytes);
    assert.ok(bytes.includes('title: "Next"'));
  });
});

test("set-relations leaves Git pending unchanged", async () => {
  await withTempRoot("pending", async (root) => {
    await writeCollection(root, [{ id: "base.md" }, { id: "next.md" }]);
    git(root, ["init", "--quiet"]);
    git(root, ["config", "user.email", "test@example.invalid"]);
    git(root, ["config", "user.name", "Test"]);
    git(root, ["add", "."]);
    git(root, ["commit", "--quiet", "-m", "initial"]);
    const basePath = `${investigationRoot(root)}/base.md`;
    await fs.appendFile(basePath, "\n", "utf8");
    assert.deepEqual(
      (await synchronizeInvestigationIndex({ workspaceRoot: root })).errors,
      []
    );
    git(root, [
      "add",
      "docs/investigations/base.md",
      "docs/investigations/investigation-index.json"
    ]);
    const pendingBefore = git(root, ["diff", "--cached", "--binary"]);
    const stagedBaseBefore = git(root, [
      "show",
      ":docs/investigations/base.md"
    ]);
    const stagedIndexBefore = git(root, [
      "show",
      ":docs/investigations/investigation-index.json"
    ]);
    const result = await setInvestigationRelations({
      replacements: [
        {
          relations: [{ target: "base.md", type: "补充" }],
          source: "next.md"
        }
      ],
      workspaceRoot: root
    });
    assert.deepEqual(result.errors, []);
    assert.equal(git(root, ["diff", "--cached", "--binary"]), pendingBefore);
    assert.equal(
      git(root, ["show", ":docs/investigations/base.md"]),
      stagedBaseBefore
    );
    assert.equal(
      git(root, ["show", ":docs/investigations/investigation-index.json"]),
      stagedIndexBefore
    );
  });
});

function git(root: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}
