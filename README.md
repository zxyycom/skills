# Skills

这个仓库存在的目的，是把 Codex skills 当作一组可长期维护、可验证、可发布的能力来管理，而不是把它们分散成一次性的 prompt 片段或本机配置。

它保留多仓库结构：每个 skill 子仓库拥有自己的行为边界和演进节奏，主仓库负责共享工具链、校验、打包、发布和长期维护约定。这样既能让单个 skill 独立发展，也能避免每个仓库重复维护相同的脚本、CI 和项目文档。

## 为什么这样组织

Codex skill 的价值不只在一份 `SKILL.md`。真正需要长期维护的是触发条件、读取策略、执行流程、引用资料、验证方式和发布路径之间的一致性。

这个主仓库承担三个长期职责：

1. 让多个 skill 以独立仓库存在，保留清晰 owner、提交历史和远端发布边界。
2. 把重复的工程能力集中维护，包括校验、打包、CI、发布和维护文档。
3. 用统一检查保证所有 skill 都能被发现、被打包，并保持内部链接和项目约定可验证。

## 当前能力方向

当前维护的 skill 分为三个方向：

1. [Prompt Optimize](prompt-optimize/README.md): 面向 prompt、规则、任务、需求、模板、工作流、skill 说明和 agent 指令的结构化文本优化。
2. [Git Commit Organizer](git-commit-organizer/README.md): 面向 Git 工作区审计、提交范围整理和中文语义化提交创建。
3. [OpenSpec Skills](openspec-skills/README.md): 面向 OpenSpec explore、propose、apply 和 archive 流程的工作流技能集合。

这些方向会优先沉淀高频、可复用、能被验证的 agent 工作方式。临时问题、迁移来源和一次性调查上下文不进入长期 README。

## 发展方向

这个仓库后续应朝四个方向演进：

1. Skill 本体更专注：子仓库只沉淀与对应 skill 行为直接相关的入口、引用资料和随 skill 分发的文件。
2. 共享工具更统一：校验、打包、发布和 CI 在主仓库集中维护，新增 skill 只接入同一套主流程。
3. 决策记录更可回放：只有影响长期维护契约、目录边界、自动化交付方式或 skill 行为边界的判断才写入决策记录。
4. 发布制品更稳定：每个 skill 都能从子仓库本体生成独立 zip，同时由主仓库提供统一的最新发布入口。

新的 skill 仓库只有在具备独立 owner、明确触发场景和可维护行为边界时才加入。只是某个现有 skill 的引用资料、示例或局部流程时，应优先放回对应子仓库。

## 协作入口

维护本仓库时，先按变更性质找到 owner：

1. Skill 行为、触发条件、读取策略和验收标准属于对应子仓库。
2. 共享脚本、CI、打包、发布和工具链说明属于主仓库。
3. 长期 agent 协作规则见 [AGENTS.md](AGENTS.md)。
4. 工具链和命令入口见 [docs/tooling.md](docs/tooling.md)。
5. 需要回放原因的长期判断见 [docs/decisions/decision-record-index.md](docs/decisions/decision-record-index.md)。

主仓库提交 submodule 指针，子仓库提交各自内容。修改子仓库后，先在子仓库提交并推送，再回到主仓库提交新的指针。
