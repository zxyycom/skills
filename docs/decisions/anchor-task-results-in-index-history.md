---
title: 以 task index 历史锚定终态结果版本
status: active
alignment: aligned
createdAt: 2026-08-11T03:21:49Z
purpose: 让终态 task 可追溯到记录该结果的仓库版本，同时不宣称 task 与实现提交一一对应。
background: 工作区 mutation 和 pending 快照都不是版本历史，只有包含终态 entry 的提交能够形成稳定仓库锚点。
decision: 首个包含终态 entry 的 task index 提交构成版本锚点；该锚点只证明仓库已记录结果。
tags:
  - task-graph
  - version-control
relations:
  - type: 拆分
    target: anchor-semantic-task-results-in-index-history.md
---

## 目的

- 让 task 结果能够追溯到一个已经进入版本历史的仓库状态，而不把 task graph 变成实现提交映射。
- 保持工作区状态、待提交快照和正式版本历史之间的边界清楚。

## 背景

- Task graph mutation 只改变工作区中的权威索引，按 task 暂存只改变版本管理的 pending 快照，二者都可能继续变化。
- 仓库首次提交包含某个终态 entry 后，Git 历史已经能够恢复该仓库版本记录的 task 状态。
- 该版本可能同时包含多项实现和协调变化，不能据此推导一个 task 唯一对应某个代码提交。

## 决策

- 采用: 目标仓库使用 Git 管理 task index 时，首次包含该终态 entry 的提交是 task 结果的版本锚点。
- 采用: 版本锚点只证明“该仓库版本已经记录此终态结果”，不证明 task 唯一对应某个实现提交，也不替代结果本身的语义 owner。
- 采用: 工作区 task mutation 和 pending 暂存均不形成版本锚点；是否 stage、commit 和交付仍由调用方按授权显式完成。
- 不采用: 用工作区 revision、pending 状态或 result 内复制的 SHA 冒充已经进入仓库历史的版本锚点。
