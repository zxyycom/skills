import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import * as v from "valibot";
import {
  queryTestEvidenceCases,
  testEvidenceLedgerStateIndexSchema,
  validateTestEvidenceLedger
} from "../src/ledger/index.ts";
import { sameTargetRevision } from "../src/ledger/query.ts";
import {
  readTestEvidenceLedgerRevision,
  readTestEvidenceLedgerSource
} from "../src/ledger/ledger-source.ts";
import {
  syncLoadedTestEvidenceLedgerIndex,
  syncTestEvidenceLedgerIndex
} from "../src/ledger/state-index.ts";
import {
  caseMarkdown,
  casesPath,
  entityIndexPath,
  entityIndexText,
  ledgerIndexPath,
  manyToManyCases,
  manyToManyEntities,
  readJsonFile,
  withLedgerWorkspace,
  writeWorkspaceFile
} from "./ledger-fixture.ts";

test("ledger indexes project definition metadata summaries revisions and query keys", async () => {
  await withLedgerWorkspace(async (workspaceRoot) => {
    const synchronized = await syncTestEvidenceLedgerIndex({
      mode: "write",
      workspaceRoot
    });
    assert.equal(synchronized.status, "ok");
    const index = v.parse(
      testEvidenceLedgerStateIndexSchema,
      await readJsonFile(ledgerIndexPath(workspaceRoot))
    );
    assert.equal(index.schemaVersion, 3);
    assert.equal(index.definitionVersion, 4);
    assert.equal(index.namespace, "test-evidence");
    assert.equal(
      index.metadata.entityIndex.fingerprint,
      index.sourceRevision.metadata
    );
    const entry = index.entries["LEDGER-ALPHA-BETA-001"];
    assert.notEqual(entry, undefined);
    assert.equal(
      entry?.state.summary,
      "The shared alpha-beta result is observable."
    );
    assert.deepEqual(entry?.keys.test, ["test.alpha", "test.beta"]);
    assert.deepEqual(entry?.keys.tag, ["shared"]);
    assert.deepEqual(entry?.keys.search, [
      "LEDGER-ALPHA-BETA-001 Alpha and beta establish a shared result Alpha and beta jointly support one semantic conclusion. The shared alpha-beta result is observable. test.alpha test.beta shared"
    ]);
    assert.equal("id" in (entry?.state ?? {}), false);
    assert.equal("caseIds" in index.metadata, false);
  });
});

test("ledger revisions normalize formatting and line endings while tracking semantic changes", async () => {
  await withLedgerWorkspace(async (workspaceRoot) => {
    const initial = await readTestEvidenceLedgerRevision(workspaceRoot);
    assert.notEqual(initial.source, null);
    const initialRevision = initial.source!.sourceRevision;

    await fs.writeFile(entityIndexPath(workspaceRoot), JSON.stringify({
      entities: manyToManyEntities.map((entity) => ({
        locators: entity.locators,
        id: entity.id,
        name: entity.name
      })),
      sourceRevision: "many-to-many-v1",
      schemaVersion: 1
    }), "utf8");
    const reformatted = await readTestEvidenceLedgerRevision(workspaceRoot);
    assert.deepEqual(reformatted.source?.sourceRevision, initialRevision);

    const alphaBetaPath = path.join(casesPath(workspaceRoot), "alpha-beta.md");
    const alphaBetaText = await fs.readFile(alphaBetaPath, "utf8");
    await fs.writeFile(
      alphaBetaPath,
      alphaBetaText.replace(/\n/g, "\r\n"),
      "utf8"
    );
    const crlf = await readTestEvidenceLedgerRevision(workspaceRoot);
    assert.deepEqual(crlf.source?.sourceRevision, initialRevision);

    const movedPath = path.join(casesPath(workspaceRoot), "alpha-beta-moved.md");
    await fs.rename(alphaBetaPath, movedPath);
    const moved = await readTestEvidenceLedgerRevision(workspaceRoot);
    assert.equal(moved.source?.sourceRevision.metadata, initialRevision.metadata);
    assert.notEqual(
      moved.source?.sourceRevision.entries["LEDGER-ALPHA-BETA-001"],
      initialRevision.entries["LEDGER-ALPHA-BETA-001"]
    );
    assert.equal(
      moved.source?.sourceRevision.entries["LEDGER-ALPHA-GAMMA-001"],
      initialRevision.entries["LEDGER-ALPHA-GAMMA-001"]
    );
  });
});

