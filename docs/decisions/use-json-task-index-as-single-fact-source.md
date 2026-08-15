---
title: 以 JSON task index 作为唯一协调事实源
status: active
alignment: aligned
createdAt: 2026-08-11T03:22:00Z
purpose: 让 task 身份、内容、状态、拓扑和执行租约只有一个受工具管理的权威表示。
background: 为每个 task 建立 Markdown 和派生索引会增加发现、同步与新鲜度成本，并形成第二事实源。
decision: 每个 task 直接作为权威 JSON 索引中的 entry 存在，不建立逐 task 文档、归档目录或默认事件历史。
tags:
  - task-graph
relations:
  - type: 拆分
    target: use-authoritative-json-index-for-task-coordination.md
---

## 目的

- 让 task 身份、紧凑内容、显式状态、拓扑关系、执行租约和结果拥有单一可查询事实源。
- 避免逐 task 源文件与派生索引之间的同步、发现和新鲜度维护面。

## 背景

- Task entry 只需要当前执行协调所需的目标、少量上下文、关系、状态、租约和结果摘要。
- 稳定需求、完整设计、正式审阅和历史证据已经由各自长期 owner 承接，不需要复制进任务存储。
- 从逐 task Markdown 再生成查询索引会同时维护源文件和投影，并使频繁 mutation 扩散为大量文件变化。

## 决策

- 采用: 使用一个受工具事务管理的 JSON task index 作为任务身份、协调内容、显式状态、拓扑关系、执行租约和结果的唯一事实源；它不是从逐 task 文件生成的派生索引。
- 采用: 每个 task 直接作为索引中的 JSON entry 存在，不创建 task Markdown、物理归档目录或默认事件历史。
- 采用: Task entry 只保存执行协调所需的本地内容和稳定引用；长篇背景、长期理由、正式 change 与历史证据继续由对应 owner 承接。
- 采用: 可行动性、有效控制、阻塞原因和反向关系从完整索引确定性投影，不写回第二份状态。
- 不采用: 以逐 task 文档、默认事件流或另一个派生目录并行维护相同协调事实。
