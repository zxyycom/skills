import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import {
  investigationRoot,
  jsonObjectMember,
  parseJsonObject,
  runGeneratedInvestigationCliSmoke,
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
    assert.match(commandHelp.stdout, /--depth <count>/u);
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
    assert.match(
      traced.stdout,
      /260828-first --补充 \(first reason\)--> 260828-base/u
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

test("CLI leaves relation and trace enum values for API validation", async () => {
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
    assert.equal(trace.status, 1);
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

test("CLI check succeeds on a current report collection", async () => {
  await withTempRoot("cli-check", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    const result = await runInvestigationCli(root, ["check"]);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /1 of 1 reports checked; full index current/u);
  });
});

test("CLI show renders a scrubbed structured report read failure", async () => {
  await withTempRoot("cli-show-read-failure", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    const reportPath = path.join(investigationRoot(root), "report.md");
    const token = `ghp_${"x".repeat(36)}`;
    const originalReadFile = fs.readFile;
    let reportReadCount = 0;
    fs.readFile = (async (...args) => {
      if (args[0] === reportPath) {
        reportReadCount += 1;
        if (reportReadCount === 3) {
          throw Object.assign(
            new Error(`token=${token}\nfailed at /private/report.md`),
            { code: "EACCES" }
          );
        }
      }
      return await originalReadFile(...args);
    }) as typeof fs.readFile;
    let result;
    try {
      result = await runInvestigationCli(root, ["show", "report.md"]);
    } finally {
      fs.readFile = originalReadFile;
    }
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /investigation-report\.report-read-failed/u);
    assert.match(result.stderr, /causeCategory: access-denied/u);
    assert.match(result.stderr, /detail: token=\[redacted\]/u);
    assert.doesNotMatch(result.stderr, new RegExp(token, "u"));
    assert.doesNotMatch(result.stderr, /\/private\/report\.md/u);
  });
});

test("CLI sync-index writes a missing derived index", async () => {
  await withTempRoot("cli-sync", async (root) => {
    await writeCollection(root, [{ id: "report" }], false);
    const indexPath = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    await assert.rejects(fs.access(indexPath));
    const result = await runInvestigationCli(root, ["sync-index"]);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(
      result.stdout,
      /Investigation index synchronized \(1 reports\)\./u
    );
    const index = parseJsonObject(await fs.readFile(indexPath, "utf8"));
    assert.ok(Object.hasOwn(jsonObjectMember(index, "entries"), "report"));
  });
});

test("CLI selected sync proves the full investigation collection before writing", async () => {
  await withTempRoot("cli-selected-sync", async (root) => {
    await writeCollection(root, [
      { id: "260828-alpha" },
      { id: "260828-beta" }
    ]);
    const indexPath = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    const alphaPath = path.join(investigationRoot(root), "260828-alpha.md");
    const baseline = await fs.readFile(indexPath, "utf8");
    const alpha = await fs.readFile(alphaPath, "utf8");
    await fs.writeFile(
      alphaPath,
      alpha.replace('title: "260828-alpha"', 'title: "Alpha changed"'),
      "utf8"
    );

    const unselected = await runInvestigationCli(root, [
      "sync-index",
      "--select",
      "260828-beta",
      "--write"
    ]);
    assert.equal(unselected.status, 1);
    assert.match(unselected.stderr, /outside the selected sync scope/u);
    assert.equal(await fs.readFile(indexPath, "utf8"), baseline);

    const checked = await runInvestigationCli(root, [
      "sync-index",
      "--select",
      "alpha.md"
    ]);
    assert.equal(checked.status, 1);
    assert.match(checked.stderr, /selected source change is not present/u);
    assert.equal(await fs.readFile(indexPath, "utf8"), baseline);

    const written = await runInvestigationCli(root, [
      "sync-index",
      "--select",
      "alpha.md",
      "--write"
    ]);
    assert.equal(written.status, 0, written.stderr);
    assert.match(
      written.stdout,
      /Selected Investigation selectors: alpha\.md\./u
    );
    assert.match(written.stdout, /resolved IDs: 260828-alpha\./u);
    const selectedText = await fs.readFile(indexPath, "utf8");
    assert.notEqual(selectedText, baseline);

    await fs.writeFile(indexPath, baseline, "utf8");
    const full = await runInvestigationCli(root, ["sync-index"]);
    assert.equal(full.status, 0, full.stderr);
    assert.equal(await fs.readFile(indexPath, "utf8"), selectedText);
  });
});

