import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createInvestigationCandidate } from "../../src/candidates/create/candidate-create.ts";
import { publishInvestigationCandidates } from "../../src/publication/publish.ts";
import { renameInvestigationRecord } from "../../src/rename/rename.ts";
import { discardInvestigationReport } from "../../src/discard/discard.ts";
import { setInvestigationRelations } from "../../src/relations/transactions/relation-transaction.ts";
import {
  writeCollection,
  writeResource
} from "../support/collection-support.ts";
import {
  investigationRoot,
  reportMarkdown,
  withTempRoot
} from "../support/fixture-support.ts";

async function withoutSourceReads<T>(
  paths: readonly string[],
  action: () => Promise<T>
): Promise<T> {
  const open = fs.open;
  const forbidden = new Set(paths);
  fs.open = async (...args) => {
    assert.equal(
      forbidden.has(String(args[0])),
      false,
      `Unselected source was read: ${String(args[0])}`
    );
    return await open(...args);
  };
  try {
    return await action();
  } finally {
    fs.open = open;
  }
}

test("Investigation creation preserves complete date identity and actual locator through first publication", async () => {
  await withTempRoot("local-identity", async (workspaceRoot) => {
    const created = await createInvestigationCandidate({
      workspaceRoot,
      id: "topic",
      formedAt: "2026-10-24T12:00:00Z",
      title: "Topic",
      question: "Which identity is stable?",
      tags: ["test"],
      relations: []
    });
    assert.equal(created.status, "ok");
    if (created.candidate === null) assert.fail("Expected created candidate");
    assert.equal(created.candidate.id, "261024-topic");
    assert.equal(
      path.basename(created.candidate.path),
      "_candidate.261024-topic"
    );
    await fs.writeFile(
      created.candidate.path,
      reportMarkdown({ id: "261024-topic", formedAt: "2026-10-24T12:00:00Z" })
    );
    const published = await publishInvestigationCandidates({
      workspaceRoot,
      ids: [created.candidate.id]
    });
    assert.deepEqual(published.errors, []);
    const root = investigationRoot(workspaceRoot);
    const index = JSON.parse(
      await fs.readFile(path.join(root, "investigation-index.json"), "utf8")
    );
    assert.deepEqual(Object.keys(index.entries), ["261024-topic"]);
    assert.equal(index.entries["261024-topic"].sourcePath, "261024-topic.md");
    await fs.access(path.join(root, "261024-topic.md"));
    await assert.rejects(fs.access(created.candidate.path));
  });
});

test("Investigation rename reads only actual formal rewrites and leaves unselected candidate references unchanged", async () => {
  await withTempRoot("local-rename", async (workspaceRoot) => {
    await writeCollection(workspaceRoot, [
      { id: "base" },
      { id: "dependent", relations: [{ type: "补充", target: "base" }] },
      { id: "unrelated" }
    ]);
    const root = investigationRoot(workspaceRoot);
    const unrelated = path.join(root, "unrelated.md");
    await fs.writeFile(unrelated, "broken unselected body\n");
    const draft = path.join(root, "_candidate.draft");
    const draftText = reportMarkdown({
      id: "draft",
      relations: [{ type: "补充", target: "base" }]
    });
    await fs.writeFile(draft, draftText);
    const before = JSON.parse(
      await fs.readFile(path.join(root, "investigation-index.json"), "utf8")
    );
    const result = await withoutSourceReads([unrelated], () =>
      renameInvestigationRecord({
        workspaceRoot,
        source: "base",
        target: "renamed"
      })
    );
    assert.equal(result.status, "ok", result.errors.join("; "));
    assert.equal(result.plan?.affectedCandidateRelationCount, 0);
    assert.match(
      await fs.readFile(path.join(root, "dependent.md"), "utf8"),
      /target: "260828-renamed"/
    );
    assert.equal(await fs.readFile(draft, "utf8"), draftText);
    const after = JSON.parse(
      await fs.readFile(path.join(root, "investigation-index.json"), "utf8")
    );
    assert.deepEqual(after.entries.unrelated, before.entries.unrelated);
    assert.equal(
      after.sourceRevision.entries.unrelated,
      before.sourceRevision.entries.unrelated
    );
    const rejected = await publishInvestigationCandidates({
      workspaceRoot,
      ids: ["draft"]
    });
    assert.equal(rejected.changed, false);
    assert.match(rejected.errors.join("; "), /base/);
  });
});

test("Investigation discard deletes only authorized owner resources without auditing unselected drafts or bodies", async () => {
  await withTempRoot("local-discard", async (workspaceRoot) => {
    await writeResource(workspaceRoot, "base/evidence.txt", "owned");
    await writeCollection(workspaceRoot, [
      { id: "base", resources: ["base/evidence.txt"] },
      { id: "unrelated" }
    ]);
    const root = investigationRoot(workspaceRoot);
    const unrelated = path.join(root, "unrelated.md");
    await fs.writeFile(unrelated, "broken unselected body\n");
    const draft = path.join(root, "_candidate.draft");
    const draftText = reportMarkdown({
      id: "draft",
      resources: ["base/evidence.txt"]
    });
    await fs.writeFile(draft, draftText);
    const denied = await discardInvestigationReport({
      workspaceRoot,
      id: "base"
    });
    assert.equal(denied.changed, false);
    const discarded = await withoutSourceReads([unrelated, draft], () =>
      discardInvestigationReport({
        workspaceRoot,
        id: "base",
        deleteOwnedResources: true
      })
    );
    assert.deepEqual(discarded.errors, []);
    assert.equal(discarded.changed, true);
    await assert.rejects(fs.access(path.join(root, "base.md")));
    await assert.rejects(fs.access(path.join(root, "_resources/base")));
    assert.equal(await fs.readFile(draft, "utf8"), draftText);
  });
});

test("Investigation selected drift fails relation edits discard and true rename no-ops without changing the index", async () => {
  await withTempRoot("local-selected-drift", async (workspaceRoot) => {
    await writeCollection(workspaceRoot, [
      { id: "260828-base", sourcePath: "base.md" }
    ]);
    const root = investigationRoot(workspaceRoot);
    const indexPath = path.join(root, "investigation-index.json");
    const before = await fs.readFile(indexPath);
    await fs.appendFile(
      path.join(root, "base.md"),
      "\nselected external edit\n"
    );
    const results = [
      await setInvestigationRelations({
        workspaceRoot,
        replacements: [{ source: "260828-base", relations: [] }]
      }),
      await discardInvestigationReport({ workspaceRoot, id: "260828-base" }),
      await renameInvestigationRecord({
        workspaceRoot,
        source: "260828-base",
        target: "base"
      })
    ];
    for (const result of results) {
      assert.equal(result.changed, false);
      assert.match(result.errors.join("; "), /published index source/);
    }
    assert.deepEqual(await fs.readFile(indexPath), before);
  });
});
