---
title: 保守判定 task index 写事务结果
status: active
alignment: aligned
createdAt: 2026-08-11T04:14:55Z
purpose: 让完整写事务只有在原子写入与锁释放均成功时报告成功，并为可能已提交的失败提供统一恢复边界。
background: 原子写 reject 或写入成功后的锁释放失败都无法向调用方证明最终提交状态。
decision: 完整写事务正常收敛才成功；不确定提交结果统一返回 WRITE_OUTCOME_UNKNOWN，并要求重读权威事实。
relations:
  - type: 修订
    target: task-graph/use-conservative-task-index-write-outcomes.md
---

## 目的

- 为一次 task index 写事务提供单一、保守且可恢复的外部结果契约。
- 避免调用方根据局部成功、失败后的瞬时读回或锁状态猜测 mutation 是否已经提交并盲目重放。

## 背景

- 原子写调用 reject 时，写入可能已经越过提交点；随后的读回不能单独证明观察到的是失败前、失败后还是其他后续状态。
- 原子写调用 resolve 后，事务仍需释放短锁；释放失败不会撤销已经提交的索引，也不能向调用方报告完整成功。
- 候选内容怎样校验、变换和序列化属于 mutation owner，本记录只拥有写入开始后的事务结果。

## 决策

- 采用: 原子写入 resolve 且短锁正常释放后立即报告成功，不执行提交回读，也不把读回相等作为成功前置。
- 采用: 原子写入 reject 时统一返回 `WRITE_OUTCOME_UNKNOWN`，不声称写入已提交或未提交。
- 采用: 原子写入已经 resolve 但短锁释放失败时同样返回 `WRITE_OUTCOME_UNKNOWN`，诊断标识 `lock-release` 阶段并提供能够确认的可能 revision，不把局部写入成功提升为完整事务成功。
- 采用: 收到未知结果的调用方必须重新读取索引 revision 和目标实体，依据当前事实决定停止、恢复或发起一个新操作。
- 不采用: 根据失败后读回把结果分类为 old、candidate 或 other，也不在未知结果后盲目重放原 mutation。
