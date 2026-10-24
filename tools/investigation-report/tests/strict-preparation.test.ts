import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { observeSourceReads } from "./phase-verification-support.ts";
import { prepareRename } from "../src/rename-preparation.ts";
import { prepareRenameTransaction } from "../src/rename-transaction-plan.ts";
import { createResourceMoveProgress } from "../src/rename-resource-proof.ts";
import { verifyCommittedRename } from "../src/rename-verification.ts";
import { discardInvestigationReportWithWriter } from "../src/discard.ts";
import { writeInvestigationTextAtomically } from "../src/transaction-files.ts";
import {
  investigationRoot,
  reportMarkdown,
  withTempRoot
} from "./fixture-support.ts";
import { writeCollection } from "./collection-support.ts";

async function verifyRenamePreparation(candidate: boolean): Promise<void> {
  await withTempRoot("strict-rename-preparation", async (workspaceRoot) => {
    await writeCollection(workspaceRoot, [
      { id: "legacy" },
      { id: "untouched" }
    ]);
    const root = investigationRoot(workspaceRoot);
    if (candidate)
      await fs.writeFile(
        path.join(root, "_candidate.draft"),
        reportMarkdown({ id: "draft" })
      );
    const targets = [
      "legacy.md",
      "untouched.md",
      ...(candidate ? ["_candidate.draft"] : [])
    ].map((source) => path.join(root, source));
    await observeSourceReads(targets, async (counts) => {
      const prepared = await prepareRename(
        root,
        path.join(root, "investigation-index.json"),
        {
          source: candidate ? "draft" : "legacy",
          target: "renamed",
          workspaceRoot
        }
      );
      if ("result" in prepared) assert.fail(prepared.result.errors.join("\n"));
      assert.equal(
        prepared.value.originalSources.some(
          (source) => source.id === "untouched"
        ),
        false
      );
      assert.equal(counts.get(path.join(root, "untouched.md")), 0);
      const transaction = await prepareRenameTransaction({
        root,
        prepared: prepared.value,
        hooks: {},
        changedPaths: [],
        progress: createResourceMoveProgress()
      });
      for (const source of prepared.value.originalSources) {
        // The index-runtime freshness boundary independently reads the collection once.
        assert.equal(
          counts.get(source.filePath),
          candidate ? 2 : 1,
          source.filePath
        );
        const captured = prepared.value.preparation!.captured(
          source.filePath,
          source.text
        );
        assert.strictEqual(
          transaction.guards!.find((guard) => guard.path === source.filePath)!
            .before,
          captured.snapshot
        );
        const write = transaction.writes.find(
          (value) => value.path === source.filePath
        );
        if (source === prepared.value.sourceBefore)
          assert.strictEqual(write!.before, captured.snapshot);
        else
          assert.equal(
            write,
            undefined,
            "unchanged sources are guards, not writes"
          );
      }
    });
  });
}

test("strict formal rename hands captured sources and validated documents to its transaction", async () => {
  await verifyRenamePreparation(false);
});

test("strict candidate rename captures only its selected candidate for transaction proof", async () => {
  await verifyRenamePreparation(true);
});

test("strict formal discard reuses preparation sources while retaining independent freshness phases", async () => {
  await withTempRoot("strict-discard-preparation", async (workspaceRoot) => {
    await writeCollection(workspaceRoot, [
      { id: "legacy" },
      { id: "untouched" }
    ]);
    const root = investigationRoot(workspaceRoot);
    const targets = ["legacy.md", "untouched.md"].map((source) =>
      path.join(root, source)
    );
    await observeSourceReads(targets, async (counts) => {
      let prepared = false;
      const result = await discardInvestigationReportWithWriter(
        { workspaceRoot, id: "legacy" },
        writeInvestigationTextAtomically,
        async () => {
          prepared = true;
          assert.equal(counts.get(targets[0]!), 1);
          assert.equal(counts.get(targets[1]!), 0);
        }
      );
      assert.equal(prepared, true);
      assert.deepEqual(result.errors, []);
      assert.equal(result.changed, true);
      assert.equal(counts.get(targets[1]!), 0);
    });
  });
});

async function committedRenameFixture(workspaceRoot: string) {
  await writeCollection(workspaceRoot, [{ id: "legacy" }, { id: "untouched" }]);
  const root = investigationRoot(workspaceRoot);
  await fs.writeFile(
    path.join(root, "_candidate.draft"),
    reportMarkdown({
      id: "draft",
      relations: [{ type: "补充", target: "legacy" }]
    })
  );
  const prepared = await prepareRename(
    root,
    path.join(root, "investigation-index.json"),
    {
      source: "legacy",
      target: "renamed",
      workspaceRoot
    }
  );
  if ("result" in prepared) assert.fail(prepared.result.errors.join("\n"));
  await fs.unlink(prepared.value.sourceBefore.filePath);
  for (const source of prepared.value.sources)
    await fs.writeFile(path.join(root, source.sourcePath), source.text);
  assert.notEqual(prepared.value.nextIndexText, null);
  await fs.writeFile(prepared.value.indexPath, prepared.value.nextIndexText!);
  return { root, prepared: prepared.value };
}

test("strict rename postwrite reads each actual rewritten source once", async () => {
  await withTempRoot("strict-rename-postwrite", async (workspaceRoot) => {
    const { root, prepared } = await committedRenameFixture(workspaceRoot);
    const targets = prepared.sources.map((source) =>
      path.join(root, source.sourcePath)
    );
    await observeSourceReads(targets, async (counts) => {
      assert.deepEqual(await verifyCommittedRename(root, prepared), []);
      for (const source of prepared.sources)
        assert.equal(counts.get(path.join(root, source.sourcePath)), 1);
    });
  });
});

test("strict rename postwrite rejects source edits rather than reusing preparation documents", async () => {
  await withTempRoot("strict-rename-postwrite-drift", async (workspaceRoot) => {
    const { root, prepared } = await committedRenameFixture(workspaceRoot);
    await fs.appendFile(
      path.join(root, prepared.plan.newSourcePath),
      "\n写入后的新证据。\n"
    );
    assert.deepEqual(await verifyCommittedRename(root, prepared), [
      prepared.plan.newId + " changed after rename publication"
    ]);
  });
});
