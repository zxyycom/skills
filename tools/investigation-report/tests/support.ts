import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StateIndexResult } from "../../index-runtime/src/index.ts";
import { synchronizeInvestigationIndex } from "../src/validation.ts";

export type ExtraSection = {
  body: string;
  title: string;
};

export type ReportEntryInput = {
  background?: string;
  extraSections?: readonly ExtraSection[];
  formedAt?: string;
  purpose?: string;
  resources?: readonly ResourceLinkInput[];
  resultAndBoundary?: string;
  scopeAndBasis?: string;
  title: string;
};

export type ResourceLinkInput = {
  id: string;
  label: string;
};

export type ReportInput = {
  body?: string;
  latestReportAt?: string;
  path: string;
  question: string;
  reports?: readonly ReportEntryInput[];
  status?: string;
  title: string;
};

type CoreSectionCase = ExtraSection & {
  slug: string;
};

export const coreSectionCases: readonly CoreSectionCase[] = [
  {
    body: "当前对象的状态、触发观察和既有认识足以界定本轮结果。",
    slug: "formed-background",
    title: "形成时背景"
  },
  {
    body: "查清当前状态并支持后续判断。",
    slug: "purpose",
    title: "调查目的"
  },
  {
    body: "检查当前对象和一手来源，并记录未覆盖范围。",
    slug: "scope-and-basis",
    title: "调查范围与依据"
  },
  {
    body: "已形成能够回答问题的结果，并保留适用边界和复核条件。",
    slug: "result-and-boundary",
    title: "调查结果与边界"
  }
];

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = path.resolve(testsDirectory, "../../..");
export const generatedCheckerPath = path.join(
  repositoryRoot,
  "skills",
  "investigation-report",
  "scripts",
  "check-investigations.mjs"
);
export const generatedDeclarationPath = path.join(
  repositoryRoot,
  "skills",
  "investigation-report",
  "scripts",
  "check-investigations.d.mts"
);
export const generatedSchemaPath = path.join(
  repositoryRoot,
  "skills",
  "investigation-report",
  "references",
  "investigation-index.schema.json"
);

export function createValidReports(): ReportInput[] {
  return [
    {
      path: "codex/project-shell-registration.md",
      question: "为什么项目 Shell 没有进入可用工具列表？",
      reports: [
        {
          formedAt: "2026-07-20T09:00:00+08:00",
          purpose: "确认注册入口是否工作，并查清当前可用工具状态。",
          resultAndBoundary: "初步确认注册入口没有产生可用工具，尚未验证启动环境。",
          title: "恢复注册入口"
        },
        {
          extraSections: [{
            body: [
              "~~~markdown",
              "# 围栏中的示例标题",
              "## 调查信息",
              "### 围栏中的报告",
              "#### 形成时背景",
              "~~~"
            ].join("\n"),
            title: "证据"
          }],
          formedAt: "2026-07-21T09:00:00+08:00",
          purpose: "重新确认注册链状态和启动环境边界。",
          resultAndBoundary: "当前注册链已经恢复，但结论仍受启动环境约束。",
          scopeAndBasis: "复查注册入口与当前工具列表；未覆盖其他启动方式。",
          title: "复查当前注册状态"
        }
      ],
      title: "项目 Shell 注册调查"
    },
    {
      path: "runtime/process-churn.md",
      question: "哪些运行阶段会形成进程抖动？",
      reports: [{
        formedAt: "2026-07-19T09:00:00+08:00",
        title: "定位进程抖动阶段"
      }],
      status: "暂停",
      title: "运行时进程抖动调查"
    }
  ];
}

export function reportEntryMarkdown(input: ReportEntryInput): string {
  const lines = [
    `### ${input.title}`,
    `- 形成时间: ${input.formedAt ?? "2026-07-21T09:00:00+08:00"}`,
    ...(input.resources === undefined
      ? []
      : [
          "- 随附资源:",
          ...input.resources.map((resource) => (
            `  - [${resource.label}](../_resources/${resource.id})`
          ))
        ]),
    "",
    "#### 形成时背景",
    input.background ?? coreSectionCases[0].body,
    "",
    "#### 调查目的",
    input.purpose ?? coreSectionCases[1].body,
    "",
    "#### 调查范围与依据",
    input.scopeAndBasis ?? coreSectionCases[2].body,
    "",
    "#### 调查结果与边界",
    input.resultAndBoundary ?? coreSectionCases[3].body
  ];
  for (const section of input.extraSections ?? []) {
    lines.push("", `#### ${section.title}`, section.body);
  }
  return lines.join("\n");
}

