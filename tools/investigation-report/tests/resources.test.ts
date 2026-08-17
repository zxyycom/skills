import assert from "node:assert/strict";
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
  commitAll,
  createValidReports,
  initializeGitRepository,
  investigationRoot,
  reportEntryMarkdown,
  resourceIdForTopic,
  runGit,
  type ReportInput,
  withTempRoot,
  writeCollection,
  writeResource
} from "./support.ts";

type ResourceIndex = {
  definitionVersion: number;
  entries: Record<
    string,
    {
      state: {
        resourceReferences: Array<{
          reportIndex: number;
          resourceIds: string[];
        }>;
      };
    }
  >;
  metadata: Record<string, never>;
};

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
  return (
    await validateInvestigationReports({
      paths: [reportPath],
      workspaceRoot
    })
  ).errors;
}

test("validation keeps reports without attached resources valid", () =>
  withTempRoot("resources-optional", async (workspaceRoot) => {
    const reports = createValidReports();
    await writeCollection(workspaceRoot, reports);

    const validation = await validateInvestigationReports({ workspaceRoot });
    assert.deepEqual(validation.errors, []);

    const index = JSON.parse(
      await fs.readFile(
        path.join(investigationRoot(workspaceRoot), investigationIndexFileName),
        "utf8"
      )
    ) as ResourceIndex;
    assert.deepEqual(index.metadata, {});
    for (const entry of Object.values(index.entries)) {
      assert.deepEqual(entry.state.resourceReferences, []);
    }
  }));

test("owner reports anchor resource prefixes before other topics share them", () =>
  withTempRoot("resources-projection", async (workspaceRoot) => {
    const ownerTopicPath = "api/user-request.md";
    const ownerRequest = resourceIdForTopic(ownerTopicPath, "request.txt");
    const ownerResponse = resourceIdForTopic(ownerTopicPath, "response.bin");
    const ownerContext = resourceIdForTopic(ownerTopicPath, "context.md");
    const request = "GET /users/42\naccept: application/json\n";
    const response = Uint8Array.from([0, 1, 2, 127, 128, 255]);
    const context = "# 观测条件\r\n\r\n形成时使用 staging 配置。\r\n";
    await writeResource(workspaceRoot, ownerContext, context);
    await writeResource(workspaceRoot, ownerResponse, response);
    await writeResource(workspaceRoot, ownerRequest, request);

    await writeCollection(workspaceRoot, [
      {
        path: ownerTopicPath,
        question: "用户请求与响应如何对应？",
        reports: [
          {
            formedAt: "2026-07-20T09:00:00+08:00",
            resources: [{ id: ownerRequest, label: "请求原文" }],
            title: "保存请求"
          },
          {
            formedAt: "2026-07-21T09:00:00+08:00",
            resources: [
              { id: ownerContext, label: "观测条件" },
              { id: ownerResponse, label: "二进制响应" }
            ],
            title: "保存响应"
          }
        ],
        title: "用户请求调查"
      },
      {
        path: "runtime/shared-response.md",
        question: "共享响应在另一主题中如何复核？",
        reports: [
          {
            resources: [
              { id: ownerResponse, label: "共享响应" },
              { id: ownerContext, label: "共享观测条件" }
            ],
            title: "复核共享响应"
          }
        ],
        title: "共享响应调查"
      }
    ]);

    const index = JSON.parse(
      await fs.readFile(
        path.join(investigationRoot(workspaceRoot), investigationIndexFileName),
        "utf8"
      )
    ) as ResourceIndex;
    assert.equal(index.definitionVersion, 5);
    assert.deepEqual(index.metadata, {});
    assert.deepEqual(
      index.entries["api/user-request.md"]!.state.resourceReferences,
      [
        { reportIndex: 0, resourceIds: [ownerRequest] },
        {
          reportIndex: 1,
          resourceIds: [ownerContext, ownerResponse]
        }
      ]
    );
    assert.deepEqual(
      index.entries["runtime/shared-response.md"]!.state.resourceReferences,
      [
        {
          reportIndex: 0,
          resourceIds: [ownerContext, ownerResponse]
        }
      ]
    );
    assert.deepEqual(
      (await validateInvestigationReports({ workspaceRoot })).errors,
      []
    );
  }));

