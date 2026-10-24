import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import { test } from "node:test";
import {} from "../src/collection-mutation-lock.ts";
import {} from "../src/diagnostics.ts";
import {
  setInvestigationRelations,
  setInvestigationRelationsWithWriter
} from "../src/relation-transaction.ts";
import { synchronizeInvestigationIndex } from "../src/validation.ts";
import {
  investigationRoot,
  reportMarkdown,
  withTempRoot
} from "./fixture-support.ts";
import { writeCollection } from "./collection-support.ts";

test("set-relations rejects source or index drift before publishing", async () => {
  await withTempRoot("drift", async (root) => {
    await writeCollection(root, [{ id: "base" }, { id: "next" }]);
    const indexPath = `${investigationRoot(root)}/investigation-index.json`;
    await fs.writeFile(indexPath, "{}", "utf8");
    const indexDrift = await setInvestigationRelations({
      replacements: [
        {
          relations: [{ target: "base", type: "补充" }],
          source: "next"
        }
      ],
      workspaceRoot: root
    });
    assert.ok(indexDrift.errors.some((error) => error.includes("index")));
    await writeCollection(root, [{ id: "base" }, { id: "next" }]);
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
            relations: [{ target: "base", type: "补充" }],
            source: "next"
          }
        ],
        workspaceRoot: root
      },
      async (target, text) => await fs.writeFile(target, text, "utf8"),
      async () => {
        await fs.writeFile(
          addedPath,
          reportMarkdown({ id: "newly-added" }),
          "utf8"
        );
        await fs.writeFile(indexPath, externallyChangedIndex, "utf8");
      }
    );
    assert.ok(
      collectionDrift.errors.some((error) => error.includes("index changed"))
    );
    assert.equal(await fs.readFile(basePath, "utf8"), beforeBase);
    assert.equal(await fs.readFile(nextPath, "utf8"), beforeReport);
    assert.equal(await fs.readFile(indexPath, "utf8"), externallyChangedIndex);
    assert.equal(
      await fs.readFile(addedPath, "utf8"),
      reportMarkdown({ id: "newly-added" })
    );

    await fs.rm(addedPath);
    await writeCollection(root, [{ id: "base" }, { id: "next" }]);
    const indexBeforeHook = await fs.readFile(indexPath, "utf8");
    const sourceBeforeHook = await fs.readFile(nextPath, "utf8");
    const indexDriftDuringPublish = await setInvestigationRelationsWithWriter(
      {
        replacements: [
          {
            relations: [{ target: "base", type: "补充" }],
            source: "next"
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
    assert.deepEqual(indexDriftDuringPublish.mutation, {
      outcome: "no-change",
      scope: "investigation report relation collection"
    });
    assert.equal(await fs.readFile(nextPath, "utf8"), sourceBeforeHook);
    assert.equal(await fs.readFile(indexPath, "utf8"), `${indexBeforeHook}\n`);
  });
});

