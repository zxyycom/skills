import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeChangePlanMetadata } from "../src/metadata.ts";
import type { ChangePlanMetadata } from "../src/types.ts";

export type PlanOverrides = {
  design?: string;
  metadata?: ChangePlanMetadata | null;
  proposal?: string;
  tasks?: string;
};

export const validBaseCommit = "0123456789abcdef0123456789abcdef01234567";

export const validImplementationMetadata: ChangePlanMetadata = {
  baseCommit: validBaseCommit,
  schemaVersion: 1,
  stage: "implementation"
};

export const validProposal = `# Proposal

本 change 建立一个可复核的变更计划。

## Why

当前工作缺少持久、可交接的实施计划。

## Outcome

形成能够指导实现与验证的 change artifacts。

## Scope

只处理计划结构和对应检查器。

## Success Criteria

三个 artifact 可独立阅读，并通过结构检查。

## Affected Owners

受影响 owner 为 change-plan skill 和配套工具源码。
`;

export const validDesign = `# Design

本 change 使用三个职责分离的 Markdown artifacts。

## Context

项目已经有稳定事实与长期决策 owner。

## Goals / Non-Goals

目标是保存当前 change 的实施计划；不拥有长期事实。

## Decisions

采用 proposal、design 和 tasks 三文件结构。

## Risks / Trade-offs

固定结构提高可检查性，但不会证明内容正确。

## Open Questions

无未回答开放问题。
`;

export const validTasks = `# Tasks

本 change 先完成准备审计，再实施并验证。

## Readiness

- [x] 0.1 核对目标、范围、owner 和开放问题。

## Implementation

- [ ] 1.1 实现 change-plan skill 与检查器。

## Verification

- [ ] 2.1 运行结构、CLI 和项目级检查。
`;

export const completedTasks = validTasks.replaceAll("- [ ]", "- [x]");

export async function writePlan(
  root: string,
  name: string,
  overrides: PlanOverrides = {}
): Promise<string> {
  const directory = path.join(root, name);
  await fs.mkdir(directory, { recursive: true });
  const metadata = overrides.metadata === undefined
    ? validImplementationMetadata
    : overrides.metadata;
  await Promise.all([
    fs.writeFile(
      path.join(directory, "proposal.md"),
      overrides.proposal ?? validProposal,
      "utf8"
    ),
    fs.writeFile(
      path.join(directory, "design.md"),
      overrides.design ?? validDesign,
      "utf8"
    ),
    fs.writeFile(
      path.join(directory, "tasks.md"),
      overrides.tasks ?? validTasks,
      "utf8"
    ),
    ...(metadata === null
      ? []
      : [writeChangePlanMetadata(directory, metadata)])
  ]);
  return directory;
}

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = path.resolve(testsDirectory, "../../..");
export const generatedCliPath = path.join(
  repositoryRoot,
  "skills/change-plan/scripts/change-plan.mjs"
);
export const generatedDeclarationPath = path.join(
  repositoryRoot,
  "skills/change-plan/scripts/change-plan.d.mts"
);
export const generatedDeclarationDirectory = path.join(
  repositoryRoot,
  "skills/change-plan/scripts/change-plan-sdk"
);
export const generatedMetadataSchemaPath = path.join(
  repositoryRoot,
  "skills/change-plan/references/schemas/change-plan-metadata.schema.json"
);

export async function withTempRoot(
  suiteName: string,
  run: (tempRoot: string) => Promise<void>
): Promise<void> {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), `change-plan-${suiteName}-`)
  );
  try {
    await run(tempRoot);
  } finally {
    await fs.rm(tempRoot, { force: true, recursive: true });
  }
}
