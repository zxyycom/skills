import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  investigationIndexFileName,
  readInvestigationSourceRevision
} from "../src/investigation-state-index.ts";
import { isInvestigationResourceId } from "../src/resource-reference.ts";
import { queryInvestigationIndex } from "../src/query.ts";
import {
  synchronizeInvestigationIndex,
  validateInvestigationReports
} from "../src/validation.ts";
import {
  coreSectionCases,
  commitAll,
  createValidReports,
  initializeGitRepository,
  investigationRoot,
  reportEntryMarkdown,
  reportMarkdown,
  type ReportInput,
  withTempRoot,
  writeCollection,
  writeResource
} from "./support.ts";

type ResourceIndex = {
  definitionVersion: number;
  entries: Record<string, {
    state: {
      resourceReferences: Array<{
        reportIndex: number;
        resourceIds: string[];
      }>;
    };
  }>;
  metadata: {
    resources: Array<{
      id: string;
      sha256: string;
    }>;
  };
};

function resourceHash(content: string | Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function rawResourceFieldReport(
  reportPath: string,
  fieldLines: readonly string[]
): ReportInput {
  const entry = reportEntryMarkdown({ title: "检查资源字段" });
  const formedAt = "- 形成时间: 2026-07-21T09:00:00+08:00";
  return {
    body: [
      "## 调查报告",
      "",
      entry.replace(
        `${formedAt}\n\n`,
        `${formedAt}\n${fieldLines.join("\n")}\n\n`
      )
    ].join("\n"),
    path: reportPath,
    question: "资源字段是否只接受固定语法？",
    title: "资源字段调查"
  };
}

function errorSummary(errors: readonly string[]): string {
  return errors.join("; ");
}

async function validatePath(
  workspaceRoot: string,
  reportPath: string
): Promise<string[]> {
  return (await validateInvestigationReports({
    paths: [reportPath],
    workspaceRoot
  })).errors;
}

test("validation keeps reports without attached resources valid", () => (
  withTempRoot("resources-optional", async (workspaceRoot) => {
    const reports = createValidReports();
    await writeCollection(workspaceRoot, reports);

    const validation = await validateInvestigationReports({ workspaceRoot });
    assert.deepEqual(validation.errors, []);

    const index = JSON.parse(await fs.readFile(path.join(
      investigationRoot(workspaceRoot),
      investigationIndexFileName
    ), "utf8")) as ResourceIndex;
    assert.deepEqual(index.metadata.resources, []);
    for (const entry of Object.values(index.entries)) {
      assert.deepEqual(entry.state.resourceReferences, []);
    }
  })
));

test("resource index projects single multiple and shared attachments", () => (
  withTempRoot("resources-projection", async (workspaceRoot) => {
    const request = "GET /users/42\naccept: application/json\n";
    const response = Uint8Array.from([0, 1, 2, 127, 128, 255]);
    const context = "# 观测条件\r\n\r\n形成时使用 staging 配置。\r\n";
    await writeResource(workspaceRoot, "shared/context.md", context);
    await writeResource(workspaceRoot, "captures/response.bin", response);
    await writeResource(workspaceRoot, "api/request.txt", request);

    await writeCollection(workspaceRoot, [
      {
        path: "api/user-request.md",
        question: "用户请求与响应如何对应？",
        reports: [
          {
            formedAt: "2026-07-20T09:00:00+08:00",
            resources: [{ id: "api/request.txt", label: "请求原文" }],
            title: "保存请求"
          },
          {
            formedAt: "2026-07-21T09:00:00+08:00",
            resources: [
              { id: "shared/context.md", label: "观测条件" },
              { id: "captures/response.bin", label: "二进制响应" }
            ],
            title: "保存响应"
          }
        ],
        title: "用户请求调查"
      },
      {
        path: "runtime/shared-response.md",
        question: "共享响应在另一主题中如何复核？",
        reports: [{
          resources: [
            { id: "captures/response.bin", label: "共享响应" },
            { id: "shared/context.md", label: "共享观测条件" }
          ],
          title: "复核共享响应"
        }],
        title: "共享响应调查"
      }
    ]);

    const index = JSON.parse(await fs.readFile(path.join(
      investigationRoot(workspaceRoot),
      investigationIndexFileName
    ), "utf8")) as ResourceIndex;
    assert.equal(index.definitionVersion, 4);
    assert.deepEqual(index.metadata.resources, [
      { id: "api/request.txt", sha256: resourceHash(request) },
      { id: "captures/response.bin", sha256: resourceHash(response) },
      { id: "shared/context.md", sha256: resourceHash(context) }
    ]);
    assert.deepEqual(
      index.entries["api/user-request.md"]!.state.resourceReferences,
      [
        { reportIndex: 0, resourceIds: ["api/request.txt"] },
        {
          reportIndex: 1,
          resourceIds: ["captures/response.bin", "shared/context.md"]
        }
      ]
    );
    assert.deepEqual(
      index.entries["runtime/shared-response.md"]!.state.resourceReferences,
      [{
        reportIndex: 0,
        resourceIds: ["captures/response.bin", "shared/context.md"]
      }]
    );
    assert.deepEqual(
      (await validateInvestigationReports({ workspaceRoot })).errors,
      []
    );
  })
));

test("resource ID whitelist accepts common names and rejects structural hazards", () => (
  withTempRoot("resources-readable-ids", async (workspaceRoot) => {
    const resources = [
      {
        id: "接口+响应@v2=ok/截图[1]【终版】(修订(二)).png",
        label: "接口截图"
      },
      {
        id: "【原始】报告《摘要》-问题：原因，修订！.pdf",
        label: "原始报告"
      },
      { id: "_O'Reilly~摘录().txt", label: "英文摘录" },
      {
        id: "白名单._-+@=()（）[]【】《》,!~'，。！、·：？.txt",
        label: "完整符号样本"
      }
    ];
    await writeResource(workspaceRoot, resources[0]!.id, "response\n");
    await writeResource(
      workspaceRoot,
      resources[1]!.id,
      Uint8Array.from([0, 1, 2, 255])
    );
    await writeResource(workspaceRoot, resources[2]!.id, "excerpt\n");
    await writeResource(workspaceRoot, resources[3]!.id, "all symbols\n");
    await writeCollection(workspaceRoot, [{
      path: "runtime/readable-resource-ids.md",
      question: "白名单资源名称能否保持可读并安全引用？",
      reports: [{ resources, title: "核对可读资源名称" }],
      title: "可读资源名称调查"
    }]);

    const validation = await validateInvestigationReports({ workspaceRoot });
    assert.deepEqual(validation.errors, []);
    const index = JSON.parse(await fs.readFile(path.join(
      investigationRoot(workspaceRoot),
      investigationIndexFileName
    ), "utf8")) as ResourceIndex;
    assert.deepEqual(
      index.entries["runtime/readable-resource-ids.md"]!
        .state.resourceReferences,
      [{
        reportIndex: 0,
        resourceIds: resources.map(({ id }) => id).sort()
      }]
    );

    assert.equal(isInvestigationResourceId("响应().json"), true);
    assert.equal(isInvestigationResourceId("响应(最终).json"), true);
    for (const allowedInfix of [
      ".", "_", "-", "+", "@", "=",
      "()", "（", "）", "[", "]", "【", "】", "《", "》",
      ",", "!", "~", "'", "，", "。", "！", "、", "·", "：", "？"
    ]) {
      assert.equal(
        isInvestigationResourceId(`甲${allowedInfix}乙.txt`),
        true,
        `allowed infix ${JSON.stringify(allowedInfix)}`
      );
    }
    assert.equal(
      isInvestigationResourceId(
        `甲${"(".repeat(32)}乙${")".repeat(32)}.txt`
      ),
      true
    );
    for (const [reason, invalidId] of [
      ["leading dot", ".env"],
      ["trailing dot", "报告."],
      ["reserved name", "CON"],
      ["reserved name with extension", "nul.txt"],
      ["reserved COM name", "COM1.json"],
      ["reserved LPT name", "LPT9"],
      ["missing identity character", "【】"],
      ["unclosed parenthesis", "响应(未闭合.txt"],
      ["unexpected closing parenthesis", "响应最终).txt"],
      ["parenthesis nesting above 32", `甲${"(".repeat(33)}乙${")".repeat(33)}.txt`],
      ["whitespace", "中文 文件.txt"],
      ["ASCII query marker", "响应?.txt"],
      ["fragment marker", "响应#.txt"],
      ["percent encoding marker", "响应%.txt"],
      ["angle brackets", "响应<副本>.txt"],
      ["ASCII colon", "响应:副本.txt"],
      ["asterisk", "响应*副本.txt"],
      ["vertical bar", "响应|副本.txt"],
      ["double quote", "响应\"副本.txt"],
      ["ampersand", "响应&副本.txt"],
      ["backtick", "响应`副本.txt"],
      ["emoji", "响应🎉.txt"]
    ]) {
      assert.equal(
        isInvestigationResourceId(invalidId),
        false,
        `${reason}: ${invalidId}`
      );
    }
  })
));

test("attached resource field is strict when present", () => (
  withTempRoot("resources-field", async (workspaceRoot) => {
    const emphasizedLabel = rawResourceFieldReport(
      "runtime/emphasized-resource-label.md",
      ["- 随附资源:", "  - [**强调样本**](../_resources/sample.txt)"]
    );
    const emptyField = rawResourceFieldReport(
      "runtime/empty-resource-field.md",
      ["- 随附资源:"]
    );
    const emptyLabel = rawResourceFieldReport(
      "runtime/empty-resource-label.md",
      ["- 随附资源:", "  - [](../_resources/sample.txt)"]
    );
    const duplicate = rawResourceFieldReport(
      "runtime/duplicate-resource.md",
      [
        "- 随附资源:",
        "  - [样本](../_resources/sample.txt)",
        "  - [重复样本](../_resources/sample.txt)"
      ]
    );
    const trailingText = rawResourceFieldReport(
      "runtime/resource-link-trailing-text.md",
      [
        "- 随附资源:",
        "  - [样本](../_resources/sample.txt) 额外文字"
      ]
    );
    const resourceAfterMetadata = rawResourceFieldReport(
      "runtime/resource-field-after-metadata.md",
      [
        "",
        "形成时间后的普通段落已结束报告元数据。",
        "",
        "- 随附资源:",
        "  - [样本](../_resources/sample.txt)"
      ]
    );
    const duplicateField = rawResourceFieldReport(
      "runtime/duplicate-resource-field.md",
      [
        "- 随附资源:",
        "  - [样本](../_resources/sample.txt)",
        "- 随附资源:",
        "  - [其他样本](../_resources/other.txt)"
      ]
    );
    const multipleLinksInItem = rawResourceFieldReport(
      "runtime/multiple-resource-links-in-item.md",
      [
        "- 随附资源:",
        "  - [样本](../_resources/sample.txt) [其他样本](../_resources/other.txt)"
      ]
    );
    const orderedResourceList = rawResourceFieldReport(
      "runtime/ordered-resource-list.md",
      [
        "- 随附资源:",
        "  1. [样本](../_resources/sample.txt)"
      ]
    );
    const titledLink = rawResourceFieldReport(
      "runtime/titled-resource-link.md",
      [
        "- 随附资源:",
        '  - [样本](../_resources/sample.txt "说明")'
      ]
    );
    const referenceStyleLink = rawResourceFieldReport(
      "runtime/reference-style-resource-link.md",
      [
        "- 随附资源:",
        "  - [样本][sample-resource]"
      ]
    );
    referenceStyleLink.body = [
      referenceStyleLink.body,
      "",
      "[sample-resource]: ../_resources/sample.txt"
    ].join("\n");
    await writeResource(workspaceRoot, "sample.txt", "sample\n");
    await writeResource(workspaceRoot, "other.txt", "other\n");
    await writeCollection(
      workspaceRoot,
      [
        emptyField,
        emptyLabel,
        duplicate,
        trailingText,
        resourceAfterMetadata,
        duplicateField,
        multipleLinksInItem,
        orderedResourceList,
        titledLink,
        referenceStyleLink,
        emphasizedLabel
      ],
      false
    );

    assert.deepEqual(
      await validatePath(workspaceRoot, emphasizedLabel.path),
      []
    );

    for (const [report, expected] of [
      [emptyField, "must contain at least one resource link"],
      [emptyLabel, "exactly one local Markdown link with non-empty display text"],
      [duplicate, "must not reference resource sample.txt more than once"],
      [trailingText, "exactly one local Markdown link with non-empty display text"],
      [
        resourceAfterMetadata,
        'report metadata must contain only "形成时间" and optional "随附资源" fields'
      ],
      [
        duplicateField,
        'report metadata must contain only "形成时间" and optional "随附资源" fields'
      ],
      [
        multipleLinksInItem,
        "exactly one local Markdown link with non-empty display text"
      ],
      [
        orderedResourceList,
        "must contain only a nested unordered list of local Markdown links"
      ],
      [
        titledLink,
        "exactly one local Markdown link with non-empty display text"
      ],
      [
        referenceStyleLink,
        "exactly one local Markdown link with non-empty display text"
      ]
    ] as const) {
      const errors = await validatePath(workspaceRoot, report.path);
      const summary = errorSummary(errors);
      assert.ok(summary.includes(report.path), summary);
      assert.ok(summary.includes(expected), summary);
    }
  })
));

test("validation rejects unsafe attached resource paths", () => (
  withTempRoot("resources-paths", async (workspaceRoot) => {
    const prefixDiagnostic = (target: string): string => (
      `resource link target ${JSON.stringify(target)} must use `
      + "../_resources/<resource-id> without queries, fragments, encoding, "
      + "or backslashes"
    );
    const idDiagnostic = (target: string): string => (
      `resource link target ${JSON.stringify(target)} must contain a safe, `
      + "normalized resource id"
    );
    const rawSpellingDiagnostic = "resource link target must be written "
      + "literally as ../_resources/<resource-id> without Markdown escapes "
      + "or character references";
    const cases = [
      {
        expected: idDiagnostic("../_resources/../outside.txt"),
        report: rawResourceFieldReport("runtime/outside-resource.md", [
          "- 随附资源:",
          "  - [越界](../_resources/../outside.txt)"
        ])
      },
      {
        expected: prefixDiagnostic("/tmp/outside.txt"),
        report: rawResourceFieldReport("runtime/absolute-resource.md", [
          "- 随附资源:",
          "  - [绝对路径](/tmp/outside.txt)"
        ])
      },
      {
        expected: prefixDiagnostic("../_resources/sample.txt?raw=1"),
        report: rawResourceFieldReport("runtime/query-resource.md", [
          "- 随附资源:",
          "  - [查询](../_resources/sample.txt?raw=1)"
        ])
      },
      {
        expected: prefixDiagnostic("../_resources/sample.txt#part"),
        report: rawResourceFieldReport("runtime/fragment-resource.md", [
          "- 随附资源:",
          "  - [片段](../_resources/sample.txt#part)"
        ])
      },
      {
        expected: prefixDiagnostic("../_resources/sample%2etxt"),
        report: rawResourceFieldReport("runtime/encoded-resource.md", [
          "- 随附资源:",
          "  - [编码](../_resources/sample%2etxt)"
        ])
      },
      {
        expected: prefixDiagnostic("../_resources\\sample.txt"),
        report: rawResourceFieldReport("runtime/backslash-resource.md", [
          "- 随附资源:",
          "  - [反斜杠](../_resources\\sample.txt)"
        ])
      },
      {
        expected: idDiagnostic("../_resources/sample🎉.txt"),
        report: rawResourceFieldReport("runtime/unsupported-resource.md", [
          "- 随附资源:",
          "  - [未放行字符](../_resources/sample🎉.txt)"
        ])
      },
      {
        expected: rawSpellingDiagnostic,
        report: rawResourceFieldReport("runtime/entity-resource-target.md", [
          "- 随附资源:",
          "  - [实体别名](&#46;&#46;/&#95;resources/sample.txt)"
        ])
      },
      {
        expected: rawSpellingDiagnostic,
        report: rawResourceFieldReport("runtime/escaped-resource-target.md", [
          "- 随附资源:",
          "  - [转义别名](../_resources/sample\\.txt)"
        ])
      },
      {
        expected: rawSpellingDiagnostic,
        report: rawResourceFieldReport("runtime/angle-resource-target.md", [
          "- 随附资源:",
          "  - [尖括号别名](<../_resources/sample.txt>)"
        ])
      }
    ];
    await writeResource(workspaceRoot, "sample.txt", "reachable\n");
    await writeResource(workspaceRoot, "sample🎉.txt", "reachable emoji\n");
    await fs.writeFile(
      path.join(investigationRoot(workspaceRoot), "outside.txt"),
      "reachable outside resource pool\n"
    );
    await writeCollection(
      workspaceRoot,
      cases.map(({ report }) => report),
      false
    );

    for (const { expected, report } of cases) {
      const errors = await validatePath(workspaceRoot, report.path);
      const summary = errorSummary(errors);
      assert.ok(summary.includes(report.path), summary);
      assert.ok(summary.includes(expected), summary);
      assert.doesNotMatch(summary, /does not exist/u);
    }
  })
));

test("validation reports missing attached resources", () => (
  withTempRoot("resources-missing", async (workspaceRoot) => {
    const report: ReportInput = {
      path: "runtime/missing-resource.md",
      question: "缺失资源是否会被定位？",
      reports: [{
        resources: [{ id: "missing/sample.txt", label: "缺失样本" }],
        title: "检查缺失资源"
      }],
      title: "缺失资源调查"
    };
    await writeCollection(workspaceRoot, [report], false);

    const errors = await validatePath(workspaceRoot, report.path);
    assert.ok(errorSummary(errors).includes("missing/sample.txt"));
    assert.match(errorSummary(errors), /does not exist|missing/u);
  })
));

test("validation reports attached resource case mismatches", () => (
  withTempRoot("resources-case", async (workspaceRoot) => {
    const report: ReportInput = {
      path: "runtime/resource-case.md",
      question: "资源大小写不一致是否会被定位？",
      reports: [{
        resources: [{ id: "case/sample.txt", label: "大小写样本" }],
        title: "检查大小写"
      }],
      title: "资源大小写调查"
    };
    await writeResource(workspaceRoot, "case/Sample.txt", "sample\n");
    await writeCollection(workspaceRoot, [report], false);

    const errors = await validatePath(workspaceRoot, report.path);
    const summary = errorSummary(errors);
    assert.ok(summary.includes(
      '_resources/case/sample.txt must match actual path casing; found "Sample.txt"'
    ), summary);
    assert.doesNotMatch(summary, /does not exist/u);
  })
));

test("validation rejects symbolic links in attached resource paths", () => (
  withTempRoot("resources-symlink", async (tempRoot) => {
    const cases = ["root", "component", "file"] as const;
    for (const kind of cases) {
      const workspaceRoot = path.join(tempRoot, kind);
      const resourceId = kind === "component" ? "linked/sample.txt" : "sample.txt";
      const report: ReportInput = {
        path: `runtime/${kind}-symlink.md`,
        question: "符号链接资源是否会被拒绝？",
        reports: [{
          resources: [{ id: resourceId, label: "符号链接样本" }],
          title: "检查符号链接"
        }],
        title: "符号链接资源调查"
      };
      await writeCollection(workspaceRoot, [report], false);
      const collectionRoot = investigationRoot(workspaceRoot);
      const outsideRoot = path.join(workspaceRoot, "outside");
      await fs.mkdir(outsideRoot, { recursive: true });
      await fs.writeFile(path.join(outsideRoot, "sample.txt"), "sample\n");

      if (kind === "root") {
        await fs.symlink(outsideRoot, path.join(collectionRoot, "_resources"));
      } else {
        const resourcesRoot = path.join(collectionRoot, "_resources");
        await fs.mkdir(resourcesRoot, { recursive: true });
        if (kind === "component") {
          await fs.symlink(outsideRoot, path.join(resourcesRoot, "linked"));
        } else {
          await fs.symlink(
            path.join(outsideRoot, "sample.txt"),
            path.join(resourcesRoot, "sample.txt")
          );
        }
      }

      const errors = await validatePath(workspaceRoot, report.path);
      if (kind !== "root") {
        assert.ok(errorSummary(errors).includes(resourceId), errorSummary(errors));
      }
      assert.match(errorSummary(errors), /symbolic link/u);
    }
  })
));

test("validation rejects attached resource targets that are not regular files", () => (
  withTempRoot("resources-file-type", async (workspaceRoot) => {
    const report: ReportInput = {
      path: "runtime/directory-resource.md",
      question: "资源目标是否必须是普通文件？",
      reports: [{
        resources: [{ id: "directory", label: "目录目标" }],
        title: "检查资源类型"
      }],
      title: "资源类型调查"
    };
    await writeCollection(workspaceRoot, [report], false);
    await fs.mkdir(path.join(
      investigationRoot(workspaceRoot),
      "_resources",
      "directory"
    ), { recursive: true });

    const errors = await validatePath(workspaceRoot, report.path);
    assert.ok(errorSummary(errors).includes("directory"), errorSummary(errors));
    assert.match(errorSummary(errors), /regular file/u);
  })
));

test("full validation rejects orphan resources while scoped validation remains local", () => (
  withTempRoot("resources-scope", async (workspaceRoot) => {
    const report = createValidReports()[0]!;
    await writeCollection(workspaceRoot, [report]);
    await writeResource(workspaceRoot, "orphan.txt", "not referenced\n");

    const scoped = await validateInvestigationReports({
      paths: [report.path],
      workspaceRoot
    });
    assert.deepEqual(scoped.errors, []);
    assert.equal(scoped.indexChecked, false);

    const complete = await validateInvestigationReports({ workspaceRoot });
    assert.ok(errorSummary(complete.errors).includes("orphan.txt"));
    assert.match(errorSummary(complete.errors), /not referenced|orphan/u);
  })
));

test("Git ignore rules exclude untracked noise but retain tracked resources", () => (
  withTempRoot("resources-git-ignore", async (workspaceRoot) => {
    initializeGitRepository(workspaceRoot);
    const trackedId = "evidence/tracked-then-ignored.txt";
    const visibleId = "evidence/visible.txt";
    await writeResource(workspaceRoot, trackedId, "tracked\n");
    await writeResource(workspaceRoot, visibleId, "visible\n");
    await writeCollection(workspaceRoot, [{
      path: "runtime/git-visible-resources.md",
      question: "Git 忽略规则如何界定受管调查资源？",
      reports: [{
        resources: [
          { id: trackedId, label: "已跟踪资源" },
          { id: visibleId, label: "可见资源" }
        ],
        title: "核对 Git 可见资源"
      }],
      title: "Git 可见资源调查"
    }]);
    commitAll(workspaceRoot, "base resources");
    await fs.writeFile(
      path.join(workspaceRoot, ".gitignore"),
      [
        "__pycache__/",
        "*.pyc",
        "ignored-untracked.txt",
        "tracked-then-ignored.txt",
        ""
      ].join("\n"),
      "utf8"
    );
    await writeResource(
      workspaceRoot,
      "evidence/__pycache__/parser.cpython-313.pyc",
      Uint8Array.from([1, 2, 3])
    );
    await writeResource(
      workspaceRoot,
      "evidence/ignored-untracked.txt",
      "ignored\n"
    );

    const synchronized = await synchronizeInvestigationIndex({ workspaceRoot });
    assert.deepEqual(synchronized.errors, []);
    assert.deepEqual(
      (await validateInvestigationReports({ workspaceRoot })).errors,
      []
    );
    const before = await readInvestigationSourceRevision(
      investigationRoot(workspaceRoot)
    );
    await writeResource(
      workspaceRoot,
      "evidence/__pycache__/parser.cpython-313.pyc",
      Uint8Array.from([4, 5, 6])
    );
    const after = await readInvestigationSourceRevision(
      investigationRoot(workspaceRoot)
    );
    assert.deepEqual(after, before);

    const index = JSON.parse(await fs.readFile(path.join(
      investigationRoot(workspaceRoot),
      investigationIndexFileName
    ), "utf8")) as ResourceIndex;
    assert.deepEqual(index.metadata.resources.map(({ id }) => id), [
      trackedId,
      visibleId
    ]);
  })
));

test("validation rejects explicitly referenced ignored resources", () => (
  withTempRoot("resources-ignored-reference", async (workspaceRoot) => {
    initializeGitRepository(workspaceRoot);
    await fs.writeFile(
      path.join(workspaceRoot, ".gitignore"),
      "ignored-response.json\n",
      "utf8"
    );
    const report: ReportInput = {
      path: "runtime/ignored-resource.md",
      question: "被忽略的文件能否作为调查证据？",
      reports: [{
        resources: [{
          id: "captures/ignored-response.json",
          label: "被忽略响应"
        }],
        title: "核对被忽略资源"
      }],
      title: "被忽略资源调查"
    };
    await writeResource(
      workspaceRoot,
      "captures/ignored-response.json",
      "{}\n"
    );
    await writeCollection(workspaceRoot, [report], false);

    const errors = await validatePath(workspaceRoot, report.path);
    const summary = errorSummary(errors);
    assert.match(summary, /ignored by version-control rules/u);
    assert.doesNotMatch(summary, /does not exist/u);
  })
));

test("resource changes invalidate source revision and list results", () => (
  withTempRoot("resources-revision", async (workspaceRoot) => {
    const originalId = "captures/response.bin";
    const renamedId = "captures/renamed-response.bin";
    const report = (resourceId: string): ReportInput => ({
      path: "runtime/resource-revision.md",
      question: "资源变化是否会使旧索引失效？",
      reports: [{
        resources: [{ id: resourceId, label: "响应样本" }],
        title: "检查资源 revision"
      }],
      title: "资源 revision 调查"
    });
    await writeResource(workspaceRoot, originalId, Uint8Array.from([1, 2, 3]));
    await writeCollection(workspaceRoot, [report(originalId)]);

    const collectionRoot = investigationRoot(workspaceRoot);
    const initialRevision = await readInvestigationSourceRevision(collectionRoot);
    await writeResource(workspaceRoot, originalId, Uint8Array.from([1, 2, 4]));
    const contentRevision = await readInvestigationSourceRevision(collectionRoot);
    assert.notEqual(contentRevision.metadata, initialRevision.metadata);
    assert.deepEqual(contentRevision.entries, initialRevision.entries);

    const contentStale = await queryInvestigationIndex({ workspaceRoot });
    assert.deepEqual(contentStale.entries, []);
    assert.ok(
      errorSummary(contentStale.errors).includes(originalId),
      errorSummary(contentStale.errors)
    );
    const contentCheck = await validateInvestigationReports({ workspaceRoot });
    assert.equal(contentCheck.indexChecked, true);
    assert.ok(
      errorSummary(contentCheck.errors).includes(originalId),
      errorSummary(contentCheck.errors)
    );
    const contentSynchronized = await synchronizeInvestigationIndex({
      workspaceRoot
    });
    assert.deepEqual(contentSynchronized.errors, []);
    assert.equal(contentSynchronized.changed, true);

    await fs.rename(
      path.join(collectionRoot, "_resources", ...originalId.split("/")),
      path.join(collectionRoot, "_resources", ...renamedId.split("/"))
    );
    await writeCollection(workspaceRoot, [report(renamedId)], false);
    const renamedRevision = await readInvestigationSourceRevision(collectionRoot);
    assert.notEqual(renamedRevision.metadata, contentRevision.metadata);
    assert.notDeepEqual(renamedRevision.entries, contentRevision.entries);

    const renameStale = await queryInvestigationIndex({ workspaceRoot });
    assert.deepEqual(renameStale.entries, []);
    assert.ok(errorSummary(renameStale.errors).includes(originalId));
    assert.ok(errorSummary(renameStale.errors).includes(renamedId));
    const renameCheck = await validateInvestigationReports({ workspaceRoot });
    assert.equal(renameCheck.indexChecked, true);
    assert.ok(errorSummary(renameCheck.errors).includes(originalId));
    assert.ok(errorSummary(renameCheck.errors).includes(renamedId));

    const synchronized = await synchronizeInvestigationIndex({ workspaceRoot });
    assert.deepEqual(synchronized.errors, []);
    assert.equal(synchronized.changed, true);
    assert.deepEqual(
      (await queryInvestigationIndex({ workspaceRoot })).errors,
      []
    );
  })
));
