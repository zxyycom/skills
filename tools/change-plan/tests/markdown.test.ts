import assert from "node:assert/strict";
import test from "node:test";
import { validateChangePlanArtifact } from "../src/markdown.ts";
import type { ArtifactStructureContract } from "../src/types.ts";

const proposalContract: ArtifactStructureContract = {
  file: "proposal.md",
  h1: "Proposal",
  requiredSections: ["Why", "Outcome"]
};

const tasksContract: ArtifactStructureContract = {
  file: "tasks.md",
  h1: "Tasks",
  requiredSections: ["Readiness", "Implementation", "Verification"],
  taskSections: ["Readiness", "Implementation", "Verification"]
};

const changeProposalContract: ArtifactStructureContract = {
  file: "proposal.md",
  h1: "Proposal",
  requiredSections: ["Why", "Outcome", "Scope"],
  subsectionContracts: [
    {
      ownerSection: "Scope",
      requiredSubsections: ["Intended Change", "Resulting Impacts"]
    }
  ]
};

function proposalWithScope(scope: string): string {
  return `# Proposal

变更摘要。

## Why

变更原因。

## Outcome

预期结果。

## Scope

${scope}
`;
}

test("Markdown semantics normalize CRLF and ignore HTML comments as content", () => {
  const valid = validateChangePlanArtifact(
    "# Proposal\r\n\r\n摘要。\r\n\r\n## Why\r\n\r\n原因。\r\n\r\n## Outcome\r\n\r\n结果。\r\n",
    proposalContract
  );
  assert.deepEqual(valid.diagnostics, []);

  const commentsOnly = validateChangePlanArtifact(
    "# Proposal\r\n\r\n<!-- 摘要 -->\r\n\r\n## Why\r\n\r\n<!-- 原因 -->\r\n\r\n## Outcome\r\n\r\n<!-- 结果 -->\r\n",
    proposalContract
  );
  assert.ok(
    commentsOnly.diagnostics.some(
      (diagnostic) => diagnostic.code === "empty-introduction"
    )
  );
  assert.equal(
    commentsOnly.diagnostics.filter(
      (diagnostic) => diagnostic.code === "empty-section"
    ).length,
    2
  );
});

test("Markdown task counting ignores fenced and commented checklist lookalikes", () => {
  const result = validateChangePlanArtifact(
    `# Tasks

任务摘要。

## Readiness

<!-- - [x] 0.0 注释中的任务。 -->

\`\`\`
- [x] 0.0 代码块中的任务。
\`\`\`

- [x] 0.1 完成准备。

## Implementation

- [ ] 1.1 完成实现。

## Verification

- [ ] 2.1 完成验证。
`,
    tasksContract
  );
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.taskCount, 3);
  assert.equal(result.completedTaskCount, 1);
  assert.deepEqual(result.taskProgress, {
    implementation: { completedTaskCount: 0, taskCount: 1 },
    readiness: { completedTaskCount: 1, taskCount: 1 },
    verification: { completedTaskCount: 0, taskCount: 1 }
  });
});

test("Markdown reports missing required subsections", () => {
  const result = validateChangePlanArtifact(
    proposalWithScope(`### Intended Change

预期调整。`),
    changeProposalContract
  );
  assert.ok(
    result.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "missing-section" &&
        diagnostic.message.includes("Resulting Impacts")
    )
  );
});

test("Markdown reports duplicate required subsections", () => {
  const result = validateChangePlanArtifact(
    proposalWithScope(`### Intended Change

预期调整。

### Resulting Impacts

衍生影响。

### Intended Change

重复的预期调整。`),
    changeProposalContract
  );
  assert.ok(
    result.diagnostics.some(
      (diagnostic) => diagnostic.code === "duplicate-section"
    )
  );
});

test("Markdown reports out-of-order required subsections", () => {
  const result = validateChangePlanArtifact(
    proposalWithScope(`### Resulting Impacts

衍生影响。

### Intended Change

预期调整。`),
    changeProposalContract
  );
  assert.ok(
    result.diagnostics.some((diagnostic) => diagnostic.code === "section-order")
  );
});

test("Markdown reports empty required subsections", () => {
  const result = validateChangePlanArtifact(
    proposalWithScope(`### Intended Change

预期调整。

### Resulting Impacts`),
    changeProposalContract
  );
  assert.ok(
    result.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "empty-section" &&
        diagnostic.message.includes("Resulting Impacts")
    )
  );
});
