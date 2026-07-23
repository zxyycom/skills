import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  queryInvestigationIndex as queryBundledInvestigationIndex,
  runInvestigationReportCheckCli,
  synchronizeInvestigationIndex as synchronizeBundledInvestigationIndex,
  validateInvestigationReports as validateBundledInvestigationReports
} from "../../../skills/investigation-report/scripts/check-investigations.mjs";
import {
  queryStateIndex,
  type StateIndex,
  type StateIndexResult
} from "../../index-runtime/src/index.ts";
import {
  createInvestigationStateIndexDefinition,
  investigationIndexFileName,
  loadCurrentInvestigationIndex
} from "../src/investigation-state-index.ts";
import { queryInvestigationIndex } from "../src/query.ts";
import {
  synchronizeInvestigationIndex,
  validateInvestigationReports
} from "../src/validation.ts";

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
const generatedSchemaPath = path.join(
  rootDir,
  "skills",
  "investigation-report",
  "references",
  "investigation-index.schema.json"
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

async function writeCollection(
  workspaceRoot: string,
  inputs: readonly ReportInput[],
  syncIndex = true
): Promise<void> {
  const investigationRoot = path.join(workspaceRoot, "docs", "investigations");
  await fs.mkdir(investigationRoot, { recursive: true });
  for (const input of inputs) {
    const reportPath = path.join(investigationRoot, ...input.path.split("/"));
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

function resultValue<Value>(result: StateIndexResult<Value>): Value {
  assert.equal(
    result.status,
    "ok",
    result.diagnostics.map((entry) => entry.message).join("; ")
  );
  return result.value as Value;
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
      reports: [{
        formedAt: "2026-07-19T09:00:00+08:00",
        title: "定位进程抖动阶段"
      }],
      status: "暂停",
      title: "运行时进程抖动调查"
    }
  ];
  await writeCollection(validRoot, validReports);

  const valid = await validateInvestigationReports({ workspaceRoot: validRoot });
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.indexChecked, true);
  assert.equal(valid.availableTopicCount, 2);
  assert.equal(valid.selectedTopicCount, 2);
  assert.equal(valid.categoryCount, 2);
  assert.deepEqual(await validateBundledInvestigationReports({ workspaceRoot: validRoot }), valid);
  assert.equal(typeof runInvestigationReportCheckCli, "function");
  assert.equal(typeof queryBundledInvestigationIndex, "function");
  assert.equal(typeof synchronizeBundledInvestigationIndex, "function");

  const validInvestigationRoot = path.join(
    validRoot,
    "docs",
    "investigations"
  );
  const validIndex = JSON.parse(await fs.readFile(
    path.join(validInvestigationRoot, investigationIndexFileName),
    "utf8"
  )) as StateIndex;
  assert.equal(validIndex.namespace, "investigations");
  assert.equal(validIndex.definitionVersion, 2);
  assert.match(validIndex.sourceRevision, /^sha256:[0-9a-f]{64}$/u);
  assert.deepEqual(
    validIndex.entries.map((entry) => entry.id),
    [
      "codex/project-shell-registration.md",
      "runtime/process-churn.md"
    ]
  );
  const codexEntry = validIndex.entries[0];
  assert.deepEqual(codexEntry.state, {
    latestReportAt: "2026-07-21T09:00:00+08:00",
    path: "codex/project-shell-registration.md",
    question: "为什么项目 Shell 没有进入可用工具列表？",
    reportCount: 2,
    reportTitles: ["恢复注册入口", "复查当前注册状态"],
    status: "调查中",
    title: "项目 Shell 注册调查"
  });
  assert.deepEqual(codexEntry.keys.category, ["codex"]);
  assert.deepEqual(codexEntry.keys.status, ["调查中"]);
  assert.deepEqual(codexEntry.keys.text, [
    "为什么项目 Shell 没有进入可用工具列表？",
    "复查当前注册状态",
    "恢复注册入口",
    "项目 Shell 注册调查"
  ]);
  assert.deepEqual(codexEntry.keys["latest-report-at"], [
    Date.parse("2026-07-21T09:00:00+08:00")
  ]);

  const loadedIndex = resultValue(await loadCurrentInvestigationIndex({
    investigationsDirectory: validInvestigationRoot
  }));
  const queriedIndex = resultValue(queryStateIndex({
    definition: createInvestigationStateIndexDefinition(),
    index: loadedIndex,
    query: {
      filters: [
        {
          key: "status",
          kind: "exact",
          operator: "all",
          values: ["暂停"]
        },
        {
          key: "text",
          kind: "text",
          operator: "all",
          text: "进程 抖动"
        }
      ]
    }
  }));
  assert.deepEqual(
    queriedIndex.entries.map((entry) => entry.id),
    ["runtime/process-churn.md"]
  );
  const domainQuery = await queryInvestigationIndex({
    statuses: ["暂停"],
    text: "进程 抖动",
    workspaceRoot: validRoot
  });
  assert.deepEqual(domainQuery.errors, []);
  assert.equal(domainQuery.total, 1);
  assert.deepEqual(
    domainQuery.entries.map((entry) => entry.path),
    ["runtime/process-churn.md"]
  );
  const historicalReportTitleQuery = await queryInvestigationIndex({
    text: "恢复 注册",
    workspaceRoot: validRoot
  });
  assert.deepEqual(historicalReportTitleQuery.errors, []);
  assert.deepEqual(
    historicalReportTitleQuery.entries.map((entry) => entry.path),
    ["codex/project-shell-registration.md"]
  );
  assert.deepEqual(
    await queryBundledInvestigationIndex({
      categories: ["codex"],
      latestReportAtFrom: "2026-07-20T00:00:00+08:00",
      paths: ["codex/project-shell-registration.md"],
      workspaceRoot: validRoot
    }),
    {
      entries: [{
        latestReportAt: "2026-07-21T09:00:00+08:00",
        path: "codex/project-shell-registration.md",
        question: "为什么项目 Shell 没有进入可用工具列表？",
        reportCount: 2,
        reportTitles: ["恢复注册入口", "复查当前注册状态"],
        status: "调查中",
        title: "项目 Shell 注册调查"
      }],
      errors: [],
      indexPath: path.join(
        validRoot,
        "docs",
        "investigations",
        investigationIndexFileName
      ),
      limit: 50,
      offset: 0,
      total: 1
    }
  );
  const secondPage = await queryInvestigationIndex({
    limit: 1,
    offset: 1,
    workspaceRoot: validRoot
  });
  assert.deepEqual(secondPage.errors, []);
  assert.equal(secondPage.total, 2);
  assert.deepEqual(
    secondPage.entries.map((entry) => entry.path),
    ["runtime/process-churn.md"]
  );

  const unchanged = await synchronizeBundledInvestigationIndex({
    workspaceRoot: validRoot
  });
  assert.deepEqual(unchanged.errors, []);
  assert.equal(unchanged.changed, false);

  const categoryFiltered = await validateInvestigationReports({
    categories: ["codex"],
    workspaceRoot: validRoot
  });
  assert.deepEqual(categoryFiltered.errors, []);
  assert.equal(categoryFiltered.indexChecked, false);
  assert.equal(categoryFiltered.selectedTopicCount, 1);
  assert.equal(categoryFiltered.categoryCount, 1);

  const pathFiltered = await validateInvestigationReports({
    paths: ["runtime\\process-churn.md"],
    workspaceRoot: validRoot
  });
  assert.deepEqual(pathFiltered.errors, []);
  assert.equal(pathFiltered.indexChecked, false);
  assert.equal(pathFiltered.selectedTopicCount, 1);

  const noIntersection = await validateInvestigationReports({
    categories: ["codex"],
    paths: ["runtime/process-churn.md"],
    workspaceRoot: validRoot
  });
  assert.ok(noIntersection.errors.includes(
    "no investigation topics matched the requested filters"
  ));

  const cliSuccess = spawnSync("node", [generatedCheckerPath, "--root", validRoot], {
    encoding: "utf8"
  });
  assert.equal(cliSuccess.status, 0, cliSuccess.stderr);
  assert.match(cliSuccess.stdout, /2 of 2 topics checked across 2 categories/);

  const cliFiltered = spawnSync(
    "node",
    [
      generatedCheckerPath,
      "--root",
      validRoot,
      "--path",
      "codex/project-shell-registration.md"
    ],
    { encoding: "utf8" }
  );
  assert.equal(cliFiltered.status, 0, cliFiltered.stderr);
  assert.match(cliFiltered.stdout, /1 of 2 topics checked across 1 categories/);
  assert.match(cliFiltered.stdout, /index not checked/);

  const cliList = spawnSync(
    "node",
    [
      generatedCheckerPath,
      "list",
      "--root",
      validRoot,
      "--status",
      "暂停",
      "--text",
      "进程 抖动"
    ],
    { encoding: "utf8" }
  );
  assert.equal(cliList.status, 0, cliList.stderr);
  assert.match(cliList.stdout, /Investigation topics/);
  assert.match(cliList.stdout, /reports: 1; latest: 定位进程抖动阶段/);
  assert.match(cliList.stdout, /runtime\/process-churn\.md/);
  assert.doesNotMatch(cliList.stdout, /codex\/project-shell-registration\.md/);

  const cliSyncRoot = path.join(tempRoot, "cli-sync");
  await writeCollection(cliSyncRoot, [validReports[0]], false);
  const cliSync = spawnSync(
    "node",
    [generatedCheckerPath, "sync-index", "--root", cliSyncRoot],
    { encoding: "utf8" }
  );
  assert.equal(cliSync.status, 0, cliSync.stderr);
  assert.match(cliSync.stdout, /Investigation index synchronized/);
  assert.equal(
    await fs.stat(path.join(
      cliSyncRoot,
      "docs",
      "investigations",
      investigationIndexFileName
    )).then((entry) => entry.isFile()),
    true
  );

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
    error.includes("scratch.md must use <category-id>/<semantic-slug>.md")
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

  const invalid = await validateInvestigationReports({ workspaceRoot: invalidRoot });
  assert.ok(invalid.errors.some((error) => error.includes("status must be one of")));
  assert.ok(invalid.errors.some((error) => error.includes("latest report time must use an RFC 3339")));
  assert.ok(invalid.errors.some((error) => error.includes("report formed time must use an RFC 3339")));
  assert.ok(invalid.errors.some((error) => (
    error.includes(emptySemanticQuestion.path)
    && error.includes("field \"核心问题\" must not be empty")
  )));
  assert.equal(invalid.indexChecked, false);

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
  ], false);
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
    paths: [goodReport.path],
    workspaceRoot: invalidRoot
  });
  assert.deepEqual(scopedValid.errors, []);

  const staleRoot = path.join(tempRoot, "stale-index");
  const firstStaleReport: ReportInput = {
    path: "runtime/first-report.md",
    question: "新增主题文件是否会使派生索引失效？",
    title: "首个索引成员调查"
  };
  const addedStaleReport: ReportInput = {
    path: "runtime/added-report.md",
    question: "新增文件是否会由同步自动吸收？",
    title: "新增索引成员调查"
  };
  await writeCollection(staleRoot, [firstStaleReport]);
  const addedStalePath = path.join(
    staleRoot,
    "docs",
    "investigations",
    ...addedStaleReport.path.split("/")
  );
  await fs.writeFile(
    addedStalePath,
    reportMarkdown(addedStaleReport),
    "utf8"
  );
  const stale = await validateInvestigationReports({
    workspaceRoot: staleRoot
  });
  assert.equal(stale.indexChecked, true);
  assert.ok(stale.errors.some((error) => (
    error.includes(investigationIndexFileName)
    && error.includes("does not match the current state projection")
  )));
  const staleQuery = await queryInvestigationIndex({
    workspaceRoot: staleRoot
  });
  assert.ok(staleQuery.errors.some((error) => (
    error.includes(investigationIndexFileName)
    && error.includes("does not match source revision")
  )));
  assert.deepEqual(staleQuery.entries, []);
  const isolatedAddedReport = await validateInvestigationReports({
    paths: [addedStaleReport.path],
    workspaceRoot: staleRoot
  });
  assert.deepEqual(isolatedAddedReport.errors, []);
  assert.equal(isolatedAddedReport.indexChecked, false);

  const resynchronized = await synchronizeInvestigationIndex({
    workspaceRoot: staleRoot
  });
  assert.deepEqual(resynchronized.errors, []);
  assert.equal(resynchronized.changed, true);
  assert.deepEqual(
    (await validateInvestigationReports({ workspaceRoot: staleRoot })).errors,
    []
  );
  const resynchronizedIndex = resultValue(await loadCurrentInvestigationIndex({
    investigationsDirectory: path.join(
      staleRoot,
      "docs",
      "investigations"
    )
  }));
  assert.deepEqual(
    resynchronizedIndex.entries.map((entry) => entry.id),
    ["runtime/added-report.md", "runtime/first-report.md"]
  );

  const tamperedIndexPath = path.join(
    staleRoot,
    "docs",
    "investigations",
    investigationIndexFileName
  );
  const tamperedIndex = await fs.readFile(tamperedIndexPath, "utf8");
  await fs.writeFile(
    tamperedIndexPath,
    tamperedIndex.replace("新增索引成员调查", "被篡改的索引标题"),
    "utf8"
  );
  const tampered = await validateInvestigationReports({
    workspaceRoot: staleRoot
  });
  assert.ok(tampered.errors.some((error) => (
    error.includes(investigationIndexFileName)
    && error.includes("does not match the current state projection")
  )));
  assert.equal(
    (await synchronizeInvestigationIndex({ workspaceRoot: staleRoot })).changed,
    true
  );
  const invalidCountIndex = await fs.readFile(tamperedIndexPath, "utf8");
  await fs.writeFile(
    tamperedIndexPath,
    invalidCountIndex.replace('"reportCount": 1', '"reportCount": 2'),
    "utf8"
  );
  const invalidCount = await queryInvestigationIndex({
    workspaceRoot: staleRoot
  });
  assert.ok(
    invalidCount.errors.some((error) => (
      error.includes(
        "reportCount must equal the number of reportTitles"
      )
    )),
    invalidCount.errors.join("; ")
  );
  assert.equal(
    (await synchronizeInvestigationIndex({ workspaceRoot: staleRoot })).changed,
    true
  );

  const scaleRoot = path.join(tempRoot, "scale");
  const scaleInvestigationRoot = path.join(
    scaleRoot,
    "docs",
    "investigations"
  );
  const scaleTopicRoot = path.join(scaleInvestigationRoot, "scale");
  await fs.mkdir(scaleTopicRoot, { recursive: true });
  const scaleCount = 1_000;
  for (let offset = 0; offset < scaleCount; offset += 64) {
    await Promise.all(
      Array.from(
        { length: Math.min(64, scaleCount - offset) },
        async (_, index) => {
          const number = String(offset + index).padStart(4, "0");
          const input: ReportInput = {
            path: `scale/report-${number}.md`,
            question: `第 ${number} 份调查能否进入通用索引？`,
            title: `规模调查 ${number}`
          };
          await fs.writeFile(
            path.join(scaleTopicRoot, `report-${number}.md`),
            reportMarkdown(input),
            "utf8"
          );
        }
      )
    );
  }
  const scaleSyncStartedAt = performance.now();
  const scaleSynchronized = await synchronizeInvestigationIndex({
    workspaceRoot: scaleRoot
  });
  const scaleSyncMilliseconds = performance.now() - scaleSyncStartedAt;
  assert.deepEqual(scaleSynchronized.errors, []);
  assert.equal(scaleSynchronized.topicCount, scaleCount);
  const scaleReadStartedAt = performance.now();
  const scaleIndex = resultValue(await loadCurrentInvestigationIndex({
    investigationsDirectory: scaleInvestigationRoot
  }));
  const scaleReadMilliseconds = performance.now() - scaleReadStartedAt;
  assert.equal(scaleIndex.entries.length, scaleCount);
  const scaleQueryStartedAt = performance.now();
  const scaleQuery = await queryInvestigationIndex({
    limit: 10,
    text: "规模 调查",
    workspaceRoot: scaleRoot
  });
  const scaleQueryMilliseconds = performance.now() - scaleQueryStartedAt;
  assert.deepEqual(scaleQuery.errors, []);
  assert.equal(scaleQuery.total, scaleCount);
  assert.equal(scaleQuery.entries.length, 10);
  console.log(
    "Investigation index scale evidence: "
    + `${scaleCount} topics synchronized in ${scaleSyncMilliseconds.toFixed(1)} ms, `
    + `freshness-read in ${scaleReadMilliseconds.toFixed(1)} ms, `
    + `freshness-query in ${scaleQueryMilliseconds.toFixed(1)} ms.`
  );

  const missingFilter = await validateInvestigationReports({
    paths: ["codex/not-present.md"],
    workspaceRoot: validRoot
  });
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
  assert.match(help.stdout, /full-index freshness/);
  assert.match(help.stdout, /sync-index validates every topic/);
  assert.match(help.stdout, /list checks index freshness/);

  const invalidArgument = spawnSync(
    "node",
    [generatedCheckerPath, "--unknown"],
    { encoding: "utf8" }
  );
  assert.equal(invalidArgument.status, 2);

  const invalidLimit = spawnSync(
    "node",
    [generatedCheckerPath, "list", "--root", validRoot, "--limit", "nope"],
    { encoding: "utf8" }
  );
  assert.equal(invalidLimit.status, 2);
  assert.match(invalidLimit.stderr, /limit must be an integer/);

  const invalidSyncFilter = spawnSync(
    "node",
    [
      generatedCheckerPath,
      "sync-index",
      "--root",
      validRoot,
      "--category",
      "codex"
    ],
    { encoding: "utf8" }
  );
  assert.equal(invalidSyncFilter.status, 2);

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
  assert.match(declarationSource, /synchronizeInvestigationIndex/);
  assert.match(declarationSource, /queryInvestigationIndex/);
  assert.match(declarationSource, /runInvestigationReportCheckCli/);

  const generatedSchema = JSON.parse(
    await fs.readFile(generatedSchemaPath, "utf8")
  ) as {
    properties: {
      definitionVersion: { const: number };
      namespace: { const: string };
    };
  };
  assert.equal(generatedSchema.properties.definitionVersion.const, 2);
  assert.equal(generatedSchema.properties.namespace.const, "investigations");

  const sourceMap = JSON.parse(await fs.readFile(`${generatedCheckerPath}.map`, "utf8")) as {
    sourceRoot: string;
    sources: string[];
  };
  assert.equal(sourceMap.sourceRoot, "../../../");
  assert.ok(sourceMap.sources.includes("tools/investigation-report/src/cli.ts"));
  assert.ok(sourceMap.sources.includes(
    "tools/investigation-report/src/investigation-state-index.ts"
  ));
  assert.ok(sourceMap.sources.includes("tools/investigation-report/src/query.ts"));
  assert.ok(sourceMap.sources.includes("tools/index-runtime/src/storage.ts"));
  assert.ok(sourceMap.sources.every((source) => !path.isAbsolute(source) && !source.includes("\\")));
} finally {
  await fs.rm(tempRoot, { force: true, recursive: true });
}

console.log("Investigation report checker tests passed.");
