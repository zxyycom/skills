---
title: 从检查步骤结果派生退出状态
status: active
alignment: aligned
createdAt: 2026-08-11T04:14:59Z
purpose: 让调用方仅通过结构化步骤结果和退出码可靠判断整次检查是否成功。
background: Warning 文本、日志顺序和 planned skip 都不能替代已执行步骤的成功或失败结果。
decision: 任一已执行步骤失败或启动参数非法时退出非零；没有失败且仅含计划内跳过时退出零。
relations:
  - type: 拆分
    target: project-tooling/render-check-results-and-exit-status.md
---

## 目的

- 为脚本、CI 和发布入口提供不依赖人类日志解析的统一完成信号。
- 区分计划内未选择或受门禁跳过的步骤与真正执行失败。

## 背景

- Quick profile 会按计划跳过 full-only 检查，前置失败时打包门禁也会产生一个 skipped 结果；这些跳过本身不增加新的失败。
- 已执行前置检查或打包步骤返回失败时，整体检查不能因其他步骤通过或继续执行而报告成功。
- 参数或并发配置非法发生在任务启动前，没有步骤结果但仍是确定失败。

## 决策

- 采用: 任一已执行计划步骤为 `failed` 时，整次检查状态为 failed 并退出 `1`。
- 采用: 没有 failed 步骤时，`passed` 与计划内 `skipped` 的任意合法组合使整次检查状态为 passed 并退出 `0`。
- 采用: 参数或并发配置在任务启动前校验失败时退出 `1`，不启动检查，也不从空结果集合推导成功。
- 采用: 退出状态只消费已经形成的结构化步骤结果，不从 warning 文本、日志内容、输出顺序或 profile 名称猜测。
- 采用: 本记录不定义步骤选择、调度、跳过条件或人类报告格式。
