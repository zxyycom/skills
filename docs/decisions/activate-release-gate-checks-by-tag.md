---
title: 用 release tag 激活可见的 Gate Check
status: active
alignment: aligned
createdAt: 2026-09-01T13:56:55Z
purpose: 让日常 Gate 完整显示全部 Check，同时只由显式 release tag 启动发布增量与打包链路。
background: 按运行范围构造不同 Definition 会把未启动的 Check 从 progress 和 machine snapshot 隐去，调用方无法区分未选择、未启动与已通过。
decision: 每次运行构造相同完整 Definition；base 只聚合不需要 tag 的 Check，release tag 激活发布增量并传入 Vibe flags。
tags:
  - project-tooling
relations:
  - type: 修订
    target: use-vibe-check-as-authoritative-project-gate.md
---

## 目的

- 让所有稳定 Check ID 在每次 Vibe progress 与 machine snapshot 中可见。
- 让未启用的发布能力给出明确可行动提示，而不是从运行结果中消失。

## 背景

- 日常检查仍需要避免运行发布专属测试、Git snapshot、版本与打包写入。
- 发布资格仍要求原有 release-required Check、版本授权与打包 DAG 全部可信通过。
- Vibe 0.0.1 的 preflight 可以在任何 execution 前结算 unavailable，因此可作为 tag activation 边界而不接管 scheduler 或 aggregate。

## 决策

- 采用: Check catalog 每次构造同一完整 Definition。不需要 tag 的 base Check 在无 tag 时执行；release 专属 Check 声明唯一 `requiredTag: release`。
- 采用: 未启用的 release Check 先由 activation preflight 阻断，既不调用其原 preflight，也不进行扫描、Git、命令或打包 I/O；结果以稳定 unavailable reason、null duration 与 `Pass --tag release` 提示可见。
- 采用: aggregate 只选择不需要 tag 的 base Check 与当前已启用 tag 的 Check；被选择的 unavailable 或 not-applicable 继续 fail closed。CLI 使用 tag 型 activation 接口；当前仅支持 `release`，因此每次 invocation 最多出现一次 `--tag release`，任何重复 tag 都拒绝。规范化 tags 传入 Vibe `flags`；`--full` 只保留为兼容别名。
- 采用: release tag 保持既有 release-required 依赖与 release DAG，CI 使用 `--tag release`。调度提示按规范化 active tag 集合隔离，且只提供顺序建议，不改变 Gate 真值。
- 不采用: 不为 base 建伪 tag，不增加 tag 依赖闭包、资源分类调度或跨运行缓存框架。
