---
title: 用 Draft、Plan 与 Archive 维护 Change
status: archived
alignment: aligned
createdAt: 2026-08-13T05:35:50Z
purpose: 让 Change 以内容成熟度和归档结果表达生命周期，并让任务进度与 CLI 职责可以直接恢复。
background: Draft 与 Plan 具有不同内容契约，tasks 已表达 Plan 内进度；额外阶段没有保存独立事实，却扩大了状态转换和命令表面。
decision: Active Change 只使用 Draft 和 Plan，任务推进全部发生在 Plan 内，完成后归档；CLI 只承担发现、检查、Plan 确认和归档。
relations:
  - type: 归并
    target: change-plan/form-proposal-and-initial-design-in-draft.md
  - type: 归并
    target: change-plan/manage-basic-change-lifecycle.md
---

## 目的

- 让 `skills/change-plan/` 的 active stage 只表达 Change 的内容成熟度，任务进度由 tasks 表达，完成结果由 archive 目录表达。
- 让调用方通过最小命令集合完成发现、检查、确认计划和归档。

## 背景

- Draft 保存可持续改写的 proposal 与初始 design；Plan 已形成完整 proposal、design 和 tasks。这是 active 生命周期中需要持久保存的内容差异。
- Readiness、Implementation 与 Verification 的 checkbox 已经表达单个 Change 内的任务类别和实际进度；开始勾选任务不会改变 Plan 的文档身份。
- 既有 Implementation metadata 只沿用 Plan 的 `baseCommit`，没有增加执行者、租约、授权或其他独立执行事实。
- 仍准备实施的 Change 可以继续作为 Plan；具有可观察外部条件的等待由任务协调 owner 承接；不再准备实施的 Change 可以删除。额外的 Shelved stage 不能形成更强的机械边界。
- Change 所在目录已经能够区分 active 计划与 archived 历史。

## 决策

- 采用: Active Change 的 stage 只使用 `draft` 与 `plan`；标准生命周期为 `draft -> plan -> archived`，其中 archived 是目录 status，不是 metadata stage。
- 采用: 新建 Draft 时保存最小 `proposal.md` 与初始 `design.md`；确认 Plan 时补全二者并派生 `tasks.md`。Readiness、Implementation 与 Verification 全部在 Plan 内执行、勾选和按新发现修订。
- 采用: CLI 只提供 `list`、`show`、`check`、`check-all`、`plan` 与 `archive`。`plan` 用于 `draft -> plan`，也允许在语义复核现有 Plan 后重新确认并刷新基线；`archive` 的机械目标是通过检查且全部任务完成的 active Plan，执行者只在完成语义审阅并获得归档授权后调用它。
- 采用: 放弃 Change 使用项目普通文件删除与版本控制流程；删除前把仍有独立价值的稳定事实、长期方向或调查结果交给对应 owner。
- 采用: 结构检查、任务勾选、Plan 确认、语义审阅、实施授权和归档授权继续保持可区分；简化阶段不让 metadata 或 CLI 命令替代当前任务授权。
