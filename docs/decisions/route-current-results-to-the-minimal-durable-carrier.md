---
title: 按当前结果选择最小持久载体
id: 261004-route-current-results-to-the-minimal-durable-carrier
status: active
alignment: aligned
createdAt: 2026-10-04T15:28:57Z
purpose: 让长期方向、实施计划、当前协调和形成时调查各有唯一内容 owner，避免同一未来事项重复持久化。
background: 载体共享主题不表示共享状态与生命周期；重复保存理由、任务分解或等待会扩大协调成本并产生漂移。
decision: 仓库导航按当前独有结果选择最小载体；组合时单向引用，状态与理由各归唯一 owner，退出沿用各自契约。
tags:
  - change-plan
  - decision-records
  - investigation-report
  - project-documentation
  - responsibility-boundaries
  - task-graph
relations:
  - type: 修订
    target: route-future-work-by-minimal-carrier
    summary: 保留最小载体与单向交接，结项使用当前退出契约
---

## 目的

- 让维护者根据当前确实需要保存的结果，判断使用当前任务、Decision、Change Plan、Task Graph、Change 内任务还是 Investigation Report。
- 避免同一方向、理由、进度或任务分解在多个持久载体中完整复制并逐渐漂移。

## 背景

- Decision 保存跨 Change 的长期方向，Change 保存明确实施计划，Task Graph 保存已选择工作所需协调，Investigation 保存形成时可独立复核的认识。
- 未来可能实施、主题相近或希望持续关注，都不足以证明当前需要第二个载体的独有结果。
- 未对齐方向若自动产生等待任务或活动草稿，会把未来选择伪装成当前执行承诺；短期计划结项后仍占用工作区也不能增加长期知识的可信度。

## 决策

- 采用: 由 `docs/navigation.md` 维护按当前需要保存的独有结果选择最小载体的路由，各 skill 继续完整拥有自己的内容和生命周期契约。
- 仅在当前确实需要载体独有结果时建立它。`active + unaligned` Decision 表达未来方向，不自动创建 Change、Task 或等待状态；明确纳入当前执行后，再按规划或协调需要建立最小下游载体。
- 单个 Change 内的 readiness、implementation 和 verification 由该 Change 的 `tasks.md` 唯一维护；确有独立租约、关系或跨 Change 协调需要的工作才另建 Task。
- 确需组合载体时使用单向引用：Change 与 Task 可以引用 Decision，Task 可引用它正在协调的 Change。长期理由、临时实施分解和协调状态只在各自 owner 完整保存。
- 完成的 Change 按结项与删除契约退出，历史由 Git 恢复；不再实施的 draft 不作为未来资料柜。下游退出时只交接自己拥有的结果，稳定事实、长期方向与独立调查认识归位对应 owner。
- Task 目标达成后完成，放弃或失去当前协调价值时取消；`waiting` 必须有可观察的外部条件。当前任务中的普通想法或步骤不因任务结束另建持久记录。
