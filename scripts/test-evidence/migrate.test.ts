import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  MigrationError,
  planTestEvidenceMigration,
  writeTestEvidenceMigration
} from "./migrate.ts";

const expectedSource = {
  projectId: "fixture-project",
  revision: "fixture-revision",
  scopeId: "fixture-tests"
};

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

void test("migration write replaces only the verified legacy files and leaves a Case-only catalog", async () => {
  await withLegacyWorkspace(async (workspaceRoot) => {
    const plan = await writeTestEvidenceMigration({
      expectedSource,
      snapshot: fixtureSnapshot(),
      workspaceRoot
    });
    assert.equal(plan.legacyCaseCount, 1);
    await assert.rejects(
      fs.lstat(
        path.join(workspaceRoot, "docs/test-evidence/test-evidence-topics.json")
      )
    );
    await assert.rejects(
      fs.lstat(path.join(workspaceRoot, "docs/test-evidence/access-control"))
    );
    assert.equal(
      await fs.readFile(
        path.join(
          workspaceRoot,
          "docs/test-evidence/cases/auth-role-access-001.md"
        ),
        "utf8"
      ),
      plan.cases[0]?.text
    );
    const index = JSON.parse(
      await fs.readFile(
        path.join(workspaceRoot, "docs/test-evidence/test-evidence-index.json"),
        "utf8"
      )
    );
    assert.equal(index.definitionVersion, 6);
    assert.deepEqual(Object.keys(index.metadata), []);
    const { syncTestEvidenceIndex, validateTestEvidence } =
      await import("../../tools/test-evidence/src/cli.ts");
    const checked = await validateTestEvidence({ workspaceRoot });
    const synced = await syncTestEvidenceIndex({
      mode: "write",
      workspaceRoot
    });
    assert.equal(synced.status, "ok");
    const rebuiltIndex = JSON.parse(
      await fs.readFile(
        path.join(workspaceRoot, "docs/test-evidence/test-evidence-index.json"),
        "utf8"
      )
    );
    assert.deepEqual(index, rebuiltIndex);
    assert.deepEqual(checked.diagnostics, []);
    const rechecked = await syncTestEvidenceIndex({
      mode: "check",
      workspaceRoot
    });
    assert.equal(rechecked.status, "ok");
  });
});

void test("migration restores verified bytes after a concurrent legacy-directory change blocks cleanup", async () => {
  await withLegacyWorkspace(async (workspaceRoot) => {
    const root = path.join(workspaceRoot, "docs/test-evidence");
    const oldCasePath = path.join(root, "access-control/auth-role-access.md");
    const oldCase = await fs.readFile(oldCasePath, "utf8");
    const oldCaseMode = (await fs.stat(oldCasePath)).mode & 0o777;
    const oldIndexPath = path.join(root, "test-evidence-index.json");
    const oldIndex = await fs.readFile(oldIndexPath, "utf8");
    const oldIndexMode = (await fs.stat(oldIndexPath)).mode & 0o777;
    assert.equal(oldIndexMode, 0o640);
    const concurrentDirectory = path.join(root, "access-control");
    const concurrentPath = path.join(concurrentDirectory, "concurrent.txt");
    const concurrentBytes = "preserve this concurrent file\n";
    const rmdirDescriptor = Object.getOwnPropertyDescriptor(fs, "rmdir");
    assert.ok(rmdirDescriptor);
    const originalRmdir = fs.rmdir;
    let injected = false;
    Object.defineProperty(fs, "rmdir", {
      ...rmdirDescriptor,
      value: async (...args: Parameters<typeof fs.rmdir>) => {
        if (args[0] === concurrentDirectory) {
          assert.equal(injected, false, "cleanup injection ran more than once");
          await fs.writeFile(concurrentPath, concurrentBytes, { flag: "wx" });
          injected = true;
        }
        return await originalRmdir(...args);
      }
    });
    try {
      await assert.rejects(
        writeTestEvidenceMigration({
          expectedSource,
          snapshot: fixtureSnapshot(),
          workspaceRoot
        }),
        (error: unknown) =>
          error instanceof MigrationError &&
          /original bytes restored/u.test(error.message)
      );
      assert.equal(injected, true, "test did not inject at cleanup");
      assert.equal(await fs.readFile(oldCasePath, "utf8"), oldCase);
      assert.equal(await fs.readFile(oldIndexPath, "utf8"), oldIndex);
      assert.equal((await fs.stat(oldCasePath)).mode & 0o777, oldCaseMode);
      assert.equal((await fs.stat(oldIndexPath)).mode & 0o777, oldIndexMode);
      assert.equal(await fs.readFile(concurrentPath, "utf8"), concurrentBytes);
      await assert.rejects(fs.lstat(path.join(root, "cases")));
    } finally {
      Object.defineProperty(fs, "rmdir", rmdirDescriptor);
    }
  });
});

