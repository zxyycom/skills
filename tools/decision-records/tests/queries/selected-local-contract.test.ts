import { assertSelectedSourceSafety } from "../../../record-operations/tests/selected-source-safety.ts";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { executeDecisionQuery } from "../../src/query/decision-query-service.ts";
import { validateDecisionRecords } from "../../src/index.ts";
import {
  a,
  b,
  fixture,
  formal,
  parseIndex
} from "../support/support-local-contracts.ts";
import {
  decisionFilePath,
  decisionIdForTest,
  withTemporaryWorkspace
} from "../support/support.ts";

const selected = (workspaceRoot: string, selectors: readonly string[]) =>
  executeDecisionQuery({
    command: "sync-index",
    location: { workspaceRoot, decisionsDir: "docs/decisions" },
    preflight: false,
    selectors
  });
const indexPath = (root: string) =>
  path.join(root, "docs/decisions/decision-index.json");

test("Decision selected sync retains unrelated published entries without reading malformed sources", async () => {
  await withTemporaryWorkspace("selected-local-unrelated", async (root) => {
    await fixture(root);
    const before = parseIndex(await fs.readFile(indexPath(root), "utf8"));
    await formal(root, a, "Selected change");
    await fs.writeFile(decisionFilePath(root, b), "invalid unrelated source\n");
    const result = await selected(root, [a]);
    assert.equal(result.status, "ok", JSON.stringify(result));
    if (result.status !== "ok" || result.command !== "sync-index")
      assert.fail("Expected selected success");
    assert.deepEqual(result.coverage, {
      source: "published-index+selected-current-sources",
      currentness: "selected-and-dependencies",
      checkedIds: [a]
    });
    const after = parseIndex(await fs.readFile(indexPath(root), "utf8"));
    assert.equal(after.entries[a]!.title, "Selected change");
    assert.deepEqual(after.entries[b], before.entries[b]);
    assert.equal(
      after.sourceRevision.entries[b],
      before.sourceRevision.entries[b]
    );
    assert.ok(
      (await validateDecisionRecords({ workspaceRoot: root })).errors.length > 0
    );
  });
});

test("Decision selected sync requires both identities for an observed same-path ID correction", async () => {
  await withTemporaryWorkspace("selected-local-identity", async (root) => {
    await fixture(root);
    const next = decisionIdForTest("260901-renamed-a");
    const source = decisionFilePath(root, a);
    const original = await fs.readFile(source, "utf8");
    const before = await fs.readFile(indexPath(root));
    await fs.writeFile(source, original.replace(`id: ${a}`, `id: ${next}`));
    assert.equal((await selected(root, [a])).status, "error");
    assert.deepEqual(await fs.readFile(indexPath(root)), before);
    const result = await selected(root, [a, next]);
    assert.equal(result.status, "ok", JSON.stringify(result));
    const after = parseIndex(await fs.readFile(indexPath(root), "utf8"));
    assert.equal(Object.hasOwn(after.entries, a), false);
    assert.equal(after.entries[next]!.sourcePath, a + ".md");
    assert.ok(
      result.status === "ok" &&
        result.command === "sync-index" &&
        result.coverage?.checkedIds.includes(a) &&
        result.coverage.checkedIds.includes(next)
    );
  });
});

test("Decision selected sync treats missing known locations as deletions without discovering unknown moves", async () => {
  await withTemporaryWorkspace("selected-local-unknown", async (root) => {
    await fixture(root);
    const source = decisionFilePath(root, a);
    const moved = path.join(root, "docs/decisions/unknown-location.md");
    await fs.rename(source, moved);
    const before = await fs.readFile(indexPath(root));
    const unknown = await selected(root, ["260901-unseen"]);
    assert.equal(unknown.status, "error");
    assert.match(JSON.stringify(unknown), /full sync-index/);
    assert.deepEqual(await fs.readFile(indexPath(root)), before);
    const deleted = await selected(root, [a]);
    assert.equal(deleted.status, "ok", JSON.stringify(deleted));
    assert.equal(
      Object.hasOwn(
        parseIndex(await fs.readFile(indexPath(root), "utf8")).entries,
        a
      ),
      false
    );
    assert.match(await fs.readFile(moved, "utf8"), new RegExp(a));
  });
});

test("Decision selected sync fresh rejects later source bytes and preserves an external index winner", async () => {
  for (const drift of ["source", "index"] as const)
    await withTemporaryWorkspace(
      "selected-local-fresh-" + drift,
      async (root) => {
        await fixture(root);
        await formal(root, a, "Selected change");
        const source = decisionFilePath(root, a);
        const index = indexPath(root);
        const before = await fs.readFile(index);
        const originalOpen = fs.open;
        let reads = 0;
        const target = drift === "source" ? source : index;
        fs.open = (async (...args) => {
          if (args[0] === target && ++reads === (drift === "source" ? 2 : 3))
            await fs.writeFile(target, "external winner\n");
          return originalOpen(...args);
        }) as typeof fs.open;
        let result;
        try {
          result = await selected(root, [a]);
        } finally {
          fs.open = originalOpen;
        }
        assert.equal(result.status, "error", JSON.stringify(result));
        assert.equal(await fs.readFile(target, "utf8"), "external winner\n");
        if (drift === "source")
          assert.deepEqual(await fs.readFile(index), before);
      }
    );
});

test("Decision selected sync rejects unsafe source links invalid UTF8 and fresh mode drift", async () => {
  for (const fault of ["symlink", "utf8", "mode"] as const)
    await withTemporaryWorkspace(
      "selected-local-safety-" + fault,
      async (root) => {
        await fixture(root);
        await assertSelectedSourceSafety({
          root,
          source: decisionFilePath(root, a),
          index: indexPath(root),
          fault,
          synchronize: async () => {
            const result = await selected(root, [a]);
            return { rejected: result.status === "error", details: result };
          }
        });
      }
    );
});
