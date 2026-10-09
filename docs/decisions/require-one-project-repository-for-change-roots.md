---
title: Change 根只维护单一项目仓库内的计划
id: 261009-require-one-project-repository-for-change-roots
status: active
alignment: aligned
createdAt: 2026-10-09T02:43:20Z
purpose: 让同一 Change 集合的 Git 证据属于同一项目，并按基线复用查询。
background: 内嵌仓库会改变提交证据的归属；逐成员辨别仓库又增加普通集合的查询成本。
decision: Change 根采用单一项目仓库边界，完整检查通过后共享仓库与基线历史。
tags:
  - change-plan
  - git-integration
  - responsibility-boundaries
relations: []
---

## 目的

- 为 `skills/change-plan/` 的 Change 集合建立单一项目仓库责任，让基线、HEAD 和目录外变化使用同一项目的证据。
- 按基线复用历史，使正常集合的 Git 查询成本主要由不同基线数量决定。

## 背景

- Change 目录的职责是保存短期计划材料。支持独立代码仓库会扩大该 skill 的责任、Git 访问与验证面。
- 附加证据目录也可能带入仓库入口；要可靠共享项目仓库，检查范围必须覆盖整个根的活动真实目录树，而非只检查直接成员。

## 决策

- 采用：Change 根使用单一项目仓库边界。所有命令在读取计划或执行 Git、写入前检查完整活动真实目录树；发现内嵌仓库或无法完成检查时，阻断整个根的操作。
- 采用：检查范围包含附加证据目录，并保留符号链接目录和私有 tombstone 区的排除边界。
- 采用：通过检查后，集合在单次查询中共享项目仓库、HEAD 与各基线历史，每个 Change 独立计算目录外变化。
- 本决策适用于 `skills/change-plan/`；标记识别、诊断和退出规则由[固定结构与 CLI 契约](../../skills/change-plan/references/change-plan-contract.md#单一项目仓库边界)维护。
