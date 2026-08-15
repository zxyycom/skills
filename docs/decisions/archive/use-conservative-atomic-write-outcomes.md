---
title: 对 task index 原子写入采用保守结果语义
status: archived
alignment: aligned
createdAt: 2026-08-11T03:21:59Z
purpose: 让索引原子写入成功立即收敛，失败统一保留未知结果并阻止调用方盲目重放。
background: 原子写调用 reject 后的磁盘读回只能观察某个时点，不能证明提交点是否越过或重放是否安全。
decision: 原子写 resolve 即成功且不回读；reject 统一返回 WRITE_OUTCOME_UNKNOWN，并要求重读索引和目标实体。
tags:
  - task-graph
relations:
  - type: 拆分
    target: keep-task-graph-locks-outside-workspace.md
---

## 目的

- 为一次 task index mutation 提供单一、保守且可恢复的提交结果契约。
- 避免调用方根据失败后的瞬时文件内容猜测写入是否发生并自动重放。

## 背景

- 获得短锁后，mutation 仍需基于最新索引完成 schema、完整图、revision 或 lease 前置条件校验，再生成唯一候选状态。
- 原子写调用 resolve 已经表示库调用成功，额外提交回读不会增加领域保证。
- 原子写调用 reject 时，写入可能已经越过提交点；随后的读回无法证明观察到的是失败前、失败后还是其他后续状态。

## 决策

- 采用: 工作区索引 mutation 获锁后读取最新索引，完成 schema 与完整图校验、revision 或 lease 前置校验、领域变换和规范序列化，再执行一次原子写入。
- 采用: 原子写调用 resolve 后立即报告成功，不执行提交回读，也不把读回相等作为成功前置。
- 采用: 原子写调用 reject 时统一返回 `WRITE_OUTCOME_UNKNOWN`；调用方必须重新读取索引 revision 和目标实体，依据当前事实决定恢复、停止或重新发起新操作。
- 不采用: 根据失败后读回把结果分类为 old、candidate 或 other，也不在未知结果后盲目重放原 mutation。
