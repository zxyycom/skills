---
title: 统一使用 Change 预期调整与衍生影响结构
status: active
alignment: aligned
createdAt: 2026-08-22T10:09:08Z
purpose: 让每个 Change 的 artifacts 共同以固定结构恢复预期调整、衍生影响及两者的因果方向。
background: 只有 Scope 和 Decisions 的集合式内容无法机械区分 Change 的预期调整与由该调整产生的处理工作。
decision: Scope 与 Decisions 固定使用 Intended Change 和 Resulting Impacts，metadata 继续只表达生命周期和计划基线。
tags:
  - change-plan
relations: []
---

## 目的

- 让 `skills/change-plan/` 在覆盖完整实施范围时，持续以 Change 希望建立的结果组织内容，并明确各项必要影响为何进入计划。
- 让固定 artifact contract 和 CLI 为这项内容关系提供统一结构与机械诊断。

## 背景

- Proposal 已用 `Outcome` 和 `Scope` 表达结果与范围，design 和 tasks 承接决定、工作和验证；只有 H2 与非空内容的结构无法保存预期调整与衍生影响的因果方向。
- 预期调整与衍生影响属于同一 Change，共同使用 proposal、design、tasks、stage、进度和归档结果。
- Metadata 的责任是表达 Draft/Plan stage 与 Plan Git 基线，artifact 内容关系由 Markdown 固定结构承接。

## 决策

- 采用: 受检 proposal 的 `Scope` 与 design 的 `Decisions` 依次要求 `Intended Change` 和 `Resulting Impacts`；stage 只确定必需 artifacts 与 H2，不改变这两个 H2 的内部结构。
- 采用: CLI 验证必需 H3 的存在性、唯一性、顺序和非空内容，skill 审阅实际因果关系。
- 采用: `Resulting Impacts` 继续通过同一 `tasks.md` 的 Readiness、Implementation 与 Verification 推进，并共享 Change 的 stage、进度和归档结果。
- 采用: `.change-plan.json` 继续只包含 Draft/Plan stage 与 Plan 的 `baseCommit`；archived metadata 只作为历史文件保留。
