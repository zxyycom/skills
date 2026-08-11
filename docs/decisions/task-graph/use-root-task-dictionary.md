---
title: 使用根级任务字典承接唯一身份
status: archived
alignment: aligned
createdAt: 2026-08-07T06:40:32Z
purpose: 让索引直接保存平铺任务集合，并只由父任务关系表达层级，删除没有调度价值的 scope 容器。
background: 索引文件已经确定工作区边界，scope 额外引入身份、绑定、命令参数和清理生命周期，却不改变任务拓扑或执行约束。
decision: 根级 tasks 字典键承接 task 唯一身份；entry 继续分离 content 与 state，任务层级仅由 parentId 表达，工具只维护当前 Schema。
relations:
  - type: 修订
    target: task-graph/key-task-identity-and-separate-content-state-projection.md
---

## 目的

- 让 task index 直接表达一个平铺任务集合，无关任务以同一图中的断开分量共存。
- 让任务身份、父子层级和工作区边界分别只有一个权威表示。
- 保留任务内容、显式状态和查询投影的清楚边界，同时删除没有调度意义的容器生命周期。

## 背景

- `docs/task-graph/task-graph-index.json` 的位置已经唯一确定当前工作区，额外的 scope ID、key 和 binding 不再提供定位价值。
- Task 本来就是平铺集合中的独立对象；一个 task 的 `parentId` 足以让它成为另一个 task 的子任务，不需要虚拟 root 或中间 group。
- Scope 迫使每个 CLI 和程序化调用重复传递容器 ID，并产生创建、恢复、binding 和 close 契约，但这些操作不会改变依赖、排斥、控制或租约语义。
- Task entry 的 `content` 与 `state` 分离、字典键唯一承接身份以及派生结果只在查询时生成仍然有效。

## 决策

- 采用: 权威索引在根级使用 `tasks[taskId]` 字典保存全部 task；字典 key 是 task 唯一身份，task entry 不重复保存 `taskId`。
- 采用: 索引文件本身是工作区和任务集合边界；Schema、CLI、程序化调用、查询投影及生命周期不再提供 scope ID、key、binding 或 scope close。
- 采用: 任务层级只由每个 task 的单一 `parentId` 表达；没有父节点的 task 是顶层任务，互不相关的任务自然形成断开分量。
- 采用: Task entry 继续使用 `content` 和 `state` 分离任务语义与显式运行事实；有效状态、阻塞、子任务和反向关系继续按完整索引即时投影。
- 采用: 工具只读写当前根级 Schema，不提供旧 Schema 读取、迁移命令、双写或兼容层。
