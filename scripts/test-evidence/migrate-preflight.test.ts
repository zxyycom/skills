import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { MigrationError, planTestEvidenceMigration } from "./migrate.ts";
import {
  expectedSource,
  fixtureSnapshot,
  legacyCase,
  withLegacyWorkspace
} from "./migrate-test-support.ts";

void test("migration preflight maps exact legacy locators and preserves Case semantics", async () => {
  await withLegacyWorkspace(async (workspaceRoot) => {
    const plan = await planTestEvidenceMigration({
      expectedSource,
      snapshot: fixtureSnapshot(),
      workspaceRoot
    });
    assert.equal(plan.legacyCaseCount, 1);
    assert.equal("sourceFiles" in plan, false);
    assert.deepEqual(plan.addedPaths, [
      "docs/test-evidence/cases/auth-role-access-001.md",
      "docs/test-evidence/test-evidence-index.json"
    ]);
    assert.deepEqual(plan.removedPaths, [
      "docs/test-evidence/access-control",
      "docs/test-evidence/access-control/auth-role-access.md",
      "docs/test-evidence/test-evidence-topics.json"
    ]);
    const convertedCase = plan.cases[0]?.text ?? "";
    assert.equal(
      convertedCase.split("\n")[0],
      "### Case AUTH-ROLE-ACCESS-001: Guest access is rejected"
    );
    assert.match(convertedCase, /Tests:\n- `test:alpha`\n- `test:beta`/u);
    assert.match(convertedCase, /Tags:\n- `access-control`/u);
    assert.match(
      convertedCase,
      /Contract:\n- Resource mutation follows the caller role boundary\./u
    );
    assert.match(
      convertedCase,
      /Proves:\n- A guest mutation returns the forbidden result\.\n- The resource remains unchanged\./u
    );
    assert.deepEqual(plan.index.entries["AUTH-ROLE-ACCESS-001"], {
      sourcePath: "cases/auth-role-access-001.md",
      tags: ["access-control"],
      testIds: ["test:alpha", "test:beta"],
      title: "Guest access is rejected"
    });
  });
});

void test("migration rejects zero and multiple snapshot matches instead of inventing entities", async () => {
  await withLegacyWorkspace(async (workspaceRoot) => {
    const noMatch = fixtureSnapshot();
    noMatch.entities = [];
    await assert.rejects(
      planTestEvidenceMigration({
        expectedSource,
        snapshot: noMatch,
        workspaceRoot
      }),
      (error: unknown) =>
        error instanceof MigrationError && /exactly one/u.test(error.message)
    );
    const manyMatches = fixtureSnapshot();
    manyMatches.entities.push({
      id: "test:duplicate",
      locators: ["tests/access.test.ts > rejects guest mutation"],
      name: "duplicate"
    });
    manyMatches.entities.sort((left, right) => left.id.localeCompare(right.id));
    await assert.rejects(
      planTestEvidenceMigration({
        expectedSource,
        snapshot: manyMatches,
        workspaceRoot
      }),
      (error: unknown) =>
        error instanceof MigrationError && /exactly one/u.test(error.message)
    );
  });
});

void test("migration reports every unmapped legacy Entry before refusing the conversion", async () => {
  await withLegacyWorkspace(async (workspaceRoot) => {
    const snapshot = fixtureSnapshot();
    snapshot.entities = [];
    await assert.rejects(
      planTestEvidenceMigration({ expectedSource, snapshot, workspaceRoot }),
      (error: unknown) => {
        assert.ok(error instanceof MigrationError);
        assert.match(
          error.message,
          /AUTH-ROLE-ACCESS-001 Entry cannot map to exactly one snapshot entity: tests\/access\.test\.ts > rejects guest mutation/u
        );
        assert.match(
          error.message,
          /AUTH-ROLE-ACCESS-001 Entry cannot map to exactly one snapshot entity: bun test --test-name-pattern=/u
        );
        assert.match(
          error.message,
          /AUTH-ROLE-ACCESS-001 Entry cannot map to exactly one snapshot entity: tests\/access\.test\.ts > preserves resource/u
        );
        return true;
      }
    );
  });
});

void test("migration normalizes escaped selector names before matching snapshot locators", async () => {
  await withLegacyWorkspace(async (workspaceRoot) => {
    const casePath = path.join(
      workspaceRoot,
      "docs/test-evidence/access-control/auth-role-access.md"
    );
    await fs.writeFile(
      casePath,
      legacyCase.replace(
        "^rejects guest mutation$",
        "^rejects\\ guest\\ mutation$"
      )
    );
    const plan = await planTestEvidenceMigration({
      expectedSource,
      snapshot: fixtureSnapshot(),
      workspaceRoot
    });
    assert.deepEqual(plan.index.entries["AUTH-ROLE-ACCESS-001"]?.testIds, [
      "test:alpha",
      "test:beta"
    ]);
  });
});

void test("migration rejects non-project-relative direct Entry files", async () => {
  for (const invalidFile of [
    "/outside.test.ts",
    "../outside.test.ts",
    "tests\\outside.test.ts"
  ]) {
    await withLegacyWorkspace(async (workspaceRoot) => {
      const casePath = path.join(
        workspaceRoot,
        "docs/test-evidence/access-control/auth-role-access.md"
      );
      await fs.writeFile(
        casePath,
        legacyCase.replace(
          "tests/access.test.ts > rejects guest mutation",
          `${invalidFile} > rejects guest mutation`
        )
      );
      await assert.rejects(
        planTestEvidenceMigration({
          expectedSource,
          snapshot: fixtureSnapshot(),
          workspaceRoot
        }),
        (error: unknown) =>
          error instanceof MigrationError &&
          /is not an exact file\/full-name locator/u.test(error.message)
      );
    });
  }
});