void test("migration preserves a source replaced after preflight instead of unlinking it", async () => {
  await withLegacyWorkspace(async (workspaceRoot) => {
    const root = path.join(workspaceRoot, "docs/test-evidence");
    const oldCasePath = path.join(root, "access-control/auth-role-access.md");
    const oldCase = await fs.readFile(oldCasePath, "utf8");
    const oldCaseIdentity = await fs.lstat(oldCasePath);
    const oldIndexPath = path.join(root, "test-evidence-index.json");
    const oldIndex = await fs.readFile(oldIndexPath, "utf8");
    const replacementPath = path.join(root, "replacement.md");
    const writeFileDescriptor = Object.getOwnPropertyDescriptor(
      fs,
      "writeFile"
    );
    assert.ok(writeFileDescriptor);
    const originalWriteFile = fs.writeFile;
    let injected = false;
    Object.defineProperty(fs, "writeFile", {
      ...writeFileDescriptor,
      value: async (...args: Parameters<typeof fs.writeFile>) => {
        if (args[0] === oldIndexPath && !injected) {
          await originalWriteFile(replacementPath, oldCase, { flag: "wx" });
          await fs.rename(replacementPath, oldCasePath);
          injected = true;
        }
        return await originalWriteFile(...args);
      }
    });
    try {
      await assert.rejects(
        writeTestEvidenceMigration({
          expectedSource,
          snapshot: fixtureSnapshot(),
          workspaceRoot
        }),
        (error: unknown) =>
          error instanceof MigrationError &&
          /legacy source changed before replacement/u.test(error.message)
      );
      assert.equal(
        injected,
        true,
        "test did not replace the source after preflight"
      );
      assert.equal(await fs.readFile(oldCasePath, "utf8"), oldCase);
      const replacementIdentity = await fs.lstat(oldCasePath);
      assert.notEqual(replacementIdentity.ino, oldCaseIdentity.ino);
      assert.equal(await fs.readFile(oldIndexPath, "utf8"), oldIndex);
      await assert.rejects(fs.lstat(path.join(root, "cases")));
    } finally {
      Object.defineProperty(fs, "writeFile", writeFileDescriptor);
    }
  });
});

void test("migration refuses a pre-existing target directory before writing legacy sources", async () => {
  await withLegacyWorkspace(async (workspaceRoot) => {
    const target = path.join(workspaceRoot, "docs/test-evidence/cases");
    await fs.mkdir(target);
    await fs.writeFile(path.join(target, "unrelated.md"), "do not delete\n");
    await assert.rejects(
      writeTestEvidenceMigration({
        expectedSource,
        snapshot: fixtureSnapshot(),
        workspaceRoot
      }),
      (error: unknown) =>
        error instanceof Error && /cases is not allowed/u.test(error.message)
    );
    assert.equal(
      await fs.readFile(path.join(target, "unrelated.md"), "utf8"),
      "do not delete\n"
    );
    assert.match(
      await fs.readFile(
        path.join(
          workspaceRoot,
          "docs/test-evidence/access-control/auth-role-access.md"
        ),
        "utf8"
      ),
      /Guest access is rejected/u
    );
  });
});

async function withLegacyWorkspace(
  action: (workspaceRoot: string) => Promise<void>
): Promise<void> {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "migration-fixture-")
  );
  try {
    const root = path.join(workspaceRoot, "docs/test-evidence");
    await fs.mkdir(path.join(root, "access-control"), { recursive: true });
    await fs.writeFile(
      path.join(root, "test-evidence-topics.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          topics: [
            { id: "access-control", description: "Authorization boundaries." }
          ]
        },
        null,
        2
      )
    );
    await fs.writeFile(
      path.join(root, "test-evidence-index.json"),
      '{"legacy":true}\n',
      { mode: 0o640 }
    );
    await fs.writeFile(
      path.join(root, "access-control/auth-role-access.md"),
      legacyCase
    );
    await action(workspaceRoot);
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

function fixtureSnapshot(): {
  completeness: "complete";
  entities: { id: string; locators: string[]; name: string }[];
  schemaVersion: 2;
  source: typeof expectedSource;
} {
  return {
    completeness: "complete",
    entities: [
      {
        id: "test:alpha",
        locators: ["tests/access.test.ts > rejects guest mutation"],
        name: "rejects guest mutation"
      },
      {
        id: "test:beta",
        locators: ["tests/access.test.ts > preserves resource"],
        name: "preserves resource"
      }
    ],
    schemaVersion: 2,
    source: expectedSource
  };
}

const legacyCase = `### Case AUTH-ROLE-ACCESS-001: Guest access is rejected

Entry:
- \`tests/access.test.ts > rejects guest mutation\`
- \`bun test --test-name-pattern="^rejects guest mutation$" ./tests/access.test.ts\`
- \`tests/access.test.ts > preserves resource\`

Contract:
- Resource mutation follows the caller role boundary.

Proves:
- A guest mutation returns the forbidden result.
- The resource remains unchanged.
`;
