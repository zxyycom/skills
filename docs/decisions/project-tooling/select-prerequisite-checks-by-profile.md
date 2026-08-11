---
title: 按 quick 与 full 档位选择前置检查
status: active
alignment: aligned
createdAt: 2026-08-11T04:03:02Z
purpose: 让日常检查与完整验收使用明确且可复核的前置任务集合。
background: 不同场景需要不同检查成本，任务选择必须独立于调度、报告和打包行为。
decision: quick 选择必要快速检查，full 选择 quick 与高成本检查，并显式维护任务的最低档位。
relations:
  - type: 修订
    target: project-tooling/select-check-tasks-by-profile.md
---

## 目的

- 让日常 `bun run check` 快速覆盖必要门禁，同时为完整验收保留显式入口。
- 让每个检查任务是否被选择只由本次 profile 和受维护的任务映射决定。

## 背景

- 少数集成检查需要临时仓库、原生 runtime 或大量子进程，不适合进入每次日常反馈。
- Profile 是前置任务选择边界；任务怎样并发、结果怎样显示以及何时打包分别由后续责任处理。
- 若从任务名称或一次运行耗时临场推断档位，同一命令就可能得到不可恢复的检查集合。

## 决策

- 采用: `bun run check` 默认使用 `quick`，选择必要且快速的前置检查。
- 采用: `bun run check --full` 选择全部 quick 与 full 前置检查，同一任务在一个计划中只选择一次。
- 采用: 当前检查任务到最低 profile 的映射由项目检查计划显式维护并接受测试，不从名称或运行耗时推断。
- 采用: CI、发布门禁和明确要求完整验证的入口使用 full。
- 采用: 选择结果向后续执行提供本次 profile、计划内前置任务和实际选中的前置任务集合；本记录不定义这些结果的调度、展示或最终退出语义。
