# Skills

这个项目的起点，是我在真实使用 agent 时逐渐发现的一件事：agent 的效果不只取决于模型能力，也取决于人类如何把意图、规则、流程和变更历史交给它。

很多问题表面上像是“agent 没理解”，实际是协作接口不够清楚：文档没有把判断路径写出来，任务没有合适的进入姿态，提交信息不能解释变更意图，流程规范也没有被改写成 agent 能稳定执行的文本。这个项目希望把这些经验沉淀成一组可复用的 skills。

## 项目起点

`skills` 不是一个随手收集 prompt 的仓库。它更像一组面向 agent 协作的基础能力实验：把高频、可复用、会影响长期工作质量的协作方式，整理成能独立演进的 skill。

这些 skills 集中在同一仓库，以复用维护工具链并提供统一的分发入口。使用者按需选择自己大致了解的 skill，不需要整套安装；聚合 release 和随包 updater 只提供获取与更新便利。完整边界见 [仓库模型](docs/repository-model.md)。

维护或查找项目文档时，从 [文档导航](docs/navigation.md) 按任务进入对应 owner。

开发环境可以先运行 `node scripts/env.js check`；需要补齐工具或项目依赖时改用 `node scripts/env.js install`。完整边界见 [项目工具链](docs/tooling.md#环境自举)。

当前方向覆盖 agent 协作中的几个关键环节：

1. 文档如何引导 agent 理解和行动。
2. 变更如何通过提交历史被后来的人和 agent 理解。
3. 流程型规范如何被改写成 agent 能稳定推进的工作流。
4. Shell 失败后如何让 agent 选择下一步命令动作，并在用户要求时维护 Codex 权限 rules。
5. 自动化测试、人工审查风险和发现豁免如何通过统一账本保持可追溯。
6. 隐性专业工作如何在 Skill 实现前恢复为可执行的决策、约束、权限和验证义务。
7. 多个格式、需求、数据模型或代码实现如何识别可共同依赖的契约, 并决定公约数的数量、变体与责任层。
8. 一次 change 如何形成可持久审阅、带实施门禁并可机械检查结构的计划。
9. 目标与责任已明确后，如何识别会改变实现选择的维护面，并在正确候选之间选择更小方案。

因此这个项目不会把所有内容合成一个大而全的 skill。每个 skill 都应该有自己的问题意识、语义边界和演进方向；它们放在同一组项目里，是为了共同服务于更好的 agent 协作。

## 当前方向

[Product & Architecture Judgment](docs/skills/product-architecture-judgment.md) 在工程任务深入局部实现前, 让 agent 区分目标结果、当前问题和已有解法, 再从产品价值与架构责任判断事情是否该做、该做到什么程度, 以及应由谁在哪一层实现。它从不做、简化、改写、重定责任、提炼抽象或局部实现中选择有证据支持的最小动作。实际 skill 位于 [`skills/product-architecture-judgment/`](skills/product-architecture-judgment/)。

[Common Denominator Design](docs/skills/common-denominator-design.md) 在统一格式、需求、数据模型、接口、流程或代码实现前, 让 agent 按现实场景识别可共同依赖的契约边界。它决定应使用一个公约数、共享核心加变体、多个场景公约数还是保持局部, 并允许存储与使用按责任层形成不同但可映射的公约数。实际 skill 位于 [`skills/common-denominator-design/`](skills/common-denominator-design/)。

[Minimal Implementation](docs/skills/minimal-implementation.md) 在目标、contract 和责任 owner 已明确后，让 agent 识别依赖、抽象、配置、扩展点、状态和 ownership 等会改变选择的维护面，并在通过正确性门槛的候选之间选择总体维护面更小的实现；它也可以对当前 diff 或指定范围执行只读 complexity pass。实际 skill 位于 [`skills/minimal-implementation/`](skills/minimal-implementation/)。

[Skill Design Discovery](docs/skills/skill-design-discovery.md) 用于创建、显著扩展或大幅重构 skill 前的深度设计发现。它从现实案例、现有材料和行为证据中恢复目标、端到端流程、潜藏决策、约束来源、人机权限与验证义务，形成可交给实现入口的设计契约。实际 skill 位于 [`skills/skill-design-discovery/`](skills/skill-design-discovery/)。

[Test Evidence Review](docs/skills/test-evidence-review.md) 评估测试固定的契约和证明价值，把当前无法经济自动化的稳定风险登记为人工 CR，并把测试发现误报登记为可巡检豁免；可替换入口采集层与账本维护层通过标准清单连接，共同检查入口角色、Git Scope 和归属漂移。实际 skill 位于 [`skills/test-evidence-review/`](skills/test-evidence-review/)。

[AI-Ready Docs](docs/skills/ai-ready-docs.md) 负责把文档优化到适合 AI 阅读、理解和使用的状态。它让 AI 能从实际文本准确恢复用途、信息、关系、范围、权威性和边界，同时保持文档便于人类阅读与维护；人类侧是次级约束和常见收益，不是并列主目标。实际 skill 位于 [`skills/ai-ready-docs/`](skills/ai-ready-docs/)。

[Skill Maintainer](docs/skills/skill-maintainer.md) 说明 skill 的组成与主要类型，判断能力归属，以自包含基线和环境适配完成交付，并随包提供机械结构验证器。实际 skill 位于 [`skills/skill-maintainer/`](skills/skill-maintainer/)。

[Git Commit Organizer](docs/skills/git-commit-organizer.md) 关注提交信息质量。它希望统一提交风格，让每一次提交都能更准确地表达变更意图，降低后续阅读、审查、追踪和管理成本。实际 skill 位于 [`skills/git-commit-organizer/`](skills/git-commit-organizer/)。

[Change Plan](docs/skills/change-plan.md) 为明确 change 创建、更新或审阅 `proposal.md`、`design.md` 和 `tasks.md`，把目标范围、当前 change 的设计上下文、Readiness 门禁、实施任务和验证任务整理为可交接的临时计划，并随包提供基础结构检查 CLI。实际 skill 位于 [`skills/change-plan/`](skills/change-plan/)。

[OpenSpec Skills](docs/skills/openspec-skills.md) 关注 OpenSpec skills 的二次开发。它的起点是原有 OpenSpec skill 文本还不够适合实际 agent 协作，需要重新梳理阶段边界、指令质量和执行脉络。实际 skill 位于 [`skills/openspec-explore/`](skills/openspec-explore/)、[`skills/openspec-propose/`](skills/openspec-propose/)、[`skills/openspec-apply-change/`](skills/openspec-apply-change/) 和 [`skills/openspec-archive-change/`](skills/openspec-archive-change/)。

[Codex Shell Permissions](docs/skills/codex-shell-permissions.md) 关注 Codex shell 失败后的下一步执行选择。它让 agent 判断应改用简单命令、申请必要提权、确认高风险范围，还是回到真实程序错误处理；当用户主动要求时，再进入 `execpolicy` 和 `allow/prompt/block` 的权限规则维护流程。实际 skill 位于 [`skills/codex-shell-permissions/`](skills/codex-shell-permissions/)。

[Decision Records](docs/skills/decision-records.md) 提供一套跨项目复用的长期决策记忆方案和配套 CLI。它用稳定 Markdown 文件保存显式摘要、完整背景、决策和按需声明的演进关系，用 JSON 索引保存当前判断的精简背景与决策，并支持结构检查、独立逻辑归档、关系链查询和校验式成员更新；实际 skill 位于 [`skills/decision-records/`](skills/decision-records/)。

## 发展方向

这个项目后续会继续围绕“提升人类和 agent 的协作质量”扩展，而不是追求 skill 数量。

更值得沉淀的 skill 应该满足三个条件：它解决的是反复出现的协作问题；它能通过更好的文档、流程或检查方式稳定改善 agent 行为；它有足够清晰的边界，可以独立演进而不变成杂项集合。

长期来看，我希望这里形成一组互相配合的 agent 工作基础设施：文档能更好地表达意图，流程能更好地约束行动，提交历史能更好地保留上下文。这样人类不是不断纠正 agent，而是通过更好的协作材料，让 agent 更接近稳定的工程伙伴。
