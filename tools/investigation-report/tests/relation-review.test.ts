import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { publishInvestigationCandidates } from "../src/publish.ts";
import { setInvestigationRelations } from "../src/relation-transaction.ts";
import {
  investigationRoot,
  runInvestigationCli,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";
import { candidatePath, createReadyCandidate } from "./publish-support.ts";

test("set-relations preflight reviews complete before and after sets without writing", async () => {
  await withTempRoot("relation-preflight-review", async (root) => {
    await writeCollection(root, [
      { id: "base" },
      {
        id: "next",
        relations: [{ target: "base", type: "补充", summary: "before" }]
      }
    ]);
    const reportPath = `${investigationRoot(root)}/next.md`;
    const indexPath = `${investigationRoot(root)}/investigation-index.json`;
    const beforeReport = await fs.readFile(reportPath, "utf8");
    const beforeIndex = await fs.readFile(indexPath, "utf8");
    const input = {
      preflight: true,
      replacements: [
        {
          source: "next",
          relations: [{ target: "base", type: "补充", summary: "after" }]
        }
      ],
      workspaceRoot: root
    };
    const preview = await setInvestigationRelations(input);
    assert.deepEqual(preview.errors, []);
    assert.equal(preview.preflight, true);
    assert.deepEqual(preview.relationReview, {
      phase: "preflight",
      sources: [
        {
          sourceId: "next",
          action: "replace",
          before: [{ target: "base", type: "补充", summary: "before" }],
          after: [{ target: "base", type: "补充", summary: "after" }]
        }
      ]
    });
    assert.equal(await fs.readFile(reportPath, "utf8"), beforeReport);
    assert.equal(await fs.readFile(indexPath, "utf8"), beforeIndex);

    const committed = await setInvestigationRelations({
      ...input,
      preflight: false
    });
    assert.equal(committed.preflight, false);
    assert.equal(committed.relationReview?.phase, "committed");
    assert.equal(committed.relationReview?.sources[0]?.action, "replace");
  });
});

test("CLI set-relations preflight renders the expected review without writes", async () => {
  await withTempRoot("relation-cli-preflight", async (root) => {
    await writeCollection(root, [
      { id: "base" },
      { id: "next", relations: [{ target: "base", type: "补充" }] }
    ]);
    const reportPath = `${investigationRoot(root)}/next.md`;
    const indexPath = `${investigationRoot(root)}/investigation-index.json`;
    const [beforeReport, beforeIndex] = await Promise.all([
      fs.readFile(reportPath, "utf8"),
      fs.readFile(indexPath, "utf8")
    ]);
    const preview = await runInvestigationCli(root, [
      "set-relations",
      "--source",
      "next",
      "--relation",
      "补充=base",
      "--relation-summary",
      "base=expected summary",
      "--preflight"
    ]);
    assert.equal(preview.status, 0, preview.stderr);
    assert.equal(preview.stderr, "");
    assert.match(preview.stdout, /relation preflight passed/u);
    assert.match(preview.stdout, /relation review \(preflight\):/u);
    assert.match(
      preview.stdout,
      /summary changed: next --补充--> base \[无摘要\] -> next --补充--> base "expected summary"/u
    );
    assert.deepEqual(
      await Promise.all([
        fs.readFile(reportPath, "utf8"),
        fs.readFile(indexPath, "utf8")
      ]),
      [beforeReport, beforeIndex]
    );
  });
});

test("relation reviews distinguish summary replacement, clear, unchanged, and multi-source sets", async () => {
  await withTempRoot("relation-review-outcomes", async (root) => {
    await writeCollection(root, [
      { id: "base" },
      { id: "other" },
      { id: "first", relations: [{ target: "base", type: "补充" }] },
      { id: "second", relations: [{ target: "base", type: "复查" }] }
    ]);
    const replace = async (summary: string | undefined) =>
      await setInvestigationRelations({
        replacements: [
          {
            source: "first",
            relations: [
              {
                target: "base",
                type: "补充",
                ...(summary === undefined ? {} : { summary })
              }
            ]
          }
        ],
        workspaceRoot: root
      });
    const added = await replace("added");
    assert.equal(added.relationReview?.sources[0]?.action, "replace");
    assert.deepEqual(added.relationReview?.sources[0]?.before, [
      { target: "base", type: "补充" }
    ]);
    assert.deepEqual(added.relationReview?.sources[0]?.after, [
      { target: "base", type: "补充", summary: "added" }
    ]);
    const changed = await replace("changed");
    assert.equal(
      changed.relationReview?.sources[0]?.before[0]?.summary,
      "added"
    );
    assert.equal(
      changed.relationReview?.sources[0]?.after[0]?.summary,
      "changed"
    );
    const removed = await replace(undefined);
    assert.equal(
      removed.relationReview?.sources[0]?.before[0]?.summary,
      "changed"
    );
    assert.equal(
      removed.relationReview?.sources[0]?.after[0]?.summary,
      undefined
    );

    const multi = await setInvestigationRelations({
      replacements: [
        { source: "second", relations: [] },
        { source: "first", relations: [] }
      ],
      workspaceRoot: root
    });
    assert.deepEqual(
      multi.relationReview?.sources.map((source) => ({
        action: source.action,
        after: source.after,
        sourceId: source.sourceId
      })),
      [
        { action: "replace", after: [], sourceId: "first" },
        { action: "replace", after: [], sourceId: "second" }
      ]
    );
    const unchanged = await setInvestigationRelations({
      replacements: [
        { source: "first", relations: [] },
        { source: "second", relations: [] }
      ],
      workspaceRoot: root
    });
    assert.equal(unchanged.changed, false);
    assert.deepEqual(
      unchanged.relationReview?.sources.map((source) => source.action),
      ["unchanged", "unchanged"]
    );
    const invalid = await setInvestigationRelations({
      preflight: true,
      replacements: [],
      workspaceRoot: root
    });
    assert.ok(invalid.errors.length > 0);
    assert.equal(invalid.relationReview, undefined);
  });
});

test("CLI relation reviews render complete source-qualified additions, removals, and summary clears", async () => {
  await withTempRoot("relation-review-output", async (root) => {
    await writeCollection(root, [
      { id: "base" },
      {
        id: "next",
        relations: [{ target: "base", type: "补充", summary: "before" }]
      }
    ]);
    const clearedSummary = await runInvestigationCli(root, [
      "set-relations",
      "--source",
      "next",
      "--relation",
      "补充=base"
    ]);
    assert.equal(clearedSummary.status, 0, clearedSummary.stderr);
    assert.match(
      clearedSummary.stdout,
      /before:\n      - next --补充--> base "before"/u
    );
    assert.match(
      clearedSummary.stdout,
      /after:\n      - next --补充--> base \[无摘要\]/u
    );
    assert.match(
      clearedSummary.stdout,
      /summary changed: next --补充--> base "before" -> next --补充--> base \[无摘要\]/u
    );

    const removed = await runInvestigationCli(root, [
      "set-relations",
      "--source",
      "next",
      "--clear-relations"
    ]);
    assert.equal(removed.status, 0, removed.stderr);
    assert.match(removed.stdout, /after: \[\]/u);
    assert.match(removed.stdout, /removed: next --补充--> base \[无摘要\]/u);

    const added = await runInvestigationCli(root, [
      "set-relations",
      "--source",
      "next",
      "--relation",
      "补充=base",
      "--relation-summary",
      "base=added"
    ]);
    assert.equal(added.status, 0, added.stderr);
    assert.match(added.stdout, /before: \[\]/u);
    assert.match(added.stdout, /added: next --补充--> base "added"/u);
  });
});

test("publish release cleanup failure preserves the committed result without a successful review", async () => {
  await withTempRoot("publish-release-review", async (root) => {
    await createReadyCandidate(root, "candidate.md");
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
      result = await publishInvestigationCandidates({
        ids: ["candidate.md"],
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
      scope: "investigation candidate publish collection"
    });
    await fs.access(path.join(investigationRoot(root), "candidate.md"));
    await assert.rejects(fs.access(candidatePath(root, "candidate.md")));
    await fs.rm(lockPath, { force: true });
  });
});
