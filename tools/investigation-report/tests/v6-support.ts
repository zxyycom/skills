import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { synchronizeInvestigationIndex } from "../src/validation.ts";
import {
  investigationRelationTypes,
  type InvestigationRelation
} from "../src/types.ts";

export type ReportFixture = Readonly<{
  formedAt?: string;
  id: string;
  question?: string;
  relations?: readonly InvestigationRelation[];
  resources?: readonly string[];
  tags?: readonly string[];
  title?: string;
}>;

export type InvestigationCliResult = Readonly<{
  status: number | null;
  stderr: string;
  stdout: string;
}>;

const generatedCliPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../skills/investigation-report/scripts/check-investigations.mjs"
);

export function reportMarkdown(input: ReportFixture): string {
  const relations = [...(input.relations ?? [])].sort((left, right) => {
    const typeOrder =
      investigationRelationTypes.indexOf(left.type) -
      investigationRelationTypes.indexOf(right.type);
    return typeOrder === 0 ? compareText(left.target, right.target) : typeOrder;
  });
  return [
    "---",
    `title: ${JSON.stringify(input.title ?? input.id.slice(0, -3))}`,
    `formedAt: ${JSON.stringify(input.formedAt ?? "2026-08-28T12:00:00+00:00")}`,
    `question: ${JSON.stringify(input.question ?? "当前问题是什么？")}`,
    "tags:",
    ...(input.tags ?? ["investigation-report"])
      .slice()
      .sort(compareText)
      .map((tag) => `  - ${JSON.stringify(tag)}`),
    ...(relations.length === 0
      ? ["relations: []"]
      : [
          "relations:",
          ...relations.flatMap((relation) => [
            `  - type: ${JSON.stringify(relation.type)}`,
            `    target: ${JSON.stringify(relation.target)}`
          ])
        ]),
    "---",
    "",
    "## 形成时背景",
    "形成此报告时的已知事实和边界。",
    "",
    "## 调查目的",
    "回答本轮直接问题。",
    "",
    "## 调查范围与依据",
    "检查当前实现和可定位的一手依据。",
    "",
    "## 调查结果与边界",
    "已形成结果，仍保留适用条件和未知。",
    ...(input.resources === undefined
      ? []
      : [
          "",
          "## 随附资源",
          ...input.resources.map((id) => `- [资源 ${id}](./_resources/${id})`)
        ]),
    ""
  ].join("\n");
}

export function investigationRoot(workspaceRoot: string): string {
  return path.join(workspaceRoot, "docs", "investigations");
}

export function runGeneratedInvestigationCli(
  workspaceRoot: string,
  args: readonly string[]
): InvestigationCliResult {
  const result = spawnSync(
    "node",
    [generatedCliPath, ...args, "--root", workspaceRoot],
    { encoding: "utf8" }
  );
  assert.equal(
    result.error,
    undefined,
    `could not run generated investigation CLI with node: ${result.error?.message ?? "unknown spawn failure"}`
  );
  return {
    status: result.status,
    stderr: result.stderr ?? "",
    stdout: result.stdout ?? ""
  };
}

export function parseJsonObject(text: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(text);
  assert.ok(isJsonObject(parsed), "expected JSON object");
  return parsed;
}

export function jsonObjectMember(
  object: Readonly<Record<string, unknown>>,
  member: string
): Record<string, unknown> {
  const value = object[member];
  assert.ok(isJsonObject(value), `expected JSON object member ${member}`);
  return value;
}

export async function writeCollection(
  workspaceRoot: string,
  reports: readonly ReportFixture[],
  sync = true
): Promise<void> {
  const root = investigationRoot(workspaceRoot);
  await fs.mkdir(root, { recursive: true });
  for (const report of reports) {
    await fs.writeFile(
      path.join(root, report.id),
      reportMarkdown(report),
      "utf8"
    );
  }
  if (sync) {
    const result = await synchronizeInvestigationIndex({ workspaceRoot });
    assert.deepEqual(result.errors, []);
  }
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function withTempRoot(
  suiteName: string,
  run: (root: string) => Promise<void>
): Promise<void> {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), `investigation-report-${suiteName}-`)
  );
  try {
    await run(root);
  } finally {
    await fs.rm(root, { force: true, recursive: true });
  }
}
