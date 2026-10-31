import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  commitWorkspace,
  decisionFilePath,
  initializeGitRepository,
  runGit,
  withTemporaryWorkspace
} from "../support/support.ts";
import {
  a,
  b,
  sync,
  formal,
  fixture,
  stage,
  pending,
  parseIndex
} from "../support/support-local-contracts.ts";

test("Decision stage sequential selection and reselection preserve unselected pending versions", async () => {
  await withTemporaryWorkspace("local-stage-refresh", async (root) => {
    await fixture(root, true);
    await formal(root, a, "暂存 A 一");
    await sync(root);
    assert.equal((await stage(root, [a])).status, "ok");
    await formal(root, a, "工作区 A 二");
    await formal(root, b, "暂存 B 一");
    await sync(root);
    assert.equal((await stage(root, [b])).status, "ok");
    assert.match(pending(root, a + ".md"), /暂存 A 一/);
    assert.match(pending(root, b + ".md"), /暂存 B 一/);
    await formal(root, b, "工作区 B 二");
    await sync(root);
    assert.equal((await stage(root, [a])).status, "ok");
    assert.match(pending(root, a + ".md"), /工作区 A 二/);
    assert.match(pending(root, b + ".md"), /暂存 B 一/);
    const index = parseIndex(pending(root, "decision-index.json"));
    assert.equal(index.entries[a]!.title, "工作区 A 二");
    assert.equal(index.entries[b]!.title, "暂存 B 一");
    const repeated = await stage(root, [a]);
    assert.equal(repeated.status, "ok");
    if (repeated.status === "ok") assert.deepEqual(repeated.writtenPaths, []);
  });
});

test("Decision index stage consumes published projections without reading current Markdown", async () => {
  await withTemporaryWorkspace("local-stage-index", async (root) => {
    await fixture(root, true);
    await formal(root, a, "发布 A");
    await sync(root);
    await fs.writeFile(decisionFilePath(root, a), "unpublished invalid body\n");
    const result = await stage(root, [a], "index");
    assert.equal(result.status, "ok", JSON.stringify(result));
    assert.equal(
      parseIndex(pending(root, "decision-index.json")).entries[a]!.title,
      "发布 A"
    );
    assert.match(pending(root, a + ".md"), /原始 A/);
  });
});

test("Decision domain stage preserves a deleted or corrupt pending index exactly", async () => {
  for (const content of [null, "corrupt pending index\n"])
    await withTemporaryWorkspace("local-stage-domain-index", async (root) => {
      await fixture(root, true);
      const indexPath = path.join(root, "docs/decisions/decision-index.json");
      if (content === null)
        runGit(root, ["rm", "--cached", "docs/decisions/decision-index.json"]);
      else {
        await fs.writeFile(indexPath, content);
        runGit(root, ["add", "docs/decisions/decision-index.json"]);
        await sync(root);
      }
      await formal(root, a, "刷新领域 A");
      await sync(root);
      const result = await stage(root, [a], "domain");
      assert.equal(result.status, "ok", JSON.stringify(result));
      if (content === null)
        assert.doesNotMatch(runGit(root, ["ls-files"]), /decision-index.json/);
      else assert.equal(pending(root, "decision-index.json"), content);
      assert.match(pending(root, a + ".md"), /刷新领域 A/);
    });
});

test("Decision stage rejects a broken or deleted pending index atomically for index and all", async () => {
  for (const scope of ["index", "all"] as const)
    for (const content of [null, "bad JSON\n"])
      await withTemporaryWorkspace("local-stage-bad-pending", async (root) => {
        await fixture(root, true);
        const indexPath = path.join(root, "docs/decisions/decision-index.json");
        if (content === null)
          runGit(root, [
            "rm",
            "--cached",
            "docs/decisions/decision-index.json"
          ]);
        else {
          await fs.writeFile(indexPath, content);
          runGit(root, ["add", "docs/decisions/decision-index.json"]);
          await sync(root);
        }
        const before = runGit(root, ["write-tree"]);
        const result = await stage(root, [a], scope);
        assert.equal(result.status, "error");
        assert.equal(runGit(root, ["write-tree"]), before);
      });
});

