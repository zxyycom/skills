---
title: 对 task index 写入采用保守结果语义
status: archived
alignment: aligned
createdAt: 2026-08-11T04:03:16Z
purpose: 让原子写入成功立即收敛，失败保留未知结果并阻止调用方盲目重放。
background: 原子写调用 reject 后的磁盘读回不能证明提交点是否已经越过。
decision: 原子写 resolve 即成功，reject 返回 WRITE_OUTCOME_UNKNOWN，并要求调用方重读事实后恢复。
relations:
  - type: 修订
    target: task-graph/use-conservative-atomic-write-outcomes.md
---

## 目的

- 为一次 task index 原子写入提供单一、保守且可恢复的结果契约。
- 避免调用方根据失败后的瞬时文件内容猜测写入是否发生并自动重放。

## 背景

- 原子写入接收调用方已经形成的唯一候选内容；候选如何校验、变换和序列化属于上游 mutation 责任。
- 原子写调用 resolve 已表示库调用成功，额外提交回读不会增加领域保证。
- 原子写调用 reject 时，写入可能已经越过提交点；随后的读回无法单独证明观察到的是失败前、失败后还是其他后续状态。

## 决策

- 采用: 原子写调用 resolve 后立即报告成功，不执行提交回读，也不把读回相等作为成功前置。
- 采用: 原子写调用 reject 时统一返回 `WRITE_OUTCOME_UNKNOWN`，不声称写入已提交或未提交。
- 采用: 收到未知结果的调用方必须重新读取索引 revision 和目标实体，依据当前事实决定停止、恢复或发起一个新操作。
- 不采用: 根据失败后读回把结果分类为 old、candidate 或 other，也不在未知结果后盲目重放原 mutation。
