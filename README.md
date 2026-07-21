# Skills

这个项目的起点，是我在真实使用 agent 时逐渐发现的一件事：agent 的效果不只取决于模型能力，也取决于人类如何把意图、规则、流程和变更历史交给它。

很多问题表面上像是“agent 没理解”，实际是协作接口不够清楚：文档没有把判断路径写出来，任务没有合适的进入姿态，提交信息不能解释变更意图，流程规范也没有被改写成 agent 能稳定执行的文本。这个项目希望把这些经验沉淀成一组可复用的 skills。

## 项目起点

`skills` 不是一个随手收集 prompt 的仓库。它更像一组面向 agent 协作的基础能力实验：把高频、可复用、会影响长期工作质量的协作方式，整理成能独立演进的 skill。

这些 skills 集中在同一仓库，以复用维护工具链并提供统一的分发入口。使用者按需选择自己大致了解的 skill，不需要整套安装；聚合 release 和随包 updater 只提供获取与更新便利。完整边界见 [仓库模型](docs/repository-model.md)。

维护或查找项目文档时，从 [文档导航](docs/navigation.md) 按任务进入对应 owner。

当前方向覆盖 agent 协作中的几个关键环节：

1. 文档如何引导 agent 理解和行动。
2. 变更如何通过提交历史被后来的人和 agent 理解。
3. 流程型规范如何被改写成 agent 能稳定推进的工作流。
4. Shell 失败后如何让 agent 选择下一步命令动作，并在用户要求时维护 Codex 权限 rules。
5. 自动化测试、人工审查风险和发现豁免如何通过统一账本保持可追溯。
6. 隐性专业工作如何在 Skill 实现前恢复为可执行的决策、约束、权限和验证义务。

因此这个项目不会把所有内容合成一个大而全的 skill。每个 skill 都应该有自己的问题意识、语义边界和演进方向；它们放在同一组项目里，是为了共同服务于更好的 agent 协作。

## 当前方向

[Product & Architecture Judgment](docs/skills/product-architecture-judgment.md) 在工程任务深入局部实现前, 让 agent 区分目标结果、当前问题和已有解法, 再从产品价值与架构责任判断事情是否该做、该做到什么程度, 以及应由谁在哪一层实现。它从不做、简化、改写、重定责任、提炼抽象或局部实现中选择有证据支持的最小动作。实际 skill 位于 [`skills/product-architecture-judgment/`](skills/product-architecture-judgment/)。

[Skill Design Discovery](docs/skills/skill-design-discovery.md) 用于创建、显著扩展或大幅重构 skill 前的深度设计发现。它从现实案例、现有材料和行为证据中恢复目标、端到端流程、潜藏决策、约束来源、人机权限与验证义务，形成可交给实现入口的设计契约。实际 skill 位于 [`skills/skill-design-discovery/`](skills/skill-design-discovery/)。

[Test Evidence Review](docs/skills/test-evidence-review.md) 评估测试固定的契约和证明价值，把当前无法经济自动化的稳定风险登记为人工 CR，并把测试发现误报登记为可巡检豁免；可替换入口采集层与账本维护层通过标准清单连接，共同检查入口角色、Git Scope 和归属漂移。实际 skill 位于 [`skills/test-evidence-review/`](skills/test-evidence-review/)。

[Prompt Optimize](docs/skills/prompt-optimize.md) 关注文档优化。它的核心不是润色文字，而是改善文档对 agent 的引导效果，让文档成为人类和 agent 之间更可靠的协作接口。实际 skill 位于 [`skills/prompt-optimize/`](skills/prompt-optimize/)。

[Skill Maintainer](docs/skills/skill-maintainer.md) 说明 skill 的组成与主要类型，判断能力归属，以自包含基线和环境适配完成交付，并随包提供机械结构验证器。实际 skill 位于 [`skills/skill-maintainer/`](skills/skill-maintainer/)。

[Git Commit Organizer](docs/skills/git-commit-organizer.md) 关注提交信息质量。它希望统一提交风格，让每一次提交都能更准确地表达变更意图，降低后续阅读、审查、追踪和管理成本。实际 skill 位于 [`skills/git-commit-organizer/`](skills/git-commit-organizer/)。

[OpenSpec Skills](docs/skills/openspec-skills.md) 关注 OpenSpec skills 的二次开发。它的起点是原有 OpenSpec skill 文本还不够适合实际 agent 协作，需要重新梳理阶段边界、指令质量和执行脉络。实际 skill 位于 [`skills/openspec-explore/`](skills/openspec-explore/)、[`skills/openspec-propose/`](skills/openspec-propose/)、[`skills/openspec-apply-change/`](skills/openspec-apply-change/) 和 [`skills/openspec-archive-change/`](skills/openspec-archive-change/)。

[Codex Shell Permissions](docs/skills/codex-shell-permissions.md) 关注 Codex shell 失败后的下一步执行选择。它让 agent 判断应改用简单命令、申请必要提权、确认高风险范围，还是回到真实程序错误处理；当用户主动要求时，再进入 `execpolicy` 和 `allow/prompt/block` 的权限规则维护流程。实际 skill 位于 [`skills/codex-shell-permissions/`](skills/codex-shell-permissions/)。

[Decision Records](docs/skills/decision-records.md) 提供一套跨项目复用的长期决策记忆方案和配套 CLI。它用稳定 Markdown 文件保存显式摘要、完整背景、决策和按需声明的演进关系，用 JSON 索引保存当前判断的精简背景与决策，并支持结构检查、独立逻辑归档、关系链查询和校验式成员更新；实际 skill 位于 [`skills/decision-records/`](skills/decision-records/)。

## 发展方向

这个项目后续会继续围绕“提升人类和 agent 的协作质量”扩展，而不是追求 skill 数量。

更值得沉淀的 skill 应该满足三个条件：它解决的是反复出现的协作问题；它能通过更好的文档、流程或检查方式稳定改善 agent 行为；它有足够清晰的边界，可以独立演进而不变成杂项集合。

长期来看，我希望这里形成一组互相配合的 agent 工作基础设施：文档能更好地表达意图，流程能更好地约束行动，提交历史能更好地保留上下文。这样人类不是不断纠正 agent，而是通过更好的协作材料，让 agent 更接近稳定的工程伙伴。
