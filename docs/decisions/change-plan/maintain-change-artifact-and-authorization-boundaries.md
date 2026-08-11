---
title: 维护 Change Plan 的制品与授权边界
status: active
alignment: aligned
createdAt: 2026-08-11T03:23:12Z
purpose: 让 Change Plan 自包含表达三项制品、临时实施上下文与授权边界，而不与 CLI 或阶段生命周期混合。
background: CLI 和阶段记录已经独立演进，但活动决策集合缺少制品职责、稳定 owner 与授权区分的当前基线。
decision: Change Plan 以 proposal、design 和 tasks 承接临时变更计划，并让机械就绪、内容审阅和实施授权保持可区分。
relations:
  - type: 拆分
    target: change-plan/use-independent-change-plans.md
---

## 目的

- 让一个 Change 的目标、设计上下文、任务与验证安排具有可持久交接的临时 owner。
- 让稳定事实、长期判断、机械检查、内容审阅和实施授权继续由各自边界承接。

## 背景

- 明确变更需要在对话之外保存目标、范围、当前方案、准备门禁、实施任务和验证安排。
- 稳定文档与长期决策已经拥有跨 Change 持续有效的信息；把临时计划并入这些 owner 会混淆当前事实、长期理由和本次实施上下文。
- 文件齐全、结构有效或阶段命令成功只能证明机械条件，不能证明开放问题、事实、方案、权限与风险已经得到语义确认。

## 决策

- 采用: 每个 Change 使用 `proposal.md` 承接目标、理由与范围，使用 `design.md` 承接当前 Change 的事实输入、方案、取舍和开放问题，使用 `tasks.md` 承接 Readiness、Implementation 与 Verification。
- 采用: Change Plan 只拥有当前 Change 的临时实施上下文。项目文档继续拥有稳定事实和行为，项目已有长期决策 owner 时，跨 Change 持续有效的方向与理由进入该 owner。
- 采用: Readiness、结构检查和阶段命令不授予实施或归档许可。执行者仍需核对内容、开放问题、必要授权、风险和实际完成证据，并以当前任务授权决定是否推进。
- 采用: Change Plan 保持为不依赖 OpenSpec capability、delta spec 或主 spec 合并的独立能力；创建 Change Plan 不迁移、替代或改变既有 OpenSpec change。
- 不采用: 让计划文件、机械检查结果或阶段状态代替稳定 owner、长期决策、内容审阅或授权判断。
