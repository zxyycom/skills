---
title: 按事项状态选择最小持久载体
status: active
alignment: aligned
createdAt: 2026-08-11T03:08:21Z
purpose: 让维护者按事项当前需要保存的结果唯一选择 Decision、Change、Task 或调查载体，避免未来方向被重复保存为长期等待任务或活动草稿。
background: 仓库已有四类载体的局部边界，但缺少跨 owner 的选择与退出规则，同一未来事项可能被重复保存为长期等待 task 或活动 draft。
decision: 由仓库导航维护最小载体和单向交接规则；只在独立结果成为当前需要时建立载体，未对齐决策不自动创建 task，失去当前价值的 Change 与 task 按 owner 退出。
tags:
  - change-plan
  - decision-records
  - investigation-report
  - project-documentation
  - task-graph
relations: []
---

## 目的

- 让维护者根据事项当前需要保存的结果，唯一判断是否需要 Decision record、Change plan、Task Graph task、Change 内 `tasks.md` 或调查报告。
- 防止同一方向、理由、状态或任务分解在多个载体中完整保存并逐渐漂移。

## 背景

- Decision Records 保存跨 change 长期有效的方向与理由，未对齐状态不构成实施承诺或任务。
- Change Plan 保存明确 Change 的临时实施上下文，其 `tasks.md` 只拥有该 Change 内的 readiness、implementation 和 verification。
- Task Graph 保存已选择的当前工作所需的可恢复协调状态；等待状态需要可观察的外部条件。
- Investigation Report 保存形成时可独立复核的调查认识，不替代决定、实施计划或当前事实 owner。
- 这些局部边界已经存在，但维护者缺少一个跨 owner 的选择入口，导致未对齐决策可能同时产生无限期监测 task，延期探索也可能长期占用活动 Change。

## 决策

- 采用: 由 `docs/navigation.md` 维护按事项状态选择最小载体的路由规则，各 skill 继续完整拥有自己的内容和生命周期契约。
- 采用: 只有当前确实需要某种载体独有的结果时才建立该载体；未来可能需要、主题相近或希望持续关注不构成建立第二载体的理由。
- 采用: `active + unaligned` Decision 只保存已确认的未来方向，不自动创建 Task Graph task、Change 或等待状态。方向被明确选入当前执行后，再按实际协调或规划需要建立最小下游载体。
- 采用: 多种载体确实同时需要时使用单向引用。Change 和 Task 可以引用 Decision，Task Graph task 可以引用正在协调的 Change；长期理由、实施分解和执行状态仍分别只由一个 owner 完整维护。
- 采用: 活动 Change 完成后归档；不再实施的 draft 不作为长期资料柜，只有具备独立复核价值的认识才迁入 Investigation Report。Task Graph task 在目标放弃或失去当前协调价值时取消，`waiting` 只保存已经明确且可观察的外部条件。
