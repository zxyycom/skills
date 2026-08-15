import assert from "node:assert/strict";
import test from "node:test";
import * as v from "valibot";
import {
  syncTestEvidenceLedgerIndex,
  testEvidenceCaseQueryResultSchema,
  testEvidenceCaseShowResultSchema,
  testEvidenceLedgerIndexSyncResultSchema,
  testEvidenceLedgerReportSchema,
  testEvidenceTestQueryResultSchema
} from "../src/ledger/index.ts";
import { runLedgerCli, withLedgerWorkspace } from "./ledger-fixture.ts";

test("ledger CLI check emits machine reports and maps validation status to exits", async () => {
  await withLedgerWorkspace(async (workspaceRoot) => {
    const missing = await runLedgerCli([
      "--root",
      workspaceRoot,
      "--json",
      "check"
    ]);
    assert.equal(missing.code, 1);
    assert.equal(missing.stderr, "");
    const missingReport = v.parse(
      testEvidenceLedgerReportSchema,
      JSON.parse(missing.stdout)
    );
    assert.equal(missingReport.schemaVersion, 5);
    assert.ok(
      missingReport.diagnostics.some(
        (diagnostic) => diagnostic.code === "state-index.index-missing"
      )
    );

    await syncTestEvidenceLedgerIndex({ mode: "write", workspaceRoot });
    const current = await runLedgerCli([
      "--root",
      workspaceRoot,
      "--json",
      "check"
    ]);
    assert.equal(current.code, 0);
    assert.equal(current.stderr, "");
    const currentReport = v.parse(
      testEvidenceLedgerReportSchema,
      JSON.parse(current.stdout)
    );
    assert.deepEqual(currentReport.diagnostics, []);
    assert.deepEqual(currentReport.summary, {
      tests: 3,
      cases: 3,
      relations: 6,
      tags: 2
    });
  });
});

test("ledger CLI sync-index separates check from explicit atomic writes", async () => {
  await withLedgerWorkspace(async (workspaceRoot) => {
    const checked = await runLedgerCli([
      "--root",
      workspaceRoot,
      "--json",
      "sync-index"
    ]);
    assert.equal(checked.code, 1);
    const checkedResult = v.parse(
      testEvidenceLedgerIndexSyncResultSchema,
      JSON.parse(checked.stdout)
    );
    assert.equal(checkedResult.mode, "check");
    assert.equal(checkedResult.state, "index-missing");

    const written = await runLedgerCli([
      "--root",
      workspaceRoot,
      "--json",
      "sync-index",
      "--write"
    ]);
    assert.equal(written.code, 0);
    const writtenResult = v.parse(
      testEvidenceLedgerIndexSyncResultSchema,
      JSON.parse(written.stdout)
    );
    assert.equal(writtenResult.mode, "write");
    assert.equal(writtenResult.state, "written");
    assert.equal(writtenResult.changed, true);

    const current = await runLedgerCli(["--root", workspaceRoot, "sync-index"]);
    assert.equal(current.code, 0);
    assert.match(current.stdout, /index is current/u);
  });
});

test("ledger CLI list composes filters pagination JSON and unknown-Test exits", async () => {
  await withLedgerWorkspace(async (workspaceRoot) => {
    await syncTestEvidenceLedgerIndex({ mode: "write", workspaceRoot });
    const listed = await runLedgerCli([
      "--root",
      workspaceRoot,
      "--json",
      "list",
      "--test",
      "test.beta",
      "--tag",
      "shared",
      "--query",
      "alpha shared",
      "--limit",
      "1",
      "--offset",
      "0"
    ]);
    assert.equal(listed.code, 0);
    assert.equal(listed.stderr, "");
    const result = v.parse(
      testEvidenceCaseQueryResultSchema,
      JSON.parse(listed.stdout)
    );
    assert.equal(result.total, 1);
    assert.deepEqual(
      result.cases.map((entry) => entry.id),
      ["LEDGER-ALPHA-BETA-001"]
    );

    const unknown = await runLedgerCli([
      "--root",
      workspaceRoot,
      "--json",
      "list",
      "--test",
      "test.unknown"
    ]);
    assert.equal(unknown.code, 2);
    assert.equal(unknown.stderr, "");
    const unknownResult = v.parse(
      testEvidenceCaseQueryResultSchema,
      JSON.parse(unknown.stdout)
    );
    assert.ok(
      unknownResult.diagnostics.some(
        (diagnostic) => diagnostic.code === "query.test-unknown"
      )
    );

    const defaults = await runLedgerCli([
      "list",
      "--root",
      workspaceRoot,
      "--json"
    ]);
    assert.equal(defaults.code, 0);
    assert.equal(
      v.parse(testEvidenceCaseQueryResultSchema, JSON.parse(defaults.stdout))
        .limit,
      20
    );

    const maximum = await runLedgerCli([
      "list",
      "--root",
      workspaceRoot,
      "--json",
      "--limit",
      "1000"
    ]);
    assert.equal(maximum.code, 0);
    assert.equal(
      v.parse(testEvidenceCaseQueryResultSchema, JSON.parse(maximum.stdout))
        .limit,
      1000
    );
  });
});