test("referenced resources require an owner topic and an owner report reference", () =>
  withTempRoot("resources-owner-errors", async (workspaceRoot) => {
    const consumerPath = "runtime/consumer.md";
    const missingOwnerId = "api/missing-owner/evidence.txt";
    const ownerWithoutReferenceId = "api/owner-without-reference/evidence.txt";
    await writeResource(workspaceRoot, missingOwnerId, "missing owner\n");
    await writeResource(
      workspaceRoot,
      ownerWithoutReferenceId,
      "owner does not reference\n"
    );
    await writeCollection(
      workspaceRoot,
      [
        {
          path: consumerPath,
          question: "资源是否必须由路径 owner 主题锚定？",
          reports: [
            {
              resources: [
                { id: missingOwnerId, label: "不存在的 owner" },
                { id: ownerWithoutReferenceId, label: "未引用 owner" }
              ],
              title: "检查 owner 锚点"
            }
          ],
          title: "资源 owner 锚点调查"
        },
        {
          path: "api/owner-without-reference.md",
          question: "owner 不引用资源是否阻止其他主题共享？",
          title: "未引用资源的 owner"
        }
      ],
      false
    );

    const result = await validateInvestigationReports({ workspaceRoot });
    assert.ok(
      result.errors.some((error) => error.includes(missingOwnerId)),
      result.errors.join("; ")
    );
    assert.ok(
      result.errors.some(
        (error) =>
          error.includes(ownerWithoutReferenceId) &&
          /owner|topic|reference/iu.test(error)
      ),
      result.errors.join("; ")
    );
  }));

test("scoped validation rejects resource links with non-kebab owner prefixes", () =>
  withTempRoot("resources-scoped-owner-prefix", async (workspaceRoot) => {
    const reportPath = "runtime/non-kebab-owner-prefix.md";
    const report: ReportInput = {
      path: reportPath,
      question: "局部检查是否拒绝非 kebab 的资源 owner 前缀？",
      reports: [
        {
          resources: [
            {
              id: "UPPER/Not-A-Slug/evidence.txt",
              label: "非法 owner 前缀"
            }
          ],
          title: "检查非 kebab owner"
        }
      ],
      title: "非 kebab 资源 owner 调查"
    };
    await writeCollection(workspaceRoot, [report], false);

    const errors = await validatePath(workspaceRoot, reportPath);
    assert.ok(
      errors.some(
        (error) =>
          error.includes("UPPER/Not-A-Slug/evidence.txt") &&
          /kebab-case owner topic prefix/iu.test(error)
      ),
      errors.join("; ")
    );
  }));

test("invalid owner topics cannot anchor resource references from valid consumers", () =>
  withTempRoot("resources-invalid-owner-consumer", async (workspaceRoot) => {
    const ownerPath = "api/invalid-owner.md";
    const consumerPath = "runtime/resource-consumer.md";
    const resourceId = resourceIdForTopic(ownerPath, "evidence.txt");
    await writeResource(workspaceRoot, resourceId, "evidence\n");
    await writeCollection(
      workspaceRoot,
      [
        {
          path: ownerPath,
          question: "无效主题能否成为资源 owner anchor？",
          reports: [
            {
              resources: [{ id: resourceId, label: "owner 资源" }],
              title: "无效 owner 报告"
            }
          ],
          status: "错误状态",
          title: "无效 owner 主题"
        },
        {
          path: consumerPath,
          question: "其他主题能否依赖无效 owner 的引用？",
          reports: [
            {
              resources: [{ id: resourceId, label: "消费者资源" }],
              title: "引用无效 owner 资源"
            }
          ],
          title: "资源消费者主题"
        }
      ],
      false
    );

    const result = await validateInvestigationReports({ workspaceRoot });
    assert.ok(
      result.errors.some(
        (error) =>
          error.includes(resourceId) &&
          /referenced by its owner topic/iu.test(error)
      ),
      result.errors.join("; ")
    );
  }));

