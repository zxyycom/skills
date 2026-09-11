import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  checkChangePlanDirectory,
  checkChangePlanDirectoryForPlan
} from "../src/check.ts";
import { readChangePlanMetadata } from "../src/metadata.ts";
import { validDesign, writePlan } from "./support.ts";

const minimalDraftProposal = `# Proposal

本 change 记录一个仍在起草的方向。

## Why

当前方向需要先形成可识别记录。

## Outcome

方向具备继续收敛为完整计划所需的最小背景。
`;

const initialDraftDesign = `# Design

本 change 保存进入计划前仍可继续修订的初始设计。

## Context

当前目标已经明确，但实现边界仍需在计划确认前继续核对。

## Goals / Non-Goals

初始目标是确定可行方向；暂不固化实施任务。

## Decisions

### Intended Change

当前采用最小可行方向，具体细节仍可随计划收敛。

### Resulting Impacts

计划确认前需要同步受影响 owner 和验证边界。

## Risks / Trade-offs

过早固化细节会增加无效维护，但缺少方向会阻断任务派生。

## Open Questions

计划确认前仍需核对受影响 owner。
`;

export async function testValidPlan(tempRoot: string): Promise<void> {
  const validDirectory = await writePlan(
    path.join(tempRoot, "changes"),
    "add-change-plan"
  );
  const validResult = await checkChangePlanDirectory(validDirectory);
  assert.equal(validResult.valid, true);
  assert.deepEqual(validResult.diagnostics, []);
  assert.equal(validResult.taskCount, 3);
  assert.equal(validResult.completedTaskCount, 1);
  assert.equal(validResult.stage, "plan");
  assert.deepEqual(
    await readChangePlanMetadata(validDirectory),
    validResult.metadata
  );
  assert.deepEqual(validResult.distance, {
    baseCommit:
      validResult.metadata?.stage === "plan"
        ? validResult.metadata.baseCommit
        : "",
    changedLines: 0,
    commitCount: 0,
    headCommit:
      validResult.metadata?.stage === "plan"
        ? validResult.metadata.baseCommit
        : ""
  });
  assert.deepEqual(validResult.taskProgress, {
    implementation: { completedTaskCount: 0, taskCount: 1 },
    readiness: { completedTaskCount: 1, taskCount: 1 },
    verification: { completedTaskCount: 0, taskCount: 1 }
  });
}

export async function testStageArtifactContracts(
  tempRoot: string
): Promise<void> {
  await assertDraftArtifactContract(tempRoot);
  await assertPlanTargetArtifactContract(tempRoot);
}

async function assertDraftArtifactContract(tempRoot: string): Promise<void> {
  const draftDirectory = await writePlan(
    path.join(tempRoot, "changes"),
    "draft-change",
    {
      design: initialDraftDesign,
      metadata: { stage: "draft" },
      proposal: minimalDraftProposal
    }
  );
  await fs.rm(path.join(draftDirectory, "tasks.md"));
  const draftResult = await checkChangePlanDirectory(draftDirectory);
  assert.equal(draftResult.valid, true);
  assert.equal(draftResult.stage, "draft");
  assert.equal(draftResult.taskCount, 0);
  assert.deepEqual(draftResult.taskProgress, {
    implementation: { completedTaskCount: 0, taskCount: 0 },
    readiness: { completedTaskCount: 0, taskCount: 0 },
    verification: { completedTaskCount: 0, taskCount: 0 }
  });
  await assertDraftRequiresStructuredScope(draftDirectory);
  await fs.rm(path.join(draftDirectory, "design.md"));
  const incompleteDraftResult = await checkChangePlanDirectory(draftDirectory);
  assert.equal(incompleteDraftResult.valid, false);
  assert.ok(
    incompleteDraftResult.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "missing-required-file" &&
        diagnostic.file === "design.md"
    )
  );
}

async function assertDraftRequiresStructuredScope(
  draftDirectory: string
): Promise<void> {
  await fs.writeFile(
    path.join(draftDirectory, "proposal.md"),
    `${minimalDraftProposal}\n## Scope\n\n仍在收敛的范围。\n`,
    "utf8"
  );
  const result = await checkChangePlanDirectory(draftDirectory);
  assert.ok(
    result.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "missing-section" &&
        diagnostic.file === "proposal.md" &&
        diagnostic.message.includes("Intended Change")
    )
  );
  await fs.writeFile(
    path.join(draftDirectory, "proposal.md"),
    minimalDraftProposal,
    "utf8"
  );
}

async function assertPlanTargetArtifactContract(
  tempRoot: string
): Promise<void> {
  const planTargetDirectory = await writePlan(
    path.join(tempRoot, "changes"),
    "plan-target",
    {
      metadata: { stage: "draft" }
    }
  );
  const targetResult =
    await checkChangePlanDirectoryForPlan(planTargetDirectory);
  assert.equal(targetResult.valid, true);
  assert.equal(targetResult.stage, "draft");
  assert.equal(targetResult.taskCount, 3);
  await assertPlanTargetRequiresDecisionSubsections(planTargetDirectory);
  await fs.rm(path.join(planTargetDirectory, "tasks.md"));
  const incompleteTargetResult =
    await checkChangePlanDirectoryForPlan(planTargetDirectory);
  assert.equal(incompleteTargetResult.valid, false);
  assert.ok(
    incompleteTargetResult.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "missing-required-file" &&
        diagnostic.file === "tasks.md"
    )
  );
}

async function assertPlanTargetRequiresDecisionSubsections(
  planTargetDirectory: string
): Promise<void> {
  await fs.writeFile(
    path.join(planTargetDirectory, "design.md"),
    validDesign.replace(
      `## Decisions

### Intended Change

采用 proposal、design 和 tasks 三文件结构。

### Resulting Impacts

同步 metadata、检查器和验证入口。`,
      `## Decisions

采用 proposal、design 和 tasks 三文件结构。`
    ),
    "utf8"
  );
  const result = await checkChangePlanDirectoryForPlan(planTargetDirectory);
  assert.ok(
    result.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "missing-section" && diagnostic.file === "design.md"
    )
  );
  await fs.writeFile(
    path.join(planTargetDirectory, "design.md"),
    validDesign,
    "utf8"
  );
}
