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
assert.deepEqual(
  decisionSourceRevision(revisionCatalog, [...revisionSources].reverse()),
  sourceRevision
);
assert.deepEqual(
  decisionSourceRevision(revisionCatalog, [
    { path: "security/2fa-policy.md", text: "line one\r\nline two\r\n" },
    { path: "workflow/use-approval.md", text: "approval\r\n" }
  ]),
  sourceRevision
);
const changedEntryRevision = decisionSourceRevision(revisionCatalog, [
    { path: "security/2fa-policy.md", text: "line one\nchanged\n" },
    revisionSources[1]!
]);
assert.equal(changedEntryRevision.metadata, sourceRevision.metadata);
assert.notEqual(
  changedEntryRevision.entries["security/2fa-policy.md"],
  sourceRevision.entries["security/2fa-policy.md"]
);
assert.equal(
  changedEntryRevision.entries["workflow/use-approval.md"],
  sourceRevision.entries["workflow/use-approval.md"]
);
const changedCatalogRevision = decisionSourceRevision({
  ...revisionCatalog,
  domains: revisionCatalog.domains.map((domain) => domain.id === "security"
    ? { ...domain, description: "维护安全策略与认证边界。" }
    : domain)
}, revisionSources);
assert.notEqual(changedCatalogRevision.metadata, sourceRevision.metadata);
assert.deepEqual(changedCatalogRevision.entries, sourceRevision.entries);
const removedEntryRevision = decisionSourceRevision(
  revisionCatalog,
  revisionSources.slice(1)
);
assert.equal(removedEntryRevision.metadata, sourceRevision.metadata);
assert.deepEqual(
  Object.keys(removedEntryRevision.entries),
  ["workflow/use-approval.md"]
);
assert.equal(
  removedEntryRevision.entries["workflow/use-approval.md"],
  sourceRevision.entries["workflow/use-approval.md"]
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
const archivedAlignedDocument = {
  ...projection,
  status: "archived",
  alignment: "aligned",
  createdAt: "2026-07-22T10:20:30+08:00"
} satisfies DecisionDocument;

function narrowedStatus(document: DecisionDocument): "active" | "archived" {
  if (document.status === "active") {
    const alignment: "aligned" | "unaligned" = document.alignment;
    assert.ok(alignment === "aligned" || alignment === "unaligned");
    return "active";
  }
  const alignment: "aligned" | "unaligned" | null = document.alignment;
  assert.ok(alignment === null || alignment === "aligned" || alignment === "unaligned");
  return "archived";
}

assert.equal(narrowedStatus(alignedDocument), "active");
assert.equal(narrowedStatus(unalignedDocument), "active");
assert.equal(narrowedStatus(archivedDocument), "archived");
assert.equal(narrowedStatus(archivedAlignedDocument), "archived");

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
