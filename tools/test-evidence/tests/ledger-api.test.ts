import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import * as v from "valibot";
import {
  queryTestEntities,
  queryTestEvidenceCases,
  showTestEvidenceCase,
  syncTestEvidenceLedgerIndex,
  testEvidenceCaseQueryResultSchema,
  testEvidenceCaseShowResultSchema,
  testEvidenceLedgerIndexSyncResultSchema,
  testEvidenceLedgerReportSchema,
  testEvidenceTestQueryResultSchema,
  validateTestEvidenceLedger
} from "../src/ledger/index.ts";
import {
  caseMarkdown,
  casesPath,
  manyToManyCases,
  withLedgerWorkspace,
  writeWorkspaceFile
} from "./ledger-fixture.ts";

test("legal empty ledgers pass validation and queries without creating Case directories", async () => {
  await withLedgerWorkspace(async (workspaceRoot) => {
    const synchronized = await syncTestEvidenceLedgerIndex({
      mode: "write",
      workspaceRoot
    });
    assert.equal(synchronized.status, "ok");
    assert.equal(synchronized.state, "written");
    assert.deepEqual(
      (await validateTestEvidenceLedger({ workspaceRoot })).summary,
      { tests: 0, cases: 0, relations: 0, tags: 0 }
    );
    assert.deepEqual(
      (await validateTestEvidenceLedger({ workspaceRoot })).diagnostics,
      []
    );
    assert.equal((await queryTestEvidenceCases({ workspaceRoot })).total, 0);
    assert.equal((await queryTestEntities({ workspaceRoot })).total, 0);
    const missing = await showTestEvidenceCase({
      workspaceRoot,
      caseId: "LEDGER-MISSING-CASE-001"
    });
    assert.ok(
      missing.diagnostics.some(
        (diagnostic) => diagnostic.code === "query.case-missing"
      )
    );
    await assert.rejects(
      fs.stat(casesPath(workspaceRoot)),
      (error: unknown) =>
        error instanceof Error && "code" in error && error.code === "ENOENT"
    );
  }, "empty");
});

test("ledger validation API reports stable source identities summaries and index diagnostics", async () => {
  await withLedgerWorkspace(async (workspaceRoot) => {
    const missingIndex = await validateTestEvidenceLedger({ workspaceRoot });
    assert.equal(
      v.safeParse(testEvidenceLedgerReportSchema, missingIndex).success,
      true
    );
    assert.equal(missingIndex.schemaVersion, 5);
    assert.deepEqual(missingIndex.summary, {
      tests: 3,
      cases: 3,
      relations: 6,
      tags: 2
    });
    assert.equal(missingIndex.entityIndex?.schemaVersion, 1);
    assert.equal(
      missingIndex.sourceRevision?.metadata,
      missingIndex.entityIndex?.fingerprint
    );
    assert.ok(
      missingIndex.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "state-index.index-missing" && diagnostic.blocking
      )
    );

    await syncTestEvidenceLedgerIndex({ mode: "write", workspaceRoot });
    const current = await validateTestEvidenceLedger({ workspaceRoot });
    assert.deepEqual(current.diagnostics, []);
    assert.deepEqual(current.summary, missingIndex.summary);
    assert.deepEqual(current.sourceRevision, missingIndex.sourceRevision);
  });
});

test("ledger sync API distinguishes check write current and unchanged states", async () => {
  await withLedgerWorkspace(async (workspaceRoot) => {
    const missing = await syncTestEvidenceLedgerIndex({
      mode: "check",
      workspaceRoot
    });
    assert.equal(
      v.safeParse(testEvidenceLedgerIndexSyncResultSchema, missing).success,
      true
    );
    assert.equal(missing.status, "error");
    assert.equal(missing.state, "index-missing");
    assert.equal(missing.mode, "check");
    assert.equal(missing.changed, false);

    const written = await syncTestEvidenceLedgerIndex({
      mode: "write",
      workspaceRoot
    });
    assert.equal(written.status, "ok");
    assert.equal(written.state, "written");
    assert.equal(written.changed, true);

    const current = await syncTestEvidenceLedgerIndex({
      mode: "check",
      workspaceRoot
    });
    assert.equal(current.status, "ok");
    assert.equal(current.state, "current");
    assert.equal(current.changed, false);

    const unchanged = await syncTestEvidenceLedgerIndex({
      mode: "write",
      workspaceRoot
    });
    assert.equal(unchanged.status, "ok");
    assert.equal(unchanged.state, "unchanged");
    assert.equal(unchanged.changed, false);
  });
});

test("ledger Case query API intersects filters and applies stable pagination", async () => {
  await withLedgerWorkspace(async (workspaceRoot) => {
    await syncTestEvidenceLedgerIndex({ mode: "write", workspaceRoot });

    const defaults = await queryTestEvidenceCases({ workspaceRoot });
    assert.equal(defaults.limit, 20);
    const maximum = await queryTestEvidenceCases({
      workspaceRoot,
      limit: 1000
    });
    assert.equal(maximum.limit, 1000);

    const page = await queryTestEvidenceCases({
      workspaceRoot,
      limit: 1,
      offset: 1
    });
    assert.equal(
      v.safeParse(testEvidenceCaseQueryResultSchema, page).success,
      true
    );
    assert.equal(page.total, 3);
    assert.deepEqual(
      page.cases.map((entry) => entry.id),
      ["LEDGER-ALPHA-GAMMA-001"]
    );

    const intersected = await queryTestEvidenceCases({
      workspaceRoot,
      query: "alpha shared",
      tag: "shared",
      testId: "test.beta"
    });
    assert.equal(intersected.total, 1);
    assert.deepEqual(
      intersected.cases.map((entry) => entry.id),
      ["LEDGER-ALPHA-BETA-001"]
    );

    const unusedTag = await queryTestEvidenceCases({
      workspaceRoot,
      tag: "unused"
    });
    assert.equal(unusedTag.total, 0);
    assert.deepEqual(unusedTag.diagnostics, []);

    const unknownTest = await queryTestEvidenceCases({
      workspaceRoot,
      testId: "test.unknown"
    });
    assert.equal(unknownTest.total, 0);
    assert.ok(
      unknownTest.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "query.test-unknown" &&
          diagnostic.testId === "test.unknown"
      )
    );
  });
});

