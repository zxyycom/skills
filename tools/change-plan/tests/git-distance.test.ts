import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  classifyGitDistance,
  measureGitDistance
} from "../src/git-distance.ts";
import { withTempRoot } from "./support.ts";

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

function contentWithLines(count: number): string {
  return Array.from({ length: count }, (_, index) => `line ${index}`).join("\n")
    + "\n";
}

async function commitOutsideChange(
  fixture: GitFixture,
  index: number,
  lineCount: number
): Promise<void> {
  await fs.writeFile(
    path.join(fixture.repositoryRoot, `project-${index}.txt`),
    contentWithLines(lineCount),
    "utf8"
  );
  git(fixture.repositoryRoot, ["add", "."]);
  git(fixture.repositoryRoot, ["commit", "--quiet", "-m", `project ${index}`]);
}

async function assertDistance(
  fixture: GitFixture,
  expectedCommitCount: number,
  expectedChangedLines: number,
  expectedAssessment: "current" | "shelve-candidate"
): Promise<void> {
  const distance = await measureGitDistance(
    fixture.changeDirectory,
    fixture.baseCommit
  );
  assert.ok(distance);
  assert.equal(distance.commitCount, expectedCommitCount);
  assert.equal(distance.changedLines, expectedChangedLines);
  assert.equal(classifyGitDistance(distance).assessment, expectedAssessment);
}

test("git-distance-v1 keeps the 3 commit and 1000 line boundary current", () => (
  withTempRoot("git-distance-3-1000", async (tempRoot) => {
    const fixture = await createGitFixture(tempRoot);
    await commitOutsideChange(fixture, 1, 998);
    await commitOutsideChange(fixture, 2, 1);
    await commitOutsideChange(fixture, 3, 1);
    await assertDistance(fixture, 3, 1000, "current");
  })
));

test("git-distance-v1 selects 4 commits with more than 1000 lines", () => (
  withTempRoot("git-distance-4-1001", async (tempRoot) => {
    const fixture = await createGitFixture(tempRoot);
    await commitOutsideChange(fixture, 1, 998);
    await commitOutsideChange(fixture, 2, 1);
    await commitOutsideChange(fixture, 3, 1);
    await commitOutsideChange(fixture, 4, 1);
    await assertDistance(fixture, 4, 1001, "shelve-candidate");
  })
));

test("git-distance-v1 selects 9 low-churn commits", () => (
  withTempRoot("git-distance-9-commits", async (tempRoot) => {
    const fixture = await createGitFixture(tempRoot);
    for (let index = 1; index <= 9; index += 1) {
      await commitOutsideChange(fixture, index, 1);
    }
    await assertDistance(fixture, 9, 9, "shelve-candidate");
  })
));

test("git-distance-v1 selects one commit with 3000 changed lines", () => (
  withTempRoot("git-distance-3000-lines", async (tempRoot) => {
    const fixture = await createGitFixture(tempRoot);
    await commitOutsideChange(fixture, 1, 3000);
    await assertDistance(fixture, 1, 3000, "shelve-candidate");
  })
));

test("git-distance-v1 reports zero distance when the project has not advanced", () => (
  withTempRoot("git-distance-zero", async (tempRoot) => {
    const fixture = await createGitFixture(tempRoot);
    await assertDistance(fixture, 0, 0, "current");
  })
));

test("git-distance-v1 excludes commits that only change the assessed directory", () => (
  withTempRoot("git-distance-excluded-change", async (tempRoot) => {
    const fixture = await createGitFixture(tempRoot);
    await fs.appendFile(
      path.join(fixture.changeDirectory, "proposal.md"),
      "change-local edit\n",
      "utf8"
    );
    git(fixture.repositoryRoot, ["add", "."]);
    git(fixture.repositoryRoot, ["commit", "--quiet", "-m", "edit plan"]);
    await assertDistance(fixture, 0, 0, "current");
  })
));

test("git-distance-v1 counts sibling paths and only outside lines in mixed commits", () => (
  withTempRoot("git-distance-path-boundary", async (tempRoot) => {
    const fixture = await createGitFixture(tempRoot);
    const siblingDirectory = path.join(
      fixture.repositoryRoot,
      "changes",
      "target-change-extra"
    );
    await fs.mkdir(siblingDirectory, { recursive: true });
    await Promise.all([
      fs.appendFile(
        path.join(fixture.changeDirectory, "proposal.md"),
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
    await assertDistance(fixture, 1, 2, "current");
  })
));

test("git-distance-v1 accumulates additions and deletions", () => (
  withTempRoot("git-distance-additions-deletions", async (tempRoot) => {
    const fixture = await createGitFixture(tempRoot);
    const trackedFile = path.join(fixture.repositoryRoot, "tracked.txt");
    await fs.writeFile(trackedFile, "old one\nold two\nold three\n", "utf8");
    git(fixture.repositoryRoot, ["add", "."]);
    git(fixture.repositoryRoot, ["commit", "--quiet", "-m", "add tracked"]);
    await fs.writeFile(trackedFile, "new one\nnew two\n", "utf8");
    git(fixture.repositoryRoot, ["add", "."]);
    git(fixture.repositoryRoot, ["commit", "--quiet", "-m", "replace tracked"]);
    await assertDistance(fixture, 2, 8, "current");
  })
));

test("git-distance-v1 counts binary-only project commits with zero changed lines", () => (
  withTempRoot("git-distance-binary", async (tempRoot) => {
    const fixture = await createGitFixture(tempRoot);
    await fs.writeFile(
      path.join(fixture.repositoryRoot, "project.bin"),
      Buffer.from([0, 1, 2, 3, 255])
    );
    git(fixture.repositoryRoot, ["add", "."]);
    git(fixture.repositoryRoot, ["commit", "--quiet", "-m", "add binary"]);
    await assertDistance(fixture, 1, 0, "current");
  })
));

test("git-distance-v1 counts empty project commits with zero changed lines", () => (
  withTempRoot("git-distance-empty", async (tempRoot) => {
    const fixture = await createGitFixture(tempRoot);
    git(fixture.repositoryRoot, [
      "commit",
      "--allow-empty",
      "--quiet",
      "-m",
      "empty project checkpoint"
    ]);
    await assertDistance(fixture, 1, 0, "current");
  })
));
