---
title: 直接提示 Plan 的 Git 演进距离
status: active
alignment: aligned
createdAt: 2026-08-13T05:35:51Z
purpose: 让调用方从 Plan 基线后的项目演进事实直接判断是否需要复核当前计划。
background: Git 距离能够提示计划上下文可能变化，但不能判断变化是否影响计划；阈值分类会让调用方先解释术语，再恢复原始证据。
decision: 保留 baseCommit 与 Git 距离计算，查询直接返回距离事实和行动提示；可用距离只提示，基线不可追溯时要求重新审阅 Plan。
tags:
  - change-plan
relations:
  - type: 归并
    target: detect-shelved-plans-by-git-distance.md
  - type: 归并
    target: use-plan-base-only-for-git-distance.md
---

## 目的

- 让 `skills/change-plan/` 的使用者直接看到 Plan 与当前项目上下文相距多远，以及继续前应检查什么。
- 让 Git 距离只承担复核提示和可检查证据，不驱动生命周期动作。

## 背景

- `baseCommit` 能为最后一次 Plan 确认提供稳定的 Git 距离起点，但不能同时证明 artifacts 与该提交内容一致。
- 从 Plan 基线到当前 `HEAD` 的 first-parent 提交数，以及这些提交在当前 Change 目录外产生的累计增删行数，可以直接表达项目继续演进的规模。
- 距离大小只说明上下文变化的可能性，不能证明变化已经影响当前 Plan，也不能决定计划的生命周期。
- 固定阈值与 assessment 分类会把原始事实转换成需要再次解释的内部术语。

## 决策

- 采用: Plan metadata 保留 `baseCommit`，只表示最后一次成功运行 `plan` 时已有的 `HEAD`，不表示 artifacts 内容快照；操作者仍可把三个 artifacts 与 metadata 放入同一个后续提交。
- 采用: 查询沿 first-parent 计算从 `baseCommit` 到当前 `HEAD` 的提交数，并累计当前 Change 目录外的 additions 与 deletions；只修改当前 Change 目录的提交不计入距离。
- 采用: 文本结果用一句话报告距离事实和行动提示。存在距离时说明已经过去多少提交、Change 目录外累计变化多少行，并提醒继续前确认变化没有影响当前计划；距离为零时说明自计划基线以来未统计到 Change 目录外的项目变化。
- 采用: 可用 Git 距离无论大小都只作提示，不阻断检查或归档，也不产生阈值、分类或生命周期动作。结构化结果只保留 `baseCommit`、`headCommit`、`commitCount` 与 `changedLines` 等原始证据。
- 采用: `baseCommit` 缺失、不可解析或不在当前 `HEAD` 的 first-parent 历史上时，检查以可行动诊断阻断，并要求调用方重新审阅 Plan 后运行 `plan` 刷新基线；现有 Plan 也可以在完成语义复核后主动重新运行 `plan`。
