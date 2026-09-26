import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createGitRepositoryFixture } from "../../shared/tests/git-fixture.ts";
import { synchronizeInvestigationIndex } from "../src/validation.ts";
import {
  git,
  indexRelativePath,
  investigationRoot,
  runInvestigationCli,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";

async function synchronizeCollection(root: string): Promise<void> {
  const result = await synchronizeInvestigationIndex({ workspaceRoot: root });
  assert.deepEqual(result.errors, []);
}

async function withSourcePathRepository(
  run: (root: string) => Promise<void>
): Promise<void> {
  await withTempRoot("stage-source-path", async (parentDirectory) => {
    const fixture = await createGitRepositoryFixture({
      fixtureRoot: fileURLToPath(
        new URL("./fixtures/staging-source-path", import.meta.url)
      ),
      parentDirectory,
      prepareRepository: synchronizeCollection,
      repositoryName: "repository",
      userEmail: "test@example.invalid",
      userName: "Test"
    });
    await run(fixture.repositoryRoot);
  });
}

function assertPendingChanges(
  root: string,
  scope: string,
  domainChanges: readonly string[]
): void {
  assert.ok(
    scope === "all" || scope === "domain",
    `unexpected scope: ${scope}`
  );
  const expected = [...domainChanges];
  if (scope === "all") expected.push(`M\t${indexRelativePath}`);
  const actual = git(root, [
    "diff",
    "--cached",
    "--name-status",
    "--no-renames"
  ]);
  assert.deepEqual(actual.trim().split("\n").sort(), expected.sort());
}

for (const scope of ["all", "domain"]) {
  test(`stage --scope ${scope} adds a report at its indexed sourcePath`, async () => {
    await withSourcePathRepository(async (root) => {
      const owner = path.join(
        investigationRoot(root),
        "_resources",
        "260828-added"
      );
      await fs.mkdir(owner, { recursive: true });
      await fs.writeFile(path.join(owner, "evidence.txt"), "evidence\n");
      await writeCollection(root, [
        {
          id: "260828-added",
          resources: ["260828-added/evidence.txt"],
          sourcePath: "added-report.md"
        }
      ]);
      const result = await runInvestigationCli(root, [
        "stage",
        "260828-added",
        "--scope",
        scope
      ]);
      assert.equal(result.status, 0, result.stderr);
      assertPendingChanges(root, scope, [
        "A\tdocs/investigations/added-report.md",
        "A\tdocs/investigations/_resources/260828-added/evidence.txt"
      ]);
      assert.match(
        git(root, ["show", ":docs/investigations/added-report.md"]),
        /id: "260828-added"/u
      );
    });
  });
}

for (const scope of ["all", "domain"]) {
  test(`stage --scope ${scope} updates the indexed sourcePath without staging an ID-named decoy`, async () => {
    await withSourcePathRepository(async (root) => {
      const selected = { id: "260828-selected", sourcePath: "selected.md" };
      const unrelated = {
        id: "260828-unrelated",
        sourcePath: "260828-selected.md"
      };
      await writeCollection(root, [
        { ...unrelated, title: "Unrelated pending" }
      ]);
      git(root, ["add", "docs/investigations/260828-selected.md"]);
      const unrelatedPending = git(root, [
        "show",
        ":docs/investigations/260828-selected.md"
      ]);
      await writeCollection(root, [
        { ...selected, title: "Selected update" },
        { ...unrelated, title: "Unrelated workspace" }
      ]);
      const result = await runInvestigationCli(root, [
        "stage",
        selected.id,
        "--scope",
        scope
      ]);
      assert.equal(result.status, 0, result.stderr);
      assertPendingChanges(root, scope, [
        "M\tdocs/investigations/selected.md",
        "M\tdocs/investigations/260828-selected.md"
      ]);
      assert.match(
        git(root, ["show", ":docs/investigations/selected.md"]),
        /title: "Selected update"/u
      );
      assert.equal(
        git(root, ["show", ":docs/investigations/260828-selected.md"]),
        unrelatedPending
      );
    });
  });
}

for (const scope of ["all", "domain"]) {
  test(`stage --scope ${scope} deletes a baseline-only report by its indexed sourcePath`, async () => {
    await withSourcePathRepository(async (root) => {
      await fs.rm(path.join(investigationRoot(root), "removed-report.md"));
      await synchronizeCollection(root);
      const result = await runInvestigationCli(root, [
        "stage",
        "260828-removed",
        "--scope",
        scope
      ]);
      assert.equal(result.status, 0, result.stderr);
      assertPendingChanges(root, scope, [
        "D\tdocs/investigations/removed-report.md"
      ]);
      assert.equal(
        git(root, ["ls-files", "--", "docs/investigations/removed-report.md"]),
        ""
      );
    });
  });
}

for (const scope of ["all", "domain"]) {
  test(`stage --scope ${scope} stages sourcePath relocation as old-path deletion and new-path addition`, async () => {
    await withSourcePathRepository(async (root) => {
      const report = { id: "260828-moved", sourcePath: "old-name.md" };
      const originalReport = await fs.readFile(
        path.join(investigationRoot(root), report.sourcePath),
        "utf8"
      );
      await fs.rename(
        path.join(investigationRoot(root), report.sourcePath),
        path.join(investigationRoot(root), "260828-moved.md")
      );
      await synchronizeCollection(root);
      const result = await runInvestigationCli(root, [
        "stage",
        report.id,
        "--scope",
        scope
      ]);
      assert.equal(result.status, 0, result.stderr);
      assertPendingChanges(root, scope, [
        "D\tdocs/investigations/old-name.md",
        "A\tdocs/investigations/260828-moved.md"
      ]);
      assert.equal(
        git(root, ["show", ":docs/investigations/260828-moved.md"]),
        originalReport
      );
    });
  });
}

for (const scope of ["all", "domain"]) {
  test(`stage --scope ${scope} keeps the shared sourcePath when both renamed IDs are selected`, async () => {
    await withSourcePathRepository(async (root) => {
      await writeCollection(root, [
        { id: "260828-a-new", sourcePath: "shared-name.md" }
      ]);
      const result = await runInvestigationCli(root, [
        "stage",
        "260828-z-old",
        "260828-a-new",
        "--scope",
        scope
      ]);
      assert.equal(result.status, 0, result.stderr);
      assertPendingChanges(root, scope, [
        "M\tdocs/investigations/shared-name.md"
      ]);
      assert.match(
        git(root, ["show", ":docs/investigations/shared-name.md"]),
        /id: "260828-a-new"/u
      );
    });
  });
}

for (const scope of ["all", "domain"]) {
  test(`stage --scope ${scope} preserves both reports through selected sourcePath swaps`, async () => {
    await withSourcePathRepository(async (root) => {
      await writeCollection(root, [
        { id: "260828-first", sourcePath: "second.md" },
        { id: "260828-second", sourcePath: "first.md" }
      ]);
      const result = await runInvestigationCli(root, [
        "stage",
        "260828-first",
        "260828-second",
        "--scope",
        scope
      ]);
      assert.equal(result.status, 0, result.stderr);
      assertPendingChanges(root, scope, [
        "M\tdocs/investigations/first.md",
        "M\tdocs/investigations/second.md"
      ]);
      assert.match(
        git(root, ["show", ":docs/investigations/first.md"]),
        /id: "260828-second"/u
      );
      assert.match(
        git(root, ["show", ":docs/investigations/second.md"]),
        /id: "260828-first"/u
      );
    });
  });
}