test("set-relations restores all report and index bytes after publish failure", async () => {
  await withTempRoot("restore", async (root) => {
    await writeCollection(root, [
      { id: "base" },
      { id: "first" },
      { id: "second" }
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
            relations: [{ target: "base", type: "补充" }],
            source: "first"
          },
          {
            relations: [{ target: "base", type: "补充" }],
            source: "second"
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
    assert.equal(result.relationReview, undefined);
    assert.deepEqual(result.mutation, {
      outcome: "rolled-back",
      scope: "investigation report relation collection"
    });
    assert.equal(
      result.diagnostics[0]?.code,
      "investigation-report.relation-publish-failed"
    );
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
      { id: "base", title: "Base" },
      { id: "next", title: "Next" }
    ]);
    const options = {
      replacements: [
        {
          relations: [{ target: "base", type: "补充" as const }],
          source: "next"
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
    await writeCollection(root, [{ id: "base" }, { id: "next" }]);
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
          relations: [{ target: "base", type: "补充" }],
          source: "next"
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

test("set-relations release cleanup failure preserves committed bytes without a successful review", async () => {
  await withTempRoot("relation-release-review", async (root) => {
    await writeCollection(root, [{ id: "base" }, { id: "next" }]);
    const lockPath = `${root}/docs/.investigation-index.json.mutation.lock`;
    const originalRm = fs.rm;
    fs.rm = (async (...args) => {
      if (args[0] === lockPath)
        throw Object.assign(new Error("injected lock release failure"), {
          code: "EIO"
        });
      return await originalRm(...args);
    }) as typeof fs.rm;
    let result;
    try {
      result = await setInvestigationRelations({
        replacements: [
          { source: "next", relations: [{ target: "base", type: "补充" }] }
        ],
        workspaceRoot: root
      });
    } finally {
      fs.rm = originalRm;
    }
    assert.equal(result.changed, true);
    assert.equal(result.relationReview, undefined);
    assert.ok(result.errors.length > 0);
    assert.deepEqual(result.mutation, {
      outcome: "committed-cleanup-pending",
      scope: "investigation report relation collection"
    });
    assert.match(
      result.diagnostics.at(-1)?.code ?? "",
      /collection-lock-release-failed/u
    );
    assert.match(
      await fs.readFile(`${investigationRoot(root)}/next.md`, "utf8"),
      /target: "base"/u
    );
    await fs.rm(lockPath, { force: true });
  });
});

test("set-relations uses indexed split closure without reading unselected split siblings", async () => {
  await withTempRoot("relations-local-dependencies", async (root) => {
    await writeCollection(root, [
      { id: "base" },
      { id: "left", relations: [{ type: "拆分", target: "base" }] },
      { id: "right", relations: [{ type: "拆分", target: "base" }] },
      { id: "unrelated" }
    ]);
    const directory = investigationRoot(root);
    const indexPath = `${directory}/investigation-index.json`;
    const originalIndex = JSON.parse(await fs.readFile(indexPath, "utf8"));
    await fs.writeFile(
      `${directory}/unrelated.md`,
      "unrelated malformed current body\n"
    );
    const input = {
      replacements: [
        {
          source: "left",
          relations: [{ type: "拆分", target: "base", summary: "refreshed" }]
        }
      ],
      workspaceRoot: root
    };
    const readFile = fs.readFile;
    let unrelatedReads = 0;
    fs.readFile = (async (...args: Parameters<typeof fs.readFile>) => {
      if (args[0] === `${directory}/unrelated.md`) {
        unrelatedReads += 1;
        throw new Error("unrelated source must not be read");
      }
      return await readFile(...args);
    }) as typeof fs.readFile;
    let applied;
    try {
      applied = await setInvestigationRelations(input);
    } finally {
      fs.readFile = readFile;
    }
    assert.deepEqual(applied.errors, []);
    assert.equal(applied.changed, true);
    assert.equal(unrelatedReads, 0);
    const currentIndex = await fs.readFile(indexPath, "utf8");
    const parsedIndex = JSON.parse(currentIndex);
    assert.deepEqual(
      parsedIndex.entries.unrelated,
      originalIndex.entries.unrelated
    );
    assert.equal(
      parsedIndex.sourceRevision.entries.unrelated,
      originalIndex.sourceRevision.entries.unrelated
    );
    await fs.appendFile(`${directory}/right.md`, "\nexternal drift\n");
    const beforeLeft = await fs.readFile(`${directory}/left.md`, "utf8");
    const rejected = await setInvestigationRelations({
      ...input,
      replacements: [
        {
          source: "left",
          relations: [{ type: "拆分", target: "base", summary: "again" }]
        }
      ]
    });
    assert.equal(rejected.changed, true);
    assert.deepEqual(rejected.errors, []);
    assert.notEqual(
      await fs.readFile(`${directory}/left.md`, "utf8"),
      beforeLeft
    );
    const updated = JSON.parse(await fs.readFile(indexPath, "utf8"));
    assert.deepEqual(updated.entries.right, parsedIndex.entries.right);
    assert.equal(
      updated.sourceRevision.entries.right,
      parsedIndex.sourceRevision.entries.right
    );
  });
});
