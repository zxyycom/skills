import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { stageInvestigationReports } from "../src/staging.ts";
import {
  git,
  initializeGit,
  investigationRoot,
  jsonObjectMember,
  parseJsonObject,
  reportMarkdown,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";

async function observeReads<T>(
  root: string,
  run: () => Promise<T>,
  onRead?: (target: string) => Promise<void>
) {
  const original = fs.readFile;
  const paths: string[] = [];
  fs.readFile = (async (...args: Parameters<typeof fs.readFile>) => {
    const value = await original(...args);
    const target = typeof args[0] === "string" ? args[0] : "";
    if (target.startsWith(investigationRoot(root) + path.sep)) {
      paths.push(path.relative(investigationRoot(root), target));
      await onRead?.(target);
    }
    return value;
  }) as typeof fs.readFile;
  try {
    return { result: await run(), paths };
  } finally {
    fs.readFile = original;
  }
}

const stage = (root: string, scope: "all" | "domain" | "index") =>
  stageInvestigationReports({ workspaceRoot: root, scope, reportIds: ["one"] });

test("local investigation stage ignores unrelated malformed and missing bodies and reads selected sources once per phase", async () => {
  await withTempRoot("stage-local-sources", async (root) => {
    await writeCollection(root, [
      { id: "one" },
      { id: "two" },
      { id: "three" }
    ]);
    initializeGit(root);
    await fs.writeFile(
      path.join(investigationRoot(root), "two.md"),
      "malformed unrelated body"
    );
    await fs.rm(path.join(investigationRoot(root), "three.md"));
    for (const scope of ["domain", "all"] as const) {
      const observed = await observeReads(root, () => stage(root, scope));
      assert.equal(observed.result.status, "ok");
      assert.deepEqual(
        observed.paths.filter((name) => name.endsWith(".md")),
        ["one.md", "one.md"]
      );
      assert.equal(
        observed.paths.filter((name) => name.endsWith(".json")).length,
        2
      );
    }
    const indexed = await observeReads(root, () => stage(root, "index"));
    assert.equal(indexed.result.status, "ok");
    assert.deepEqual(
      indexed.paths.filter((name) => name.endsWith(".md")),
      []
    );
    assert.equal(git(root, ["diff", "--cached", "--name-only"]), "");
  });
});

test("local investigation stage acquires direct resource owners without staging dependencies and rejects their drift", async () => {
  await withTempRoot("stage-owner-dependency", async (root) => {
    const resource = "owner/sample.txt";
    await fs.mkdir(path.join(investigationRoot(root), "_resources", "owner"), {
      recursive: true
    });
    await fs.writeFile(
      path.join(investigationRoot(root), "_resources", resource),
      "sample\n"
    );
    await writeCollection(root, [
      { id: "one", resources: [resource] },
      { id: "owner", resources: [resource] },
      { id: "other" }
    ]);
    initializeGit(root);
    await fs.writeFile(
      path.join(investigationRoot(root), "other.md"),
      "unrelated malformed"
    );
    const observed = await observeReads(root, () => stage(root, "domain"));
    assert.equal(observed.result.status, "ok");
    assert.deepEqual(
      observed.paths.filter((name) => name.endsWith(".md")).sort(),
      ["one.md", "one.md", "owner.md", "owner.md"]
    );
    assert.deepEqual(observed.result.selectedIds, ["one"]);
    assert.deepEqual(observed.result.writtenPaths, []);
    await fs.writeFile(
      path.join(investigationRoot(root), "owner.md"),
      reportMarkdown({ id: "owner" })
    );
    const rejected = await stage(root, "domain");
    assert.equal(rejected.status, "error");
    assert.equal(git(root, ["diff", "--cached", "--name-only"]), "");
  });
});

test("investigation index stage validates global metadata relations and the final selective projection without bodies", async () => {
  await withTempRoot("stage-index-relations", async (root) => {
    await writeCollection(root, [{ id: "one" }]);
    initializeGit(root);
    await writeCollection(root, [
      { id: "one", relations: [{ type: "补充", target: "new" }] },
      { id: "new" }
    ]);
    const observed = await observeReads(root, () => stage(root, "index"));
    assert.equal(observed.result.status, "error");
    assert.deepEqual(
      observed.paths.filter((name) => name.endsWith(".md")),
      []
    );
    assert.equal(git(root, ["diff", "--cached", "--name-only"]), "");
    const target = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    const index = parseJsonObject(await fs.readFile(target, "utf8"));
    jsonObjectMember(jsonObjectMember(index, "entries"), "one").relations = [
      { type: "补充", target: "missing" }
    ];
    await fs.writeFile(target, JSON.stringify(index));
    assert.equal((await stage(root, "index")).status, "error");
  });
});

test("local investigation stage rejects mutable published index drift before pending replacement", async () => {
  await withTempRoot("stage-index-drift", async (root) => {
    await writeCollection(root, [{ id: "one" }]);
    initializeGit(root);
    let changed = false;
    const observed = await observeReads(
      root,
      () => stage(root, "all"),
      async (target) => {
        if (changed || !target.endsWith("one.md")) return;
        changed = true;
        const indexPath = path.join(
          investigationRoot(root),
          "investigation-index.json"
        );
        const index = parseJsonObject(await fs.readFile(indexPath, "utf8"));
        jsonObjectMember(jsonObjectMember(index, "entries"), "one").title =
          "changed metadata";
        await fs.writeFile(indexPath, JSON.stringify(index));
      }
    );
    assert.equal(observed.result.status, "error");
    assert.equal(observed.result.state, "source-drift");
    assert.equal(git(root, ["diff", "--cached", "--name-only"]), "");
  });
});

test("local investigation stage rechecks required owner and shared resource bytes before writing", async () => {
  for (const driftingPath of ["owner.md", "_resources/owner/sample.txt"]) {
    await withTempRoot("stage-dependency-drift", async (root) => {
      const resource = "owner/sample.txt";
      await fs.mkdir(
        path.join(investigationRoot(root), "_resources", "owner"),
        { recursive: true }
      );
      await fs.writeFile(
        path.join(investigationRoot(root), "_resources", resource),
        "sample\n"
      );
      await writeCollection(root, [
        { id: "one", resources: [resource] },
        { id: "owner", resources: [resource] }
      ]);
      initializeGit(root);
      let changed = false;
      const observed = await observeReads(
        root,
        () => stage(root, "domain"),
        async (target) => {
          if (
            changed ||
            target !== path.join(investigationRoot(root), driftingPath)
          )
            return;
          changed = true;
          await fs.appendFile(target, "\ndependency drift\n");
        }
      );
      assert.equal(observed.result.status, "error");
      assert.equal(observed.result.state, "source-drift");
      assert.equal(
        observed.paths.filter((name) => name === driftingPath).length,
        2
      );
      assert.equal(git(root, ["diff", "--cached", "--name-only"]), "");
    });
  }
});
