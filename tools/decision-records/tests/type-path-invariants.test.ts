import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  isDecisionDomainId,
  isDecisionRelativePath,
  isNewDecisionIdentityPath,
  normalizeDecisionRelativePath
} from "../src/decision-path.ts";
import { decisionSourceRevision } from "../src/decision-state-index.ts";
import { validateDecisionBody } from "../src/record.ts";
import type {
  DecisionDocument,
  DecisionProjection
} from "../src/types.ts";

test("decision types and paths preserve identity and alignment invariants", async () => {
assert.equal(
  isNewDecisionIdentityPath("decision-records/use-semantic-paths.md"),
  true
);
assert.equal(isDecisionDomainId("security-policy"), true);
assert.equal(isDecisionDomainId("Invalid_Domain"), false);
assert.equal(
  isNewDecisionIdentityPath("decision-records/use-v2-paths.md"),
  true
);
assert.equal(
  isNewDecisionIdentityPath("security/2fa-policy.md"),
  true
);
assert.equal(
  isNewDecisionIdentityPath("decision-records/260722-use-semantic-paths.md"),
  false
);
assert.equal(
  isNewDecisionIdentityPath("2026-records/use-semantic-paths.md"),
  true
);
assert.equal(
  isNewDecisionIdentityPath("decision-records/use-2026-07-22-paths.md"),
  false
);
assert.equal(
  isDecisionRelativePath("decision-records/260722-use-semantic-paths.md"),
  true
);
assert.equal(
  normalizeDecisionRelativePath(".\\decision-records\\use-semantic-paths.md"),
  "decision-records/use-semantic-paths.md"
);

const revisionSources = [
  { path: "security/2fa-policy.md", text: "line one\nline two\n" },
  { path: "workflow/use-approval.md", text: "approval\n" }
];
const revisionCatalog = {
  schemaVersion: 1 as const,
  domains: [
    { id: "security", description: "维护安全策略与身份验证责任边界。" },
    { id: "workflow", description: "维护工作流执行与审批责任边界。" }
  ]
};
const sourceRevision = decisionSourceRevision(revisionCatalog, revisionSources);
assert.equal(
  decisionSourceRevision(revisionCatalog, [...revisionSources].reverse()),
  sourceRevision
);
assert.equal(
  decisionSourceRevision(revisionCatalog, [
    { path: "security/2fa-policy.md", text: "line one\r\nline two\r\n" },
    { path: "workflow/use-approval.md", text: "approval\r\n" }
  ]),
  sourceRevision
);
assert.notEqual(
  decisionSourceRevision(revisionCatalog, [
    { path: "security/2fa-policy.md", text: "line one\nchanged\n" },
    revisionSources[1]!
  ]),
  sourceRevision
);

const projection: DecisionProjection = {
  title: "验证文档字段约束",
  purpose: "证明文档类型不依赖额外的对齐说明结构。",
  background: "该对象只用于证明生命周期和对齐字段的类型组合。",
  decision: "对齐状态只由 alignment 字段表达。",
  relations: [],
};
const alignedDocument = {
  ...projection,
  status: "active",
  alignment: "aligned",
  createdAt: "2026-07-22T10:20:30+08:00"
} satisfies DecisionDocument;
const unalignedDocument = {
  ...projection,
  status: "active",
  alignment: "unaligned",
  createdAt: "2026-07-22T10:20:30+08:00"
} satisfies DecisionDocument;
const archivedDocument = {
  ...projection,
  status: "archived",
  alignment: null,
  createdAt: "2026-07-22T10:20:30+08:00"
} satisfies DecisionDocument;

function narrowedStatus(document: DecisionDocument): "active" | "archived" {
  if (document.alignment === null) {
    const status: "archived" = document.status;
    return status;
  }
  const status: "active" = document.status;
  return status;
}

assert.equal(narrowedStatus(alignedDocument), "active");
assert.equal(narrowedStatus(unalignedDocument), "active");
assert.equal(narrowedStatus(archivedDocument), "archived");

const relativePath = "security/2fa-policy.md";
const decisionsDirectory = path.resolve("decision-records-test-data");
const errors: string[] = [];
const document = await validateDecisionBody({
  body: [
    "---",
    "title: 采用 2FA 安全策略",
    "status: active",
    "alignment: unaligned",
    "createdAt: 2026-07-22T10:20:30+08:00",
    "purpose: 让语义明确的安全术语可以直接形成稳定决策身份。",
    "background: 数字开头的领域术语不等于日期或形成时间。",
    "decision: 允许 2fa 等语义 slug，同时继续拒绝日期 token。",
    "relations: []",
    "---",
    "",
    "## 目的",
    "- 让语义明确的安全术语可以直接形成稳定决策身份。",
    "",
    "## 背景",
    "- 数字开头的领域术语不等于日期或形成时间。",
    "",
    "## 决策",
    "- 采用: 允许 2fa 等语义 slug，同时继续拒绝日期 token。",
    ""
  ].join("\n"),
  decisionsDirectory,
  errors,
  fileName: "2fa-policy.md",
  relativePath
});

assert.deepEqual(errors, []);
assert.ok(document);
assert.equal(document.status, "active");
assert.equal(document.alignment, "unaligned");
});
