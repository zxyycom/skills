import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  checkChangePlanDirectory as checkBundledChangePlanDirectory
} from "../../../skills/change-plan/scripts/change-plan.mjs";
import { checkChangePlanDirectory } from "../src/check.ts";
import {
  validProposal,
  withTempRoot,
  writePlan
} from "./support.ts";

async function testValidPlan(tempRoot: string): Promise<void> {
  const validDirectory = await writePlan(tempRoot, "add-change-plan");
  const validResult = await checkChangePlanDirectory(validDirectory);
  assert.equal(validResult.valid, true);
  assert.deepEqual(validResult.diagnostics, []);
  assert.equal(validResult.taskCount, 3);
  assert.equal(validResult.completedTaskCount, 1);
  assert.deepEqual(
    await checkBundledChangePlanDirectory(validDirectory),
    validResult
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

test("check accepts a complete plan with bundled API parity", () => (
  withTempRoot("check-valid", testValidPlan)
));

test("check reports change directory path diagnostics", () => (
  withTempRoot("check-paths", testDirectoryDiagnostics)
));

test("check reports proposal and task artifact diagnostics", () => (
  withTempRoot("check-artifacts", testArtifactDiagnostics)
));