test("ledger Case show API rereads authoritative Markdown and resolves current Tests", async () => {
  await withLedgerWorkspace(async (workspaceRoot) => {
    await syncTestEvidenceLedgerIndex({ mode: "write", workspaceRoot });
    const changedCase = {
      ...manyToManyCases[0]!,
      title: "Alpha and beta establish the current result",
      proves: ["The authoritative current result is observable."]
    };
    await writeWorkspaceFile(
      workspaceRoot,
      "docs/test-evidence/cases/alpha-beta.md",
      caseMarkdown(changedCase)
    );

    const shown = await showTestEvidenceCase({
      workspaceRoot,
      caseId: changedCase.id
    });
    assert.equal(
      v.safeParse(testEvidenceCaseShowResultSchema, shown).success,
      true
    );
    assert.equal(shown.case?.title, changedCase.title);
    assert.match(shown.markdown ?? "", /authoritative current result/u);
    assert.deepEqual(
      shown.tests.map((entry) => entry.id),
      ["test.alpha", "test.beta"]
    );
    assert.ok(
      shown.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "state-index.index-stale" &&
          diagnostic.severity === "warning"
      )
    );

    const missing = await showTestEvidenceCase({
      workspaceRoot,
      caseId: "LEDGER-MISSING-CASE-001"
    });
    assert.equal(missing.case, null);
    assert.equal(missing.markdown, null);
    assert.deepEqual(missing.tests, []);
    assert.ok(
      missing.diagnostics.some(
        (diagnostic) => diagnostic.code === "query.case-missing"
      )
    );
  });
});

test("ledger Test query API derives reverse Case memberships and searches entity authority", async () => {
  await withLedgerWorkspace(async (workspaceRoot) => {
    await syncTestEvidenceLedgerIndex({ mode: "write", workspaceRoot });
    const queried = await queryTestEntities({
      workspaceRoot,
      query: "gamma behavior"
    });
    assert.equal(
      v.safeParse(testEvidenceTestQueryResultSchema, queried).success,
      true
    );
    assert.equal(queried.total, 1);
    assert.deepEqual(queried.tests[0], {
      id: "test.gamma",
      name: "Gamma behavior",
      locators: ["tests/gamma.test.ts > gamma behavior"],
      caseIds: ["LEDGER-ALPHA-GAMMA-001", "LEDGER-BETA-GAMMA-001"]
    });
    assert.equal((await queryTestEntities({ workspaceRoot })).limit, 20);
    assert.equal(
      (
        await queryTestEntities({
          workspaceRoot,
          limit: 1000
        })
      ).limit,
      1000
    );
    assert.equal(
      (
        await queryTestEntities({
          workspaceRoot,
          query: "test.gamma"
        })
      ).tests[0]?.id,
      "test.gamma"
    );
    assert.equal(
      (
        await queryTestEntities({
          workspaceRoot,
          query: "tests/gamma.test.ts"
        })
      ).tests[0]?.id,
      "test.gamma"
    );

    const page = await queryTestEntities({
      workspaceRoot,
      limit: 1,
      offset: 1
    });
    assert.equal(page.total, 3);
    assert.deepEqual(
      page.tests.map((entry) => entry.id),
      ["test.beta"]
    );
  });
});

test("ledger APIs return schema-valid machine failures for invalid options", async () => {
  const results = await Promise.all([
    validateTestEvidenceLedger({ workspaceRoot: "" }),
    syncTestEvidenceLedgerIndex({
      mode: "invalid",
      workspaceRoot: "/tmp/example"
    } as never),
    queryTestEvidenceCases({
      workspaceRoot: "/tmp/example",
      limit: 0
    } as never),
    showTestEvidenceCase({
      workspaceRoot: "/tmp/example",
      caseId: "bad"
    } as never),
    queryTestEntities({
      workspaceRoot: "/tmp/example",
      query: "   "
    })
  ]);
  const schemas = [
    testEvidenceLedgerReportSchema,
    testEvidenceLedgerIndexSyncResultSchema,
    testEvidenceCaseQueryResultSchema,
    testEvidenceCaseShowResultSchema,
    testEvidenceTestQueryResultSchema
  ] as const;
  const invalidFields = [
    "workspaceRoot",
    "mode",
    "limit",
    "caseId",
    "query"
  ] as const;
  results.forEach((result, index) => {
    const diagnostic = result.diagnostics.find(
      (entry) => entry.code === "query.options-invalid"
    );
    assert.equal(diagnostic?.blocking, true);
    assert.match(
      diagnostic?.message ?? "",
      new RegExp(`${invalidFields[index]}:`, "u")
    );
    assert.equal(v.safeParse(schemas[index]!, result).success, true);
  });
});
