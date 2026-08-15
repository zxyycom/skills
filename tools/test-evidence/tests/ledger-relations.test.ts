import assert from "node:assert/strict";
import test from "node:test";
import { readTestEvidenceLedgerSource } from "../src/ledger/ledger-source.ts";
import type {
  TestEntity,
  TestEvidenceLedgerCase
} from "../src/ledger/index.ts";
import {
  caseMarkdown,
  manyToManyCases,
  manyToManyEntities,
  withLedgerWorkspace,
  writeLedgerFixture,
  writeWorkspaceFile
} from "./ledger-fixture.ts";

test("ledger relation graphs close empty one-to-many many-to-one and many-to-many fixtures", async () => {
  await withLedgerWorkspace(async (workspaceRoot) => {
    const loaded = await readTestEvidenceLedgerSource(workspaceRoot);
    assert.notEqual(loaded.source, null);
    assert.equal(loaded.summary.relations, 0);
  }, "empty");

  const twoEntities = manyToManyEntities.slice(0, 2);
  const oneCase = [manyToManyCases[0]!];
  await assertClosedFixture(twoEntities, oneCase, 2);

  const oneEntity = [manyToManyEntities[0]!];
  const twoCases: TestEvidenceLedgerCase[] = [
    {
      ...manyToManyCases[0]!,
      id: "LEDGER-ALPHA-FIRST-001",
      sourcePath: "cases/alpha-first.md",
      testIds: ["test.alpha"],
      tags: []
    },
    {
      ...manyToManyCases[1]!,
      id: "LEDGER-ALPHA-SECOND-001",
      sourcePath: "cases/alpha-second.md",
      testIds: ["test.alpha"],
      tags: []
    }
  ];
  await assertClosedFixture(oneEntity, twoCases, 2);

  await withLedgerWorkspace(async (workspaceRoot) => {
    const loaded = await readTestEvidenceLedgerSource(workspaceRoot);
    assert.notEqual(loaded.source, null);
    assert.equal(loaded.summary.relations, 6);
    assert.deepEqual(loaded.source?.relations.testToCaseIds.get("test.alpha"), [
      "LEDGER-ALPHA-BETA-001",
      "LEDGER-ALPHA-GAMMA-001"
    ]);
  });
});

test("ledger relation gates reject empty duplicate unknown and unreferenced endpoints", async () => {
  await withLedgerWorkspace(async (workspaceRoot) => {
    await writeLedgerFixture(workspaceRoot, {
      cases: [],
      entities: [manyToManyEntities[0]!],
      sourceRevision: "unreferenced-v1"
    });
    const loaded = await readTestEvidenceLedgerSource(workspaceRoot);
    assert.equal(loaded.source, null);
    assert.ok(
      loaded.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "relation.test-unreferenced" &&
          diagnostic.testId === "test.alpha"
      )
    );
  }, "empty");

  await withLedgerWorkspace(async (workspaceRoot) => {
    const unknownCase: TestEvidenceLedgerCase = {
      ...manyToManyCases[0]!,
      id: "LEDGER-UNKNOWN-TEST-001",
      sourcePath: "cases/unknown-test.md",
      testIds: ["test.unknown"]
    };
    await writeLedgerFixture(workspaceRoot, {
      cases: [unknownCase],
      entities: [],
      sourceRevision: "unknown-v1"
    });
    const loaded = await readTestEvidenceLedgerSource(workspaceRoot);
    assert.equal(loaded.source, null);
    assert.ok(
      loaded.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "relation.test-unknown" &&
          diagnostic.caseId === unknownCase.id &&
          diagnostic.testId === "test.unknown"
      )
    );
  }, "empty");

  await withLedgerWorkspace(async (workspaceRoot) => {
    const duplicate = caseMarkdown(manyToManyCases[0]!).replace(
      "- `test.alpha`\n- `test.beta`",
      "- `test.alpha`\n- `test.alpha`"
    );
    await writeWorkspaceFile(
      workspaceRoot,
      "docs/test-evidence/cases/duplicate.md",
      duplicate
    );
    const loaded = await readTestEvidenceLedgerSource(workspaceRoot);
    assert.equal(loaded.source, null);
    assert.ok(
      loaded.diagnostics.some(
        (diagnostic) => diagnostic.code === "relation.duplicate"
      )
    );
  }, "empty");

  await withLedgerWorkspace(async (workspaceRoot) => {
    const emptyTests = caseMarkdown(manyToManyCases[0]!).replace(
      "- `test.alpha`\n- `test.beta`\n",
      ""
    );
    await writeWorkspaceFile(
      workspaceRoot,
      "docs/test-evidence/cases/empty-tests.md",
      emptyTests
    );
    const loaded = await readTestEvidenceLedgerSource(workspaceRoot);
    assert.equal(loaded.source, null);
    assert.ok(
      loaded.diagnostics.some(
        (diagnostic) => diagnostic.code === "relation.tests-empty"
      )
    );
  }, "empty");
});

async function assertClosedFixture(
  entities: readonly TestEntity[],
  cases: readonly TestEvidenceLedgerCase[],
  relationCount: number
): Promise<void> {
  await withLedgerWorkspace(async (workspaceRoot) => {
    await writeLedgerFixture(workspaceRoot, {
      cases,
      entities,
      sourceRevision: `closed-${relationCount}`
    });
    const loaded = await readTestEvidenceLedgerSource(workspaceRoot);
    assert.deepEqual(loaded.diagnostics, []);
    assert.equal(loaded.summary.relations, relationCount);
  }, "empty");
}
