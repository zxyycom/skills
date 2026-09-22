import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import {
  investigationRoot,
  jsonObjectMember,
  parseJsonObject,
  runInvestigationCli,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";

function git(root: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function initializeGit(root: string): void {
  git(root, ["init", "--quiet"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  git(root, ["config", "user.name", "Test"]);
  git(root, ["add", "."]);
  git(root, ["commit", "--quiet", "-m", "initial"]);
}

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
        if (reportReadCount === 1) {
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

test("CLI selected sync publishes by default and keeps --preflight zero-write", async () => {
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
      "260828-beta"
    ]);
    assert.equal(unselected.status, 1);
    assert.match(unselected.stderr, /outside the selected sync scope/u);
    assert.equal(await fs.readFile(indexPath, "utf8"), baseline);

    const checked = await runInvestigationCli(root, [
      "sync-index",
      "--select",
      "alpha.md",
      "--preflight"
    ]);
    assert.equal(checked.status, 1);
    assert.match(checked.stderr, /selected source change is not present/u);
    assert.equal(await fs.readFile(indexPath, "utf8"), baseline);

    const removedWrite = await runInvestigationCli(root, [
      "sync-index",
      "--select",
      "alpha.md",
      "--write"
    ]);
    assert.equal(removedWrite.status, 2);
    assert.match(removedWrite.stderr, /unknown option '--write'/u);
    assert.equal(removedWrite.stdout, "");
    assert.equal(await fs.readFile(indexPath, "utf8"), baseline);

    const written = await runInvestigationCli(root, [
      "sync-index",
      "--select",
      "alpha.md"
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

test("CLI queries serve persisted snapshots with staleness warnings", async () => {
  await withTempRoot("cli-stale-snapshot", async (root) => {
    await writeCollection(root, [
      { id: "260828-alpha" },
      { id: "260828-beta" }
    ]);
    const alphaPath = path.join(investigationRoot(root), "260828-alpha.md");
    const alpha = await fs.readFile(alphaPath, "utf8");
    await fs.writeFile(
      alphaPath,
      alpha.replace(
        "已形成结果，仍保留适用条件和未知。",
        "已形成结果，仍保留适用条件和未知。追加的正文证据。"
      ),
      "utf8"
    );
    const snapshotWarning = /persisted Investigation index is stale/u;

    const listed = await runInvestigationCli(root, ["list"]);
    assert.equal(listed.status, 0, listed.stderr);
    assert.match(listed.stdout, /260828-alpha/u);
    assert.match(listed.stderr, snapshotWarning);
    assert.match(
      listed.stderr,
      /Run sync-index to publish the current projection/u
    );

    const traced = await runInvestigationCli(root, ["trace", "260828-alpha"]);
    assert.equal(traced.status, 0, traced.stderr);
    assert.match(traced.stderr, snapshotWarning);

    const shown = await runInvestigationCli(root, ["show", "260828-alpha"]);
    assert.equal(shown.status, 0, shown.stderr);
    assert.match(shown.stdout, /追加的正文证据/u);
    assert.match(
      shown.stderr,
      /metadata reflects the last published index snapshot while the body is read from the current/u
    );

    const metadata = await runInvestigationCli(root, [
      "search",
      "--in",
      "metadata",
      "alpha"
    ]);
    assert.equal(metadata.status, 0, metadata.stderr);
    assert.match(metadata.stderr, snapshotWarning);

    const content = await runInvestigationCli(root, [
      "search",
      "追加的正文证据"
    ]);
    assert.equal(content.status, 0, content.stderr);
    assert.match(content.stdout, /260828-alpha/u);
    assert.match(content.stderr, /unavailable or stale/u);
    assert.match(
      content.stderr,
      /Run sync-index to publish the current projection/u
    );
  });
});

test("CLI strict check and stage-index stop on a stale derived index", async () => {
  await withTempRoot("cli-stale-gates", async (root) => {
    await writeCollection(root, [{ id: "260828-alpha" }]);
    initializeGit(root);
    const indexPath = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    const reportPath = path.join(investigationRoot(root), "260828-alpha.md");
    const report = await fs.readFile(reportPath, "utf8");
    await fs.writeFile(
      reportPath,
      report.replace('title: "260828-alpha"', 'title: "Alpha changed"'),
      "utf8"
    );

    const checked = await runInvestigationCli(root, ["check"]);
    assert.equal(checked.status, 1);
    assert.match(checked.stderr, /state-index\.index-stale/u);
    assert.equal(checked.stdout, "");

    const staged = await runInvestigationCli(root, [
      "stage-index",
      "260828-alpha"
    ]);
    assert.equal(staged.status, 1);
    assert.match(staged.stderr, /state: index-stale/u);
    assert.match(
      staged.stderr,
      /run check to diagnose the collection, run sync-index to publish the current index, then retry stage-index/u
    );
    assert.equal(git(root, ["diff", "--cached", "--name-only"]).trim(), "");
    assert.equal(
      git(root, [
        "diff",
        "--name-only",
        "--",
        "docs/investigations/investigation-index.json"
      ]).trim(),
      ""
    );

    const synchronized = await runInvestigationCli(root, ["sync-index"]);
    assert.equal(synchronized.status, 0, synchronized.stderr);
    const restaged = await runInvestigationCli(root, [
      "stage-index",
      "260828-alpha"
    ]);
    assert.equal(restaged.status, 0, restaged.stderr);
    assert.match(restaged.stdout, /staged for 1 selected report/u);
    await fs.rm(indexPath);
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
    assert.match(result.stdout, /^- report /mu);
  });
});

test("CLI exposes bounded list controls and rejects malformed or repeated list options", async () => {
  await withTempRoot("cli-invalid", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    const help = await runInvestigationCli(root, ["list", "--help"]);
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /default: 10, maximum: 1000/u);
    assert.match(help.stdout, /--detail/u);

    for (const args of [
      ["list", "--limit", "zero"],
      ["list", "--limit", "0"],
      ["list", "--offset", "-1"],
      ["list", "--formed-from", "not-a-timestamp"],
      ["list", "--detail", "--detail"]
    ]) {
      const result = await runInvestigationCli(root, args);
      assert.equal(result.status, 2, args.join(" "));
      assert.equal(result.stdout, "", args.join(" "));
    }

    for (const option of ["formed-from", "formed-to", "limit", "offset"]) {
      const value = option.startsWith("formed-") ? "2026-09-08T00:00:00Z" : "1";
      const result = await runInvestigationCli(root, [
        "list",
        `--${option}`,
        value,
        `--${option}`,
        value
      ]);
      assert.equal(result.status, 2, option);
      assert.equal(result.stdout, "", option);
      assert.match(result.stderr, new RegExp(`--${option} only once`, "u"));
    }
  });
});
