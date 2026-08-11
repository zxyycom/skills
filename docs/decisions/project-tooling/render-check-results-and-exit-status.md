---
title: 渲染检查结果并映射最终退出状态
status: archived
alignment: aligned
createdAt: 2026-08-11T04:03:03Z
purpose: 让成功路径保持可扫描，失败保留诊断，并以统一摘要和退出码表达计划结果。
background: 完整成功日志会淹没摘要，而只显示首个失败会遗漏已收敛计划中的其他结果。
decision: 默认单行报告成功与跳过、完整展开失败，汇总全部步骤并由失败结果映射非零退出。
relations:
  - type: 修订
    target: project-tooling/report-check-results-concisely.md
---

## 目的

- 让正常检查输出能够快速扫描，同时保留失败步骤的完整 stdout 与 stderr。
- 让调用方通过统一摘要和退出状态可靠判断整次计划是否成功。

## 背景

- 检查工具可能把大量成功明细写入 stdout 或 stderr，默认展开会制造噪音并掩盖最终状态。
- 报告器消费已经形成的计划及其步骤结果，不负责决定任务选择、调度顺序或步骤为何被跳过。
- 最终退出状态必须来自结构化步骤结果，不能从 warning 文本或日志顺序猜测。

## 决策

- 采用: 成功步骤默认只输出名称、`passed` 和耗时；计划内跳过步骤使用单行 `skipped`，不展开捕获日志。
- 采用: 失败步骤完整展开自身捕获的 stdout 与 stderr，并输出 `failed`；报告器展示计划提供的全部已收敛结果。
- 采用: `--verbose` 可与任一 profile 组合，并在每个已执行步骤的摘要前展开其完整捕获日志。
- 采用: 最终摘要报告 profile、计划总数、passed、skipped、failed 和总耗时。
- 采用: 任一已执行计划步骤为 `failed` 时整体退出非零；没有失败结果时整体退出零，`skipped` 本身不构成失败。
- 采用: 正常人类报告和捕获日志写入 stdout；任务启动前的参数或并发配置错误写入 stderr 并退出非零。
