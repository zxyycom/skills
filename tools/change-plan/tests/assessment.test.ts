import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  assessChangePlan
} from "../src/assessment.ts";
import { confirmPlanArtifactsAtHead } from "../src/git-distance.ts";
import type { ChangePlanMetadata } from "../src/types.ts";
import { withTempRoot } from "./support.ts";

type AssessmentFixture = {
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

async function createAssessmentFixture(
  tempRoot: string
): Promise<AssessmentFixture> {
  git(tempRoot, ["init", "--quiet", "--initial-branch=main"]);
  git(tempRoot, ["config", "user.email", "change-plan@example.invalid"]);
  git(tempRoot, ["config", "user.name", "Change Plan Tests"]);

  const changeDirectory = path.join(tempRoot, "changes", "assessed-change");
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

function planMetadata(baseCommit: string | null): ChangePlanMetadata {
  return { baseCommit, stage: "plan" };
}

async function commitProjectLines(
  fixture: AssessmentFixture,
  index: number,
  lineCount: number
): Promise<void> {
  const contents = Array.from(
    { length: lineCount },
    (_, line) => `line ${line}`
  ).join("\n") + "\n";
  await fs.writeFile(
    path.join(fixture.repositoryRoot, `project-${index}.txt`),
    contents,
    "utf8"
  );
  git(fixture.repositoryRoot, ["add", "."]);
  git(fixture.repositoryRoot, ["commit", "--quiet", "-m", `project ${index}`]);
}

test("assessment is not applicable outside active plan stage", async () => {
  const draft: ChangePlanMetadata = { stage: "draft" };
  assert.deepEqual(
    await assessChangePlan("not-a-repository", draft),
    { assessment: "not-applicable" }
  );
});

test("assessment keeps a confirmed unchanged plan current", () => (
  withTempRoot("assessment-current", async (tempRoot) => {
    const fixture = await createAssessmentFixture(tempRoot);
    assert.deepEqual(
      await confirmPlanArtifactsAtHead(fixture.changeDirectory),
      { confirmed: true, headCommit: fixture.baseCommit }
    );
    assert.deepEqual(
      await assessChangePlan(
        fixture.changeDirectory,
        planMetadata(fixture.baseCommit)
      ),
      {
        assessment: "current",
        baseCommit: fixture.baseCommit,
        changedLines: 0,
        commitCount: 0,
        headCommit: fixture.baseCommit,
        policy: "git-distance-v1"
      }
    );

    git(fixture.repositoryRoot, ["config", "core.autocrlf", "true"]);
    await Promise.all([
      "proposal.md",
      "design.md",
      "tasks.md"
    ].map((artifact) => fs.rm(path.join(fixture.changeDirectory, artifact))));
    git(fixture.repositoryRoot, [
      "checkout",
      "--",
      "changes/assessed-change"
    ]);
    assert.match(
      await fs.readFile(
        path.join(fixture.changeDirectory, "proposal.md"),
        "utf8"
      ),
      /\r\n/u
    );
    assert.equal(git(fixture.repositoryRoot, ["status", "--porcelain"]), "");
    assert.deepEqual(
      await confirmPlanArtifactsAtHead(fixture.changeDirectory),
      { confirmed: true, headCommit: fixture.baseCommit }
    );
  })
));

test("assessment requires review when an artifact differs from its base", () => (
  withTempRoot("assessment-artifacts", async (tempRoot) => {
    const fixture = await createAssessmentFixture(tempRoot);
    await fs.appendFile(
      path.join(fixture.changeDirectory, "design.md"),
      "changed\n",
      "utf8"
    );
    assert.deepEqual(
      await confirmPlanArtifactsAtHead(fixture.changeDirectory),
      { confirmed: false, headCommit: fixture.baseCommit }
    );
    assert.deepEqual(
      await assessChangePlan(
        fixture.changeDirectory,
        planMetadata(fixture.baseCommit)
      ),
      {
        assessment: "plan-review-required",
        baseCommit: fixture.baseCommit,
        headCommit: fixture.baseCommit,
        reason: "artifacts-changed"
      }
    );

    git(fixture.repositoryRoot, ["add", "."]);
    git(fixture.repositoryRoot, ["commit", "--quiet", "-m", "revise design"]);
    const revisedHead = git(fixture.repositoryRoot, ["rev-parse", "HEAD"]);
    assert.deepEqual(
      await confirmPlanArtifactsAtHead(fixture.changeDirectory),
      { confirmed: true, headCommit: revisedHead }
    );
    assert.deepEqual(
      await assessChangePlan(
        fixture.changeDirectory,
        planMetadata(fixture.baseCommit)
      ),
      {
        assessment: "plan-review-required",
        baseCommit: fixture.baseCommit,
        headCommit: revisedHead,
        reason: "artifacts-changed"
      }
    );

    await fs.appendFile(
      path.join(fixture.changeDirectory, "proposal.md"),
      "staged revision\n",
      "utf8"
    );
    git(fixture.repositoryRoot, ["add", "changes/assessed-change/proposal.md"]);
    await fs.writeFile(
      path.join(fixture.changeDirectory, "proposal.md"),
      `${git(fixture.repositoryRoot, [
        "show",
        "HEAD:changes/assessed-change/proposal.md"
      ])}\n`,
      "utf8"
    );
    assert.match(
      git(fixture.repositoryRoot, ["status", "--porcelain"]),
      /^MM changes\/assessed-change\/proposal\.md$/u
    );
    assert.deepEqual(
      await confirmPlanArtifactsAtHead(fixture.changeDirectory),
      { confirmed: false, headCommit: revisedHead }
    );
  })
));

test("assessment requires review when the plan base is unavailable", () => (
  withTempRoot("assessment-base", async (tempRoot) => {
    const fixture = await createAssessmentFixture(tempRoot);
    assert.deepEqual(
      await assessChangePlan(fixture.changeDirectory, planMetadata(null)),
      {
        assessment: "plan-review-required",
        baseCommit: null,
        headCommit: fixture.baseCommit,
        reason: "base-unavailable"
      }
    );
    assert.deepEqual(
      await assessChangePlan(
        fixture.changeDirectory,
        planMetadata("deadbeefdeadbeefdeadbeefdeadbeefdeadbeef")
      ),
      {
        assessment: "plan-review-required",
        baseCommit: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
        headCommit: fixture.baseCommit,
        reason: "base-unavailable"
      }
    );
  })
));

test("assessment rejects a base outside the HEAD first-parent history", () => (
  withTempRoot("assessment-first-parent", async (tempRoot) => {
    const fixture = await createAssessmentFixture(tempRoot);
    git(fixture.repositoryRoot, ["switch", "--quiet", "-c", "side"]);
    await commitProjectLines(fixture, 1, 1);
    const sideCommit = git(fixture.repositoryRoot, ["rev-parse", "HEAD"]);
    git(fixture.repositoryRoot, ["switch", "--quiet", "main"]);
    await commitProjectLines(fixture, 2, 1);
    await fs.appendFile(
      path.join(fixture.changeDirectory, "design.md"),
      "main-only artifact revision\n",
      "utf8"
    );
    git(fixture.repositoryRoot, ["add", "."]);
    git(fixture.repositoryRoot, [
      "commit",
      "--quiet",
      "-m",
      "revise plan on main"
    ]);
    git(fixture.repositoryRoot, [
      "merge",
      "--quiet",
      "--no-ff",
      "side",
      "-m",
      "merge side"
    ]);
    const headCommit = git(fixture.repositoryRoot, ["rev-parse", "HEAD"]);

    assert.deepEqual(
      await assessChangePlan(
        fixture.changeDirectory,
        planMetadata(sideCommit)
      ),
      {
        assessment: "plan-review-required",
        baseCommit: sideCommit,
        headCommit,
        reason: "base-unavailable"
      }
    );
  })
));
