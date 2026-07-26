import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { validateInvestigationReports } from "../src/validation.ts";
import {
  coreSectionCases,
  createValidReports,
  investigationRoot,
  reportBodyWithSections,
  reportMarkdown,
  type ReportInput,
  withTempRoot,
  writeCollection
} from "./support.ts";

async function testFilteredDirectoryValidation(tempRoot: string): Promise<void> {
  const workspaceRoot = path.join(tempRoot, "filters");
  await writeCollection(workspaceRoot, createValidReports());

  const categoryFiltered = await validateInvestigationReports({
    categories: ["codex"],
    workspaceRoot
  });
  assert.deepEqual(categoryFiltered.errors, []);
  assert.equal(categoryFiltered.indexChecked, false);
  assert.equal(categoryFiltered.selectedTopicCount, 1);
  assert.equal(categoryFiltered.categoryCount, 1);

  const pathFiltered = await validateInvestigationReports({
    paths: ["runtime\\process-churn.md"],
    workspaceRoot
  });
  assert.deepEqual(pathFiltered.errors, []);
  assert.equal(pathFiltered.indexChecked, false);
  assert.equal(pathFiltered.selectedTopicCount, 1);

  const noIntersection = await validateInvestigationReports({
    categories: ["codex"],
    paths: ["runtime/process-churn.md"],
    workspaceRoot
  });
  assert.ok(noIntersection.errors.includes(
    "no investigation topics matched the requested filters"
  ));

  const missingFilter = await validateInvestigationReports({
    paths: ["codex/not-present.md"],
    workspaceRoot
  });
  assert.ok(missingFilter.errors.some((error) => (
    error.includes("topic file does not exist")
  )));
}

async function testDirectoryPathRules(tempRoot: string): Promise<void> {
  const dateSemanticRoot = path.join(tempRoot, "date-semantic-path");
  const dateSemanticReport: ReportInput = {
    path: "runtime/2026-07-21-process-churn.md",
    question: "检查器是否避免猜测文件名中的日期语义？",
    reports: [{
      formedAt: "2026-07-21T03:00:00Z",
      title: "检查日期语义"
    }],
    title: "日期语义边界调查"
  };
  await writeCollection(dateSemanticRoot, [dateSemanticReport]);
  assert.deepEqual(
    (await validateInvestigationReports({
      workspaceRoot: dateSemanticRoot
    })).errors,
    []
  );

  const rootLevelMarkdownRoot = path.join(tempRoot, "root-level-markdown");
  await writeCollection(rootLevelMarkdownRoot, [dateSemanticReport]);
  await fs.writeFile(
    path.join(investigationRoot(rootLevelMarkdownRoot), "scratch.md"),
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
    error.includes("scratch.md must use <category-id>/<semantic-slug>.md")
  )));
}

async function testInformationFieldValidation(tempRoot: string): Promise<void> {
  const invalidRoot = path.join(tempRoot, "invalid-information");
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
    reports: [{
      formedAt: "2026-07-20",
      title: "检查时间格式"
    }],
    title: "无效时间调查"
  };
  const emptySemanticQuestion: ReportInput = {
    path: "runtime/empty-semantic-question.md",
    question: "** **",
    title: "空语义问题调查"
  };
  await writeCollection(
    invalidRoot,
    [goodReport, invalidReport, invalidTimestampReport, emptySemanticQuestion],
    false
  );

  const invalid = await validateInvestigationReports({
    workspaceRoot: invalidRoot
  });
  assert.ok(invalid.errors.some((error) => (
    error.includes("status must be one of")
  )));
  assert.ok(invalid.errors.some((error) => (
    error.includes("latest report time must use an RFC 3339")
  )));
  assert.ok(invalid.errors.some((error) => (
    error.includes("report formed time must use an RFC 3339")
  )));
  assert.ok(invalid.errors.some((error) => (
    error.includes(emptySemanticQuestion.path)
    && error.includes("field \"核心问题\" must not be empty")
  )));
  assert.equal(invalid.indexChecked, false);

  const scopedValid = await validateInvestigationReports({
    paths: [goodReport.path],
    workspaceRoot: invalidRoot
  });
  assert.deepEqual(scopedValid.errors, []);
}

async function testCompleteReportStructure(tempRoot: string): Promise<void> {
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
      [
        ...coreSectionCases,
        { body: `重复的${section.title}。`, title: section.title }
      ]
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
      {
        formedAt: "2026-07-21T08:00:00+08:00",
        title: "较晚形成的报告"
      },
      {
        formedAt: "2026-07-20T10:00:00+08:00",
        title: "较早形成的报告"
      }
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
  ], false);

  const invalidReports = await validateInvestigationReports({
    workspaceRoot: invalidReportsRoot
  });
  assert.ok(invalidReports.errors.some((error) => (
    error.includes("second H2 must be \"调查报告\"")
  )));
  assert.ok(invalidReports.errors.some((error) => (
    error.includes("must contain at least one H3 report")
  )));
  assert.ok(invalidReports.errors.some((error) => (
    error.includes("report must start with")
  )));
  for (const section of coreSectionCases) {
    assert.ok(invalidReports.errors.some((error) => (
      error.includes(`empty-${section.slug}.md`)
      && error.includes(`report section "${section.title}" must not be empty`)
    )));
    assert.ok(invalidReports.errors.some((error) => (
      error.includes(`missing-${section.slug}.md`)
      && error.includes(`report is missing "#### ${section.title}"`)
    )));
    assert.ok(invalidReports.errors.some((error) => (
      error.includes(`duplicate-${section.slug}.md`)
      && error.includes(`must contain exactly one "#### ${section.title}"`)
    )));
  }
  assert.ok(invalidReports.errors.some((error) => (
    error.includes(legacyCore.path)
    && error.includes("report is missing \"#### 形成时背景\"")
  )));
  const requiredOrder = coreSectionCases
    .map((section) => section.title)
    .join(", ");
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
}

test("validation filters reports by category and path", () => (
  withTempRoot("parsing-filters", testFilteredDirectoryValidation)
));

test("validation enforces investigation directory path rules", () => (
  withTempRoot("parsing-paths", testDirectoryPathRules)
));

test("validation reports invalid information fields without blocking valid scopes", () => (
  withTempRoot("parsing-information", testInformationFieldValidation)
));

test("validation enforces complete report structure and chronology", () => (
  withTempRoot("parsing-structure", testCompleteReportStructure)
));