test("ledger sync writes deterministic populated and empty indexes without creating case directories", async () => {
  await withLedgerWorkspace(async (workspaceRoot) => {
    const first = await syncTestEvidenceLedgerIndex({
      mode: "write",
      workspaceRoot
    });
    assert.equal(first.state, "written");
    const firstText = await fs.readFile(ledgerIndexPath(workspaceRoot), "utf8");
    const second = await syncTestEvidenceLedgerIndex({
      mode: "write",
      workspaceRoot
    });
    assert.equal(second.state, "unchanged");
    assert.equal(
      await fs.readFile(ledgerIndexPath(workspaceRoot), "utf8"),
      firstText
    );
  });

  await withLedgerWorkspace(async (workspaceRoot) => {
    assert.equal(await exists(casesPath(workspaceRoot)), false);
    const synchronized = await syncTestEvidenceLedgerIndex({
      mode: "write",
      workspaceRoot
    });
    assert.equal(synchronized.status, "ok");
    const index = v.parse(
      testEvidenceLedgerStateIndexSchema,
      await readJsonFile(ledgerIndexPath(workspaceRoot))
    );
    assert.deepEqual(index.entries, {});
    assert.equal(await exists(casesPath(workspaceRoot)), false);
  }, "empty");
});

test("ledger queries fall back from recoverable index failures with warnings", async () => {
  await withLedgerWorkspace(async (workspaceRoot) => {
    let queried = await queryTestEvidenceCases({ workspaceRoot });
    assert.equal(queried.total, 3);
    assert.ok(queried.diagnostics.some(
      (diagnostic) => diagnostic.code === "state-index.index-missing"
        && diagnostic.severity === "warning"
        && !diagnostic.blocking
    ));

    await fs.writeFile(ledgerIndexPath(workspaceRoot), "{bad json", "utf8");
    queried = await queryTestEvidenceCases({ workspaceRoot });
    assert.equal(queried.total, 3);
    assert.ok(queried.diagnostics.some(
      (diagnostic) => diagnostic.code === "state-index.json-invalid"
        && diagnostic.severity === "warning"
    ));

    await fs.writeFile(
      ledgerIndexPath(workspaceRoot),
      Buffer.from([0xc3, 0x28])
    );
    queried = await queryTestEvidenceCases({ workspaceRoot });
    assert.equal(queried.total, 3);
    assert.ok(queried.diagnostics.some(
      (diagnostic) => diagnostic.code === "state-index.index-encoding-invalid"
        && diagnostic.severity === "warning"
    ));
    const invalidEncodingCheck = await validateTestEvidenceLedger({
      workspaceRoot
    });
    assert.ok(invalidEncodingCheck.diagnostics.some(
      (diagnostic) => diagnostic.code === "state-index.index-encoding-invalid"
        && diagnostic.blocking
    ));
    const repairedEncoding = await syncTestEvidenceLedgerIndex({
      mode: "write",
      workspaceRoot
    });
    assert.equal(repairedEncoding.status, "ok");
    assert.equal(repairedEncoding.state, "written");

    const invalidIdIndex = await readJsonFile(
      ledgerIndexPath(workspaceRoot)
    ) as {
      entries: Record<string, unknown>;
      sourceRevision: { entries: Record<string, unknown> };
    };
    invalidIdIndex.entries.bad = invalidIdIndex.entries[
      "LEDGER-ALPHA-BETA-001"
    ];
    delete invalidIdIndex.entries["LEDGER-ALPHA-BETA-001"];
    invalidIdIndex.sourceRevision.entries.bad =
      invalidIdIndex.sourceRevision.entries["LEDGER-ALPHA-BETA-001"];
    delete invalidIdIndex.sourceRevision.entries[
      "LEDGER-ALPHA-BETA-001"
    ];
    await fs.writeFile(
      ledgerIndexPath(workspaceRoot),
      `${JSON.stringify(invalidIdIndex, null, 2)}\n`,
      "utf8"
    );
    queried = await queryTestEvidenceCases({ workspaceRoot });
    assert.equal(queried.total, 3);
    assert.ok(queried.diagnostics.some(
      (diagnostic) => diagnostic.code === "state-index.definition-mismatch"
        && diagnostic.severity === "warning"
        && diagnostic.caseId === undefined
    ));

    await syncTestEvidenceLedgerIndex({ mode: "write", workspaceRoot });
    const oldDefinition = await readJsonFile(
      ledgerIndexPath(workspaceRoot)
    ) as Record<string, unknown>;
    oldDefinition.definitionVersion = 3;
    await fs.writeFile(
      ledgerIndexPath(workspaceRoot),
      `${JSON.stringify(oldDefinition, null, 2)}\n`,
      "utf8"
    );
    queried = await queryTestEvidenceCases({ workspaceRoot });
    assert.equal(queried.total, 3);
    assert.ok(queried.diagnostics.some(
      (diagnostic) => diagnostic.code === "state-index.definition-version-mismatch"
        && diagnostic.severity === "warning"
    ));

    await syncTestEvidenceLedgerIndex({ mode: "write", workspaceRoot });
    const changed = {
      ...manyToManyCases[0]!,
      proves: ["The changed alpha-beta result is observable."]
    };
    await writeWorkspaceFile(
      workspaceRoot,
      "docs/test-evidence/cases/alpha-beta.md",
      caseMarkdown(changed)
    );
    queried = await queryTestEvidenceCases({
      workspaceRoot,
      query: "changed alpha-beta"
    });
    assert.equal(queried.total, 1);
    assert.equal(
      queried.cases[0]?.summary,
      "The changed alpha-beta result is observable."
    );
    assert.ok(queried.diagnostics.some(
      (diagnostic) => diagnostic.code === "state-index.index-stale"
        && diagnostic.severity === "warning"
    ));
  });
});