test("Decision domain stage cleans pending-only additions and repeated moves", async () => {
  await withTemporaryWorkspace("local-stage-pending-only", async (root) => {
    await fixture(root, true);
    const id = "260901-added-local";
    await formal(root, id, "待提交新增");
    await sync(root);
    assert.equal((await stage(root, [id], "domain")).status, "ok");
    const old = decisionFilePath(root, id);
    const moved = path.join(root, "docs/decisions/moved-local.md");
    await fs.rename(old, moved);
    await sync(root);
    assert.equal((await stage(root, [id], "domain")).status, "ok");
    assert.doesNotMatch(runGit(root, ["ls-files"]), new RegExp(id + "\\.md"));
    assert.match(pending(root, "moved-local.md"), /待提交新增/);
    const trustedIndex = await fs.readFile(
      path.join(root, "docs/decisions/decision-index.json")
    );
    await fs.rm(moved);
    await sync(root);
    const before = runGit(root, ["write-tree"]);
    const missingLocator = await stage(root, [id], "domain");
    assert.equal(missingLocator.status, "error");
    assert.match(
      JSON.stringify(missingLocator),
      /selector is missing or ambiguous/
    );
    assert.equal(runGit(root, ["write-tree"]), before);
    // Restore a trusted locator as caller-owned pending index, then selected cleanup can proceed.
    const currentIndex = await fs.readFile(
      path.join(root, "docs/decisions/decision-index.json")
    );
    await fs.writeFile(
      path.join(root, "docs/decisions/decision-index.json"),
      trustedIndex
    );
    runGit(root, ["add", "docs/decisions/decision-index.json"]);
    await fs.writeFile(
      path.join(root, "docs/decisions/decision-index.json"),
      currentIndex
    );
    assert.equal((await stage(root, [id], "domain")).status, "ok");
    assert.doesNotMatch(runGit(root, ["ls-files"]), /moved-local.md/);
  });
});

test("Decision stage rejects incompatible collection revisions without changing pending bytes", async () => {
  await withTemporaryWorkspace("local-stage-metadata", async (root) => {
    await fixture(root, true);
    const file = path.join(root, "docs/decisions/decision-index.json");
    const index = parseIndex(await fs.readFile(file, "utf8"));
    await fs.writeFile(
      file,
      JSON.stringify({
        ...index,
        sourceRevision: {
          ...index.sourceRevision,
          metadata: "sha256:" + "0".repeat(64)
        }
      })
    );
    runGit(root, ["add", "docs/decisions/decision-index.json"]);
    await sync(root);
    const before = runGit(root, ["write-tree"]);
    for (const scope of ["index", "all"] as const) {
      const result = await stage(root, [a], scope);
      assert.equal(result.status, "error");
      assert.match(JSON.stringify(result), /metadata is incompatible/);
      assert.equal(runGit(root, ["write-tree"]), before);
    }
  });
});

test("Decision stage initializes an unborn pending projection from selected published objects", async () => {
  await withTemporaryWorkspace("local-stage-unborn", async (root) => {
    initializeGitRepository(root);
    await formal(root, a, "初始 A");
    await formal(root, b, "初始 B");
    await sync(root);
    const result = await stage(root, [a]);
    assert.equal(result.status, "ok", JSON.stringify(result));
    assert.deepEqual(
      Object.keys(parseIndex(pending(root, "decision-index.json")).entries),
      [a]
    );
    assert.match(pending(root, a + ".md"), /初始 A/);
    assert.doesNotMatch(runGit(root, ["ls-files"]), new RegExp(b));
  });
});

test("Decision stage rejects missing selected published destinations without deleting old pending locations", async () => {
  await withTemporaryWorkspace("local-stage-missing-target", async (root) => {
    await fixture(root, true);
    const destination = path.join(root, "docs/decisions/moved-a.md");
    await fs.rename(decisionFilePath(root, a), destination);
    await sync(root);
    await fs.rm(destination);
    const before = runGit(root, ["write-tree"]);
    for (const scope of ["domain", "all"] as const) {
      assert.equal((await stage(root, [a], scope)).status, "error");
      assert.equal(runGit(root, ["write-tree"]), before);
    }
  });
});

test("Decision all stage uses index-only related dependencies without rewriting their pending payloads", async () => {
  await withTemporaryWorkspace("local-stage-dependency", async (root) => {
    await fixture(root, true);
    // Publish B as archived and A as its successor, then commit a coherent baseline.
    const archive = decisionFilePath(root, "archive/" + b);
    await fs.mkdir(path.dirname(archive), { recursive: true });
    await fs.rename(decisionFilePath(root, b), archive);
    await fs.writeFile(
      archive,
      (await fs.readFile(archive, "utf8")).replace(
        "status: active",
        "status: archived"
      )
    );
    const body = (await fs.readFile(decisionFilePath(root, a), "utf8")).replace(
      "relations: []",
      "relations:\n  - type: 修订\n    target: " + b
    );
    await fs.writeFile(decisionFilePath(root, a), body);
    await sync(root);
    commitWorkspace(root);
    await fs.writeFile(
      archive,
      (await fs.readFile(archive, "utf8")).replace("原始 B", "仅领域 B")
    );
    await sync(root);
    assert.equal((await stage(root, [b], "domain")).status, "ok");
    const before = runGit(root, ["write-tree"]);
    const selectedOnly = await stage(root, [a]);
    assert.equal(selectedOnly.status, "ok", JSON.stringify(selectedOnly));
    assert.equal(runGit(root, ["write-tree"]), before);
    assert.match(pending(root, "archive/" + b + ".md"), /仅领域 B/);
    const selected = await stage(root, [a, b]);
    assert.equal(selected.status, "ok", JSON.stringify(selected));
    assert.equal(
      parseIndex(pending(root, "decision-index.json")).entries[b]!.title,
      "仅领域 B"
    );
  });
});