export function reportBodyWithSections(
  title: string,
  sections: readonly ExtraSection[]
): string {
  return [
    "## 调查报告",
    "",
    `### ${title}`,
    "- 形成时间: 2026-07-21T09:00:00+08:00",
    "",
    ...sections.flatMap((section, index) => [
      `#### ${section.title}`,
      section.body,
      ...(index === sections.length - 1 ? [] : [""])
    ])
  ].join("\n");
}

export function reportMarkdown(input: ReportInput): string {
  const reports = input.reports ?? [{ title: "当前状态调查" }];
  const lastFormedAt = reports.at(-1)?.formedAt
    ?? "2026-07-21T09:00:00+08:00";
  return [
    `# ${input.title}`,
    "",
    "## 调查信息",
    `- 核心问题: ${input.question}`,
    `- 状态: ${input.status ?? "调查中"}`,
    `- 最新报告时间: ${input.latestReportAt ?? lastFormedAt}`,
    "",
    input.body ?? [
      "## 调查报告",
      "",
      ...reports.flatMap((report, index) => [
        reportEntryMarkdown(report),
        ...(index === reports.length - 1 ? [] : [""])
      ])
    ].join("\n"),
    ""
  ].join("\n");
}

export function investigationRoot(workspaceRoot: string): string {
  return path.join(workspaceRoot, "docs", "investigations");
}

export async function writeResource(
  workspaceRoot: string,
  resourceId: string,
  content: string | Uint8Array
): Promise<void> {
  const resourcePath = path.join(
    investigationRoot(workspaceRoot),
    "_resources",
    ...resourceId.split("/")
  );
  await fs.mkdir(path.dirname(resourcePath), { recursive: true });
  await fs.writeFile(resourcePath, content);
}

export async function writeCollection(
  workspaceRoot: string,
  inputs: readonly ReportInput[],
  syncIndex = true
): Promise<void> {
  const collectionRoot = investigationRoot(workspaceRoot);
  await fs.mkdir(collectionRoot, { recursive: true });
  for (const input of inputs) {
    const reportPath = path.join(collectionRoot, ...input.path.split("/"));
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, reportMarkdown(input), "utf8");
  }
  if (syncIndex) {
    const synchronized = await synchronizeInvestigationIndex({
      workspaceRoot
    });
    assert.deepEqual(synchronized.errors, []);
  }
}

export function initializeGitRepository(workspaceRoot: string): void {
  mkdirSync(workspaceRoot, { recursive: true });
  runGit(workspaceRoot, ["init", "--quiet"]);
  runGit(workspaceRoot, ["config", "core.autocrlf", "false"]);
  runGit(workspaceRoot, [
    "config",
    "user.email",
    "investigation-stage@example.invalid"
  ]);
  runGit(workspaceRoot, [
    "config",
    "user.name",
    "Investigation Stage Test"
  ]);
}

export function commitAll(workspaceRoot: string, message: string): void {
  runGit(workspaceRoot, ["add", "--all"]);
  runGit(workspaceRoot, ["commit", "--quiet", "--message", message]);
}

export function readPendingText(
  workspaceRoot: string,
  repositoryPath: string
): string {
  return runGit(workspaceRoot, ["show", `:${repositoryPath}`]);
}

export function pendingPaths(workspaceRoot: string): string[] {
  return runGit(workspaceRoot, [
    "diff",
    "--cached",
    "--name-only",
    "--diff-filter=ACDMRTUXB"
  ]).trim().split("\n").filter((entry) => entry.length > 0);
}

export function runGit(
  workspaceRoot: string,
  arguments_: readonly string[]
): string {
  return execFileSync("git", ["-C", workspaceRoot, ...arguments_], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

export function resultValue<Value>(result: StateIndexResult<Value>): Value {
  assert.equal(
    result.status,
    "ok",
    result.diagnostics.map((entry) => entry.message).join("; ")
  );
  return result.value as Value;
}

export async function withTempRoot(
  suiteName: string,
  run: (tempRoot: string) => Promise<void>
): Promise<void> {
  const tempRoot = await fs.mkdtemp(path.join(
    os.tmpdir(),
    `investigation-report-${suiteName}-`
  ));
  try {
    await run(tempRoot);
  } finally {
    await fs.rm(tempRoot, { force: true, recursive: true });
  }
}
