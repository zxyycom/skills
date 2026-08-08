import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  checkChangePlanDirectory as checkBundledChangePlanDirectory
} from "../../../skills/change-plan/scripts/change-plan.mjs";
import {
  checkChangePlanArtifactsForStage,
  checkChangePlanDirectory,
} from "../src/check.ts";
import { readChangePlanMetadata } from "../src/metadata.ts";
import { changePlanMetadataName } from "../src/types.ts";
import {
  validBaseCommit,
  validDesign,
  validProposal,
  withTempRoot,
  writePlan
} from "./support.ts";

function runGit(repositoryRoot: string, arguments_: readonly string[]): void {
  const result = spawnSync(
    "git",
    ["-C", repositoryRoot, ...arguments_],
    { encoding: "utf8" }
  );
  assert.equal(result.status, 0, result.stderr);
}

const minimalDraftProposal = `# Proposal

本 change 记录一个仍在起草的方向。

## Why

当前方向需要先形成可识别记录。

## Outcome

方向具备继续收敛为完整计划所需的最小背景。
`;

async function testValidPlan(tempRoot: string): Promise<void> {
  const validDirectory = await writePlan(tempRoot, "add-change-plan");
  const validResult = await checkChangePlanDirectory(validDirectory);
  assert.equal(validResult.valid, true);
  assert.deepEqual(validResult.diagnostics, []);
  assert.equal(validResult.taskCount, 3);
  assert.equal(validResult.completedTaskCount, 1);
  assert.equal(validResult.stage, "implementation");
  assert.deepEqual(
    await readChangePlanMetadata(validDirectory),
    validResult.metadata
  );
  assert.deepEqual(validResult.assessment, { assessment: "not-applicable" });
  assert.deepEqual(validResult.taskProgress, {
    implementation: { completedTaskCount: 0, taskCount: 1 },
    readiness: { completedTaskCount: 1, taskCount: 1 },
    verification: { completedTaskCount: 0, taskCount: 1 }
  });
  assert.deepEqual(
    await checkBundledChangePlanDirectory(validDirectory),
    validResult
  );
}

async function testStageArtifactContracts(tempRoot: string): Promise<void> {
  const draftDirectory = await writePlan(tempRoot, "draft-change", {
    metadata: { schemaVersion: 1, stage: "draft" },
    proposal: minimalDraftProposal
  });
  await Promise.all([
    fs.rm(path.join(draftDirectory, "design.md")),
    fs.rm(path.join(draftDirectory, "tasks.md"))
  ]);
  const draftResult = await checkChangePlanDirectory(draftDirectory);
  assert.equal(draftResult.valid, true);
  assert.equal(draftResult.stage, "draft");
  assert.equal(draftResult.taskCount, 0);
  assert.deepEqual(draftResult.taskProgress, {
    implementation: { completedTaskCount: 0, taskCount: 0 },
    readiness: { completedTaskCount: 0, taskCount: 0 },
    verification: { completedTaskCount: 0, taskCount: 0 }
  });

  const planTargetDirectory = await writePlan(tempRoot, "plan-target", {
    metadata: { schemaVersion: 1, stage: "draft" }
  });
  const targetResult = await checkChangePlanArtifactsForStage(
    planTargetDirectory,
    "plan"
  );
  assert.equal(targetResult.valid, true);
  assert.equal(targetResult.targetStage, "plan");
  assert.equal(targetResult.taskCount, 3);

  await fs.rm(path.join(planTargetDirectory, "design.md"));
  const incompleteTargetResult = await checkChangePlanArtifactsForStage(
    planTargetDirectory,
    "plan"
  );
  assert.equal(incompleteTargetResult.valid, false);
  assert.ok(incompleteTargetResult.diagnostics.some((diagnostic) => (
    diagnostic.code === "missing-required-file"
    && diagnostic.file === "design.md"
  )));

  const shelvedDirectory = await writePlan(tempRoot, "shelved-change", {
    metadata: {
      baseCommit: validBaseCommit,
      schemaVersion: 1,
      shelf: {
        atCommit: validBaseCommit,
        reason: "等待上游方向确定",
        source: "explicit"
      },
      stage: "shelved"
    }
  });
  const shelvedResult = await checkChangePlanDirectory(shelvedDirectory);
  assert.equal(shelvedResult.valid, true);
  assert.equal(shelvedResult.stage, "shelved");
}

