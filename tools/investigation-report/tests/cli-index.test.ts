import assert from "node:assert/strict";
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
