import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import {
  investigationRoot,
  runInvestigationCli,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";

test("CLI exposes only report-level commands and rejects old topic options", async () => {
  await withTempRoot("cli", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    const help = await runInvestigationCli(root, ["--help"]);
    assert.equal(help.status, 0);
    assert.equal(help.stderr, "");
    assert.match(help.stdout, /Usage: investigation-report <command>/u);
    assert.match(help.stdout, /Exit status: 0 success; 1/u);
    assert.doesNotMatch(help.stdout, /check-investigations\.mjs/u);
    assert.doesNotMatch(help.stdout, /--category/u);

    const commandHelp = await runInvestigationCli(root, ["trace", "--help"]);
    assert.equal(commandHelp.status, 0);
    assert.match(commandHelp.stdout, /Usage: investigation-report trace/u);
    assert.match(commandHelp.stdout, /--depth <count\|all>/u);
    assert.match(commandHelp.stdout, /--max-records <count>/u);
    assert.doesNotMatch(commandHelp.stdout, /set-relations/u);

    const searchHelp = await runInvestigationCli(root, ["search", "--help"]);
    assert.equal(searchHelp.status, 0);
    assert.match(searchHelp.stdout, /search <text>/u);
    assert.match(searchHelp.stdout, /--match <mode>/u);

    const relationHelp = await runInvestigationCli(root, [
      "set-relations",
      "--help"
    ]);
    assert.equal(relationHelp.status, 0);
    assert.match(relationHelp.stdout, /--relation-summary/u);

    const oldOption = await runInvestigationCli(root, [
      "list",
      "--category",
      "legacy"
    ]);
    assert.equal(oldOption.status, 2);
    assert.equal(oldOption.stdout, "");
    assert.match(oldOption.stderr, /unknown option: --category/u);

    const retiredText = await runInvestigationCli(root, [
      "list",
      "--text",
      "legacy"
    ]);
    assert.equal(retiredText.status, 2);
    assert.match(retiredText.stderr, /unknown option: --text/u);
  });
});

test("CLI set-relations prints a human-readable result and rejects JSON output", async () => {
  await withTempRoot("cli-relations", async (root) => {
    await writeCollection(root, [{ id: "base" }, { id: "next" }]);
    const result = await runInvestigationCli(root, [
      "set-relations",
      "--source",
      "next.md",
      "--relation",
      "补充=base.md"
    ]);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /Investigation relations updated for: next/u);
    const json = await runInvestigationCli(root, [
      "set-relations",
      "--source",
      "next.md",
      "--clear-relations",
      "--json"
    ]);
    assert.equal(json.status, 2);
    assert.match(json.stderr, /unknown option: --json/u);
    const markdown = await fs.readFile(
      path.join(investigationRoot(root), "next.md"),
      "utf8"
    );
    assert.match(markdown, /type: "补充"\n    target: "base"/u);
  });
});

test("CLI set-relations rejects relations that do not follow a source", async () => {
  await withTempRoot("cli-relations-invalid", async (root) => {
    await writeCollection(root, [{ id: "base" }, { id: "next" }]);
    const malformed = await runInvestigationCli(root, [
      "set-relations",
      "--relation",
      "补充=base.md"
    ]);
    assert.equal(malformed.status, 2);
    assert.equal(malformed.stdout, "");
    assert.match(malformed.stderr, /--relation must follow --source/u);
  });
});

test("CLI new binds relation summaries after selector resolution and preserves equals", async () => {
  await withTempRoot("cli-new-relation-summary", async (root) => {
    await writeCollection(root, [{ id: "260828-base" }]);
    const created = await runInvestigationCli(root, [
      "new",
      "next-summary",
      "--title",
      "摘要候选",
      "--formed-at",
      "2026-09-02T12:00:00+00:00",
      "--question",
      "关系摘要如何绑定？",
      "--tag",
      "investigation-report",
      "--relation",
      "补充=base",
      "--relation-summary=260828-base=reason=a=b"
    ]);
    assert.equal(created.status, 0, created.stderr);
    const shown = await runInvestigationCli(root, [
      "show-candidate",
      "next-summary"
    ]);
    assert.equal(shown.status, 0, shown.stderr);
    assert.match(
      shown.stdout,
      /type: "补充"\n    target: "260828-base"\n    summary: "reason=a=b"/u
    );

    const summaryOnly = await runInvestigationCli(root, [
      "new",
      "summary-only",
      "--title",
      "无关系摘要",
      "--formed-at",
      "2026-09-02T12:00:00+00:00",
      "--question",
      "摘要能否独立存在？",
      "--tag",
      "investigation-report",
      "--relation-summary",
      "260828-base=invalid"
    ]);
    assert.equal(summaryOnly.status, 2);
    assert.match(summaryOnly.stderr, /requires at least one --relation/u);
  });
});