async function testMetadataAndArchiveBoundaries(
  tempRoot: string
): Promise<void> {
  runGit(tempRoot, ["init", "--quiet", "--initial-branch=main"]);
  const resumedPlanDirectory = await writePlan(tempRoot, "resumed-plan", {
    metadata: { baseCommit: null, schemaVersion: 1, stage: "plan" }
  });
  const resumedPlanResult = await checkChangePlanDirectory(resumedPlanDirectory);
  assert.equal(resumedPlanResult.stage, "plan");
  assert.deepEqual(resumedPlanResult.metadata, {
    baseCommit: null,
    schemaVersion: 1,
    stage: "plan"
  });
  assert.equal(
    resumedPlanResult.assessment?.assessment,
    "plan-review-required"
  );
  assert.equal(resumedPlanResult.valid, false);
  assert.ok(resumedPlanResult.diagnostics.some((diagnostic) => (
    diagnostic.code === "plan-review-required"
    && diagnostic.file === changePlanMetadataName
  )));
  assert.equal(
    resumedPlanResult.diagnostics.some(
      (diagnostic) => diagnostic.code === "invalid-metadata"
    ),
    false
  );
  const resumedArtifactResult = await checkChangePlanArtifactsForStage(
    resumedPlanDirectory,
    "plan"
  );
  assert.equal(resumedArtifactResult.valid, true);
  assert.equal(
    resumedArtifactResult.targetStage,
    "plan"
  );

  const gitShelvedDirectory = await writePlan(tempRoot, "git-shelved", {
    metadata: {
      baseCommit: validBaseCommit,
      schemaVersion: 1,
      shelf: {
        atCommit: validBaseCommit,
        changedLines: 3000,
        commitCount: 1,
        source: "git-distance-v1"
      },
      stage: "shelved"
    }
  });
  assert.equal(
    (await checkChangePlanDirectory(gitShelvedDirectory)).valid,
    true
  );

  const invalidMetadataDirectory = await writePlan(
    tempRoot,
    "invalid-metadata"
  );
  await fs.writeFile(
    path.join(invalidMetadataDirectory, changePlanMetadataName),
    JSON.stringify({ extra: true, schemaVersion: 1, stage: "draft" }),
    "utf8"
  );
  const invalidMetadataResult = await checkChangePlanDirectory(
    invalidMetadataDirectory
  );
  assert.equal(invalidMetadataResult.valid, false);
  assert.equal(invalidMetadataResult.stage, null);
  assert.ok(invalidMetadataResult.diagnostics.some((diagnostic) => (
    diagnostic.code === "invalid-metadata"
    && diagnostic.file === changePlanMetadataName
  )));

  const missingMetadataDirectory = await writePlan(
    tempRoot,
    "missing-metadata",
    { metadata: null }
  );
  const missingMetadataResult = await checkChangePlanDirectory(
    missingMetadataDirectory
  );
  assert.ok(missingMetadataResult.diagnostics.some((diagnostic) => (
    diagnostic.code === "missing-required-file"
    && diagnostic.file === changePlanMetadataName
  )));

  const archivedDirectory = await writePlan(
    path.join(tempRoot, "archive"),
    "historical-change",
    { metadata: null }
  );
  const archivedResult = await checkChangePlanDirectory(archivedDirectory);
  assert.equal(archivedResult.valid, true);
  assert.equal(archivedResult.metadata, null);
  assert.equal(archivedResult.stage, null);
  assert.deepEqual(archivedResult.assessment, {
    assessment: "not-applicable"
  });
}

async function testVersionControlFailure(tempRoot: string): Promise<void> {
  const planDirectory = await writePlan(tempRoot, "unassessable-plan", {
    metadata: { baseCommit: null, schemaVersion: 1, stage: "plan" }
  });
  const result = await checkChangePlanDirectory(planDirectory);
  assert.equal(result.assessment, null);
  assert.equal(result.valid, false);
  assert.ok(result.diagnostics.some((diagnostic) => (
    diagnostic.code === "version-control-failed"
    && diagnostic.file === changePlanMetadataName
  )));
  assert.equal(
    result.diagnostics.some(
      (diagnostic) => diagnostic.code === "plan-review-required"
    ),
    false
  );
}

async function testDirectoryDiagnostics(tempRoot: string): Promise<void> {
  const invalidNameDirectory = await writePlan(tempRoot, "Invalid_Name");
  const invalidNameResult = await checkChangePlanDirectory(invalidNameDirectory);
  assert.equal(invalidNameResult.valid, false);
  assert.ok(
    invalidNameResult.diagnostics.some(
      (diagnostic) => diagnostic.code === "invalid-change-name"
    )
  );

  const missingFileDirectory = await writePlan(tempRoot, "missing-design");
  await fs.rm(path.join(missingFileDirectory, "design.md"));
  const missingFileResult = await checkChangePlanDirectory(missingFileDirectory);
  assert.ok(
    missingFileResult.diagnostics.some(
      (diagnostic) => (
        diagnostic.code === "missing-required-file"
        && diagnostic.file === "design.md"
      )
    )
  );

  const missingDirectoryResult = await checkChangePlanDirectory(
    path.join(tempRoot, "not-created")
  );
  assert.ok(
    missingDirectoryResult.diagnostics.some(
      (diagnostic) => diagnostic.code === "change-directory-not-found"
    )
  );
  const inaccessibleDirectoryResult = await checkChangePlanDirectory(
    `${tempRoot}\0inaccessible-change`
  );
  assert.ok(
    inaccessibleDirectoryResult.diagnostics.some(
      (diagnostic) => diagnostic.code === "change-directory-read-failed"
    )
  );

  const filePath = path.join(tempRoot, "not-a-directory");
  await fs.writeFile(filePath, "file", "utf8");
  const filePathResult = await checkChangePlanDirectory(filePath);
  assert.ok(
    filePathResult.diagnostics.some(
      (diagnostic) => diagnostic.code === "change-path-not-directory"
    )
  );
}

