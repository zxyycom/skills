import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  runInvestigationReportCheckCli,
  validateInvestigationReports as validateBundledInvestigationReports
} from "../../../skills/investigation-report/scripts/check-investigations.mjs";
import { validateInvestigationReports } from "../src/validation.ts";

type ReportInput = {
  body?: string;
  currentUnderstanding?: string;
  firstFormedAt?: string;
  origin?: string;
  path: string;
  question: string;
  recordFormedAt?: string;
  scope?: string;
  status?: string;
  title: string;
  updatedAt?: string;
};

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testsDirectory, "../../..");
const generatedCheckerPath = path.join(
  rootDir,
  "skills",
  "investigation-report",
  "scripts",
  "check-investigations.mjs"
);
const generatedDeclarationPath = path.join(
  rootDir,
  "skills",
  "investigation-report",
  "scripts",
  "check-investigations.d.mts"
);

function reportMarkdown(input: ReportInput): string {
  const firstFormedAt = input.firstFormedAt ?? "2026-07-20T09:00:00+08:00";
  const recordFormedAt = input.recordFormedAt ?? firstFormedAt;
  return [
    `# ${input.title}`,
    "",
    "## 调查概述",
    `- 起因: ${input.origin ?? "观察到需要进一步理解的现象。"}`,
    `- 核心问题: ${input.question}`,
    `- 调查范围: ${input.scope ?? "当前项目与可复核的一手材料。"}`,
    `- 当前认识: ${input.currentUnderstanding ?? "已有部分事实，仍保留明确未知。"}`,
    `- 状态: ${input.status ?? "调查中"}`,
    `- 首次形成时间: ${firstFormedAt}`,
    `- 最近更新时间: ${input.updatedAt ?? "2026-07-21T09:00:00+08:00"}`,
    "",
    input.body ?? [
      "## 调查记录",
      "",
      "### 初始调查",
      `- 形成时间: ${recordFormedAt}`,
      "",
      "本轮按问题组织证据、结果、推断和认识边界。"
    ].join("\n"),
    ""
  ].join("\n");
}

function indexMarkdown(inputs: readonly ReportInput[]): string {
  const byTopic = new Map<string, ReportInput[]>();
  for (const input of inputs) {
    const topic = input.path.split("/")[0];
    const topicReports = byTopic.get(topic) ?? [];
    topicReports.push(input);
    byTopic.set(topic, topicReports);
  }

  const lines = [
    "# 调查索引",
    "",
    "本索引只用于定位调查。",
    ""
  ];
  for (const [topic, reports] of [...byTopic].sort(([left], [right]) => (
    left.localeCompare(right)
  ))) {
    lines.push(`## ${topic}`, "");
    for (const report of reports) {
      lines.push(
        `- [${report.title}](${report.path})`,
        `  - 核心问题: ${report.question}`,
        `  - 状态: ${report.status ?? "调查中"}`,
        `  - 最近更新时间: ${report.updatedAt ?? "2026-07-21T09:00:00+08:00"}`,
        ""
      );
    }
  }
  return lines.join("\n");
}