test("CLI sync-index preserves collection lock diagnostics", async () => {
  await withTempRoot("cli-sync-lock", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    const lockPath = path.join(
      root,
      "docs",
      ".investigation-index.json.mutation.lock"
    );
    await fs.writeFile(lockPath, "held", "utf8");
    try {
      const result = await runInvestigationCli(root, ["sync-index"]);
      assert.equal(result.status, 1);
      assert.equal(result.stdout, "");
      assert.match(
        result.stderr,
        /investigation-report\.collection-lock-busy/u
      );
      assert.match(result.stderr, /causeCategory: busy/u);
      assert.match(
        result.stderr,
        /scope: investigation report index collection/u
      );
      assert.match(result.stderr, /outcome: no-change/u);
    } finally {
      await fs.rm(lockPath, { force: true });
    }
  });
});

test("CLI sync-index renders filesystem diagnostics structurally", async () => {
  await withTempRoot("cli-sync-filesystem", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    const indexPath = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    const token = `ghp_${"z".repeat(36)}`;
    const originalReadFile = fs.readFile;
    fs.readFile = (async (...args) => {
      if (args[0] === indexPath) {
        throw Object.assign(
          new Error(`token=${token}\nfailed at /private/index.json`),
          { code: "EACCES" }
        );
      }
      return await originalReadFile(...args);
    }) as typeof fs.readFile;
    let result;
    try {
      result = await runInvestigationCli(root, ["sync-index"]);
    } finally {
      fs.readFile = originalReadFile;
    }
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(
      result.stderr,
      /\[state-index\.index-read-failed\] investigation-index\.json/u
    );
    assert.match(result.stderr, /causeCategory: access-denied/u);
    assert.match(result.stderr, /operation: read a state-index file/u);
    assert.match(result.stderr, /detail: token=\[redacted\]/u);
    assert.doesNotMatch(result.stderr, new RegExp(token, "u"));
    assert.doesNotMatch(result.stderr, /\/private\/index\.json/u);
  });
});

test("CLI list returns a current report after resource byte changes", async () => {
  await withTempRoot("cli-resource", async (root) => {
    const resource = path.join(
      investigationRoot(root),
      "_resources",
      "report",
      "evidence.txt"
    );
    await fs.mkdir(path.dirname(resource), { recursive: true });
    await fs.writeFile(resource, "before", "utf8");
    await writeCollection(root, [
      { id: "report", resources: ["report/evidence.txt"] }
    ]);
    await fs.writeFile(resource, "after", "utf8");

    const result = await runInvestigationCli(root, ["list"]);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /^report /mu);
  });
});

test("CLI uses invalid-option exit status for malformed list input", async () => {
  await withTempRoot("cli-invalid", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    const result = await runInvestigationCli(root, ["list", "--limit", "zero"]);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /limit must be a number/u);
  });
});

test("CLI rejects repeated relation query options", async () => {
  await withTempRoot("cli-repeated-relation-query", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    const repeated = ["related-to", "direction", "relation-type"] as const;
    for (const command of ["list", "search"] as const) {
      for (const option of repeated) {
        const result = await runInvestigationCli(root, [
          ...(command === "search" ? ["search", "当前"] : ["list"]),
          `--${option}`,
          option === "direction"
            ? "both"
            : option === "relation-type"
              ? "补充"
              : "report",
          `--${option}`,
          option === "direction"
            ? "both"
            : option === "relation-type"
              ? "补充"
              : "report"
        ]);
        assert.equal(result.status, 2, result.stderr);
        assert.equal(result.stdout, "");
        assert.match(result.stderr, new RegExp(`--${option} only once`, "u"));
      }
    }
  });
});

test("CLI stage-index uses invalid-option exit status without report IDs", async () => {
  await withTempRoot("cli-stage-invalid", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    const indexPath = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    const before = await fs.readFile(indexPath, "utf8");
    const result = await runInvestigationCli(root, ["stage-index"]);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(
      result.stderr,
      /stage-index requires at least one Investigation ID/u
    );
    assert.equal(await fs.readFile(indexPath, "utf8"), before);
  });
});

test("CLI stage-index preserves version-control diagnostic facts", async () => {
  await withTempRoot("cli-stage-version-control", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    const result = await runInvestigationCli(root, [
      "stage-index",
      "report.md"
    ]);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /state-index\.repository-unavailable/u);
    assert.match(result.stderr, /causeCategory: not-repository/u);
    assert.match(result.stderr, /operation: /u);
    assert.match(
      result.stderr,
      /\[state-index\.repository-unavailable\] configured root/u
    );
  });
});