async function testArtifactDiagnostics(tempRoot: string): Promise<void> {
  const invalidProposalDirectory = await writePlan(tempRoot, "invalid-proposal", {
    proposal: `# Proposal

本 change 的 proposal 结构无效。

## Outcome

结果提前出现。

## Why

原因随后出现。

## Scope

范围存在。

## Success Criteria

成功标准存在。

## Affected Owners
`
  });
  const invalidProposalResult = await checkChangePlanDirectory(
    invalidProposalDirectory
  );
  assert.ok(
    invalidProposalResult.diagnostics.some(
      (diagnostic) => diagnostic.code === "section-order"
    )
  );
  assert.ok(
    invalidProposalResult.diagnostics.some(
      (diagnostic) => (
        diagnostic.code === "empty-section"
        && diagnostic.file === "proposal.md"
      )
    )
  );

  const invalidTasksDirectory = await writePlan(tempRoot, "invalid-tasks", {
    tasks: `# Tasks

本 change 的任务结构无效。

## Readiness

- [ ] 0.1 完成准备。

## Implementation

- [ ] no-id 缺少合法编号。
- [ ] 0.1 重复任务编号。

## Verification

尚未形成验证任务。

## Notes

- [ ] 3.1 任务不能放在额外章节。
`
  });
  const invalidTasksResult = await checkChangePlanDirectory(invalidTasksDirectory);
  assert.ok(
    invalidTasksResult.diagnostics.some(
      (diagnostic) => diagnostic.code === "invalid-task-syntax"
    )
  );
  assert.ok(
    invalidTasksResult.diagnostics.some(
      (diagnostic) => diagnostic.code === "duplicate-task-id"
    )
  );
  assert.ok(
    invalidTasksResult.diagnostics.some(
      (diagnostic) => diagnostic.code === "missing-task"
    )
  );
  assert.ok(
    invalidTasksResult.diagnostics.some(
      (diagnostic) => diagnostic.code === "task-outside-required-section"
    )
  );
}

async function testSymbolicLinkDiagnostics(tempRoot: string): Promise<void> {
  const targetDirectory = await writePlan(tempRoot, "linked-target");
  const linkedDirectory = path.join(tempRoot, "linked-change");
  await fs.symlink(
    targetDirectory,
    linkedDirectory,
    process.platform === "win32" ? "junction" : "dir"
  );
  const linkedDirectoryResult = await checkChangePlanDirectory(
    linkedDirectory
  );
  assert.equal(linkedDirectoryResult.assessment, null);
  assert.ok(linkedDirectoryResult.diagnostics.some(
    (diagnostic) => diagnostic.code === "change-path-not-directory"
  ));

  const linkedArtifactDirectory = await writePlan(
    tempRoot,
    "linked-artifact"
  );
  const designTarget = path.join(tempRoot, "design-target.md");
  await fs.writeFile(designTarget, validDesign, "utf8");
  await fs.rm(path.join(linkedArtifactDirectory, "design.md"));
  await fs.symlink(
    designTarget,
    path.join(linkedArtifactDirectory, "design.md"),
    "file"
  );
  const linkedArtifactResult = await checkChangePlanArtifactsForStage(
    linkedArtifactDirectory,
    "plan"
  );
  assert.ok(linkedArtifactResult.diagnostics.some((diagnostic) => (
    diagnostic.code === "required-path-not-file"
    && diagnostic.file === "design.md"
  )));
}

test("check accepts a complete plan with bundled API parity", () => (
  withTempRoot("check-valid", testValidPlan)
));

test("check applies stage-specific artifact contracts", () => (
  withTempRoot("check-stages", testStageArtifactContracts)
));

test("check validates active metadata and preserves archived history", () => (
  withTempRoot("check-metadata", testMetadataAndArchiveBoundaries)
));

test("check reports change directory path diagnostics", () => (
  withTempRoot("check-paths", testDirectoryDiagnostics)
));

test("check reports proposal and task artifact diagnostics", () => (
  withTempRoot("check-artifacts", testArtifactDiagnostics)
));

test("check reports version-control failures without a plan-review assessment", () => (
  withTempRoot("check-version-control", testVersionControlFailure)
));

test("check rejects symbolic-link change directories and artifacts", () => (
  withTempRoot("check-symbolic-links", testSymbolicLinkDiagnostics)
));