async function writeCollection(
  workspaceRoot: string,
  inputs: readonly ReportInput[],
  indexInputs: readonly ReportInput[] = inputs
): Promise<void> {
  const investigationRoot = path.join(workspaceRoot, "docs", "investigations");
  await fs.mkdir(investigationRoot, { recursive: true });
  await fs.writeFile(
    path.join(investigationRoot, "investigation-index.md"),
    indexMarkdown(indexInputs),
    "utf8"
  );
  for (const input of inputs) {
    const reportPath = path.join(investigationRoot, ...input.path.split("/"));
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, reportMarkdown(input), "utf8");
  }
}

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "investigation-report-test-"));
try {
  const validRoot = path.join(tempRoot, "valid");
  const validReports: ReportInput[] = [
    {
      body: [
        "## 调查记录",
        "",
        "### 注册机制调查",
        "- 形成时间: 2026-07-20T09:00:00+08:00",
        "",
        "~~~markdown",
        "# 围栏中的示例标题",
        "## 调查概述",
        "### 围栏中的调查段",
        "~~~"
      ].join("\n"),
      path: "codex/project-shell-registration.md",
      question: "为什么项目 Shell 没有进入可用工具列表？",
      title: "项目 Shell 注册调查"
    },
    {
      path: "runtime/process-churn.md",
      question: "哪些运行阶段会形成进程抖动？",
      status: "暂停",
      title: "运行时进程抖动调查"
    }
  ];
  await writeCollection(validRoot, validReports);

  const valid = await validateInvestigationReports({ workspaceRoot: validRoot });
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.availableReportCount, 2);
  assert.equal(valid.selectedReportCount, 2);
  assert.equal(valid.topicCount, 2);
  assert.deepEqual(await validateBundledInvestigationReports({ workspaceRoot: validRoot }), valid);
  assert.equal(typeof runInvestigationReportCheckCli, "function");

  const topicFiltered = await validateInvestigationReports({
    topics: ["codex"],
    workspaceRoot: validRoot
  });
  assert.deepEqual(topicFiltered.errors, []);
  assert.equal(topicFiltered.selectedReportCount, 1);
  assert.equal(topicFiltered.topicCount, 1);

  const reportFiltered = await validateInvestigationReports({
    reports: ["runtime\\process-churn.md"],
    workspaceRoot: validRoot
  });
  assert.deepEqual(reportFiltered.errors, []);
  assert.equal(reportFiltered.selectedReportCount, 1);

  const noIntersection = await validateInvestigationReports({
    reports: ["runtime/process-churn.md"],
    topics: ["codex"],
    workspaceRoot: validRoot
  });
  assert.ok(noIntersection.errors.includes("no investigation reports matched the requested filters"));

  const cliSuccess = spawnSync("node", [generatedCheckerPath, "--root", validRoot], {
    encoding: "utf8"
  });
  assert.equal(cliSuccess.status, 0, cliSuccess.stderr);
  assert.match(cliSuccess.stdout, /2 of 2 reports checked across 2 topics/);

  const cliFiltered = spawnSync(
    "node",
    [
      generatedCheckerPath,
      "--root",
      validRoot,
      "--report",
      "codex/project-shell-registration.md"
    ],
    { encoding: "utf8" }
  );
  assert.equal(cliFiltered.status, 0, cliFiltered.stderr);
  assert.match(cliFiltered.stdout, /1 of 2 reports checked across 1 topics/);

  const dateSemanticRoot = path.join(tempRoot, "date-semantic-path");
  const dateSemanticReport: ReportInput = {
    path: "runtime/2026-07-21-process-churn.md",
    question: "检查器是否避免猜测文件名中的日期语义？",
    firstFormedAt: "2026-07-21T10:00:00+08:00",
    title: "日期语义边界调查",
    updatedAt: "2026-07-21T03:00:00Z"
  };
  await writeCollection(dateSemanticRoot, [dateSemanticReport]);
  const dateSemantic = await validateInvestigationReports({
    workspaceRoot: dateSemanticRoot
  });
  assert.deepEqual(dateSemantic.errors, []);

  const rootLevelMarkdownRoot = path.join(tempRoot, "root-level-markdown");
  await writeCollection(rootLevelMarkdownRoot, [dateSemanticReport]);
  await fs.writeFile(
    path.join(rootLevelMarkdownRoot, "docs", "investigations", "scratch.md"),
    reportMarkdown({
      path: "scratch.md",
      question: "调查根目录是否只接受统一格式的主题报告？",
      title: "根目录额外文档调查"
    }),
    "utf8"
  );
  const rootLevelMarkdown = await validateInvestigationReports({
    workspaceRoot: rootLevelMarkdownRoot
  });
  assert.ok(rootLevelMarkdown.errors.some((error) => (
    error.includes("scratch.md must use <topic-id>/<semantic-slug>.md")
  )));

  const invalidRoot = path.join(tempRoot, "invalid");
  const goodReport: ReportInput = {
    path: "codex/good-report.md",
    question: "哪些事实能够解释当前现象？",
    title: "有效调查"
  };
  const invalidReport: ReportInput = {
    currentUnderstanding: "",
    path: "runtime/invalid-report.md",
    question: "这个索引问题会被正文改写。",
    firstFormedAt: "2026-07-22T09:00:00+08:00",
    status: "完成",
    title: "无效调查",
    updatedAt: "2026-07-21T09:00:00+08:00"
  };
  const invalidTimestampReport: ReportInput = {
    path: "runtime/invalid-timestamp.md",
    question: "缺少秒级时区的时间是否会被识别？",
    firstFormedAt: "2026-07-20",
    title: "无效时间调查"
  };
  const missingReport: ReportInput = {
    path: "ghost/missing-report.md",
    question: "缺失文件是否会被识别？",
    title: "缺失调查"
  };
  await writeCollection(invalidRoot, [goodReport, invalidReport, invalidTimestampReport], [
    goodReport,
    { ...invalidReport, question: "索引中的不同问题。" },
    invalidTimestampReport,
    missingReport
  ]);
  const unindexed: ReportInput = {
    path: "other/unindexed-report.md",
    question: "未索引文件是否会被识别？",
    title: "未索引调查"
  };
  const unindexedPath = path.join(
    invalidRoot,
    "docs",
    "investigations",
    ...unindexed.path.split("/")
  );
  await fs.mkdir(path.dirname(unindexedPath), { recursive: true });
  await fs.writeFile(unindexedPath, reportMarkdown(unindexed), "utf8");

  const invalid = await validateInvestigationReports({ workspaceRoot: invalidRoot });
  assert.ok(invalid.errors.some((error) => error.includes("status must be one of")));
  assert.ok(invalid.errors.some((error) => (
    error.includes("first formation time must use an RFC 3339")
  )));
  assert.ok(invalid.errors.some((error) => error.includes("updated time must not be earlier")));
  assert.ok(invalid.errors.some((error) => error.includes("does not match investigation-index")));
  assert.ok(invalid.errors.some((error) => error.includes("missing-report.md")));
  assert.ok(invalid.errors.some((error) => error.includes("unindexed-report.md")));

  const invalidRecordsRoot = path.join(tempRoot, "invalid-records");
  const missingRecordSection: ReportInput = {
    body: "## 调查材料\n\n正文缺少固定调查记录容器。",
    path: "runtime/missing-record-section.md",
    question: "报告是否包含固定调查记录？",
    title: "缺少调查记录"
  };
  const emptyRecordSection: ReportInput = {
    body: "## 调查记录\n\n尚未形成任何调查段。",
    path: "runtime/empty-record-section.md",
    question: "调查记录是否至少包含一轮调查？",
    title: "空调查记录"
  };
  const missingRecordTime: ReportInput = {
    body: [
      "## 调查记录",
      "",
      "### 缺少形成时间",
      "",
      "本轮正文没有固定形成时间。"
    ].join("\n"),
    path: "runtime/missing-record-time.md",
    question: "调查段是否记录形成时间？",
    title: "缺少调查段时间"
  };
  const lateRecordTime: ReportInput = {
    path: "runtime/late-record-time.md",
    question: "调查段时间是否落在报告时间范围内？",
    recordFormedAt: "2026-07-22T09:00:00+08:00",
    title: "越界调查段时间",
    updatedAt: "2026-07-21T09:00:00+08:00"
  };
  const reversedRecordTimes: ReportInput = {
    body: [
      "## 调查记录",
      "",
      "### 后形成的调查",
      "- 形成时间: 2026-07-21T08:00:00+08:00",
      "",
      "先写入较晚形成的认识。",
      "",
      "### 较早形成的调查",
      "- 形成时间: 2026-07-20T10:00:00+08:00",
      "",
      "后写入较早形成的认识。"
    ].join("\n"),
    path: "runtime/reversed-record-times.md",
    question: "调查段是否按形成时间追加？",
    title: "倒序调查段"
  };
  await writeCollection(invalidRecordsRoot, [
    missingRecordSection,
    emptyRecordSection,
    missingRecordTime,
    lateRecordTime,
    reversedRecordTimes
  ]);
  const invalidRecords = await validateInvestigationReports({
    workspaceRoot: invalidRecordsRoot
  });
  assert.ok(invalidRecords.errors.some((error) => (
    error.includes("second H2 must be \"调查记录\"")
  )));
  assert.ok(invalidRecords.errors.some((error) => (
    error.includes("must contain at least one H3 record")
  )));
  assert.ok(invalidRecords.errors.some((error) => (
    error.includes("investigation record must start with")
  )));
  assert.ok(invalidRecords.errors.some((error) => (
    error.includes("investigation record formed time must not be later")
  )));
  assert.ok(invalidRecords.errors.some((error) => (
    error.includes("must not be earlier than the previous investigation record")
  )));

  const scopedValid = await validateInvestigationReports({
    reports: [goodReport.path],
    workspaceRoot: invalidRoot
  });
  assert.deepEqual(scopedValid.errors, []);

  const sameTopicRoot = path.join(tempRoot, "same-topic-filter");
  const sameTopicReport: ReportInput = {
    path: "runtime/good-report.md",
    question: "单报告筛选能否隔离无关条目？",
    title: "单报告筛选调查"
  };
  await writeCollection(sameTopicRoot, [sameTopicReport]);
  await fs.writeFile(
    path.join(sameTopicRoot, "docs", "investigations", "investigation-index.md"),
    [
      "# 调查索引",
      "",
      "## runtime",
      "",
      "- 这不是链接",
      "  - 核心问题: 无关坏条目是否会污染筛选？",
      "  - 状态: 调查中",
      "  - 最近更新时间: 2026-07-21T09:00:00+08:00",
      "",
      `- [${sameTopicReport.title}](${sameTopicReport.path})`,
      `  - 核心问题: ${sameTopicReport.question}`,
      "  - 状态: 调查中",
      "  - 最近更新时间: 2026-07-21T09:00:00+08:00",
      ""
    ].join("\n"),
    "utf8"
  );
  const isolatedReport = await validateInvestigationReports({
    reports: [sameTopicReport.path],
    workspaceRoot: sameTopicRoot
  });
  assert.deepEqual(isolatedReport.errors, []);

  const nonPosixRoot = path.join(tempRoot, "non-posix-index");
  const nonPosixReport: ReportInput = {
    path: "runtime/non-posix-link.md",
    question: "索引链接是否必须使用 POSIX 路径？",
    title: "索引路径调查"
  };
  await writeCollection(nonPosixRoot, [nonPosixReport]);
  const nonPosixIndexPath = path.join(
    nonPosixRoot,
    "docs",
    "investigations",
    "investigation-index.md"
  );
  const nonPosixIndex = (await fs.readFile(nonPosixIndexPath, "utf8"))
    .replace("runtime/non-posix-link.md", "runtime\\non-posix-link.md");
  await fs.writeFile(nonPosixIndexPath, nonPosixIndex, "utf8");
  const nonPosix = await validateInvestigationReports({ workspaceRoot: nonPosixRoot });
  assert.ok(nonPosix.errors.some((error) => error.includes("<topic-id>/<semantic-slug>.md")));

  const missingFilter = await validateInvestigationReports({
    reports: ["codex/not-present.md"],
    workspaceRoot: validRoot
  });
  assert.ok(missingFilter.errors.some((error) => error.includes("must appear exactly once")));
  assert.ok(missingFilter.errors.some((error) => error.includes("report file does not exist")));

  const cliFailure = spawnSync("node", [generatedCheckerPath, "--root", invalidRoot], {
    encoding: "utf8"
  });
  assert.equal(cliFailure.status, 1);
  assert.match(cliFailure.stderr, /Investigation report check failed/);

  const help = spawnSync("node", [generatedCheckerPath, "--help"], { encoding: "utf8" });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Usage: check-investigations\.mjs/);

  const invalidArgument = spawnSync(
    "node",
    [generatedCheckerPath, "--unknown"],
    { encoding: "utf8" }
  );
  assert.equal(invalidArgument.status, 2);

  const checkerSource = await fs.readFile(generatedCheckerPath, "utf8");
  assert.match(checkerSource, /Repository: https:\/\/github\.com\/zxyycom\/skills/);
  assert.match(
    checkerSource,
    /Maintained source: https:\/\/github\.com\/zxyycom\/skills\/blob\/main\/scripts\/investigation-report\/src\/cli\.ts/
  );
  assert.match(checkerSource, /Rebuild: bun run sync:investigation-report-check/);
  assert.match(checkerSource, /sourceMappingURL=check-investigations\.mjs\.map/);

  const declarationSource = await fs.readFile(generatedDeclarationPath, "utf8");
  assert.match(declarationSource, /validateInvestigationReports/);
  assert.match(declarationSource, /runInvestigationReportCheckCli/);

  const sourceMap = JSON.parse(await fs.readFile(`${generatedCheckerPath}.map`, "utf8")) as {
    sourceRoot: string;
    sources: string[];
  };
  assert.equal(sourceMap.sourceRoot, "../../../");
  assert.ok(sourceMap.sources.includes("scripts/investigation-report/src/cli.ts"));
  assert.ok(sourceMap.sources.every((source) => !path.isAbsolute(source) && !source.includes("\\")));
} finally {
  await fs.rm(tempRoot, { force: true, recursive: true });
}

console.log("Investigation report checker tests passed.");
