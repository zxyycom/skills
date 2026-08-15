---
title: 用根级任务字典承接集合身份
status: active
alignment: aligned
createdAt: 2026-08-11T04:03:17Z
purpose: 让 task index 以根级字典表达一个平铺任务集合，并让字典键唯一承接任务身份。
background: 索引文件已界定任务集合，额外 scope 容器只会重复集合与身份边界。
decision: 索引根级使用 tasks 字典，taskId 键是唯一任务身份，索引文件直接界定集合。
tags:
  - task-graph
relations:
  - type: 修订
    target: use-root-task-dictionary.md
---

## 目的

- 让 task index 直接表达一个平铺任务集合，无关任务可以作为同一集合中的独立成员共存。
- 让任务集合边界和任务唯一身份分别只由索引文件与根字典键承接。

## 背景

- `docs/task-graph/task-graph-index.json` 的位置已经界定当前工作区及其任务集合。
- 额外 scope ID、key、binding 和 close 生命周期不会增加任务身份或集合定位信息。
- Task entry 的 `content`、`state`、`parentId`、查询投影和旧 Schema 兼容属于相邻领域 owner 或当前工具契约，不属于集合身份决策。

## 决策

- 采用: 权威索引在根级使用 `tasks[taskId]` 字典保存当前集合的全部 task。
- 采用: 字典 key 是 task 的唯一身份，task entry 不重复保存 `taskId`，同一索引中不得出现重复身份。
- 采用: 索引文件本身界定任务集合，不增加 scope 容器或独立 scope 身份。