test("ledger CLI show accepts one positional Case ID and returns authority or absence", async () => {
  await withLedgerWorkspace(async (workspaceRoot) => {
    await syncTestEvidenceLedgerIndex({ mode: "write", workspaceRoot });
    const shown = await runLedgerCli([
      "--root",
      workspaceRoot,
      "--json",
      "show",
      "LEDGER-ALPHA-BETA-001"
    ]);
    assert.equal(shown.code, 0);
    const result = v.parse(
      testEvidenceCaseShowResultSchema,
      JSON.parse(shown.stdout)
    );
    assert.equal(result.case?.id, "LEDGER-ALPHA-BETA-001");
    assert.deepEqual(
      result.tests.map((entry) => entry.id),
      ["test.alpha", "test.beta"]
    );
    assert.match(result.markdown ?? "", /^### Case LEDGER-ALPHA-BETA-001:/u);

    const missing = await runLedgerCli([
      "--root",
      workspaceRoot,
      "--json",
      "show",
      "LEDGER-MISSING-CASE-001"
    ]);
    assert.equal(missing.code, 1);
    const missingResult = v.parse(
      testEvidenceCaseShowResultSchema,
      JSON.parse(missing.stdout)
    );
    assert.equal(missingResult.case, null);
    assert.ok(
      missingResult.diagnostics.some(
        (diagnostic) => diagnostic.code === "query.case-missing"
      )
    );
  });
});

test("ledger CLI tests searches authority and exposes derived reverse memberships", async () => {
  await withLedgerWorkspace(async (workspaceRoot) => {
    await syncTestEvidenceLedgerIndex({ mode: "write", workspaceRoot });
    const queried = await runLedgerCli([
      "--root",
      workspaceRoot,
      "--json",
      "tests",
      "--query",
      "gamma behavior",
      "--limit",
      "1"
    ]);
    assert.equal(queried.code, 0);
    const result = v.parse(
      testEvidenceTestQueryResultSchema,
      JSON.parse(queried.stdout)
    );
    assert.equal(result.total, 1);
    assert.equal(result.tests[0]?.id, "test.gamma");
    assert.deepEqual(result.tests[0]?.caseIds, [
      "LEDGER-ALPHA-GAMMA-001",
      "LEDGER-BETA-GAMMA-001"
    ]);
  });
});

test("ledger CLI rejects missing repeated malformed and excess arguments with usage exits", async () => {
  await withLedgerWorkspace(async (workspaceRoot) => {
    const invalidCommands = [
      ["check"],
      ["--root", workspaceRoot, "--root", workspaceRoot, "check"],
      ["--root", workspaceRoot, "--json", "--json", "check"],
      ["--root", workspaceRoot, "sync-index", "--write", "--write"],
      ["--root", workspaceRoot, "list", "--limit", "0"],
      ["--root", workspaceRoot, "list", "--limit", "1001"],
      ["--root", workspaceRoot, "list", "--limit", "1", "--limit", "2"],
      ["--root", workspaceRoot, "list", "--offset", "-1"],
      ["--root", workspaceRoot, "list", "--offset", "0", "--offset", "1"],
      ["--root", workspaceRoot, "list", "--tag", "Bad Tag"],
      ["--root", workspaceRoot, "list", "--tag", "shared", "--tag", "mutation"],
      [
        "--root",
        workspaceRoot,
        "list",
        "--test",
        "test.alpha",
        "--test",
        "test.beta"
      ],
      ["--root", workspaceRoot, "list", "--query", "   "],
      ["--root", workspaceRoot, "list", "--query", "alpha", "--query", "beta"],
      ["--root", workspaceRoot, "show", "bad"],
      ["--root", workspaceRoot, "show", "LEDGER-ALPHA-BETA-001", "extra"],
      ["--root", workspaceRoot, "unknown"]
    ];
    for (const args of invalidCommands) {
      const result = await runLedgerCli(args);
      assert.equal(result.code, 2, args.join(" "));
      assert.equal(result.stdout, "", args.join(" "));
      assert.notEqual(result.stderr, "", args.join(" "));
    }
  });
});
