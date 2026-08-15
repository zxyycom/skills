---
title: 通过 claim 直接接管过期 task lease
status: active
alignment: aligned
createdAt: 2026-08-07T02:31:28Z
purpose: 让失联执行的恢复仍是一个可竞争的事务领取动作，而不经过独立恢复状态和多步命令链。
background: recover 后再 retry 和 claim 扩大命令面与竞态窗口，活动 lease 强制接管还会削弱当前执行者所有权。
decision: 过期 running task 只通过携带旧 lease、最新 revision 和原因的 claim 写入新 lease，活动 lease 不允许提前接管。
tags:
  - task-graph
relations:
  - type: 修订
    target: coordinate-task-execution-with-transactional-claims.md
---

## 目的

- 让过期执行恢复在一个事务中重新验证当前 lease、revision、图约束和新执行者身份。
- 保留活动执行者的租约所有权，不提供普通恢复入口绕过有效 lease。
- 让 actionable 投影直接给出待恢复任务的合法下一动作，减少 agent 需要编排的中间状态。

## 背景

- 原有恢复路径先把过期 `running` 写成 `failed`，再由调用方 `retry` 为 `idle`，最后重新 `claim`；每一步都会增加 revision 和新的竞争窗口。
- 恢复的最终目标是为确认失联的过期执行建立一个新 lease，而不是长期保留一个人工制造的失败状态。
- 活动 lease 可以续租、完成、失败、释放或取消；允许另一个执行者强制接管会使 lease 不再证明当前所有权。

## 决策

- 采用: 过期 running task 的投影保持 `recovery-needed`，并把 `nextAction` 设为 `claim`，使其进入 actionable 集合。
- 采用: 恢复 claim 必须同时携带旧 `recoverLeaseId`、最新 `expectedRevision` 和非空 `reason`；三项缺一即拒绝，旧 lease 或 revision 不匹配也拒绝。
- 采用: 合法恢复在一个 mutation 中把过期 running execution 替换为新 actor、新唯一 lease 和递增 attempt；普通 idle claim 不接受恢复三元组。
- 采用: 活动 lease 永不通过恢复 claim 覆盖；调用方只能由当前 owner 正常操作或等待其过期。
- 不采用: 独立 `recover` 命令、活动 lease 的 force 接管，以及 `recover -> retry -> claim` 多步恢复链。
