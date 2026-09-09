---
title: 用关系摘要说明具体演进
id: 260909-write-explanatory-relation-summaries
status: active
alignment: aligned
createdAt: 2026-09-09T02:43:41Z
purpose: 让读者通过关系摘要理解后继对前序的具体变化，并能按变化内容检索。
background: 关系类型和目标表达连接，简短摘要解释具体含义；发挥这一作用需要写作流程与示例共同引导。
decision: Decision 与 Investigation 新建或调整真实关系时填写有正文依据的简短摘要，格式、投影与图规则各自承接精确约束。
tags:
  - decision-records
  - investigation-report
relations:
  - type: 修订
    target: 260905-add-optional-relation-summaries
    summary: 保留字段兼容，改以主动填写摘要为写作路径
---

## 目的

- 让 Decision 与 Investigation 的关系摘要直接说明后继对前序具体做了什么，支持快速阅读与检索。

## 背景

- 本决策适用于 `skills/decision-records/` 与 `skills/investigation-report/`。
- 关系类型与目标可恢复拓扑，摘要可解释每条边的具体含义。已有存储与检索支持需要配套写作引导，才能稳定产生这些信息。
- 写作流程负责推荐用法，格式契约负责可接受的数据范围；分别维护可兼顾阅读质量与历史数据兼容。

## 决策

- 采用: 新建或调整真实直接关系时，依据两端正文为每条边填写 `summary`，从来源视角说明相对前序的具体变化、复核内容或承接范围。
- 采用: 各 skill 的 `SKILL.md` 承接写作行为，人类说明与关系示例展示同一推荐用法；字段与事务的精确约束由各自固定契约承接。
- 采用: `summary` 保持单行、trim 后最多 40 个 Unicode 码点；超限拒绝而非自动截断。字段在数据结构中仍可缺省，trim 后为空则省略，既有边不因该写作方向而要求批量回填。
- 采用: Markdown 是摘要的权威来源；索引、领域 API、图与 trace 投影已有摘要，rename 保留摘要。边身份、排序、去重和图规则由领域关系决定，摘要仅承接阅读说明。
- 采用: `search --in metadata` 将非空摘要作为 source 的独立文本 segment，命中返回来源记录与边上下文；target 内容及 type/target 字符串不充当来源文本证据，检索沿用既有范围与边身份。
