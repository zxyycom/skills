---
title: 以删除完成当前 Change Plan
id: 260904-current-change-plan-completion
status: active
alignment: aligned
createdAt: 2026-09-04T20:50:14Z
purpose: 让公开 Change Plan 只承接当前实施计划并安全退出名称空间。
background: archive 与 tombstone 的历史或恢复内容不能成为公开 Change 目标或长期读取表面。
decision: 以直接 active member、Git 可恢复删除与受控 tombstone 恢复收敛当前 Change Plan 生命周期。
tags:
  - change-plan
relations:
  - type: 归并
    target: require-canonical-active-change-metadata
  - type: 归并
    target: exclude-formation-time-link-bytes-from-validation
  - type: 归并
    target: route-future-work-by-minimal-carrier
  - type: 归并
    target: 260904-complete-change-plans-by-deletion
---

## 目的

- 让 Change Plan 的公开命令只操作仍处于当前实施、交接或验证阶段的直接成员。
- 让完成计划从当前名称空间退出，并只以 Git 保留可恢复历史。

## 背景

- 先前的 archived 生命周期把不再适用当前结构检查的 artifacts 留在当前工作树，并使 catalog、reader、持续校验和路径选择长期承担历史形态。
- tombstone 只用于一次删除事务无法证明精确清理时的恢复边界；它不是 Change、历史容器或公开输入。

## 决策

- 采用: 当前 Change 生命周期为 `draft -> plan -> complete -> directory absent`。`list` 与 `check-all` 只处理 active Change 根的直接成员；`show`、`check`、`plan` 与 `complete` 只接受这样的显式目录，拒绝 tombstone 和嵌套路径。
- 采用: `complete` 只在完整 Plan、任务、base、两次 lifecycle/HEAD snapshot 与完整 Git tree 证明通过后执行。它独占声明 tombstone target，以不覆盖复制建立可验证副本，再逐项清理 source 与副本；任何未能证明的清理返回精确 recovery path，不覆盖或递归删除未知内容。
- 采用: 完成前仍由执行者完成 owner 交接并取得删除授权；工具不代替授权，也不 stage、commit、reset 或自动 Git restore。完成后需要内容时使用普通 Git。
