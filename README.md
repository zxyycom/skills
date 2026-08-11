# Skills

这个项目的起点，是我在真实使用 agent 时逐渐发现的一件事：agent 的效果不只取决于模型能力，也取决于人类如何把意图、规则、流程和变更历史交给它。

很多问题表面上像是“agent 没理解”，实际是协作接口不够清楚：文档没有把判断路径写出来，任务没有合适的进入姿态，提交信息不能解释变更意图，流程规范也没有被改写成 agent 能稳定执行的文本。这个项目希望把这些经验沉淀成一组可复用的 skills。

## 项目起点

`skills` 不是一个随手收集 prompt 的仓库。它更像一组面向 agent 协作的基础能力实验：把高频、可复用、会影响长期工作质量的协作方式，整理成能独立演进的 skill。

这些 skills 集中在同一仓库，以复用维护工具链并提供统一的分发入口。使用者按需选择自己大致了解的 skill，不需要整套安装；聚合 release 和随包 updater 只提供获取与更新便利。完整边界见 [仓库模型](docs/repository-model.md)。

维护仓库内容时，从 [仓库导航](docs/navigation.md) 按任务定位先读内容和对应 owner。

开发环境可以先运行 `node scripts/environment.js check`；需要补齐工具、项目依赖和仓库本地配置时改用 `node scripts/environment.js setup`。完整边界见 [项目工具链](docs/tooling.md#环境自举)。

项目不会把所有内容合成一个大而全的 skill。每个 skill 都有自己的问题意识、语义边界和演进方向；它们放在同一组项目里，是为了共同服务于更好的 agent 协作。

## 当前方向

[Product & Architecture Judgment](docs/skills/product-architecture-judgment.md) 在工程任务深入局部实现前, 让 agent 区分目标结果、当前问题和已有解法, 再从产品价值与架构责任判断事情是否该做、该做到什么程度, 以及应由谁在哪一层实现。它从不做、简化、改写、重定责任、提炼抽象或局部实现中选择有证据支持的最小动作。实际 skill 位于 [`skills/product-architecture-judgment/`](skills/product-architecture-judgment/)。

[Common Denominator Design](docs/skills/common-denominator-design.md) 在统一格式、需求、数据模型、接口、流程或代码实现前, 让 agent 按现实场景识别可共同依赖的契约边界。它决定应使用一个公约数、共享核心加变体、多个场景公约数还是保持局部, 并允许存储与使用按责任层形成不同但可映射的公约数。实际 skill 位于 [`skills/common-denominator-design/`](skills/common-denominator-design/)。

[Dependency Boundary Design](docs/skills/dependency-boundary-design.md) 在同一责任的工具、库、SDK、存储或基础设施调用分散，或依赖处理重复、漂移时，判断是否需要建立明确边界。需要收口时，它按责任与变化原因确定 owner、范围、契约和例外，先集中当前依赖治理，再按现实多实现义务演进。实际 skill 位于 [`skills/dependency-boundary-design/`](skills/dependency-boundary-design/)。

[Minimal Implementation](docs/skills/minimal-implementation.md) 在目标、contract 和责任 owner 已明确后，让 agent 识别依赖、抽象、配置、扩展点、状态和 ownership 等会改变选择的维护面，并在通过正确性门槛的候选之间选择总体维护面更小的实现；它也可以对当前 diff 或指定范围执行只读 complexity pass。实际 skill 位于 [`skills/minimal-implementation/`](skills/minimal-implementation/)。

[Skill Design Discovery](docs/skills/skill-design-discovery.md) 用于创建、显著扩展或大幅重构 skill 前的深度设计发现。它从现实案例、现有材料和行为证据中恢复目标、端到端流程、潜藏决策、约束来源、人机权限与验证义务，形成可交给实现入口的设计契约。实际 skill 位于 [`skills/skill-design-discovery/`](skills/skill-design-discovery/)。

[Test Evidence Review](docs/skills/test-evidence-review.md) 在新增、修改、删除或评审测试实现时，以测试框架中最小可独立选择并报告结果的原生测试节点为入口，区分测试节点与文件、suite、脚本、CI job 等聚合容器或内部环节，并为本次范围内每个保留入口维护一个显式 case；索引支持按 Contract、Proves 和 Entry 快速检索，不负责发现或自动注册。工程校验和仅运行既有测试不会触发。实际 skill 位于 [`skills/test-evidence-review/`](skills/test-evidence-review/)。

[AI-Ready Docs](docs/skills/ai-ready-docs.md) 负责把文档优化到适合 AI 阅读、理解和使用的状态。它让 AI 能从实际文本准确恢复用途、信息、关系、范围、权威性和边界，同时保持文档便于人类阅读与维护；人类侧是次级约束和常见收益，不是并列主目标。实际 skill 位于 [`skills/ai-ready-docs/`](skills/ai-ready-docs/)。

[Skill Maintainer](docs/skills/skill-maintainer.md) 说明 skill 的组成与主要类型，判断能力归属，以自包含基线和环境适配完成交付，并随包提供机械结构验证器。实际 skill 位于 [`skills/skill-maintainer/`](skills/skill-maintainer/)。

[Git Commit Organizer](docs/skills/git-commit-organizer.md) 关注提交信息质量。它希望统一提交风格，让每一次提交都能更准确地表达变更意图，降低后续阅读、审查、追踪和管理成本。实际 skill 位于 [`skills/git-commit-organizer/`](skills/git-commit-organizer/)。

[Change Plan](docs/skills/change-plan.md) 用 `proposal.md`、`design.md`、`tasks.md` 和 `.change-plan.json` 维护明确 Change 的 draft、plan、implementation 与 shelved 阶段，并通过随包 CLI 提供查询、阶段推进、Git 距离搁置识别和归档。实际 skill 位于 [`skills/change-plan/`](skills/change-plan/)。

[Task Graph](docs/skills/task-graph.md) 为当前工作维护可恢复的非线性任务图。它用权威 JSON 索引显式保存候选、真实父子、依赖、排斥和执行租约，通过事务化 JSON CLI 支持动态追加、并发领取和上下文恢复；只要仍有协调价值，任务就可以持续保留，但持久知识、正式 change 与代理编排继续由各自 owner 承接。实际 skill 位于 [`skills/task-graph/`](skills/task-graph/)。

[Subagent Orchestration](docs/skills/subagent-orchestration.md) 在用户明确要求委派，或复杂任务适合拆成边界清楚的调查、实现、验证和审查子任务时，指导主 agent 选择最小充分历史、划分互斥写入所有权并审计结果。它让子代理负责有界交付，主 agent 保持目标一致性和下一步判断。实际 skill 位于 [`skills/subagent-orchestration/`](skills/subagent-orchestration/)。

[OpenSpec Skills](docs/skills/openspec-skills.md) 当前保留探索、提案、实施和归档四个入口，但整组能力已经进入去留观察期：现有行为继续可用，普通维护与改进默认延期，观察本身不表示已经删除或授权删除。实际 skill 位于 [`skills/openspec-explore/`](skills/openspec-explore/)、[`skills/openspec-propose/`](skills/openspec-propose/)、[`skills/openspec-apply-change/`](skills/openspec-apply-change/) 和 [`skills/openspec-archive-change/`](skills/openspec-archive-change/)。

[Codex Shell Permissions](docs/skills/codex-shell-permissions.md) 关注 Codex shell 失败后的下一步执行选择。它让 agent 判断应改用简单命令、申请必要提权、确认高风险范围，还是回到真实程序错误处理；当用户主动要求时，再进入 `execpolicy` 和 `allow/prompt/block` 的权限规则维护流程。实际 skill 位于 [`skills/codex-shell-permissions/`](skills/codex-shell-permissions/)。

[ast-grep](docs/skills/ast-grep.md) 让 agent 使用 ast-grep CLI 按语法树结构查看、搜索、检查和受控迁移代码。它在 `outline`、`run`、`scan` 和 `test` 之间选择最小入口，先用正反例证明 matcher，再限制真实扫描或 rewrite 范围；文本、语义、符号引用和调用图查询继续交给各自工具。实际 skill 位于 [`skills/ast-grep/`](skills/ast-grep/)。

[Investigation Report](docs/skills/investigation-report.md) 在用户明确要求沉淀调查时，用稳定主题保存每轮形成时背景、调查目的、实际依据以及结果与边界。同一核心问题的新认识追加为可独立阅读的完整报告，主题级派生索引负责发现、新鲜度和查询。实际 skill 位于 [`skills/investigation-report/`](skills/investigation-report/)。

[Decision Records](docs/skills/decision-records.md) 提供一套跨项目复用的长期决策记忆方案和配套 CLI。它用自包含 Markdown 保存长期决策的完整语义、生命周期、对齐状态和演进关系，并生成可重建的全生命周期 JSON 查询索引；配套 CLI 负责查询、检查、索引同步和受约束的维护事务。实际 skill 位于 [`skills/decision-records/`](skills/decision-records/)。

## 发展方向

这个项目会继续围绕“提升人类和 agent 的协作质量”扩展，而不是追求 skill 数量。新的 skill 应解决反复出现的协作问题，能够稳定改善 agent 行为，并具备可以独立演进的清晰边界。

长期来看，我希望这里形成一组互相配合的 agent 工作基础设施：文档能更好地表达意图，流程能更好地约束行动，提交历史能更好地保留上下文。这样人类不是不断纠正 agent，而是通过更好的协作材料，让 agent 更接近稳定的工程伙伴。
