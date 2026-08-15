---
title: 只在 task result 中保存语义结果
status: active
alignment: aligned
createdAt: 2026-08-11T03:21:49Z
purpose: 让终态 task 保存可恢复的结果含义和稳定 owner 引用，不复制易变的执行或提交身份。
background: 分支和提交身份会在集成时变化，当前没有长期消费者要求从每个 result 解析唯一实现提交。
decision: Task result 默认只保存结果摘要和必要的稳定引用，不保存中间交接信息或常规 commit SHA。
tags:
  - task-graph
relations:
  - type: 拆分
    target: anchor-semantic-task-results-in-index-history.md
---

## 目的

- 让 task 进入终态后留下足以恢复交付含义的语义结果，而不重复其他 owner 已经维护的执行和版本事实。
- 保持 result 是当前协调结果而不是提交映射、执行流水或第二审计日志。

## 背景

- 子代理分支和提交身份会因 rebase、重排、压缩、冲突处理或主线集成而改变，旧身份不能稳定映射到最终仓库状态。
- 当前消费者需要的是结果摘要和长期事实 owner 的稳定位置，并不需要每个 task 唯一对应一个实现提交。
- 分支、当前提交、lease 和验证证据服务执行或集成交接，把它们复制到终态 result 会制造跨 owner 同步责任。

## 决策

- 采用: `content.result` 保存 task 终结时的当前语义结果，默认只包含结果摘要和确有长期价值的稳定 owner 引用。
- 采用: 工作中间态、分支、当前提交、lease 和临时验证证据继续作为执行或集成交接输入，不进入长期 result。
- 采用: 只有未来出现定义清楚的长期消费者和独立验收时，才重新评估精确提交引用能力。
- 不采用: 为每个 succeeded task 常规保存分支 SHA、主线 SHA，或建立旧提交到新提交的映射历史。
