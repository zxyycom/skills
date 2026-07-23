import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkChangePlanDirectory as checkBundledChangePlanDirectory
} from "../../../skills/change-plan/scripts/change-plan.mjs";
import { checkChangePlanDirectory } from "../src/check.ts";

type PlanOverrides = {
  design?: string;
  proposal?: string;
  tasks?: string;
};

const validProposal = `# Proposal

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

const validDesign = `# Design

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

const validTasks = `# Tasks

本 change 先完成准备审计，再实施并验证。

## Readiness

- [x] 0.1 核对目标、范围、owner 和开放问题。

## Implementation

- [ ] 1.1 实现 change-plan skill 与检查器。

## Verification

- [ ] 2.1 运行结构、CLI 和项目级检查。
`;

async function writePlan(
  root: string,
  name: string,
  overrides: PlanOverrides = {}
): Promise<string> {
  const directory = path.join(root, name);
  await fs.mkdir(directory, { recursive: true });
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
    )
  ]);
  return directory;
}

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testsDirectory, "../../..");
const generatedCheckerPath = path.join(
  repositoryRoot,
  "skills/change-plan/scripts/change-plan.mjs"
);
const generatedDeclarationPath = path.join(
  repositoryRoot,
  "skills/change-plan/scripts/change-plan.d.mts"
);
const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "change-plan-test-"));

try {
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

  const missingDirectoryResult = await checkChangePlanDirectory(
    path.join(tempRoot, "not-created")
  );
  assert.ok(
    missingDirectoryResult.diagnostics.some(
      (diagnostic) => diagnostic.code === "change-directory-not-found"
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

  const cliSuccess = spawnSync(
    "node",
    [generatedCheckerPath, "check", validDirectory],
    { encoding: "utf8" }
  );
  assert.equal(cliSuccess.status, 0, cliSuccess.stderr);
  assert.match(cliSuccess.stdout, /Change plan check passed/u);
  assert.equal(cliSuccess.stderr, "");

  const cliFailure = spawnSync(
    "node",
    [generatedCheckerPath, "check", invalidTasksDirectory],
    { encoding: "utf8" }
  );
  assert.equal(cliFailure.status, 1);
  assert.match(cliFailure.stderr, /Change plan check failed/u);
  assert.equal(cliFailure.stdout, "");

  const cliJson = spawnSync(
    "node",
    [generatedCheckerPath, "check", invalidTasksDirectory, "--json"],
    { encoding: "utf8" }
  );
  assert.equal(cliJson.status, 1);
  assert.equal(cliJson.stderr, "");
  const jsonResult = JSON.parse(cliJson.stdout) as { valid: boolean };
  assert.equal(jsonResult.valid, false);

  const help = spawnSync("node", [generatedCheckerPath, "--help"], {
    encoding: "utf8"
  });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Usage: change-plan\.mjs check/u);
  assert.equal(help.stderr, "");

  const invalidArgument = spawnSync("node", [generatedCheckerPath, "check"], {
    encoding: "utf8"
  });
  assert.equal(invalidArgument.status, 2);
  assert.match(invalidArgument.stderr, /Expected:/u);

  const checkerSource = await fs.readFile(generatedCheckerPath, "utf8");
  assert.match(
    checkerSource,
    /Maintained source: https:\/\/github\.com\/zxyycom\/skills\/blob\/main\/tools\/change-plan\/src\/cli\.ts/u
  );
  assert.match(checkerSource, /Rebuild: bun run sync:change-plan-cli/u);
  assert.match(checkerSource, /sourceMappingURL=change-plan\.mjs\.map/u);

  const declarationSource = await fs.readFile(generatedDeclarationPath, "utf8");
  assert.match(declarationSource, /checkChangePlanDirectory/u);
  assert.match(declarationSource, /runChangePlanCli/u);

  const sourceMap = JSON.parse(
    await fs.readFile(`${generatedCheckerPath}.map`, "utf8")
  ) as {
    sourceRoot: string;
    sources: string[];
  };
  assert.equal(sourceMap.sourceRoot, "../../../");
  assert.ok(sourceMap.sources.includes("tools/change-plan/src/cli.ts"));
  assert.ok(
    sourceMap.sources.every(
      (source) => !path.isAbsolute(source) && !source.includes("\\")
    )
  );
} finally {
  await fs.rm(tempRoot, { force: true, recursive: true });
}

console.log("Change plan checker tests passed.");
