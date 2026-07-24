---
title: 只恢复当前格式工具与派生索引
status: archived
alignment: null
createdAt: 2026-07-22T08:42:44Z
purpose: 让工具、索引或写入故障恢复到当前自包含 Markdown 与当前派生索引的单一可校验状态。
background: Markdown 已拥有全部权威状态，继续维护旧 schema 映射或独立索引状态会重新引入并行事实源和兼容路径。
decision: 恢复手册只处理当前格式；优先恢复当前 CLI，再从 Markdown 重建当前索引，不读取、迁移或推断其他 schema。
relations:
  - type: 替代
    target: decision-records/support-degraded-decision-maintenance.md
---

## 目的
- 让 decision-records CLI、运行时、索引或写事务损坏时能够恢复当前可维护工具和集合。
- 保留每条当前格式 Markdown 中的权威状态、时间、完整语义和关系，并从这些文件恢复派生查询索引。
- 阻止故障处理重新引入旧格式兼容、索引独占状态或基于默认值的语义推断。

## 背景
- 当前 Markdown frontmatter 和正文已经自包含 `status`、`alignment`、`createdAt`、完整语义与直接关系。
- 当前索引只是从全部有效 Markdown 生成的查询投影，缺失或损坏时不需要从旧索引恢复成员或状态。
- 随包 CLI、更新器、JSON Schema、release 与源码仍能帮助恢复可运行工具；这些路径都应回到同一当前契约。
- 旧 schema 映射、兼容读取或从文件时间和默认值补写元数据会制造固定契约之外的第二套语义。

## 决策
- 采用: 维护恢复手册只在 CLI 或 Node 不可用、索引缺失或损坏、写入中断，或严格 `check` 失败且普通诊断不足时读取。
- 采用: 工具故障优先通过已有替代运行时、随包更新器、当前 release 或仓库源码恢复同一份当前 CLI，不维护第二套长期脚本。
- 采用: 索引缺失、损坏或投影漂移时，只从全部有效当前格式 Markdown 生成符合当前固定契约的完整索引，不从索引反向覆盖 Markdown。
- 采用: CLI 暂时无法及时恢复而任务必须继续时，只按固定契约构建当前 schema 的完整候选索引；不为任何状态、时间、关系或缺失元数据设置默认值。
- 采用: 恢复路径不读取、迁移或解释其他 schema 与格式；无法从可信的当前格式 Markdown 恢复的判断请求用户确认。
- 采用: CLI 恢复后运行 `sync-index --write` 和严格 `check`，以 Markdown、索引、关系和 Git `HEAD` 边界全部一致作为完成条件。
