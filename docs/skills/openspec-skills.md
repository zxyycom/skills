# OpenSpec Skills

本仓库当前仍保留四个经过二次整理的 OpenSpec skills，但这组能力已经进入去留观察期。现有入口继续可用；普通问题、文案优化、体验改进和功能扩展默认延期，不据此建立新的 Task 或 Change。观察不表示已经删除或现有行为失效，真实删除仍需要独立授权和完整影响核对。

当前维护姿态由[在删除观察期延期 OpenSpec 维护](../decisions/skill-maintainer/defer-openspec-maintenance-during-removal-review.md)承接；四个 skill 的实际行为仍分别以对应 `SKILL.md` 为准。

## 当前保留的能力

OpenSpec 工作流按探索、提案、实施和归档分成四个行为入口：

1. `openspec-explore` 澄清问题、调查事实和比较方案，不提前进入实现。
2. `openspec-propose` 把需求整理为 proposal、design、tasks 和 spec delta 等临时 artifacts。
3. `openspec-apply-change` 按 Change 任务清单推进实现，并同步任务状态和验证结果。
4. `openspec-archive-change` 在完成状态核对后归档 Change，并保留可审计摘要。

## 观察期边界

1. 现有 skill、决策和分发关系在实际删除前继续有效；观察状态不改变使用这些入口时必须遵守的现行契约。
2. 新发现的普通问题只作为当次判断，不自动沉淀为 backlog、Task、Change 或新的实施承诺。明确重新选择维护后，再按届时事实重新评估。
3. 如果决定继续保留，只处理重新确认仍有价值的问题，不恢复全部历史改进设想。
4. 如果决定删除，需要单独核对并同步 skill 目录、`AGENTS.md`、项目入口、打包分发和仓库引用；观察期本身不授权这些修改。

本页不维护延期问题清单，也不把可能删除解释为既成事实。
