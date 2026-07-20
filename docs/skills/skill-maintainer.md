# Skill Maintainer

`skill-maintainer` 为可复用的 agent 能力确定应由新 skill、既有 skill 还是其他 owner 承接，并让选定的 skill 成为触发清楚、边界独立、可验证且可交付的行为单元。

## 核心定位

这个 skill 的源码、文档和发布由本仓库维护；它的行为契约决定能够服务哪些项目。安装后，它既可以维护仓库内的 skill，也可以处理独立目录或其他安装位置中的 skill。

执行时先识别当前环境实际提供的约定。环境已有目录规范、metadata、验证器或发布入口时，按这些契约集成；环境只提供一个目标位置时，使用自包含的最小基线完成可加载的 skill 目录和 `SKILL.md`。

## Skill 模型

一个 skill 由三层组成：`name` 与 `description` 构成发现入口，`SKILL.md` 正文承接触发后的行为，`references/`、`scripts/` 与 `assets/` 提供按需知识、确定性操作和输出素材。Metadata、文档、索引与发布配置是当前环境按需增加的集成层。

按主要作用，skill 可以归为知识与规则、流程与决策、工具与自动化、产出与模板、协调与入口五类。一个 skill 可以混合多种特征，但应选择一个主要类型来确定正文重心、资源结构和验证重点。

## 结构验证

Skill 包内提供 `scripts/validate-skill.mjs`，可在只有 Node 和目标 skill 目录的环境中检查可移植结构基线：

```text
node scripts/validate-skill.mjs <skill-directory>
```

它检查 `SKILL.md`、frontmatter 必需字段、名称与目录、正文、资源目录和内部 Markdown 链接；项目专属 metadata、索引和打包规则继续由项目自己的验证入口补充。

## 主要能力

1. 识别 skill 的组成、主要类型以及对应的验证重点。
2. 判断一次需求应该新增 skill、扩展已有 skill，还是交给其他 owner。
3. 用用户意图、行为责任和验收入口区分相邻 skill，减少重名和触发重叠。
4. 使用 skill 目录、`SKILL.md`、`name`、`description` 和完整行为契约组成可独立使用的最小交付。
5. 根据当前环境接入 references、scripts、assets、metadata、文档、验证和发布入口。
6. 通过随包结构验证器、环境校验、脚本运行和现实触发请求提供验证证据。

## 边界

`skill-maintainer` 拥有 skill 的归属判断、行为契约、资源边界和交付闭环。当前环境已经为文本、决策、测试、权限或版本控制提供专职 owner 时，它按触发条件与这些能力协作。
