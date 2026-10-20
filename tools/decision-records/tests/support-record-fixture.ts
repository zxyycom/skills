import assert from "node:assert/strict";
import path from "node:path";
import { isDecisionId } from "../src/decision-path.ts";
import type { DecisionId } from "../src/types.ts";

export const currentDecisionId = decisionIdForTest("use-generated-cli");
export const archivedDecisionId = decisionIdForTest("260710-use-source-cli");
export const currentSourcePath = "use-generated-cli.md";
export const archivedSourcePath = "archive/260710-use-source-cli.md";
// Historical test names refer to the collection identity, never its sourcePath.
export const currentRelativePath = currentDecisionId;
export const archivedRelativePath = archivedDecisionId;

let implicitCandidateId: string | null = null;

export function decisionFilePath(
  workspaceRoot: string,
  sourcePath: string
): string {
  const normalizedSourcePath = sourcePathForTest(sourcePath);
  implicitCandidateId = normalizedSourcePath
    .replace(/^archive\//u, "")
    .replace(/\.md$/iu, "");
  return path.join(
    workspaceRoot,
    "docs",
    "decisions",
    ...normalizedSourcePath.split("/")
  );
}

export function candidateDecisionBody(
  options: {
    id?: string;
    relations?: readonly { summary?: string; target: string; type: string }[];
    tags?: readonly string[];
    title?: string;
  } = {}
): string {
  const relations = options.relations ?? [];
  return [
    "---",
    `title: ${options.title ?? "使用 Markdown 建立状态"}`,
    `id: ${options.id ?? implicitCandidateId ?? "candidate"}`,
    "status: candidate",
    "alignment: null",
    "createdAt: null",
    "purpose: 验证 Markdown 生命周期独立定义候选和已建立状态。",
    "background: 索引和版本历史不应共同承担决策成员身份。",
    "decision: 使用显式 candidate 状态区分候选与已建立决策。",
    "tags:",
    ...(options.tags ?? ["decision-records"]).map((tag) => `  - ${tag}`),
    relations.length === 0 ? "relations: []" : "relations:",
    ...relations.flatMap((relation) => [
      `  - type: ${relation.type}`,
      `    target: ${relation.target.replace(/\.md$/iu, "")}`,
      ...(relation.summary === undefined
        ? []
        : [`    summary: ${relation.summary}`])
    ]),
    "---",
    "",
    "## 目的",
    "- 验证 Markdown 生命周期独立定义候选和已建立状态。",
    "",
    "## 背景",
    "- 索引和版本历史不应共同承担决策成员身份。",
    "",
    "## 决策",
    "- 采用: 使用显式 candidate 状态区分候选与已建立决策。",
    ""
  ].join("\n");
}

export function sourcePathForTest(value: string): string {
  const archived = value.startsWith("archive/");
  const basename = archived ? value.slice("archive/".length) : value;
  if (!isDecisionId(basename)) return value;
  return (archived ? "archive/" : "") + basename + ".md";
}

export function decisionIdForTest(value: string): DecisionId {
  const normalized = value.replace(/\.md$/iu, "");
  assert.ok(isDecisionId(normalized), `Expected Decision ID ${value}`);
  return normalized;
}
