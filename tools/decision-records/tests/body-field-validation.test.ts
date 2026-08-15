import assert from "node:assert/strict";
import test from "node:test";
import { validateDecisionBody } from "../src/record.ts";

const sourcePath = "accept-equivalent-punctuation.md";
const listMarkers = ["-", "*", "+"] as const;
const fieldSeparators = [":", "："] as const;
const missingFieldError =
  sourcePath + ' must include non-empty field "- 采用: <value>"';

function decisionBody(fieldLine: string): string {
  return [
    "---",
    "title: 接受等价正文符号",
    "status: active",
    "alignment: aligned",
    "createdAt: 2026-08-03T10:20:30+08:00",
    "purpose: 避免常见等价符号阻断决策正文的基础结构校验。",
    "background: 人工编写的 Markdown 可能使用不同的等价列表标记或冒号。",
    "decision: 校验接受明确列出的等价符号，同时保持字段语义严格。",
    "tags:",
    "  - decision-records",
    "relations: []",
    "---",
    "",
    "## 目的",
    "- 避免常见等价符号阻断决策正文的基础结构校验。",
    "",
    "## 背景",
    "- 人工编写的 Markdown 可能使用不同的等价列表标记或冒号。",
    "",
    "## 决策",
    fieldLine,
    ""
  ].join("\n");
}

async function validateFieldLine(fieldLine: string) {
  const errors: string[] = [];
  const document = await validateDecisionBody({
    body: decisionBody(fieldLine),
    decisionId: "accept-equivalent-punctuation.md",
    errors,
    sourcePath,
    targetExists: () => false
  });
  return { document, errors };
}

test("decision body fields accept common equivalent punctuation", async () => {
  for (const marker of listMarkers) {
    for (const separator of fieldSeparators) {
      const fieldLine = `${marker} 采用${separator} 保持字段语义严格。`;
      const { document, errors } = await validateFieldLine(fieldLine);
      assert.deepEqual(errors, [], fieldLine);
      assert.ok(document, fieldLine);
    }
  }
});

test("decision body fields require non-empty values on the field line", async () => {
  for (const marker of listMarkers) {
    for (const separator of fieldSeparators) {
      const fieldLine = `${marker} 采用${separator}   `;
      const { document, errors } = await validateFieldLine(fieldLine);
      assert.equal(document, null, fieldLine);
      assert.deepEqual(errors, [missingFieldError], fieldLine);
    }
  }

  const fieldLine = "- 采用:\n- 备注: 下一行不能作为采用值。";
  const { document, errors } = await validateFieldLine(fieldLine);
  assert.equal(document, null, fieldLine);
  assert.deepEqual(errors, [missingFieldError], fieldLine);
});

test("decision body fields reject unsupported punctuation", async () => {
  for (const fieldLine of [
    "• 采用: 保持字段语义严格。",
    "- 采用; 保持字段语义严格。"
  ]) {
    const { document, errors } = await validateFieldLine(fieldLine);
    assert.equal(document, null, fieldLine);
    assert.deepEqual(errors, [missingFieldError], fieldLine);
  }
});
