---
title: 让关系边携带可检索的简短说明
id: 260905-add-optional-relation-summaries
status: active
alignment: aligned
createdAt: 2026-09-05T06:27:30Z
purpose: 让直接演进关系可以快速说明具体承载的变化，并能从索引中检索。
background: 现有关系只有类型和目标，图与追踪可以恢复拓扑，却不能直接解释每条边具体表达什么。
decision: Decision 与 Investigation 的关系边可选保存最多 40 个 Unicode 码点的单行摘要，并投影到索引和查询结果。
tags:
  - decision-records
  - investigation-report
relations: []
---

## 目的

- 让 Decision 与 Investigation 的直接演进关系在不展开完整记录时，也能说明这条边具体承载的变化。
- 让简短的关系语义可由派生索引检索，同时保持记录正文和图拓扑各自的责任。

## 背景

- 现有关系只保存类型和目标；图与 trace 可以恢复连接方向，却不能直接回答后继记录对该前序具体补充、修正、替代或承接了什么。
- 关系集合在以调查为主的工作区可能很大；为所有旧边强制回填语义会把可选的阅读增强变成大规模迁移门禁。
- 摘要只有保持短小、关系专属且不参与图计算，才不会替代正文或破坏既有边身份。

## 决策

- 采用: Decision 与 Investigation 的每条直接关系都可选保存 `summary`；摘要从关系 source 视角说明该 source 对 target 具体做了什么。
- 采用: `summary` 输入先去除首尾空白；结果为空时省略字段，非空值必须是单行且不超过 40 个 Unicode 码点。违反限制时失败，不自动截断或改写。
- 采用: 旧关系和新关系都可省略摘要；实施不得要求批量回填或迁移已有边。
- 采用: 边身份、去重、规范排序、时间方向、拆分与归并形状及无环检查继续只由既有的 source、type 和 target 规则决定；`summary` 只是边的阅读说明。
- 采用: Markdown 是摘要的权威来源；派生索引、领域 API、图和 trace 投影存在的摘要，rename 改写 target 时保留它。
- 采用: `search --in metadata` 可把非空关系摘要作为 source 记录的独立文本 segment；命中时返回该 source 记录和对应边上下文，不把 target 记录或 type/target 字符串当作自由文本命中。
- 不采用: 为关系摘要新增独立搜索范围（包括 `--in relations`）、边 ID 或任何参与拓扑的文本权重。
