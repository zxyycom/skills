---
title: 以结项删除 Change Plan
id: 260920-finalize-change-plans-by-deletion
status: active
alignment: aligned
createdAt: 2026-09-20T03:31:37Z
purpose: 用 finalize 作为唯一最终生命周期动作，并保留进度、验收与删除的责任边界。
background: complete 同时指向进度、验收和删除，无法准确表达最终动作；目录退出后由 Git 提供历史恢复。
decision: 采用 finalize/finalized；保留 completedTaskCount、删除和 tombstone 术语。
tags:
  - change-plan
relations:
  - type: 修订
    target: 260904-current-change-plan-completion
    summary: 以 finalize 的专用动作术语承接原有安全删除边界。
---

## 目的

- 让维护者以结项识别合格 Plan 退出当前名称空间的专用动作。
- 让任务 checkbox、语义验收和安全删除继续表达各自可核对的事实。

## 背景

- `complete` 同时被用于任务状态、成功标准和最终命令，调用方无法从词语本身恢复其责任层级。
- Change Plan 成功后不保存持久终态或归档目录；目录删除是最终动作的效果，历史只由 Git 恢复。
- 现有 Git tree、tombstone、重验和恢复边界已经准确保护删除，不能因公开术语迁移改变它们。

## 决策

- 采用: 生命周期为 `draft -> plan --finalize--> directory absent`。`finalize` 是唯一最终动作，成功 outcome 为 `finalized`；`complete`、`archive` 和旧 archived 选项均按未知 CLI 接口拒绝。
- 采用: `completedTaskCount` 只记录 Plan 内任务进度；Success Criteria 与 owner 交接继续承担语义验收；`change-deletion-*`、tombstone 与 `committed-cleanup-pending` 继续承担删除与恢复责任。
- 采用: `finalize` 仅在完整 Plan、任务、基线、两次 lifecycle/HEAD snapshot 和完整 Git tree 门禁通过后删除目录。它不代替删除授权、不会写持久 status，也不 stage、commit、reset、revert 或自动 Git restore。
