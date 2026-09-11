import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import {
  investigationRoot,
  runGeneratedInvestigationCliSmoke,
  runInvestigationCli,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";

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
