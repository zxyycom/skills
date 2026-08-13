import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { inspectPlanVersionControl } from "../src/git-distance.ts";
import { validBaseCommit, withTempRoot } from "./support.ts";

type GitFixture = {
  baseCommit: string;
  changeDirectory: string;
  repositoryRoot: string;
};

function git(repositoryRoot: string, arguments_: readonly string[]): string {
  const result = spawnSync(
    "git",
    ["-C", repositoryRoot, ...arguments_],
    { encoding: "utf8" }
  );
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

async function createGitFixture(tempRoot: string): Promise<GitFixture> {
  git(tempRoot, ["init", "--quiet", "--initial-branch=main"]);
  git(tempRoot, ["config", "user.email", "change-plan@example.invalid"]);
  git(tempRoot, ["config", "user.name", "Change Plan Tests"]);

  const changeDirectory = path.join(tempRoot, "changes", "target-change");
  await fs.mkdir(changeDirectory, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(changeDirectory, "proposal.md"), "proposal\n"),
    fs.writeFile(path.join(changeDirectory, "design.md"), "design\n"),
    fs.writeFile(path.join(changeDirectory, "tasks.md"), "tasks\n")
  ]);
  git(tempRoot, ["add", "."]);
  git(tempRoot, ["commit", "--quiet", "-m", "plan base"]);
  return {
    baseCommit: git(tempRoot, ["rev-parse", "HEAD"]),
    changeDirectory,
    repositoryRoot: tempRoot
  };
}

async function assertDistance(
  fixture: GitFixture,
  expectedCommitCount: number,
  expectedChangedLines: number
): Promise<void> {
  const inspection = await inspectPlanVersionControl(
    fixture.changeDirectory,
    fixture.baseCommit
  );
  if (inspection.outcome !== "measured") {
    assert.fail(`expected measured inspection, received ${inspection.outcome}`);
  }
  assert.equal(inspection.evidence.commitCount, expectedCommitCount);
  assert.equal(inspection.evidence.changedLines, expectedChangedLines);
}

test("git-distance excludes commits that only change the assessed directory", () => (
  withTempRoot("git-distance-excluded-change", async (tempRoot) => {
    const fixture = await createGitFixture(tempRoot);
    await fs.writeFile(
      path.join(fixture.changeDirectory, "notes.md"),
      "change-local edit\n",
      "utf8"
    );
    git(fixture.repositoryRoot, ["add", "."]);
    git(fixture.repositoryRoot, ["commit", "--quiet", "-m", "edit plan"]);
    await assertDistance(fixture, 0, 0);
  })
));

test("git-distance reports zero evidence at the plan baseline", () => (
  withTempRoot("git-distance-zero", async (tempRoot) => {
    const fixture = await createGitFixture(tempRoot);
    const inspection = await inspectPlanVersionControl(
      fixture.changeDirectory,
      fixture.baseCommit
    );
    assert.deepEqual(inspection, {
      evidence: {
        baseCommit: fixture.baseCommit,
        changedLines: 0,
        commitCount: 0,
        headCommit: fixture.baseCommit
      },
      outcome: "measured"
    });
  })
));

test("git-distance counts sibling paths and only outside lines in mixed commits", () => (
  withTempRoot("git-distance-path-boundary", async (tempRoot) => {
    const fixture = await createGitFixture(tempRoot);
    const siblingDirectory = path.join(
      fixture.repositoryRoot,
      "changes",
      "target-change-extra"
    );
    await fs.mkdir(siblingDirectory, { recursive: true });
    await Promise.all([
      fs.writeFile(
        path.join(fixture.changeDirectory, "notes.md"),
        "inside\n",
        "utf8"
      ),
      fs.writeFile(
        path.join(siblingDirectory, "note.md"),
        "outside one\noutside two\n",
        "utf8"
      )
    ]);
    git(fixture.repositoryRoot, ["add", "."]);
    git(fixture.repositoryRoot, ["commit", "--quiet", "-m", "mixed paths"]);
    await assertDistance(fixture, 1, 2);
  })
));

test("git-distance accumulates additions and deletions", () => (
  withTempRoot("git-distance-additions-deletions", async (tempRoot) => {
    const fixture = await createGitFixture(tempRoot);
    const trackedFile = path.join(fixture.repositoryRoot, "tracked.txt");
    await fs.writeFile(trackedFile, "old one\nold two\nold three\n", "utf8");
    git(fixture.repositoryRoot, ["add", "."]);
    git(fixture.repositoryRoot, ["commit", "--quiet", "-m", "add tracked"]);
    await fs.writeFile(trackedFile, "new one\nnew two\n", "utf8");
    git(fixture.repositoryRoot, ["add", "."]);
    git(fixture.repositoryRoot, ["commit", "--quiet", "-m", "replace tracked"]);
    await assertDistance(fixture, 2, 8);
  })
));

test("git-distance reports unavailable missing and non-first-parent bases", () => (
  withTempRoot("git-distance-base-unavailable", async (tempRoot) => {
    const fixture = await createGitFixture(tempRoot);
    const missingBase = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    assert.deepEqual(
      await inspectPlanVersionControl(fixture.changeDirectory, null),
      {
        baseCommit: null,
        headCommit: fixture.baseCommit,
        outcome: "base-unavailable"
      }
    );
    assert.deepEqual(
      await inspectPlanVersionControl(fixture.changeDirectory, missingBase),
      {
        baseCommit: missingBase,
        headCommit: fixture.baseCommit,
        outcome: "base-unavailable"
      }
    );

    git(fixture.repositoryRoot, ["switch", "--quiet", "-c", "side"]);
    await fs.writeFile(path.join(fixture.repositoryRoot, "side.txt"), "side\n");
    git(fixture.repositoryRoot, ["add", "side.txt"]);
    git(fixture.repositoryRoot, ["commit", "--quiet", "-m", "side"]);
    const sideCommit = git(fixture.repositoryRoot, ["rev-parse", "HEAD"]);
    git(fixture.repositoryRoot, ["switch", "--quiet", "main"]);
    assert.deepEqual(
      await inspectPlanVersionControl(fixture.changeDirectory, sideCommit),
      {
        baseCommit: sideCommit,
        headCommit: fixture.baseCommit,
        outcome: "base-unavailable"
      }
    );
  })
));

test("git-distance propagates version-control access failures", async () => {
  await assert.rejects(
    inspectPlanVersionControl("/path/that/is/not/a/repository", validBaseCommit),
    /version control|repository|git/u
  );
});
