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

type ExtraSection = {
  body: string;
  title: string;
};

type ReportEntryInput = {
  background?: string;
  extraSections?: readonly ExtraSection[];
  formedAt?: string;
  purpose?: string;
  resultAndBoundary?: string;
  scopeAndBasis?: string;
  title: string;
};

type ReportInput = {
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

const coreSectionCases: readonly CoreSectionCase[] = [
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

function reportEntryMarkdown(input: ReportEntryInput): string {
  const lines = [
    `### ${input.title}`,
    `- 形成时间: ${input.formedAt ?? "2026-07-21T09:00:00+08:00"}`,
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

function reportBodyWithSections(
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

function reportMarkdown(input: ReportInput): string {
  const reports = input.reports ?? [{ title: "当前状态调查" }];
  const lastFormedAt = reports.at(-1)?.formedAt ?? "2026-07-21T09:00:00+08:00";
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

function indexMarkdown(inputs: readonly ReportInput[]): string {
  const byTopic = new Map<string, ReportInput[]>();
  for (const input of inputs) {
    const topic = input.path.split("/")[0];
    const topicReports = byTopic.get(topic) ?? [];
    topicReports.push(input);
    byTopic.set(topic, topicReports);
  }

  const lines = ["# 调查索引", "", "本索引只用于定位调查。", ""];
  for (const [topic, reports] of [...byTopic].sort(([left], [right]) => (
    left.localeCompare(right)
  ))) {
    lines.push(`## ${topic}`, "");
    for (const report of reports) {
      const lastFormedAt = report.reports?.at(-1)?.formedAt
        ?? "2026-07-21T09:00:00+08:00";
      lines.push(
        `- [${report.title}](${report.path})`,
        `  - 核心问题: ${report.question}`,
        `  - 状态: ${report.status ?? "调查中"}`,
        `  - 最新报告时间: ${report.latestReportAt ?? lastFormedAt}`,
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
  assert.ok(noIntersection.errors.includes(
    "no investigation topic files matched the requested filters"
  ));

  const cliSuccess = spawnSync("node", [generatedCheckerPath, "--root", validRoot], {
    encoding: "utf8"
  });
  assert.equal(cliSuccess.status, 0, cliSuccess.stderr);
  assert.match(cliSuccess.stdout, /2 of 2 topic files checked across 2 topics/);

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
  assert.match(cliFiltered.stdout, /1 of 2 topic files checked across 1 topics/);

  const dateSemanticRoot = path.join(tempRoot, "date-semantic-path");
  const dateSemanticReport: ReportInput = {
    path: "runtime/2026-07-21-process-churn.md",
    question: "检查器是否避免猜测文件名中的日期语义？",
    reports: [{ formedAt: "2026-07-21T03:00:00Z", title: "检查日期语义" }],
    title: "日期语义边界调查"
  };
  await writeCollection(dateSemanticRoot, [dateSemanticReport]);
  assert.deepEqual(
    (await validateInvestigationReports({ workspaceRoot: dateSemanticRoot })).errors,
    []
  );

  const rootLevelMarkdownRoot = path.join(tempRoot, "root-level-markdown");
  await writeCollection(rootLevelMarkdownRoot, [dateSemanticReport]);
  await fs.writeFile(
    path.join(rootLevelMarkdownRoot, "docs", "investigations", "scratch.md"),
    reportMarkdown({
      path: "scratch.md",
      question: "调查根目录是否只接受统一格式的主题文件？",
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
    path: "runtime/invalid-report.md",
    question: "这个索引问题会被正文改写。",
    status: "完成",
    title: "无效调查"
  };
  const invalidTimestampReport: ReportInput = {
    latestReportAt: "2026-07-20",
    path: "runtime/invalid-timestamp.md",
    question: "缺少秒级时区的时间是否会被识别？",
    reports: [{ formedAt: "2026-07-20", title: "检查时间格式" }],
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
  assert.ok(invalid.errors.some((error) => error.includes("latest report time must use an RFC 3339")));
  assert.ok(invalid.errors.some((error) => error.includes("report formed time must use an RFC 3339")));
  assert.ok(invalid.errors.some((error) => error.includes("does not match investigation-index")));
  assert.ok(invalid.errors.some((error) => error.includes("missing-report.md")));
  assert.ok(invalid.errors.some((error) => error.includes("unindexed-report.md")));

  const invalidReportsRoot = path.join(tempRoot, "invalid-reports");
  const missingReportSection: ReportInput = {
    body: "## 调查材料\n\n正文缺少固定调查报告容器。",
    path: "runtime/missing-report-section.md",
    question: "主题文件是否包含固定调查报告容器？",
    title: "缺少调查报告"
  };
  const emptyReportSection: ReportInput = {
    body: "## 调查报告\n\n尚未形成任何完整报告。",
    path: "runtime/empty-report-section.md",
    question: "调查报告容器是否至少包含一份报告？",
    title: "空调查报告"
  };
  const missingReportTime: ReportInput = {
    body: [
      "## 调查报告",
      "",
      "### 缺少形成时间",
      "",
      ...coreSectionCases.flatMap((section, index) => [
        `#### ${section.title}`,
        section.body,
        ...(index === coreSectionCases.length - 1 ? [] : [""])
      ])
    ].join("\n"),
    path: "runtime/missing-report-time.md",
    question: "每份报告是否记录形成时间？",
    title: "缺少报告时间"
  };

  const emptyCoreReports: ReportInput[] = coreSectionCases.map((section) => ({
    path: `runtime/empty-${section.slug}.md`,
    question: `${section.title}是否为完整报告的必需内容？`,
    reports: [{
      background: section.title === "形成时背景" ? "" : undefined,
      purpose: section.title === "调查目的" ? "" : undefined,
      resultAndBoundary: section.title === "调查结果与边界" ? "" : undefined,
      scopeAndBasis: section.title === "调查范围与依据" ? "" : undefined,
      title: `检查${section.title}`
    }],
    title: `空${section.title}调查`
  }));
  const missingCoreReports: ReportInput[] = coreSectionCases.map((section) => ({
    body: reportBodyWithSections(
      `缺少${section.title}`,
      coreSectionCases.filter((candidate) => candidate.title !== section.title)
    ),
    path: `runtime/missing-${section.slug}.md`,
    question: `完整报告是否必须包含${section.title}？`,
    title: `缺少${section.title}调查`
  }));
  const duplicateCoreReports: ReportInput[] = coreSectionCases.map((section) => ({
    body: reportBodyWithSections(
      `重复${section.title}`,
      [...coreSectionCases, { body: `重复的${section.title}。`, title: section.title }]
    ),
    path: `runtime/duplicate-${section.slug}.md`,
    question: `${section.title}是否只能出现一次？`,
    title: `重复${section.title}调查`
  }));
  const legacyCore: ReportInput = {
    body: reportBodyWithSections("旧三段标题", [
      { body: "已有必要背景。", title: "背景" },
      { body: "需要调查并形成结果。", title: "起因" },
      { body: "形成了结果。", title: "调查结果" }
    ]),
    path: "runtime/legacy-three-sections.md",
    question: "旧三段标题是否会被当作固定核心接受？",
    title: "旧三段标题调查"
  };
  const optionalSectionInsideCore: ReportInput = {
    body: reportBodyWithSections("支撑章节插入核心章节", [
      coreSectionCases[0],
      { body: "过早出现的证据。", title: "证据" },
      ...coreSectionCases.slice(1)
    ]),
    path: "runtime/optional-section-inside-core.md",
    question: "可选章节是否只能位于固定核心之后？",
    title: "可选章节位置调查"
  };
  const wrongSectionOrder: ReportInput = {
    body: reportBodyWithSections("顺序错误", [
      coreSectionCases[1],
      coreSectionCases[0],
      ...coreSectionCases.slice(2)
    ]),
    path: "runtime/wrong-section-order.md",
    question: "四个核心章节是否使用固定顺序？",
    title: "章节顺序调查"
  };
  const reversedReportTimes: ReportInput = {
    latestReportAt: "2026-07-20T10:00:00+08:00",
    path: "runtime/reversed-report-times.md",
    question: "完整报告是否按形成时间追加？",
    reports: [
      { formedAt: "2026-07-21T08:00:00+08:00", title: "较晚形成的报告" },
      { formedAt: "2026-07-20T10:00:00+08:00", title: "较早形成的报告" }
    ],
    title: "倒序完整报告"
  };
  const mismatchedLatestTime: ReportInput = {
    latestReportAt: "2026-07-21T10:00:00+08:00",
    path: "runtime/mismatched-latest-time.md",
    question: "最新报告时间是否等于最后一份报告的形成时间？",
    title: "最新报告时间调查"
  };
  await writeCollection(invalidReportsRoot, [
    missingReportSection,
    emptyReportSection,
    missingReportTime,
    ...emptyCoreReports,
    ...missingCoreReports,
    ...duplicateCoreReports,
    legacyCore,
    optionalSectionInsideCore,
    wrongSectionOrder,
    reversedReportTimes,
    mismatchedLatestTime
  ]);
  const invalidReports = await validateInvestigationReports({
    workspaceRoot: invalidReportsRoot
  });
  assert.ok(invalidReports.errors.some((error) => error.includes("second H2 must be \"调查报告\"")));
  assert.ok(invalidReports.errors.some((error) => error.includes("must contain at least one H3 report")));
  assert.ok(invalidReports.errors.some((error) => error.includes("report must start with")));
  for (const section of coreSectionCases) {
    assert.ok(invalidReports.errors.some((error) => (
      error.includes(`empty-${section.slug}.md`)
      && error.includes(`report section \"${section.title}\" must not be empty`)
    )));
    assert.ok(invalidReports.errors.some((error) => (
      error.includes(`missing-${section.slug}.md`)
      && error.includes(`report is missing \"#### ${section.title}\"`)
    )));
    assert.ok(invalidReports.errors.some((error) => (
      error.includes(`duplicate-${section.slug}.md`)
      && error.includes(`must contain exactly one \"#### ${section.title}\"`)
    )));
  }
  assert.ok(invalidReports.errors.some((error) => (
    error.includes(legacyCore.path)
    && error.includes("report is missing \"#### 形成时背景\"")
  )));
  const requiredOrder = coreSectionCases.map((section) => section.title).join(", ");
  assert.ok(invalidReports.errors.some((error) => (
    error.includes(optionalSectionInsideCore.path)
    && error.includes(`report H4 sections must start with: ${requiredOrder}`)
  )));
  assert.ok(invalidReports.errors.some((error) => (
    error.includes(wrongSectionOrder.path)
    && error.includes(`report H4 sections must start with: ${requiredOrder}`)
  )));
  assert.ok(invalidReports.errors.some((error) => (
    error.includes("report formed time must not be earlier than the previous report")
  )));
  assert.ok(invalidReports.errors.some((error) => (
    error.includes("latest report time must exactly match the last report formed time")
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
      "  - 最新报告时间: 2026-07-21T09:00:00+08:00",
      "",
      `- [${sameTopicReport.title}](${sameTopicReport.path})`,
      `  - 核心问题: ${sameTopicReport.question}`,
      "  - 状态: 调查中",
      "  - 最新报告时间: 2026-07-21T09:00:00+08:00",
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
  assert.ok(missingFilter.errors.some((error) => error.includes("topic file does not exist")));

  const cliFailure = spawnSync("node", [generatedCheckerPath, "--root", invalidRoot], {
    encoding: "utf8"
  });
  assert.equal(cliFailure.status, 1);
  assert.match(cliFailure.stderr, /Investigation report check failed/);

  const help = spawnSync("node", [generatedCheckerPath, "--help"], { encoding: "utf8" });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Usage: check-investigations\.mjs/);
  assert.match(help.stdout, /self-contained reports/);
  assert.match(help.stdout, /every index entry and topic file/);

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
    /Maintained source: https:\/\/github\.com\/zxyycom\/skills\/blob\/main\/tools\/investigation-report\/src\/cli\.ts/
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
  assert.ok(sourceMap.sources.includes("tools/investigation-report/src/cli.ts"));
  assert.ok(sourceMap.sources.every((source) => !path.isAbsolute(source) && !source.includes("\\")));
} finally {
  await fs.rm(tempRoot, { force: true, recursive: true });
}

console.log("Investigation report checker tests passed.");
