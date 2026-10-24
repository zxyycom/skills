import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { renameInvestigationRecord } from "../src/rename.ts";
import { discardInvestigationRecord } from "../src/discard-entry.ts";
import { writeCollection } from "./collection-support.ts";
import {
  investigationRoot,
  reportMarkdown,
  withTempRoot
} from "./fixture-support.ts";
import { candidatePath, createReadyCandidate } from "./publish-support.ts";

const lockPath = (root: string) =>
  path.join(root, "docs/.investigation-index.json.mutation.lock");

test("Investigation rename executes preparation only under lock while explicit preflight stays unlocked", async () => {
  await withTempRoot("rename-preparation-entry", async (root) => {
    await writeCollection(root, [{ id: "260828-alpha" }, { id: "unrelated" }]);
    const unrelated = path.join(investigationRoot(root), "unrelated.md");
    await fs.writeFile(unrelated, "invalid unrelated report\n");
    const index = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    const before = await fs.readFile(index);
    await fs.writeFile(lockPath(root), "busy\n");
    const execute = await renameInvestigationRecord({
      workspaceRoot: root,
      source: "260828-alpha",
      target: "renamed"
    });
    assert.match(JSON.stringify(execute), /collection-lock-busy/);
    const preview = await renameInvestigationRecord({
      workspaceRoot: root,
      source: "260828-alpha",
      target: "renamed",
      preflight: true
    });
    assert.equal(preview.status, "ok");
    assert.doesNotMatch(JSON.stringify(preview), /collection-lock-busy/);
    assert.deepEqual(await fs.readFile(index), before);
    await fs.rm(lockPath(root));
    await fs.writeFile(unrelated, reportMarkdown({ id: "unrelated" }));
    const originalOpen = fs.open;
    let unlockedSourceRead = false;
    fs.open = (async (...args) => {
      if (typeof args[0] === "string" && args[0].endsWith(".md")) {
        if (!(await fs.stat(lockPath(root)).catch(() => null)))
          unlockedSourceRead = true;
      }
      return originalOpen(...args);
    }) as typeof fs.open;
    let result;
    try {
      result = await renameInvestigationRecord({
        workspaceRoot: root,
        source: "260828-alpha",
        target: "renamed"
      });
    } finally {
      fs.open = originalOpen;
    }
    assert.equal(result.status, "ok", JSON.stringify(result));
    assert.equal(unlockedSourceRead, false);
    await assert.rejects(
      fs.access(path.join(investigationRoot(root), "260828-alpha.md"))
    );
    assert.match(
      await fs.readFile(
        path.join(investigationRoot(root), "renamed.md"),
        "utf8"
      ),
      /260828-renamed/
    );
  });
});

test("Investigation unified discard classifies and prepares under one lock for formal and candidate targets", async () => {
  for (const kind of ["formal", "candidate"] as const)
    await withTempRoot("discard-entry-" + kind, async (root) => {
      await writeCollection(root, [{ id: "formal" }]);
      if (kind === "candidate")
        await createReadyCandidate(root, "candidate.md", { id: "candidate" });
      const index = path.join(
        investigationRoot(root),
        "investigation-index.json"
      );
      const before = await fs.readFile(index);
      const originalOpen = fs.open;
      let lockAcquisitions = 0;
      let unlockedSourceRead = false;
      const selectedPath =
        kind === "candidate"
          ? candidatePath(root, "candidate.md")
          : path.join(investigationRoot(root), "formal.md");
      let selectedReads = 0;
      fs.open = (async (...args) => {
        if (args[0] === lockPath(root)) lockAcquisitions += 1;
        if (args[0] === selectedPath) selectedReads += 1;
        if (
          typeof args[0] === "string" &&
          (args[0].endsWith(".md") || args[0] === selectedPath)
        ) {
          if (!(await fs.stat(lockPath(root)).catch(() => null)))
            unlockedSourceRead = true;
        }
        return originalOpen(...args);
      }) as typeof fs.open;
      let result;
      try {
        result = await discardInvestigationRecord({
          workspaceRoot: root,
          id: kind
        });
      } finally {
        fs.open = originalOpen;
      }
      assert.deepEqual(result.errors, []);
      assert.equal(result.changed, true);
      assert.equal(lockAcquisitions, 1);
      assert.equal(unlockedSourceRead, false);
      assert.ok(
        selectedReads > 0,
        "the selected formal or candidate source is actually acquired under lock"
      );
      if (kind === "candidate") {
        await assert.rejects(fs.access(candidatePath(root, "candidate.md")));
        assert.deepEqual(await fs.readFile(index), before);
      } else {
        await assert.rejects(
          fs.access(path.join(investigationRoot(root), "formal.md"))
        );
        assert.deepEqual(
          JSON.parse(await fs.readFile(index, "utf8")).entries,
          {}
        );
      }
    });
});

test("Investigation unified discard preserves name ambiguity and candidate formal identity conflicts", async () => {
  await withTempRoot("discard-entry-ambiguity", async (root) => {
    await writeCollection(root, [{ id: "260828-shared" }]);
    await createReadyCandidate(root, "260829-shared.md", {
      id: "260829-shared",
      formedAt: "2026-08-29T12:00:00Z"
    });
    const index = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    const before = await fs.readFile(index);
    assert.ok(
      (await discardInvestigationRecord({ workspaceRoot: root, id: "shared" }))
        .errors.length > 0
    );
    await fs.writeFile(
      candidatePath(root, "260829-shared.md"),
      reportMarkdown({ id: "260828-shared" })
    );
    assert.ok(
      (
        await discardInvestigationRecord({
          workspaceRoot: root,
          id: "260828-shared"
        })
      ).errors.length > 0
    );
    assert.deepEqual(await fs.readFile(index), before);
    await fs.access(path.join(investigationRoot(root), "260828-shared.md"));
    await fs.access(candidatePath(root, "260829-shared.md"));
  });
});

test("Investigation unified candidate discard retains its actual result when lock release fails", async () => {
  await withTempRoot("discard-entry-candidate-release", async (root) => {
    await writeCollection(root, [{ id: "formal" }]);
    await createReadyCandidate(root, "candidate.md", { id: "candidate" });
    const index = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    const before = await fs.readFile(index);
    const originalRm = fs.rm;
    fs.rm = (async (...args) => {
      if (args[0] === lockPath(root))
        throw Object.assign(new Error("injected lock cleanup failure"), {
          code: "EIO"
        });
      return originalRm(...args);
    }) as typeof fs.rm;
    let result;
    try {
      result = await discardInvestigationRecord({
        workspaceRoot: root,
        id: "candidate"
      });
    } finally {
      fs.rm = originalRm;
    }
    assert.equal(result.changed, true);
    assert.equal(result.id, "candidate");
    assert.equal(result.mutation?.outcome, "committed-cleanup-pending");
    assert.equal(
      result.mutation?.scope,
      "investigation candidate discard collection"
    );
    assert.match(
      JSON.stringify(result.diagnostics),
      /collection-lock-release-failed/
    );
    assert.equal(Object.hasOwn(result, "indexPath"), false);
    await assert.rejects(fs.access(candidatePath(root, "candidate.md")));
    assert.deepEqual(await fs.readFile(index), before);
    await fs.rm(lockPath(root));
  });
});
