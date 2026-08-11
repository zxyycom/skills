---
title: 将 Change 结构完成与实施许可分离
status: active
alignment: aligned
createdAt: 2026-08-11T03:26:59Z
purpose: 允许未成熟的 OpenSpec Change 先形成结构，同时阻止未审计或仍有关键歧义的方案进入实现。
background: Artifact 完成只证明满足当前 schema 的结构要求，不能证明方案已经审计、开放问题已经解决或当前任务已经授权实施。
decision: Change 可以作为临时计划存在；propose 设置阻塞级实现前审计，apply 在开放问题或关键歧义消除前暂停实现。
relations:
  - type: 拆分
    target: openspec/260706-gate-temporary-change-plans.md
---

## 目的
- 让想法和待审方案能够先进入结构化 Change，而不被误解为已经批准或可以直接实施。
- 在进入实现前暴露跨 artifact 偏离、未回答问题和仍影响实现的歧义。

## 背景
- OpenSpec 的 artifact 状态表示 schema 和依赖要求下的材料完成度，不承担方案审核、用户授权或实现正确性的证明。
- 如果创建 Change 或 artifact 完成自动等同于实施许可，维护者会失去暂存未成熟计划的安全空间。
- 提案阶段的跨 artifact 审计和实施阶段的开放问题检查作用于同一许可边界，但使用各阶段可获得的不同证据。

## 决策
- 采用: Active Change 可以作为尚待审计的临时计划存在；创建目录、生成 artifact 或达到结构完成状态都不表示方案已经批准、审计完毕或获得实施许可。
- 采用: Propose 在所有实现任务之前保留阻塞级审计，至少核对目标主线、capability 身份、Change 写入边界、临时状态表达和开放问题是否已经收敛。
- 采用: Apply 在执行实现前检查开放问题及已标记收敛但仍影响实现的歧义；存在任一项时暂停，不把缺失判断当作实现假设。
- 采用: Artifact 不需要重复固定免责声明，但不得把临时 Change 表述为已批准、已审计或可直接实现；具体许可仍来自当前任务授权和门禁证据。
- 不采用: 不把 Change 创建、artifact 完成或 CLI 的可执行状态单独视为实施授权。
- 不采用: 不再把 Artifact 的写作语言与示例选择作为这组长期决策的组成部分；它们由当前 skill 行为和项目语言约定维护，只有出现需要独立回放的长期取舍时才另行记录。
