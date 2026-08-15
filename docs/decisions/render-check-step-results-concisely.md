---
title: 简洁渲染检查步骤结果
status: active
alignment: aligned
createdAt: 2026-08-11T04:14:59Z
purpose: 让正常检查输出易于扫描，同时为失败和显式 verbose 保留完整诊断。
background: 默认展开所有成功日志会淹没摘要，而隐藏失败输出会妨碍定位原因。
decision: 成功与跳过默认单行、失败完整展开、verbose 展开全部，并汇总计划步骤的状态与耗时。
tags:
  - project-tooling
relations:
  - type: 拆分
    target: render-check-results-and-exit-status.md
---

## 目的

- 让人类能够快速扫描正常检查结果，并在失败时直接获得对应步骤的完整输出。
- 让最终摘要稳定表达本次计划中各类步骤结果，而不负责决定机器成功或退出码。

## 背景

- 检查工具可能把大量成功明细写入 stdout 或 stderr，默认展开会制造噪音并掩盖最终状态。
- 报告器消费已经形成的步骤结果，不负责决定任务选择、调度、跳过原因或机器退出状态。

## 决策

- 采用: 成功步骤默认只输出名称、`passed` 和耗时；计划内跳过步骤使用单行 `skipped` 及原因，不展开捕获日志。
- 采用: 失败步骤完整展开自身捕获的 stdout 与 stderr，并输出 `failed`。
- 采用: `--verbose` 可与任一 profile 组合，并在每个已执行步骤的摘要前展开其完整捕获日志。
- 采用: 最终人类摘要报告 status、profile、计划总数、passed、skipped、failed 和总耗时；status 只渲染已经形成的机器结果。
- 采用: 正常人类报告和捕获日志写入 stdout；任务启动前的参数或并发配置错误写入 stderr。