test("CLI set-relations scopes summaries to complete source groups", async () => {
  await withTempRoot("cli-set-relation-summaries", async (root) => {
    await writeCollection(root, [
      { id: "260828-base" },
      { id: "260828-first" },
      { id: "260828-second" }
    ]);
    const applied = await runInvestigationCli(root, [
      "set-relations",
      "--source",
      "second",
      "--relation-summary",
      "260828-base=second=reason",
      "--relation",
      "补充=base",
      "--source",
      "260828-first",
      "--relation",
      "补充=260828-base",
      "--relation-summary",
      "base=first reason"
    ]);
    assert.equal(applied.status, 0, applied.stderr);
    assert.match(
      await fs.readFile(`${root}/docs/investigations/260828-second.md`, "utf8"),
      /summary: "second=reason"/u
    );
    assert.match(
      await fs.readFile(`${root}/docs/investigations/260828-first.md`, "utf8"),
      /summary: "first reason"/u
    );
    const traced = await runInvestigationCli(root, [
      "trace",
      "base",
      "--direction",
      "successors"
    ]);
    assert.equal(traced.status, 0, traced.stderr);
    const trace = JSON.parse(traced.stdout);
    assert.deepEqual(trace.traceIds, [
      "260828-base",
      "260828-first",
      "260828-second"
    ]);
    assert.equal(
      trace.entries["260828-first"].relations[0].summary,
      "first reason"
    );

    const clearedSummary = await runInvestigationCli(root, [
      "set-relations",
      "--source",
      "first",
      "--relation",
      "补充=base"
    ]);
    assert.equal(clearedSummary.status, 0, clearedSummary.stderr);
    assert.doesNotMatch(
      await fs.readFile(`${root}/docs/investigations/260828-first.md`, "utf8"),
      /summary:/u
    );

    for (const args of [
      ["--source", "first", "--relation-summary", "base=summary only"],
      [
        "--source",
        "first",
        "--clear-relations",
        "--relation-summary",
        "base=conflict"
      ],
      [
        "--source",
        "first",
        "--relation",
        "补充=base",
        "--relation-summary",
        "base=one",
        "--relation-summary",
        "260828-base=two"
      ],
      [
        "--source",
        "first",
        "--relation",
        "补充=base",
        "--relation-summary",
        "second=missing"
      ]
    ]) {
      const rejected = await runInvestigationCli(root, [
        "set-relations",
        ...args
      ]);
      assert.notEqual(rejected.status, 0);
    }
  });
});

test("CLI rejects invalid relation and trace enum values", async () => {
  await withTempRoot("cli-raw-enums", async (root) => {
    await writeCollection(root, [{ id: "base" }, { id: "next" }]);
    const relation = await runInvestigationCli(root, [
      "set-relations",
      "--source",
      "next.md",
      "--relation",
      "unknown=base.md"
    ]);
    assert.equal(relation.status, 1);
    assert.equal(relation.stdout, "");
    assert.match(relation.stderr, /relation type/u);

    const trace = await runInvestigationCli(root, [
      "trace",
      "--direction",
      "sideways",
      "next.md"
    ]);
    assert.equal(trace.status, 2);
    assert.equal(trace.stdout, "");
    assert.match(trace.stderr, /direction/u);
  });
});

test("CLI discard rejects malformed investigation IDs as argument errors", async () => {
  await withTempRoot("cli-discard-invalid", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    const result = await runInvestigationCli(root, ["discard", "./report.md"]);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /discard id must use an Investigation ID/u);
    await fs.access(path.join(investigationRoot(root), "report.md"));
  });
});
