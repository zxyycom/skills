---
title: 以调查主题维护可重建查询索引
status: active
alignment: aligned
createdAt: 2026-08-06T09:20:46Z
purpose: 让调查主题作为稳定发现和续接单位，并使查询投影可以从同一领域源快照完整重建。
background: 主题拥有核心问题和生命周期，报告只是时点认识；查询需要低成本读取，但派生索引不能成为第二事实源。
decision: 每个主题生成一个主题级索引项；领域 state、keys、metadata 与 source revision 从同一完整源快照确定性派生，索引可以删除重建。
relations:
  - type: 修订
    target: investigation-report/generate-query-index-from-topic-files.md
---

## 目的
- 让调查主题随着数量增长仍可按身份、分类、状态、最新报告时间和文本稳定发现，并能继续同一核心问题。
- 保留主题内报告数量、形成顺序和最近记录信息，同时不把单份报告误作独立生命周期单位或累积当前口径。
- 让主题与其他领域源保持权威，查询索引损坏、缺失或被删除时可以从完整源快照重建。
- 让 `investigation-report` 使用通用索引能力，同时保持独立分发和领域命令边界。

## 背景
- 一个主题文件承接稳定核心问题、调查状态和追加报告序列；每份 H3 报告只表达特定形成时点的认识。
- 路径首段只是分类，同一分类可以包含多个核心问题不同的主题；以分类或报告作为主索引单位都会丢失主题身份。
- 手写索引会复制主题标题、问题、状态和时间，形成需要双写且容易漂移的第二事实源。
- 通用索引已经提供稳定 ID、多 key、类型化 metadata、source revision、确定性同步和统一 reader；调查领域只需拥有源发现、state 与 key 投影和领域 CLI。

## 决策
- 采用: 相对调查根目录的 `<category-id>/<semantic-slug>.md` 路径是主题在当前集合中的 ID；每个主题只产生一个 `investigation-index.json` entry，报告不产生独立主 entry，移动主题会显式改变 ID。
- 采用: 主题 state 投影标题、核心问题、状态、最新报告时间、报告数量和按形成顺序排列的报告标题；不复制报告正文、结果摘要或 Markdown 展示标记。
- 采用: 领域派生 `category`、`status`、`latest-report-at` 和 `text` keys；文本只聚合主题标题、核心问题和报告标题，路径查询使用通用保留 ID。
- 采用: 最新报告只表示最近形成的认识，不自动成为累积当前口径；正文级历史知识检索可以建立独立读取侧，但不改变主题主索引粒度。
- 采用: 领域从同一次完整源读取生成 metadata、主题 state 和 `sourceRevision`；任何会改变成员、state、keys 或 metadata 的源变化都改变 revision，解析、身份或 key 契约变化时提升 definition version。
- 采用: `sync-index` 在完整源有效后确定性替换索引，并在写入前复核 revision；默认 `check` 验证完整集合和索引新鲜度，局部筛选检查不证明全局索引可查询。
- 采用: 领域 `list` 先核对当前 revision，再查询持久化主题 state 与 keys；使用者不需要理解通用索引 API 或逐份解析报告正文。
- 采用: `investigation-index.json` 是可以删除重建的唯一调查查询投影，不保留手写兼容索引；构建器把通用索引源码内联进自包含分发模块，并随包提供领域 JSON Schema。
