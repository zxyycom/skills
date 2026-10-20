import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { printInvestigationRelationReview } from "../src/relation-review-output.ts";
import {
  relationReview,
  replacementRelationReview
} from "../src/relation-review.ts";
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
  const review = (
    before: import("../src/types.ts").InvestigationRelation[],
    after: import("../src/types.ts").InvestigationRelation[]
  ) =>
    replacementRelationReview("committed", [
      { sourceId: "first", before, after }
    ]);
  const plain = [{ target: "base", type: "补充" as const }];
  const added = [{ target: "base", type: "补充" as const, summary: "added" }];
  const changed = [
    { target: "base", type: "补充" as const, summary: "changed" }
  ];
  for (const [before, after] of [
    [plain, added],
    [added, changed],
    [changed, plain],
    [plain, []]
  ]) {
    assert.deepEqual(review(before!, after!).sources, [
      { sourceId: "first", action: "replace", before, after }
    ]);
  }
  assert.deepEqual(review(plain, structuredClone(plain)).sources, [
    { sourceId: "first", action: "unchanged", before: plain, after: plain }
  ]);
  const multi = replacementRelationReview("preflight", [
    {
      sourceId: "second",
      before: [{ target: "base", type: "复查" }],
      after: []
    },
    { sourceId: "first", before: plain, after: [] }
  ]);
  assert.equal(multi.phase, "preflight");
  assert.deepEqual(
    multi.sources.map(({ sourceId, action, after }) => ({
      sourceId,
      action,
      after
    })),
    [
      { sourceId: "first", action: "replace", after: [] },
      { sourceId: "second", action: "replace", after: [] }
    ]
  );
  assert.deepEqual(
    replacementRelationReview("committed", [
      { sourceId: "second", before: [], after: [] },
      { sourceId: "first", before: [], after: [] }
    ]).sources.map((source) => source.action),
    ["unchanged", "unchanged"]
  );
  const invalid = await setInvestigationRelations({
    preflight: true,
    replacements: [],
    workspaceRoot: os.tmpdir()
  });
  assert.deepEqual(invalid.errors, [
    "set-relations requires at least one complete source group"
  ]);
  assert.equal(invalid.changed, false);
  assert.equal(invalid.relationReview, undefined);
});

test("CLI relation reviews render complete source-qualified additions, removals, and summary clears", () => {
  const render = (
    before: import("../src/types.ts").InvestigationRelation[],
    after: import("../src/types.ts").InvestigationRelation[]
  ) => {
    let stdout = "";
    printInvestigationRelationReview(
      relationReview("committed", [
        { sourceId: "next", action: "replace", before, after }
      ]),
      {
        stdout: (text) => {
          stdout += text;
        },
        stderr: () => assert.fail("review renderer must not write stderr")
      }
    );
    return stdout;
  };
  const clearedSummary = render(
    [{ target: "base", type: "补充", summary: "before" }],
    [{ target: "base", type: "补充" }]
  );
  assert.match(
    clearedSummary,
    /before:\n      - next --补充--> base "before"/u
  );
  assert.match(
    clearedSummary,
    /after:\n      - next --补充--> base \[无摘要\]/u
  );
  assert.match(
    clearedSummary,
    /summary changed: next --补充--> base "before" -> next --补充--> base \[无摘要\]/u
  );
  const removed = render([{ target: "base", type: "补充" }], []);
  assert.match(removed, /after: \[\]/u);
  assert.match(removed, /removed: next --补充--> base \[无摘要\]/u);
  const added = render(
    [],
    [{ target: "base", type: "补充", summary: "added" }]
  );
  assert.match(added, /before: \[\]/u);
  assert.match(added, /added: next --补充--> base "added"/u);
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
