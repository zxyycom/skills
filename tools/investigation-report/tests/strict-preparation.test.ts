import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { observeSourceReads } from "./phase-verification-support.ts";
import { prepareRename } from "../src/rename-preparation.ts";
import { prepareRenameTransaction } from "../src/rename-transaction-plan.ts";
import { createResourceMoveProgress } from "../src/rename-resource-proof.ts";
import { verifyCommittedRename } from "../src/rename-verification.ts";
import { InvestigationPreparation } from "../src/strict-preparation.ts";
import type { ParsedInvestigationReport } from "../src/types.ts";
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
      const original = prepared.value.originalSources.find(
        (source) => source.id === "untouched"
      )!;
      assert.strictEqual(
        prepared.value.sources.find((source) => source.id === "untouched"),
        original
      );
      assert.strictEqual(original.document, original.parsed!.report);
      assert.ok(original.state);
      const transaction = await prepareRenameTransaction({
        root,
        prepared: prepared.value,
        hooks: {},
        changedPaths: [],
        progress: createResourceMoveProgress()
      });
      for (const source of prepared.value.originalSources) {
        // The index-runtime freshness boundary independently reads the collection once.
        assert.equal(counts.get(source.filePath), 2, source.filePath);
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

test("strict candidate rename reuses complete layout source facts without rescanning candidates", async () => {
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
          for (const target of targets)
            assert.equal(counts.get(target), 2, target);
        }
      );
      assert.equal(prepared, true);
      assert.deepEqual(result.errors, []);
      assert.equal(result.changed, true);
      assert.ok(counts.get(targets[1]!)! > 2);
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

test("strict rename postwrite reuses one fresh layout and document per source while retaining index freshness reads", async (t) => {
  await withTempRoot("strict-rename-postwrite", async (workspaceRoot) => {
    const { root, prepared } = await committedRenameFixture(workspaceRoot);
    const targets = prepared.sources.map((source) =>
      path.join(root, source.sourcePath)
    );
    const observed = t.mock.method(
      InvestigationPreparation.prototype,
      "parsed"
    );
    const documents = new Map<string, ParsedInvestigationReport[]>();
    await observeSourceReads(targets, async (counts) => {
      assert.deepEqual(await verifyCommittedRename(root, prepared), []);
      for (const call of observed.mock.calls) {
        assert.ok(call.result);
        const key = call.arguments[0].sourcePath;
        const previous = documents.get(key) ?? [];
        previous.push(call.result);
        documents.set(key, previous);
      }
      for (const source of prepared.sources) {
        assert.equal(
          counts.get(path.join(root, source.sourcePath)),
          2,
          source.sourcePath
        );
        const parsed = documents.get(source.sourcePath)!;
        assert.equal(parsed.length, 2, source.sourcePath);
        assert.strictEqual(parsed[0], parsed[1]);
      }
    });
  });
});

test("strict rename postwrite rejects source edits rather than reusing preparation documents", async () => {
  await withTempRoot("strict-rename-postwrite-drift", async (workspaceRoot) => {
    const { root, prepared } = await committedRenameFixture(workspaceRoot);
    await fs.appendFile(
      path.join(root, "untouched.md"),
      "\n写入后的新证据。\n"
    );
    assert.deepEqual(await verifyCommittedRename(root, prepared), [
      "investigation index is stale after rename"
    ]);
  });
});
