import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { serializeInvestigationReportFrontmatter } from "../src/markdown.ts";
import { synchronizeInvestigationIndex } from "../src/validation.ts";
import type { InvestigationRelation } from "../src/types.ts";

export type ReportFixture = Readonly<{
  formedAt?: string;
  id: string;
  question?: string;
  relations?: readonly InvestigationRelation[];
  resources?: readonly string[];
  tags?: readonly string[];
  title?: string;
}>;

export function reportMarkdown(input: ReportFixture): string {
  return [
    serializeInvestigationReportFrontmatter({
      formedAt: input.formedAt ?? "2026-08-28T12:00:00+00:00",
      question: input.question ?? "当前问题是什么？",
      relations: input.relations ?? [],
      tags: input.tags ?? ["investigation-report"],
      title: input.title ?? input.id.slice(0, -3)
    }),
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
