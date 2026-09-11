import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { MigrationError, writeTestEvidenceMigration } from "./migrate.ts";
import {
  expectedSource,
  fixtureSnapshot,
  withLegacyWorkspace
} from "./migrate-test-support.ts";

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