test("resources linked only by invalid owner topics remain unreferenced warnings", () =>
  withTempRoot(
    "resources-invalid-owner-unreferenced",
    async (workspaceRoot) => {
      const ownerPath = "api/invalid-owner.md";
      const resourceId = resourceIdForTopic(ownerPath, "evidence.txt");
      await writeResource(workspaceRoot, resourceId, "evidence\n");
      await writeCollection(
        workspaceRoot,
        [
          {
            path: ownerPath,
            question: "无效主题的资源链接是否属于全量合法引用？",
            reports: [
              {
                resources: [{ id: resourceId, label: "无效 owner 资源" }],
                title: "无效主题资源链接"
              }
            ],
            status: "错误状态",
            title: "只含无效 owner 的主题"
          }
        ],
        false
      );

      const result = await validateInvestigationReports({ workspaceRoot });
      assert.ok(result.errors.some((error) => error.includes(ownerPath)));
      assert.ok(
        result.warnings.some(
          (warning) =>
            warning.includes(resourceId) &&
            /referenced by its owner topic/iu.test(warning)
        ),
        result.warnings.join("; ")
      );
    }
  ));

test("resource ID whitelist accepts common names and rejects structural hazards", () =>
  withTempRoot("resources-readable-ids", async (workspaceRoot) => {
    const topicPath = "runtime/readable-resource-ids.md";
    const resources = [
      {
        id: resourceIdForTopic(
          topicPath,
          "接口+响应@v2=ok/截图[1]【终版】(修订(二)).png"
        ),
        label: "接口截图"
      },
      {
        id: resourceIdForTopic(
          topicPath,
          "【原始】报告《摘要》-问题：原因，修订！.pdf"
        ),
        label: "原始报告"
      },
      {
        id: resourceIdForTopic(topicPath, "_O'Reilly~摘录().txt"),
        label: "英文摘录"
      },
      {
        id: resourceIdForTopic(
          topicPath,
          "白名单._-+@=()（）[]【】《》,!~'，。！、·：？.txt"
        ),
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
    await writeCollection(workspaceRoot, [
      {
        path: topicPath,
        question: "白名单资源名称能否保持可读并安全引用？",
        reports: [{ resources, title: "核对可读资源名称" }],
        title: "可读资源名称调查"
      }
    ]);

    const validation = await validateInvestigationReports({ workspaceRoot });
    assert.deepEqual(validation.errors, []);
    const index = JSON.parse(
      await fs.readFile(
        path.join(investigationRoot(workspaceRoot), investigationIndexFileName),
        "utf8"
      )
    ) as ResourceIndex;
    assert.deepEqual(index.entries[topicPath]!.state.resourceReferences, [
      {
        reportIndex: 0,
        resourceIds: resources.map(({ id }) => id).sort()
      }
    ]);

    const withOwner = (resourceSubpath: string): string =>
      resourceIdForTopic(topicPath, resourceSubpath);
    assert.equal(isInvestigationResourceId(withOwner("响应().json")), true);
    assert.equal(isInvestigationResourceId(withOwner("响应(最终).json")), true);
    for (const allowedInfix of [
      ".",
      "_",
      "-",
      "+",
      "@",
      "=",
      "()",
      "（",
      "）",
      "[",
      "]",
      "【",
      "】",
      "《",
      "》",
      ",",
      "!",
      "~",
      "'",
      "，",
      "。",
      "！",
      "、",
      "·",
      "：",
      "？"
    ]) {
      assert.equal(
        isInvestigationResourceId(withOwner(`甲${allowedInfix}乙.txt`)),
        true,
        `allowed infix ${JSON.stringify(allowedInfix)}`
      );
    }
    assert.equal(
      isInvestigationResourceId(
        withOwner(`甲${"(".repeat(32)}乙${")".repeat(32)}.txt`)
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
      [
        "parenthesis nesting above 32",
        `甲${"(".repeat(33)}乙${")".repeat(33)}.txt`
      ],
      ["whitespace", "中文 文件.txt"],
      ["ASCII query marker", "响应?.txt"],
      ["fragment marker", "响应#.txt"],
      ["percent encoding marker", "响应%.txt"],
      ["angle brackets", "响应<副本>.txt"],
      ["ASCII colon", "响应:副本.txt"],
      ["asterisk", "响应*副本.txt"],
      ["vertical bar", "响应|副本.txt"],
      ["double quote", '响应"副本.txt'],
      ["ampersand", "响应&副本.txt"],
      ["backtick", "响应`副本.txt"],
      ["emoji", "响应🎉.txt"]
    ]) {
      assert.equal(
        isInvestigationResourceId(withOwner(invalidId)),
        false,
        `${reason}: ${invalidId}`
      );
    }
  }));

test("attached resource field is strict when present", () =>
  withTempRoot("resources-field", async (workspaceRoot) => {
    const emphasizedLabel = rawResourceFieldReport(
      "runtime/emphasized-resource-label.md",
      [
        "- 随附资源:",
        "  - [**强调样本**](../_resources/runtime/emphasized-resource-label/sample.txt)"
      ]
    );
    const emptyField = rawResourceFieldReport(
      "runtime/empty-resource-field.md",
      ["- 随附资源:"]
    );
    const emptyLabel = rawResourceFieldReport(
      "runtime/empty-resource-label.md",
      ["- 随附资源:", "  - [](../_resources/sample.txt)"]
    );
    const duplicate = rawResourceFieldReport("runtime/duplicate-resource.md", [
      "- 随附资源:",
      "  - [样本](../_resources/sample.txt)",
      "  - [重复样本](../_resources/sample.txt)"
    ]);
    const trailingText = rawResourceFieldReport(
      "runtime/resource-link-trailing-text.md",
      ["- 随附资源:", "  - [样本](../_resources/sample.txt) 额外文字"]
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
      ["- 随附资源:", "  1. [样本](../_resources/sample.txt)"]
    );
    const titledLink = rawResourceFieldReport(
      "runtime/titled-resource-link.md",
      ["- 随附资源:", '  - [样本](../_resources/sample.txt "说明")']
    );
    const referenceStyleLink = rawResourceFieldReport(
      "runtime/reference-style-resource-link.md",
      ["- 随附资源:", "  - [样本][sample-resource]"]
    );
    referenceStyleLink.body = [
      referenceStyleLink.body,
      "",
      "[sample-resource]: ../_resources/sample.txt"
    ].join("\n");
    for (const report of [
      emptyField,
      emptyLabel,
      duplicate,
      trailingText,
      resourceAfterMetadata,
      duplicateField,
      multipleLinksInItem,
      orderedResourceList,
      titledLink,
      referenceStyleLink
    ]) {
      report.body = report.body?.replaceAll(
        /\.\.\/_resources\/(sample|other)\.txt/gu,
        (_target, filename: string) =>
          `../_resources/${resourceIdForTopic(report.path, `${filename}.txt`)}`
      );
    }
    await writeResource(
      workspaceRoot,
      "runtime/emphasized-resource-label/sample.txt",
      "sample\n"
    );
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
      [
        emptyLabel,
        "exactly one local Markdown link with non-empty display text"
      ],
      [duplicate, "must not reference resource"],
      [
        trailingText,
        "exactly one local Markdown link with non-empty display text"
      ],
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
  }));

test("validation rejects unsafe attached resource paths", () =>
  withTempRoot("resources-paths", async (workspaceRoot) => {
    const prefixDiagnostic = (target: string): string =>
      `resource link target ${JSON.stringify(target)} must use ` +
      "../_resources/<resource-id> without queries, fragments, encoding, " +
      "or backslashes";
    const idDiagnostic = (target: string): string =>
      `resource link target ${JSON.stringify(target)} must contain a safe, ` +
      "normalized resource id";
    const rawSpellingDiagnostic =
      "resource link target must be written " +
      "literally as ../_resources/<resource-id> without Markdown escapes " +
      "or character references";
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
  }));

test("validation reports missing attached resources", () =>
  withTempRoot("resources-missing", async (workspaceRoot) => {
    const report: ReportInput = {
      path: "runtime/missing-resource.md",
      question: "缺失资源是否会被定位？",
      reports: [
        {
          resources: [
            {
              id: "runtime/missing-resource/sample.txt",
              label: "缺失样本"
            }
          ],
          title: "检查缺失资源"
        }
      ],
      title: "缺失资源调查"
    };
    await writeCollection(workspaceRoot, [report], false);

    const errors = await validatePath(workspaceRoot, report.path);
    assert.ok(
      errorSummary(errors).includes("runtime/missing-resource/sample.txt")
    );
    assert.match(errorSummary(errors), /does not exist|missing/u);
  }));

test("validation reports attached resource case mismatches", () =>
  withTempRoot("resources-case", async (workspaceRoot) => {
    const report: ReportInput = {
      path: "runtime/resource-case.md",
      question: "资源大小写不一致是否会被定位？",
      reports: [
        {
          resources: [
            {
              id: "runtime/resource-case/sample.txt",
              label: "大小写样本"
            }
          ],
          title: "检查大小写"
        }
      ],
      title: "资源大小写调查"
    };
    await writeResource(
      workspaceRoot,
      "runtime/resource-case/Sample.txt",
      "sample\n"
    );
    await writeCollection(workspaceRoot, [report], false);

    const errors = await validatePath(workspaceRoot, report.path);
    const summary = errorSummary(errors);
    assert.ok(
      summary.includes(
        '_resources/runtime/resource-case/sample.txt must match actual path casing; found "Sample.txt"'
      ),
      summary
    );
    assert.doesNotMatch(summary, /does not exist/u);
  }));

test("validation rejects symbolic links in attached resource paths", () =>
  withTempRoot("resources-symlink", async (tempRoot) => {
    const cases = ["root", "component", "file"] as const;
    for (const kind of cases) {
      const workspaceRoot = path.join(tempRoot, kind);
      const resourceId =
        kind === "component"
          ? `runtime/${kind}-symlink/linked/sample.txt`
          : `runtime/${kind}-symlink/sample.txt`;
      const report: ReportInput = {
        path: `runtime/${kind}-symlink.md`,
        question: "符号链接资源是否会被拒绝？",
        reports: [
          {
            resources: [{ id: resourceId, label: "符号链接样本" }],
            title: "检查符号链接"
          }
        ],
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
          await fs.mkdir(
            path.join(resourcesRoot, "runtime", `${kind}-symlink`),
            {
              recursive: true
            }
          );
          await fs.symlink(
            outsideRoot,
            path.join(resourcesRoot, "runtime", `${kind}-symlink`, "linked")
          );
        } else {
          await fs.mkdir(
            path.join(resourcesRoot, "runtime", `${kind}-symlink`),
            {
              recursive: true
            }
          );
          await fs.symlink(
            path.join(outsideRoot, "sample.txt"),
            path.join(resourcesRoot, "runtime", `${kind}-symlink`, "sample.txt")
          );
        }
      }

      const errors = await validatePath(workspaceRoot, report.path);
      if (kind !== "root") {
        assert.ok(
          errorSummary(errors).includes(resourceId),
          errorSummary(errors)
        );
      }
      assert.match(errorSummary(errors), /symbolic link/u);
    }
  }));

test("validation rejects attached resource targets that are not regular files", () =>
  withTempRoot("resources-file-type", async (workspaceRoot) => {
    const report: ReportInput = {
      path: "runtime/directory-resource.md",
      question: "资源目标是否必须是普通文件？",
      reports: [
        {
          resources: [
            {
              id: "runtime/directory-resource/directory",
              label: "目录目标"
            }
          ],
          title: "检查资源类型"
        }
      ],
      title: "资源类型调查"
    };
    await writeCollection(workspaceRoot, [report], false);
    await fs.mkdir(
      path.join(
        investigationRoot(workspaceRoot),
        "_resources",
        "runtime",
        "directory-resource",
        "directory"
      ),
      { recursive: true }
    );

    const errors = await validatePath(workspaceRoot, report.path);
    assert.ok(errorSummary(errors).includes("directory"), errorSummary(errors));
    assert.match(errorSummary(errors), /regular file/u);
  }));

test("unreferenced resource pool hazards warn only and scoped checks prove neither owner anchoring nor global unreferenced-resource state", () =>
  withTempRoot("resources-scope", async (workspaceRoot) => {
    const report = createValidReports()[0]!;
    await writeCollection(workspaceRoot, [report]);
    await writeResource(
      workspaceRoot,
      "codex/project-shell-registration/orphan.txt",
      "not referenced\n"
    );
    await writeResource(workspaceRoot, "orphan.txt", "illegal owner\n");
    await writeResource(
      workspaceRoot,
      "runtime/unreferenced-owner/illegal🎉.txt",
      "illegal id\n"
    );
    const resourcesRoot = path.join(
      investigationRoot(workspaceRoot),
      "_resources",
      "runtime",
      "unreferenced-owner"
    );
    await fs.mkdir(path.join(resourcesRoot, "directory"), { recursive: true });
    await fs.symlink(
      path.join(resourcesRoot, "orphan.txt"),
      path.join(resourcesRoot, "linked.txt")
    );

    const scoped = await validateInvestigationReports({
      paths: [report.path],
      workspaceRoot
    });
    assert.deepEqual(scoped.errors, []);
    assert.deepEqual(scoped.warnings, []);
    assert.equal(scoped.indexChecked, false);

    const complete = await validateInvestigationReports({ workspaceRoot });
    assert.deepEqual(complete.errors, []);
    assert.ok(complete.warnings.length >= 4, complete.warnings.join("; "));
    assert.match(
      errorSummary(complete.warnings),
      /codex\/project-shell-registration\/orphan.txt/u
    );
    assert.match(errorSummary(complete.warnings), /illegal🎉.txt/u);
    assert.match(errorSummary(complete.warnings), /symbolic link/u);
    assert.match(errorSummary(complete.warnings), /regular file/u);
    assert.deepEqual(
      complete.warnings,
      [...complete.warnings].sort((left, right) =>
        left < right ? -1 : left > right ? 1 : 0
      )
    );
  }));

test("a resource root that cannot be inspected makes validation an error", () =>
  withTempRoot("resources-root-unavailable", async (workspaceRoot) => {
    const topicPath = "runtime/root-unavailable.md";
    const resourceId = resourceIdForTopic(topicPath, "evidence.txt");
    await writeCollection(
      workspaceRoot,
      [
        {
          path: topicPath,
          question: "资源根不可用时能否仍判定资源完整？",
          reports: [
            {
              resources: [{ id: resourceId, label: "不可读资源根" }],
              title: "检查资源根错误"
            }
          ],
          title: "资源根错误调查"
        }
      ],
      false
    );
    await fs.writeFile(
      path.join(investigationRoot(workspaceRoot), "_resources"),
      "not a directory\n"
    );

    const result = await validateInvestigationReports({ workspaceRoot });
    assert.ok(
      result.errors.some((error) =>
        /_resources.*directory|resource.*check.*completed/iu.test(error)
      ),
      result.errors.join("; ")
    );
  }));

test("a Git membership query failure makes full resource validation an error", () =>
  withTempRoot("resources-membership-unavailable", async (workspaceRoot) => {
    const topicPath = "runtime/membership-unavailable.md";
    const resourceId = resourceIdForTopic(topicPath, "evidence.txt");
    await writeResource(workspaceRoot, resourceId, "evidence\n");
    await writeCollection(
      workspaceRoot,
      [
        {
          path: topicPath,
          question: "版本控制成员查询失败能否降级为 warning？",
          reports: [
            {
              resources: [{ id: resourceId, label: "成员查询资源" }],
              title: "检查成员查询错误"
            }
          ],
          title: "资源成员查询错误调查"
        }
      ],
      false
    );
    await fs.mkdir(path.join(workspaceRoot, ".git"));

    const result = await validateInvestigationReports({ workspaceRoot });
    assert.ok(
      result.errors.some((error) =>
        /membership|version-control|Git/iu.test(error)
      ),
      result.errors.join("; ")
    );
  }));

test("tracked unreferenced resource members warn when their entire resource root is deleted", () =>
  withTempRoot("resources-deleted-tracked-root", async (workspaceRoot) => {
    const topicPath = "runtime/deleted-resource-root.md";
    const resourceId = resourceIdForTopic(topicPath, "evidence.txt");
    initializeGitRepository(workspaceRoot);
    await writeResource(workspaceRoot, resourceId, "tracked evidence\n");
    await writeCollection(workspaceRoot, [
      {
        path: topicPath,
        question: "已跟踪但未引用的资源根删除后是否只产生 warning？",
        title: "删除资源根后的 tracked 成员"
      }
    ]);
    commitAll(workspaceRoot, "baseline tracked resource");
    await fs.rm(path.join(investigationRoot(workspaceRoot), "_resources"), {
      force: true,
      recursive: true
    });

    const result = await validateInvestigationReports({ workspaceRoot });
    assert.deepEqual(result.errors, []);
    assert.ok(
      result.warnings.some(
        (warning) =>
          warning.includes(resourceId) && /does not exist/iu.test(warning)
      ),
      result.warnings.join("; ")
    );
  }));

test("ignored binary resources fail only when referenced, then become managed after git add -f", () =>
  withTempRoot("resources-ignored-reference", async (workspaceRoot) => {
    initializeGitRepository(workspaceRoot);
    await fs.writeFile(
      path.join(workspaceRoot, ".gitignore"),
      "*.bin\n",
      "utf8"
    );
    const topicPath = "runtime/ignored-resource.md";
    const ignoredResourceId = resourceIdForTopic(
      topicPath,
      "captures/ignored-response.bin"
    );
    const report: ReportInput = {
      path: topicPath,
      question: "被忽略的文件能否作为调查证据？",
      reports: [
        {
          resources: [
            {
              id: ignoredResourceId,
              label: "被忽略响应"
            }
          ],
          title: "核对被忽略资源"
        }
      ],
      title: "被忽略资源调查"
    };
    await writeResource(
      workspaceRoot,
      ignoredResourceId,
      Uint8Array.of(0, 127, 128, 255)
    );
    await writeCollection(workspaceRoot, [report], false);

    const ignored = await validateInvestigationReports({ workspaceRoot });
    const summary = errorSummary(ignored.errors);
    assert.match(summary, /ignored by version-control rules/u);
    assert.deepEqual(ignored.warnings, []);

    runGit(workspaceRoot, [
      "add",
      "--force",
      path.posix.join("docs/investigations/_resources", ignoredResourceId)
    ]);
    const managed = await validatePath(workspaceRoot, report.path);
    assert.deepEqual(managed, []);

    await writeCollection(workspaceRoot, [
      {
        ...report,
        reports: [{ title: "移除已受管二进制引用" }]
      }
    ]);
    const unreferenced = await validateInvestigationReports({ workspaceRoot });
    assert.deepEqual(unreferenced.errors, []);
    assert.ok(
      unreferenced.warnings.some((warning) =>
        warning.includes(ignoredResourceId)
      ),
      unreferenced.warnings.join("; ")
    );
  }));

test("resource pool changes leave list fresh while report link changes invalidate its entry", () =>
  withTempRoot("resources-revision", async (workspaceRoot) => {
    const topicPath = "runtime/resource-revision.md";
    const originalId = resourceIdForTopic(topicPath, "captures/response.bin");
    const addedId = resourceIdForTopic(topicPath, "captures/added.bin");
    const renamedId = resourceIdForTopic(
      topicPath,
      "captures/renamed-response.bin"
    );
    const report = (resourceId: string): ReportInput => ({
      path: topicPath,
      question: "资源变化是否会保持主题索引可查询？",
      reports: [
        {
          resources: [{ id: resourceId, label: "响应样本" }],
          title: "检查资源 revision"
        }
      ],
      title: "资源索引边界调查"
    });
    await writeResource(workspaceRoot, originalId, Uint8Array.from([1, 2, 3]));
    await writeCollection(workspaceRoot, [report(originalId)]);

    const collectionRoot = investigationRoot(workspaceRoot);
    const initialRevision =
      await readInvestigationSourceRevision(collectionRoot);
    await writeResource(workspaceRoot, originalId, Uint8Array.from([1, 2, 4]));
    const contentRevision =
      await readInvestigationSourceRevision(collectionRoot);
    assert.deepEqual(contentRevision, initialRevision);

    await writeResource(workspaceRoot, addedId, Uint8Array.from([9]));
    const addedRevision = await readInvestigationSourceRevision(collectionRoot);
    assert.deepEqual(addedRevision, contentRevision);
    assert.deepEqual(
      (await queryInvestigationIndex({ workspaceRoot })).errors,
      []
    );
    await fs.rm(path.join(collectionRoot, "_resources", ...addedId.split("/")));
    const removedRevision =
      await readInvestigationSourceRevision(collectionRoot);
    assert.deepEqual(removedRevision, addedRevision);

    const contentFresh = await queryInvestigationIndex({ workspaceRoot });
    assert.deepEqual(contentFresh.errors, []);
    assert.equal(contentFresh.total, 1);
    const contentCheck = await validateInvestigationReports({ workspaceRoot });
    assert.equal(contentCheck.indexChecked, true);
    assert.deepEqual(contentCheck.errors, []);
    const contentSynchronized = await synchronizeInvestigationIndex({
      workspaceRoot
    });
    assert.deepEqual(contentSynchronized.errors, []);
    assert.equal(contentSynchronized.changed, false);

    await fs.rename(
      path.join(collectionRoot, "_resources", ...originalId.split("/")),
      path.join(collectionRoot, "_resources", ...renamedId.split("/"))
    );
    const renamedOnlyRevision =
      await readInvestigationSourceRevision(collectionRoot);
    assert.deepEqual(renamedOnlyRevision, removedRevision);
    assert.deepEqual(
      (await queryInvestigationIndex({ workspaceRoot })).errors,
      []
    );

    await writeCollection(workspaceRoot, [report(renamedId)], false);
    const renamedRevision =
      await readInvestigationSourceRevision(collectionRoot);
    assert.equal(renamedRevision.metadata, contentRevision.metadata);
    assert.notDeepEqual(renamedRevision.entries, contentRevision.entries);

    const renameStale = await queryInvestigationIndex({ workspaceRoot });
    assert.deepEqual(renameStale.entries, []);
    assert.ok(
      errorSummary(renameStale.errors).includes("source revision"),
      errorSummary(renameStale.errors)
    );
    const renameCheck = await validateInvestigationReports({ workspaceRoot });
    assert.equal(renameCheck.indexChecked, true);
    assert.ok(
      errorSummary(renameCheck.errors).includes("state projection"),
      errorSummary(renameCheck.errors)
    );

    const synchronized = await synchronizeInvestigationIndex({ workspaceRoot });
    assert.deepEqual(synchronized.errors, []);
    assert.equal(synchronized.changed, true);
    assert.deepEqual(
      (await queryInvestigationIndex({ workspaceRoot })).errors,
      []
    );
  }));
