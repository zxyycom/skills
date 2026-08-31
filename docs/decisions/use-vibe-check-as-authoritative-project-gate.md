---
title: 以 Vibe Check 作为权威项目门禁
status: active
alignment: aligned
createdAt: 2026-08-31T09:19:20Z
purpose: 让日常与发布门禁在一个 Vibe Definition 目录中形成唯一可验证结果。
background: 旧项目编排重复实现选择、调度、展示、聚合和打包边界，无法继续作为当前最小责任模型。
decision: 采用 Vibe 的 Definition、scheduler、progress 与 aggregate 承接唯一 check，并把打包限制为 full 的依赖终结 Check。
tags:
  - project-tooling
relations:
  - type: 归并
    target: derive-check-exit-status-from-step-results.md
  - type: 归并
    target: render-check-step-results-concisely.md
  - type: 归并
    target: run-packaging-after-prerequisite-checks.md
  - type: 归并
    target: select-prerequisite-checks-by-profile.md
  - type: 归并
    target: settle-all-selected-checks-under-bounded-concurrency.md
---

## 目的

- 让 `bun run check` 只通过 Vibe 形成日常或发布门禁的权威完成信号。
- 保留默认与 full 的不同成本和完成语义，同时避免维护第二套项目任务编排器。

## 背景

- 项目仍需要日常 default 与发布 full、失败后独立检查继续结算，以及只有完整发布前置通过后才产生 skill 包。
- Vibe 已提供 Definition、静态 scheduler、progress、结构化 RunResult、aggregate 与直接依赖；旧项目代码重复维护这些通用机制只会扩大长期维护面。
- CI 已有一个 package job 和 `bun run check --full` 完成信号；并行增加另一套门禁不能提高责任清晰度。

## 决策

- 采用: `bun run check` 以同一能力目录构造 default 或 `--full` 的 Vibe Definition；默认成功不代表发布完整性，full 形成全部 release-required 结果后才可完成发布打包。
- 采用: Vibe static `maxParallel: 4`、progress、aggregate 与结构化 RunResult 负责调度、展示和结果收敛；独立 Check 在其他 Check 失败后仍继续结算，不保留动态并发、verbose、旧 renderer 或第二套状态机。
- 采用: `pack:skills` 只属于 full，直接依赖全部 release-required Check；只有全部 passed 时调用一次，任何 failed、unavailable、not-applicable 或无可信依赖结果都不产生本次打包写入。
- 采用: 保持现有 CI package job 调用唯一 `bun run check --full`，固定指标运行时后运行 full，不新增并行 CI job 或第二完成信号。
