---
title: 在 Draft 中形成初始提案与设计
status: archived
alignment: aligned
createdAt: 2026-08-11T06:44:15Z
purpose: 让 Change 创建时同时保存开展理由与可继续收敛的初始设计，并让 Plan 专注于完善设计和派生任务。
background: Draft 只要求最小 proposal 会把设计方向推迟到 Plan，并让设计形成与任务派生挤在同一次阶段跃迁中。
decision: Draft 必须包含最小 proposal 和初始 design；进入 Plan 时继续完善二者并从设计派生 tasks，确认三者一致后再建立可实施计划。
relations:
  - type: 修订
    target: change-plan/manage-change-lifecycle-stages.md
---

## 目的

- 让一个明确 Change 从创建开始就同时保存为什么开展以及当前准备怎样实现，避免只有方向而无法继续评估方案。
- 让 Plan 阶段建立在已经存在的初始设计上，专注于收敛设计、派生任务和确认实施就绪。

## 背景

- Change Plan 不承接仍在纯探索中的问题；一个已经创建的 Draft 应当具有可持续改写的目标与初始设计，而不只是理由记录。
- 只要求最小 proposal 会把设计方向延后到 Plan，执行者需要在一次阶段转换前同时完成设计形成、风险核对和任务拆解。
- 初始设计仍可能包含暂定选择与开放问题；要求它存在不等于提前声明设计已经确认或可以实施。

## 决策

- 采用: 创建 Draft 时同时形成最小 `proposal.md` 和初始 `design.md`；proposal 保存开展理由与预期结果，design 保存当前上下文、设计目标、初步方向、已知取舍和开放问题。
- 采用: Draft 的 proposal 和 design 都允许持续改写；暂定选择必须与已确认事实区分，结构完整不表示设计已经获准实施。
- 采用: 准备进入 Plan 时继续补全 proposal、核对并完善 design，再从 design 派生 `tasks.md` 的 Readiness、Implementation 和 Verification；Plan 确认三项制品共同构成当前可执行计划。
- 采用: 不增加 proposal 或 design 独立阶段；`draft -> plan -> implementation` 的生命周期保持不变。新建 Draft 时不创建 tasks；准备确认 Plan 时允许在 metadata 仍为 `draft` 的过渡期间写入并检查 tasks。