test("ledger checks block stale indexes and write sync rebuilds them", async () => {
  await withLedgerWorkspace(async (workspaceRoot) => {
    await syncTestEvidenceLedgerIndex({ mode: "write", workspaceRoot });
    const changed = {
      ...manyToManyCases[0]!,
      proves: ["The newly current shared result is observable."]
    };
    await writeWorkspaceFile(
      workspaceRoot,
      "docs/test-evidence/cases/alpha-beta.md",
      caseMarkdown(changed)
    );
    const stale = await validateTestEvidenceLedger({ workspaceRoot });
    assert.ok(stale.diagnostics.some(
      (diagnostic) => diagnostic.code === "state-index.index-stale"
        && diagnostic.blocking
    ));
    const rebuilt = await syncTestEvidenceLedgerIndex({
      mode: "write",
      workspaceRoot
    });
    assert.equal(rebuilt.status, "ok");
    assert.equal(rebuilt.state, "written");
    assert.deepEqual(
      (await validateTestEvidenceLedger({ workspaceRoot })).diagnostics,
      []
    );
  });
});

test("ledger operations reject entity and case drift before returning or writing projections", async () => {
  await withLedgerWorkspace(async (workspaceRoot) => {
    const loaded = await readTestEvidenceLedgerSource(workspaceRoot);
    assert.notEqual(loaded.source, null);
    const sourceRevision = loaded.source!.snapshot.sourceRevision;
    assert.equal(sameTargetRevision({
      caseId: "LEDGER-ALPHA-BETA-001",
      current: sourceRevision,
      observedFingerprint: `sha256:${"0".repeat(64)}`,
      opened: sourceRevision
    }), false);
    const entityDriftedRevision = {
      entries: { ...loaded.source!.snapshot.sourceRevision.entries },
      metadata: `sha256:${"0".repeat(64)}`
    };
    const entityDrifted = await syncLoadedTestEvidenceLedgerIndex({
      mode: "write",
      readRevision: async () => entityDriftedRevision,
      source: loaded.source!,
      workspaceRoot
    });
    assert.equal(entityDrifted.status, "error");
    assert.equal(entityDrifted.changed, false);
    assert.ok(entityDrifted.diagnostics.some(
      (diagnostic) => diagnostic.code === "state-index.source-changed"
    ));
    assert.equal(await exists(ledgerIndexPath(workspaceRoot)), false);

    const driftedRevision = {
      entries: {
        ...loaded.source!.snapshot.sourceRevision.entries,
        "LEDGER-ALPHA-BETA-001": `sha256:${"0".repeat(64)}`
      },
      metadata: loaded.source!.snapshot.sourceRevision.metadata
    };
    const synchronized = await syncLoadedTestEvidenceLedgerIndex({
      mode: "write",
      readRevision: async () => driftedRevision,
      source: loaded.source!,
      workspaceRoot
    });
    assert.equal(synchronized.status, "error");
    assert.equal(synchronized.changed, false);
    assert.ok(synchronized.diagnostics.some(
      (diagnostic) => diagnostic.code === "state-index.source-changed"
    ));
    assert.equal(await exists(ledgerIndexPath(workspaceRoot)), false);
  });
});

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