test("CLI stage-index renders filesystem diagnostics structurally", async () => {
  await withTempRoot("cli-stage-filesystem", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    git(root, ["init", "--quiet"]);
    git(root, ["config", "user.email", "test@example.invalid"]);
    git(root, ["config", "user.name", "Test"]);
    git(root, ["add", "."]);
    git(root, ["commit", "--quiet", "-m", "initial"]);
    const indexPath = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    const token = `ghp_${"y".repeat(36)}`;
    const originalReadFile = fs.readFile;
    fs.readFile = (async (...args) => {
      if (args[0] === indexPath) {
        throw Object.assign(
          new Error(`token=${token}\nfailed at /private/index.json`),
          { code: "EACCES" }
        );
      }
      return await originalReadFile(...args);
    }) as typeof fs.readFile;
    let result;
    try {
      result = await runInvestigationCli(root, ["stage-index", "report.md"]);
    } finally {
      fs.readFile = originalReadFile;
    }
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(
      result.stderr,
      /\[state-index\.index-read-failed\] investigation-index\.json/u
    );
    assert.match(result.stderr, /causeCategory: access-denied/u);
    assert.match(result.stderr, /operation: read a state-index file/u);
    assert.match(result.stderr, /detail: token=\[redacted\]/u);
    assert.doesNotMatch(result.stderr, new RegExp(token, "u"));
    assert.doesNotMatch(result.stderr, /\/private\/index\.json/u);
  });
});

test("CLI stage-index preserves pending transaction facts", async () => {
  await withTempRoot("cli-stage-pending", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    git(root, ["init", "--quiet"]);
    git(root, ["config", "user.email", "test@example.invalid"]);
    git(root, ["config", "user.name", "Test"]);
    git(root, ["add", "."]);
    git(root, ["commit", "--quiet", "-m", "initial"]);
    const lockPath = path.join(root, ".git", "index.lock");
    await fs.writeFile(lockPath, "held", "utf8");
    try {
      const result = await runInvestigationCli(root, [
        "stage-index",
        "report.md"
      ]);
      assert.equal(result.status, 1);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /state-index\.pending-conflict/u);
      assert.match(result.stderr, /causeCategory: busy/u);
      assert.match(result.stderr, /scope: /u);
      assert.match(result.stderr, /outcome: no-change/u);
    } finally {
      await fs.rm(lockPath, { force: true });
    }
  });
});

test("CLI stage-index rejects JSON output", async () => {
  await withTempRoot("cli-stage-json", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    const indexPath = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    const before = await fs.readFile(indexPath, "utf8");
    const result = await runInvestigationCli(root, [
      "stage-index",
      "report.md",
      "--json"
    ]);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /unknown option: --json/u);
    assert.equal(await fs.readFile(indexPath, "utf8"), before);
  });
});

test("CLI show requires one Investigation ID", async () => {
  await withTempRoot("cli-show", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    const result = await runInvestigationCli(root, ["show"]);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /show requires exactly one Investigation ID/u);
  });
});

test("CLI trace accepts report-level direction options", async () => {
  await withTempRoot("cli-trace", async (root) => {
    await writeCollection(root, [
      { id: "first" },
      {
        id: "second",
        relations: [{ target: "first", type: "补充" }]
      }
    ]);
    const result = await runInvestigationCli(root, [
      "trace",
      "--direction",
      "successors",
      "--depth",
      "1",
      "first.md"
    ]);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /Reports: first, second/u);
    assert.match(result.stdout, /second --补充--> first/u);
  });
});

test("generated Investigation Report CLI starts under Node with argv and stdout protocol", async () => {
  await withTempRoot("cli-node-smoke", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    const result = runGeneratedInvestigationCliSmoke(root, ["check"]);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /1 of 1 reports checked; full index current/u);

    const publishHelp = runGeneratedInvestigationCliSmoke(root, [
      "publish",
      "--help"
    ]);
    assert.equal(publishHelp.status, 0);
    assert.equal(publishHelp.stderr, "");
    assert.match(
      publishHelp.stdout,
      /Usage: investigation-report publish <investigation-id\.\.\.> \[--preflight\]/u
    );
  });
});

function git(root: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}
