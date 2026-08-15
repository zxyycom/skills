---
title: 由嵌套字典键承接任务身份并分离内容与状态
status: archived
alignment: aligned
createdAt: 2026-08-06T12:11:25Z
purpose: 让 scope 与 task 的字典键成为身份和归属的唯一来源，同时保持任务内容、显式状态与查询投影边界清楚。
background: 任务采用嵌套字典后，如果 entry 内继续重复保存 ID 和作用域，就会形成可分叉的身份事实；内容、运行事实和派生结果混写也会让调度语义失真。
decision: 嵌套字典键承接身份与作用域；task entry 只保存 content 和显式 state，派生信息仅在查询时投影。
tags:
  - task-graph
relations:
  - type: 修订
    target: separate-task-content-state-and-effective-projection.md
---

## 目的

- 让 scope 和 task 可以按稳定 ID 直接定位，并确保身份、作用域归属只有一个权威表示。
- 让紧凑任务语义与复杂调度状态各自清楚，避免一个 entry 退化为难以辨认的平铺字段集合。
- 防止 `ready`、`waiting`、阻塞原因和继承来源等派生结果与显式关系发生新鲜度漂移。

## 背景

- Task graph 使用 `scopes` 及 scope 内 `tasks` 的嵌套字典保存短期任务；字典 key 已经能够稳定表达 scope 身份、task 身份和二者的归属关系。
- 如果 scope entry 或 task entry 再保存相同的 `id`、`scopeId`，一次移动、重命名或损坏就可能产生两个互相冲突的身份事实源。
- 一个任务的内容通常只包含目标结果、完成条件、少量上下文、引用和结果摘要，而调度状态还涉及人工控制、实际执行、父子继承、依赖、排斥、租约和时间。
- 把派生有效状态重新写回权威 entry，会要求每次拓扑变化同步更新多个任务并形成冗余事实。

## 决策

- 采用: `scopes[scopeId].tasks[taskId]` 的字典路径是 scope 身份、task 身份和作用域归属的唯一权威表示；scope entry 不重复保存 `scopeId`，task entry 不重复保存 `taskId` 或 `scopeId`。
- 采用: task entry 分别使用 `content` 和 `state` 承接任务语义与显式运行事实；schema 拒绝未声明字段，避免重新引入平行身份或派生缓存。
- 采用: `content` 只保存目标结果、完成条件、必要上下文、外部引用和紧凑结果；它不保存调度状态、阻塞原因或关系投影。
- 采用: `state` 至少区分人工控制、实际执行、显式关系和生命周期时间；执行租约属于实际执行状态，不能与任务内容混写。
- 采用: 控制状态表达候选、排队、显式等待、暂停或继承，执行状态表达空闲、运行、完成、失败或取消；两者不压缩为单一枚举。
- 采用: `ready`、依赖造成的 `waiting`、有效控制状态、继承来源、阻塞列表、子任务和反向依赖只由工具根据当前完整索引查询生成，不持久写回 task entry。
