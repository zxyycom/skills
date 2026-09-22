import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
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

test("CLI stage uses invalid-option exit status without report IDs", async () => {
  await withTempRoot("cli-stage-invalid", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    const indexPath = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    const before = await fs.readFile(indexPath, "utf8");
    const result = await runInvestigationCli(root, ["stage"]);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(
      result.stderr,
      /stage requires at least one Investigation ID/u
    );
    assert.equal(await fs.readFile(indexPath, "utf8"), before);
  });
});

test("CLI stage preserves version-control diagnostic facts", async () => {
  await withTempRoot("cli-stage-version-control", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    const result = await runInvestigationCli(root, [
      "stage",
      "--scope",
      "index",
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

test("CLI stage renders filesystem diagnostics structurally", async () => {
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
      result = await runInvestigationCli(root, [
        "stage",
        "--scope",
        "index",
        "report.md"
      ]);
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

test("CLI stage --scope index preserves pending transaction facts", async () => {
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
        "stage",
        "--scope",
        "index",
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

test("CLI stage rejects JSON output", async () => {
  await withTempRoot("cli-stage-json", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    const indexPath = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    const before = await fs.readFile(indexPath, "utf8");
    const result = await runInvestigationCli(root, [
      "stage",
      "report.md",
      "--json"
    ]);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /unknown option '--json'/u);
    assert.equal(await fs.readFile(indexPath, "utf8"), before);
  });
});

test("CLI stage exposes the scope contract and rejects an invalid scope", async () => {
  await withTempRoot("cli-stage-scope", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    const help = await runInvestigationCli(root, ["stage", "--help"]);
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /--scope <scope>/u);
    assert.match(help.stdout, /all, index, or domain pending snapshot scope/u);

    const invalid = await runInvestigationCli(root, [
      "stage",
      "--scope",
      "everything",
      "report"
    ]);
    assert.equal(invalid.status, 2);
    assert.equal(invalid.stdout, "");
    assert.match(
      invalid.stderr,
      /stage --scope must be all, index, or domain/u
    );

    const repeated = await runInvestigationCli(root, [
      "stage",
      "--scope",
      "index",
      "--scope",
      "domain",
      "report"
    ]);
    assert.equal(repeated.status, 2);
    assert.match(repeated.stderr, /--scope only once/u);
  });
});

test("CLI treats the removed stage-index entry as an unknown command", async () => {
  await withTempRoot("cli-stage-index-removed", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    const result = await runInvestigationCli(root, ["stage-index", "report"]);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /unknown command/u);
  });
});

test("CLI stage --scope domain stages report Markdown and owner resources without the index", async () => {
  await withTempRoot("cli-stage-domain", async (root) => {
    const resourceDirectory = path.join(
      investigationRoot(root),
      "_resources",
      "report"
    );
    await fs.mkdir(resourceDirectory, { recursive: true });
    await fs.writeFile(
      path.join(resourceDirectory, "evidence.txt"),
      "evidence\n",
      "utf8"
    );
    await writeCollection(root, [
      { id: "report", resources: ["report/evidence.txt"] }
    ]);
    git(root, ["init", "--quiet"]);
    git(root, ["config", "user.email", "test@example.invalid"]);
    git(root, ["config", "user.name", "Test"]);
    git(root, ["add", "."]);
    git(root, ["commit", "--quiet", "-m", "initial"]);
    await writeCollection(root, [
      { id: "report", resources: ["report/evidence.txt"], title: "Changed" }
    ]);
    const result = await runInvestigationCli(root, [
      "stage",
      "--scope",
      "domain",
      "report"
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /scope: domain/u);
    assert.match(
      result.stdout,
      /written paths: docs\/investigations\/report\.md/u
    );
    assert.match(
      result.stdout,
      /caller-owned paths: docs\/investigations\/investigation-index\.json/u
    );
    assert.match(
      git(root, ["diff", "--cached", "--name-only"]),
      /docs\/investigations\/report\.md/u
    );
    assert.equal(
      git(root, [
        "diff",
        "--cached",
        "--",
        "docs/investigations/investigation-index.json"
      ]),
      ""
    );
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
    const terminal = await runInvestigationCli(root, [
      "trace",
      "--direction",
      "successors",
      "--depth",
      "1",
      "first.md"
    ]);
    assert.equal(terminal.status, 0, terminal.stderr);
    assert.match(
      terminal.stdout,
      /successors:\n    second --补充--> first \[无摘要\]/u
    );
    assert.match(
      terminal.stdout,
      /predecessors:\n    second --补充--> first \[无摘要\]/u
    );
    const result = await runInvestigationCli(root, [
      "trace",
      "--direction",
      "successors",
      "--depth",
      "1",
      "first.md",
      "--json"
    ]);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    const trace = JSON.parse(result.stdout);
    assert.deepEqual(trace.traceIds, ["first", "second"]);
    assert.deepEqual(trace.entries.second.relations, [
      { target: "first", type: "补充" }
    ]);

    const bounded = await runInvestigationCli(root, [
      "trace",
      "--direction",
      "successors",
      "--depth",
      "0",
      "first.md",
      "--json"
    ]);
    assert.equal(bounded.status, 0, bounded.stderr);
    const boundedTrace = JSON.parse(bounded.stdout) as {
      frontier: Array<Record<string, unknown>>;
      traceIds: string[];
    };
    assert.deepEqual(boundedTrace.traceIds, ["first"]);
    assert.deepEqual(Object.keys(boundedTrace.frontier[0] ?? {}), [
      "fromId",
      "direction",
      "reason",
      "nextIds"
    ]);
  });
});

test("CLI trace renders a stable terminal graph by default and preserves JSON behind --json", async () => {
  await withTempRoot("cli-trace-terminal", async (root) => {
    await writeCollection(root, [
      { id: "base", title: "共同前序" },
      {
        id: "alpha",
        relations: [
          { target: "base", type: "拆分", summary: '承接"查询"责任' }
        ],
        title: "查询方向"
      },
      {
        id: "beta",
        relations: [{ target: "base", type: "拆分" }],
        title: "存储方向"
      }
    ]);
    const terminal = await runInvestigationCli(root, [
      "trace",
      "alpha",
      "--direction",
      "predecessors"
    ]);
    assert.equal(terminal.status, 0, terminal.stderr);
    assert.equal(terminal.stderr, "");
    assert.match(
      terminal.stdout,
      /^TRACE anchor=\[alpha\] direction=predecessors depth=5 complete=true records=3/mu
    );
    assert.match(terminal.stdout, /L0\* \[alpha\].*查询方向/u);
    assert.match(terminal.stdout, /L1\* \[base\].*共同前序/u);
    assert.match(terminal.stdout, /split-successors:/u);
    assert.match(terminal.stdout, /\* trace   \[alpha\].*查询方向/u);
    assert.match(terminal.stdout, /~ context \[beta\].*存储方向/u);
    assert.match(terminal.stdout, /alpha --拆分--> base "承接\\"查询\\"责任"/u);
    assert.match(terminal.stdout, /beta --拆分--> base \[无摘要\]/u);
    assert.match(
      terminal.stdout,
      /only relations within this trace slice are expanded/u
    );

    const blocked = await runInvestigationCli(root, [
      "trace",
      "alpha",
      "--direction",
      "predecessors",
      "--max-records",
      "2"
    ]);
    assert.equal(blocked.status, 0, blocked.stderr);
    assert.match(
      blocked.stdout,
      /BOUNDARY: coverage=incomplete stoppedBy=max-records/u
    );
    assert.match(blocked.stdout, /reason=max-records/u);
    assert.match(
      blocked.stdout,
      /blocked-event kind=split records=\[alpha, base, beta\] required-max-records=3/u
    );

    const json = await runInvestigationCli(root, [
      "trace",
      "alpha",
      "--direction",
      "predecessors",
      "--json"
    ]);
    assert.equal(json.status, 0, json.stderr);
    const parsed = JSON.parse(json.stdout);
    assert.deepEqual(parsed.contextIds, ["beta"]);
    assert.deepEqual(parsed.entries.alpha.relations, [
      { target: "base", type: "拆分", summary: '承接"查询"责任' }
    ]);
    assert.deepEqual(parsed.entries.beta.relations, [
      { target: "base", type: "拆分" }
    ]);
  });
});

test("CLI trace renders numeric depth layers before lexically earlier trace IDs", async () => {
  await withTempRoot("cli-trace-layer-order", async (root) => {
    await writeCollection(root, [
      { id: "alpha", title: "前序" },
      {
        id: "zeta",
        relations: [{ target: "alpha", type: "补充" }],
        title: "锚点"
      }
    ]);
    const result = await runInvestigationCli(root, [
      "trace",
      "zeta",
      "--direction",
      "predecessors"
    ]);
    assert.equal(result.status, 0, result.stderr);
    const anchor = result.stdout.indexOf("L0* [zeta]");
    const predecessor = result.stdout.indexOf("L1* [alpha]");
    assert.ok(anchor >= 0, result.stdout);
    assert.ok(predecessor > anchor, result.stdout);
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
      /Usage: investigation-report publish \[options\] \[investigation-id\.\.\.\]/u
    );
    assert.match(publishHelp.stdout, /--preflight/u);

    const declaration = await fs.readFile(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../../skills/investigation-report/scripts/check-investigations.d.mts"
      ),
      "utf8"
    );
    assert.match(declaration, /export type InvestigationReportTraceSuccess/u);
    assert.match(declaration, /maxDepth\?: number \| null/u);
    assert.match(declaration, /maxRecords\?: number/u);
  });
});

function git(root: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}
