---
title: 按语义身份组织 Vibe Check
status: active
alignment: aligned
createdAt: 2026-09-01T05:11:30Z
purpose: 让 Vibe Gate 结果按所证明契约和失败 owner 直接定位。
background: package script 既是手动聚合容器又曾是 Gate leaf，混合领域事务、CLI 与分发失败，成本顺序也不能承接稳定语义。
decision: 采用稳定 semantic Check ID 和语义 catalog 替代 package 容器身份，保持 profile 覆盖，并以普通 Check 到版本再到打包的 DAG 组织 release。
tags:
  - project-tooling
relations:
  - type: 修订
    target: use-vibe-check-as-authoritative-project-gate.md
---

## 目的

- 让 Vibe Gate 的每个结果直接说明它证明的契约、失败后的直接 owner 与可重跑命令。
- 保持一个 Vibe Definition 作为日常和 release 门禁的唯一权威结果，同时使 release 责任可独立定位。

## 背景

- package script 是面向维护者的稳定聚合入口，不是测试证据的最小原生入口；将它作为 Check leaf 会把领域记录、查询投影、事务恢复、pending-stage、CLI 和分发制品混为同一失败结果。
- 以成本感知的声明顺序和 full-only 分组可以影响调度，却不能表达 Check 证明什么、失败优先级或发布依赖；按耗时均衡分片还会制造重复和脆弱边界。
- 现有 default/full 覆盖、单一 Vibe aggregate、机器发布和从 Git pending 生成 release 制品仍是有效责任，变化只在于 Gate leaf 的身份和 release 链路的可定位性。

## 决策

- 采用: 由 Vibe Gate owner 维护 semantic Check catalog。每个 Check 使用稳定 machine-facing ID，并按单一证明契约和直接失败 owner 选择测试入口；测试文件和 package script 保持容器身份。显示名、声明顺序、调度并发和缓存状态不得改变该 ID 的语义或 machine publication 身份。
- 采用: 保持 default/full 原有覆盖：default 选择原本属于日常工作区的能力，full 保留 default 并加入原本属于 full 或 release 的能力。profile 表达交付范围，不按运行时间、文件数量或 worker 利用率重新分组；性能只用于验证没有无真实共享契约的重复入口执行。
- 采用: full 先结算全部普通 Check，再由 `release:skill-version` 对 Git pending 运行版本/hash 校验，只有该节点通过才由 `pack:skills` 从 Git pending 恰好打包一次。普通 Check、version 和 packaging 分别报告失败，任何前置失败都不启动下游制品写入。
