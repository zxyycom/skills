---
title: 以任务完成声明驱动 Change 连续结项
id: 261017-complete-change-plans-through-task-declarations
status: active
alignment: aligned
createdAt: 2026-10-17T06:51:26Z
purpose: 让任务清单完整承载实质完成条件，全勾后连续保存完成记录并安全删除计划。
background: 全勾后另设业务验收会使任务声明不完整，而删除前缺少最终 Git 快照会丢失完成记录。
decision: 以如实勾选承载工作与验收，连续执行 Git 保存和 finalize，并保留授权及删除恢复保障。
tags:
  - change-plan
  - git-integration
  - naming
  - record-lifecycle
  - responsibility-boundaries
  - validation-boundaries
relations:
  - type: 修订
    target: 260920-finalize-change-plans-by-deletion
    summary: 以任务声明统一验收并接续保留完成态的安全删除
---

## 目的

- 让 `skills/change-plan/` 的任务清单完整表达当前 Change 的实质工作与验收。
- 让任务完成直接驱动正常结项，同时在删除临时计划前保存可以回放的完成记录。

## 背景

- `proposal.md` 的成功标准、`design.md` 的必要影响和 `tasks.md` 的工作属于同一个 Outcome；若语义验收与必要 owner 交接留到全勾之后，checkbox 就不能完整表达工作是否完成。
- `finalize` 删除临时目录，历史由 Git 恢复，因此删除前需要保存全部任务完成的最终记录。
- 任务验收与删除保障承担不同责任：前者确认工作结果，后者保护完成记录、路径与恢复；当前任务授权约束实际操作范围。

## 决策

- 采用: 本决策适用于 `skills/change-plan/`。生命周期为 `draft -> plan --finalize--> directory absent`；`finalize` 是正常结项动作，成功 outcome 为 `finalized`，退出后的历史仅由 Git 承接。
- 采用: `tasks.md` 完整承接成功标准、预期调整、必要影响、阻塞验收的问题、稳定 owner 同步与必要知识交接，优先落实到现有任务或其验收条件。
- 采用: 每次勾选声明工作与验收已完成且有证据，语义审阅与必要交接在勾选前完成；遗漏、误勾或证据不足时修正清单与状态。`completedTaskCount` 是工具读取的进度计数，证据与权限由执行者核实。
- 采用: 在实施或完成 Change 的任务中，全勾后连续保存 Git 完成态、预检、执行 `finalize`，并以 `list` 确认退出；业务验收已经随任务完成。保存最终全勾 Plan 与删除自身目录属于结项动作，不列为全勾的前置任务，以免循环。
- 采用: 按项目版本控制流程保存当前任务改动并保留无关工作。完整 Change 目录与当前 `HEAD` 精确匹配，保证最终全勾 Plan 与必要证据可恢复；已有相同快照无需重复提交。
- 采用: 保留完整 Plan、任务、基线、两次 lifecycle/HEAD snapshot、完整 Git tree 及路径与清理保护；`change-deletion-*`、tombstone 与 `committed-cleanup-pending` 继续承担删除与恢复责任。`finalize` 不 stage、commit、reset、revert 或自动 Git restore。
- 采用: 接手实施时恢复实施、提交和正常结项删除的既有授权，缺失且影响交付时尽早确认；完整交付按已有授权连续结项。只创建、查询或审阅计划时保持原有操作范围，即使全勾也不自动提交或删除。
- 采用: 版本保存、机械门禁或清理失败按结项执行故障处理，任务按事实保持状态，正常完成以 `finalized` 与 `list` 确认。不再实施的 Change 按明确授权下的取消路径退出。
