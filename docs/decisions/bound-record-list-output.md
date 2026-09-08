---
title: 限制记录列表输出并优先展示近期对象
id: 260908-bound-record-list-output
status: active
alignment: aligned
createdAt: 2026-09-08T06:47:16Z
purpose: 让大型记录集合可先按筛选概览定位，再读取少量近期对象。
background: 默认全量多行列表会随集合增长占用终端与 agent 上下文，且旧记录优先降低近期对象可发现性。
decision: Decision 与 Investigation 在查询时从同一索引快照聚合筛选概览，默认显示近期有界单行结果，并以 detail 显式展开。
tags:
  - decision-records
  - investigation-report
relations: []
---

## 目的

- 让 Decision 与 Investigation 的列表在记录集合持续增长后仍能用有界输出支持快速定位。
- 让筛选概览、近期结果与完整对象读取各自承担清楚的查询责任。

## 背景

- 两个领域的默认列表会固定展开每条记录的多行投影；Decision 还会返回全部 active 记录，输出长度随集合线性增长。
- 调用者通常需要先了解 tags、时间范围及领域状态，再查看少量近期对象，而不是先读取全部路径、目的或问题。
- 索引 entries 已经包含这些筛选字段，查询也会加载并遍历同一快照；当前没有证据证明必须为避免一次内存聚合而扩展持久 metadata 和共享索引事务。
- 持久化 entry-derived facets 会使任意 entry 变化同时成为 collection metadata 变化，并与按 ID 的 selected sync 和 selected staging 边界冲突。

## 决策

- 采用: Decision 与 Investigation 的 list query 从同一次已加载的完整索引 snapshot 聚合全局筛选 facets；不读取 Markdown、不改写索引，也不把这些统计持久化到 metadata。
- 采用: 默认列表按领域时间降序并以 ID 稳定打破平局，只返回有界的近期窗口和紧凑单行；显式 limit、offset 和领域筛选负责继续定位。
- 采用: `--detail` 只改变展示密度，在同一筛选、排序和分页窗口中保留原有多行字段；完整正文继续由 `show` 读取。
- 采用: 默认 facets preview 自身必须有界，并明确区分完整索引的 `Index filters`、本次 `Applied filters` 与分页后的 `Latest matches`。
- 不采用: 为这项列表显示优化新增 entries-derived metadata、通用 facet 框架、无限列表模式或目录分片。
