---
title: 按 quick 和 full 档位选择检查任务
status: archived
alignment: aligned
createdAt: 2026-08-11T03:25:48Z
purpose: 让日常检查快速覆盖必要门禁，并为 CI、发布和完整验证提供显式全量入口。
background: 少数高成本集成测试主导等待时间，但直接移出默认路径不能削弱所选检查的可信完成语义。
decision: 默认 quick 只选择必要快速检查，full 包含 quick 和耗时检查；未选择项显式跳过，CI 使用 full。
relations:
  - type: 拆分
    target: project-tooling/use-profiled-concise-checks.md
---

## 目的

- 让日常 `bun run check` 以较短反馈时间运行必要门禁，同时保留可显式选择的完整验证集合。
- 让 quick 与 full 的结果边界可恢复，不把未选择的高成本任务误作已经通过。

## 背景

- 少数需要临时 Git 仓库、原生 runtime 或大量子进程的集成测试占据完整检查的主要等待时间。
- 所有维护任务都走同一默认档会拖慢日常反馈，完全移除高成本任务又会削弱 CI 和发布验收。
- Profile 只决定本次选择哪些前置任务，不应把未选择项解释成 warning 或 failure，也不应让已选择任务的失败降级为成功。

## 决策

- 采用: `bun run check` 默认使用 `quick` 档，只选择必要且快速的前置检查；高成本任务必须显式声明为 `full` 最低档位。
- 采用: `bun run check --full` 同时选择 quick 与 full 的全部前置任务，同一任务只执行一次；CI 和发布门禁使用 full 档。
- 采用: quick 档对未选择的 full-only 任务逐项表达 `skipped`；只有这些计划内跳过且全部已选择任务通过时，quick 档可以成功。
- 采用: 当前任务到最低档位的映射由项目工具链和检查计划共同维护并接受测试，不从任务名称或运行耗时临场推断。
- 不采用: 默认运行全部高成本集成测试，或把已选择前置任务的失败降级为最终成功的 warning。
