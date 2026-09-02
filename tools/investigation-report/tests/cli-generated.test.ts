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
    await writeCollection(root, [{ id: "report.md" }]);
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

    const oldOption = await runInvestigationCli(root, [
      "list",
      "--category",
      "legacy"
    ]);
    assert.equal(oldOption.status, 2);
    assert.equal(oldOption.stdout, "");
    assert.match(oldOption.stderr, /unknown option: --category/u);
  });
});

test("CLI set-relations prints a human-readable result and rejects JSON output", async () => {
  await withTempRoot("cli-relations", async (root) => {
    await writeCollection(root, [{ id: "base.md" }, { id: "next.md" }]);
    const result = await runInvestigationCli(root, [
      "set-relations",
      "--source",
      "next.md",
      "--relation",
      "补充=base.md"
    ]);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(
      result.stdout,
      /Investigation relations updated for: next\.md/u
    );
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
    assert.match(markdown, /type: "补充"\n    target: "base\.md"/u);
  });
});

test("CLI set-relations rejects relations that do not follow a source", async () => {
  await withTempRoot("cli-relations-invalid", async (root) => {
    await writeCollection(root, [{ id: "base.md" }, { id: "next.md" }]);
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

test("CLI leaves relation and trace enum values for API validation", async () => {
  await withTempRoot("cli-raw-enums", async (root) => {
    await writeCollection(root, [{ id: "base.md" }, { id: "next.md" }]);
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
    await writeCollection(root, [{ id: "report.md" }]);
    const result = await runInvestigationCli(root, ["discard", "./report.md"]);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /discard id must use an Investigation ID/u);
    await fs.access(path.join(investigationRoot(root), "report.md"));
  });
});

test("CLI check succeeds on a current report collection", async () => {
  await withTempRoot("cli-check", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
    const result = await runInvestigationCli(root, ["check"]);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /1 of 1 reports checked; full index current/u);
  });
});

test("CLI show renders a scrubbed structured report read failure", async () => {
  await withTempRoot("cli-show-read-failure", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
    const reportPath = path.join(investigationRoot(root), "report.md");
    const token = `ghp_${"x".repeat(36)}`;
    const originalReadFile = fs.readFile;
    let reportReadCount = 0;
    fs.readFile = (async (...args) => {
      if (args[0] === reportPath) {
        reportReadCount += 1;
        if (reportReadCount === 2) {
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
    await writeCollection(root, [{ id: "report.md" }], false);
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
    assert.ok(Object.hasOwn(jsonObjectMember(index, "entries"), "report.md"));
  });
});

test("CLI sync-index preserves collection lock diagnostics", async () => {
  await withTempRoot("cli-sync-lock", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
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
    await writeCollection(root, [{ id: "report.md" }]);
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
      { id: "report.md", resources: ["report/evidence.txt"] }
    ]);
    await fs.writeFile(resource, "after", "utf8");

    const result = await runInvestigationCli(root, ["list"]);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /^report\.md /mu);
  });
});

test("CLI uses invalid-option exit status for malformed list input", async () => {
  await withTempRoot("cli-invalid", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
    const result = await runInvestigationCli(root, ["list", "--limit", "zero"]);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /limit must be a number/u);
  });
});

test("CLI stage-index uses invalid-option exit status without report IDs", async () => {
  await withTempRoot("cli-stage-invalid", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
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
    await writeCollection(root, [{ id: "report.md" }]);
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
    await writeCollection(root, [{ id: "report.md" }]);
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
    await writeCollection(root, [{ id: "report.md" }]);
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
    await writeCollection(root, [{ id: "report.md" }]);
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
    await writeCollection(root, [{ id: "report.md" }]);
    const result = await runInvestigationCli(root, ["show"]);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /show requires exactly one Investigation ID/u);
  });
});

test("CLI trace accepts report-level direction options", async () => {
  await withTempRoot("cli-trace", async (root) => {
    await writeCollection(root, [
      { id: "first.md" },
      {
        id: "second.md",
        relations: [{ target: "first.md", type: "补充" }]
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
    assert.match(result.stdout, /Reports: first\.md, second\.md/u);
    assert.match(result.stdout, /second\.md --补充--> first\.md/u);
  });
});

test("generated Investigation Report CLI starts under Node with argv and stdout protocol", async () => {
  await withTempRoot("cli-node-smoke", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
    const result = runGeneratedInvestigationCliSmoke(root, ["check"]);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /1 of 1 reports checked; full index current/u);
  });
});

function git(root: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}
