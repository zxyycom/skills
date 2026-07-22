import assert from "node:assert/strict";
import path from "node:path";
import {
  isDecisionRelativePath,
  isNewDecisionIdentityPath
} from "../src/decision-path.ts";
import { validateDecisionBody } from "../src/record.ts";
import type {
  DecisionDocument,
  DecisionProjection
} from "../src/types.ts";

assert.equal(
  isNewDecisionIdentityPath("decision-records/use-semantic-paths.md"),
  true
);
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
  false
);
assert.equal(
  isNewDecisionIdentityPath("decision-records/use-2026-07-22-paths.md"),
  false
);
assert.equal(
  isDecisionRelativePath("decision-records/260722-use-semantic-paths.md"),
  true
);

const projection: DecisionProjection = {
  background: "该对象只用于证明生命周期和对齐字段的类型组合。",
  decision: "对齐状态只由 alignment 字段表达。",
  purpose: "证明文档类型不依赖额外的对齐说明结构。",
  relations: [],
  title: "验证文档字段约束"
};
const alignedDocument = {
  ...projection,
  alignment: "aligned",
  createdAt: "2026-07-22T10:20:30+08:00",
  status: "active"
} satisfies DecisionDocument;
const unalignedDocument = {
  ...projection,
  alignment: "unaligned",
  createdAt: "2026-07-22T10:20:30+08:00",
  status: "active"
} satisfies DecisionDocument;
const archivedDocument = {
  ...projection,
  alignment: null,
  createdAt: "2026-07-22T10:20:30+08:00",
  status: "archived"
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
    "status: active",
    "alignment: unaligned",
    "createdAt: 2026-07-22T10:20:30+08:00",
    "---",
    "",
    "# 采用 2FA 安全策略",
    "",
    "## 索引摘要",
    "- 目的: 让语义明确的安全术语可以直接形成稳定决策身份。",
    "- 背景: 数字开头的领域术语不等于日期或形成时间。",
    "- 决策: 允许 2fa 等语义 slug，同时继续拒绝日期 token。",
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
  decisionPath: path.join(decisionsDirectory, relativePath),
  decisionsDirectory,
  errors,
  fileName: "2fa-policy.md",
  relativePath
});

assert.deepEqual(errors, []);
assert.ok(document);
assert.equal(document.status, "active");
assert.equal(document.alignment, "unaligned");
