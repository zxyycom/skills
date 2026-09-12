---
title: 按读取任务分配关系摘要消费
id: 260912-separate-relation-summary-consumption-by-reading-task
status: active
alignment: aligned
createdAt: 2026-09-12T07:21:43Z
purpose: 让关系筛选、写入核对与演进阅读各取得足够边说明，同时保持其他入口职责清楚。
background: 摘要可选且历史覆盖有限；不同入口需要不同粒度的边信息，不能把记录视图误作边证据。
decision: Decision 与 Investigation 按读取任务提供边说明，并保留完整正文、数据和公开 API 的既有边界。
tags:
  - decision-records
  - investigation-report
relations: []
---

## 目的

- 让需要解释关系的读取任务在不阅读全文的前提下取得足以定位边的说明，同时不把所有关系数据复制到普通发现入口。
- 让两域后续维护者能区分筛选依据、写入核对、局部演进阅读和完整语义审阅应消费的对象。

## 背景

- `summary` 是可选的来源视角说明；历史关系可以缺少它，完整理由仍在两端正文。已有写作方向要求新建或调整真实关系时填写有依据的摘要，但不要求历史批量回填。
- 记录列表、全文读取、关系事务和 trace 解决的问题不同。仅返回记录自身关系无法说明某条记录为何命中筛选；仅返回动作回执又无法核对完整替换是否移除了摘要。
- Decision 的 list/search 是内部查询表面；Investigation 的同类 entry 已是公开 API。索引、关系数据模型和 trace JSON 的既有边界不应因终端消费改进而扩大。

## 决策

- 采用: 两域在 `--related-to` 或 `--relation-type` 筛选时，于查询结果的可选 `filterRelations` 返回同一筛选快照中导致该记录命中的完整边集合。无关系条件时省略该字段；文本命中证据与筛选依据分开，普通 list/search 继续以记录发现为职责。
- 采用: Decision 的 `filterRelations` 限于内部 list/search 查询记录；Investigation 将其置于公开 list/search entry。两者都不写入索引、Schema 或正式关系数据模型，完整正文和完整直接关系继续由 show 或来源 Markdown 承接。
- 采用: Decision 新候选的 activate/evolve 及 Investigation 的 publish/set-relations 在适用的预检和成功结果中以 `relationReview` 返回按来源分组的完整 before/after。preflight 只说明预计集合且零写入，committed 才说明事务成功边界；失败不附成功 review。正式执行必须重新读取和验证，不能消费预检作为提交凭据。
- 采用: trace 保持现有图选择、预算、coverage 与 JSON。文本只展开切片内部边，已读取但缺少摘要明确标记；主体或必要的 context 事件边承接 source、type、target 与摘要。context 只闭合事件而不递归扩展，切片外边仍回到 entry 或来源正文读取。
- 采用: show、候选准备、状态或身份回执、检查、同步和 pending 保持原有职责，不为摘要消费扩展为关系解释入口。新增或调整关系仍以真实两端正文为依据；缺少摘要时说明读取路径，不推断或补写摘要。
