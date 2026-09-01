---
title: 为 Vibe 分发 consumer 声明生成前置
status: active
alignment: aligned
createdAt: 2026-09-01T06:31:41Z
purpose: 让消费当前分发制品的 Vibe Check 只在对应生成结果可信时运行。
background: semantic Check 已按证明契约划分，但 public-distribution consumer 若不依赖生成一致性结果，会在制品漂移后产生无效失败噪声。
decision: 为真实消费分发制品的 semantic Check 声明精确生成前置，并以调度依赖和直接结果守卫保持可定位的失败边界。
tags:
  - project-tooling
relations:
  - type: 修订
    target: organize-vibe-checks-by-semantic-identity.md
---

## 目的

- 让分发制品的生成一致性与其 public-distribution consumer 形成可观察、可重跑的 Gate 依赖。
- 在上游制品不可信时避免下游读取该制品或产生无效的重复失败。

## 背景

- semantic Check 的稳定身份应由所证明的契约和直接失败 owner 决定，而非 package script、调度顺序或耗时。
- Change Plan、Decision Records 与 Task Graph 的 public-distribution Check 消费各自的当前分发制品；相应 `check:*` 已是这些制品唯一的生成与漂移检查 owner。
- 仅依靠 Vibe 的调度依赖不足以表达 consumer 的执行前提：consumer wrapper 还必须基于直接前置的最终 product result 决定是否启动自己的脚本。

## 决策

- 采用: 保持既有 semantic Check catalog、Check ID、profile 和 package script owner。`test:change-plan:public-distribution`、`test:decision-records:public-distribution` 与 `test:task-graph:public-distribution` 分别精确依赖 `script:check:change-plan-cli`、`script:check:decision-records-cli` 与 `script:check:task-graph-cli`。
- 采用: `dependsOn` 只声明 Vibe 的静态调度关系。consumer wrapper 只读取直接前置的最终 product result；只有可信 `passed` 才运行 consumer，failed、unavailable 或缺少可信结果均不运行 consumer，并把修复与重跑指向该前置。
- 采用: 将此前置视为制品信任和失败归因边界。它只避免失败路径的无效 consumer 执行，不改变成功路径中每个生成一致性 Check 恰好一次的责任，也不作为性能分组、缓存或跨工具构建共享的依据。
- 采用: 保持 full 的普通 Check、版本校验和打包终结链路；普通 consumer prerequisite 不改变 release version 及 `pack:skills` 的唯一 owner 和前置关系。
