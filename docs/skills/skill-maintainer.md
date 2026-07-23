# Skill Maintainer

`skill-maintainer` 为可复用的 agent 能力确定应由新 skill、既有 skill 还是其他 owner 承接，并分别维护 skill 的行为边界与分发单元的交付边界。

## 核心定位

这个 skill 的源码、文档和发布由本仓库维护；它的行为契约决定能够服务哪些项目。安装后，它既可以维护仓库内的 skill，也可以处理独立目录或其他安装位置中的 skill。

执行时先识别当前环境实际提供的约定。环境已有目录规范、metadata、验证器或发布入口时，按这些契约恢复分发单元；环境只提供一个目标位置时，使用最小基线完成可加载的 skill 目录和 `SKILL.md`。

## Skill 模型

一个 skill 由三层组成：`name` 与 `description` 构成发现入口，`SKILL.md` 正文承接触发后的行为，`references/`、`scripts/` 与 `assets/` 提供按需知识、确定性操作和输出素材。Metadata、文档、索引与发布配置是当前环境按需增加的集成层。

Skill 是行为单元；分发单元是安装、更新、兼容性和交付的边界。一个分发单元可以只有一个 skill，也可以由一组不承诺单独使用的 skill 共同组成。同一单元内允许显式依赖和交接；跨单元依赖要写明前置条件和缺失路径。

在本项目中，`ai-ready-docs` 独立组成一个分发单元；四个 OpenSpec skills 共同组成一个分发单元。

按主要作用，skill 可以归为知识与规则、流程与决策、工具与自动化、产出与模板、协调与入口五类。一个 skill 可以混合多种特征，但应选择一个主要类型来确定正文重心、资源结构和验证重点。

## 结构验证

Skill 包内提供自包含的 `scripts/validate-skill.mjs`，可在只有 Node 和目标 skill 目录的环境中检查可移植结构基线：

```text
node scripts/validate-skill.mjs <skill-directory>
```

同一模块也可以从已安装 skill 的实际路径直接导入，使用 `validateSkillDirectory` 获取结构化结果，或使用 `runSkillValidatorCli` 在当前进程中复用 CLI 语义；导入不会自动运行校验，相邻的 `validate-skill.d.mts` 提供 TypeScript 类型。

它检查单个 skill 的 `SKILL.md`、frontmatter 必需字段、名称与目录、正文、资源目录和内部 Markdown 链接；分发单元成员、跨 skill 依赖、项目专属 metadata、索引和打包规则继续由项目自己的验证入口补充。没有单元级机械入口时，维护者需要逐项检查并报告残余风险。

## 主要能力

1. 识别 skill 的组成、主要类型以及对应的验证重点。
2. 判断一次需求应该新增 skill、扩展已有 skill，还是交给其他 owner。
3. 根据安装、更新、兼容性和完整工作流确定一个或多个 skill 的分发单元。
4. 允许同一分发单元内的成员显式依赖和交接，并收敛跨单元的未声明前提。
5. 根据当前环境接入 references、scripts、assets、metadata、文档、验证和发布入口。
6. 通过成员结构验证、单元集成验证、脚本运行和现实工作流提供验证证据。

## 边界

`skill-maintainer` 拥有 skill 的归属判断、行为契约、分发单元、资源边界和交付闭环。安装、更新和打包的具体实现继续服从当前环境的交付契约。
