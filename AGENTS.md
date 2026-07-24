# Agent Instructions

## 目标与适用范围

1. 本文件约束 agent 在本仓库内的协作方式、改动边界和交付检查。
2. 本仓库是 Codex skills 单仓库, 集中维护多个 skill 本体、共享工具链、决策记录、聚合打包发布和项目级维护说明。
3. 评估仓库目标、skill 选择与启用边界或分发边界时, 先读取 `docs/repository-model.md`。
4. `skills/` 是 skill 本体根目录; 每个一级目录代表一个可打包分发的 skill, 且必须包含 `SKILL.md`。
5. 根目录维护跨 skill 的共享能力, 包括仓库说明、维护约定、决策记录、工具链、自动化、CI 和聚合发布。
6. 长期文档只沉淀当前仓库内可维护、可复用、当前有效的信息; 仓库外路径、临时来源、迁移过程和一次性调查上下文不进入长期文档。
7. 改动范围以用户请求为准; 不为整理风格、统一措辞或顺手清理而重写无关文件。

## Skill 指代与概览

1. 在本仓库的对话、任务和维护说明中, 只提到 `skill`、skill 名称或某类 skill, 且未直接给出路径时, 默认指 `skills/` 下由本仓库维护的 skill。
2. 对话中直接给出路径时, 按该路径定位 skill; 不因本仓库存在同名目录而改写其来源。
3. 解析到仓库内 skill 后, 以对应的 `skills/<skill-name>/SKILL.md` 为行为入口, 并按该文件的读取策略加载必要引用。
4. 以下概览只用于让 agent 了解本仓库维护的 skill 及其大致核心内容; 需要进一步理解时再读取对应 `SKILL.md` 和人类介绍:
   - `product-architecture-judgment`: 从产品价值和架构责任判断工程事项是否该做、做到什么程度以及由谁实现。
   - `common-denominator-design`: 识别多个现实场景可共同依赖的契约边界, 并决定公约数的数量与层次。
   - `dependency-boundary-design`: 判断分散的依赖调用是否需要收口, 并形成明确的责任边界。
   - `minimal-implementation`: 在目标和责任明确后, 比较正确候选的整体维护面并选择更小方案。
   - `skill-design-discovery`: 在创建或重构 skill 前, 从现实材料恢复流程、判断、约束、权限和验证义务。
   - `investigation-report`: 以可独立复核和比较的报告保存调查背景、依据、结果与边界。
   - `test-evidence-review`: 评估测试的证明价值与维护成本, 并管理自动化证据、人工审查风险和发现豁免。
   - `ai-ready-docs`: 优化说明、规则、任务和工作流等文档, 使 AI 能准确理解和可靠使用。
   - `skill-maintainer`: 维护 skill 的能力归属、组成和交付边界。
   - `git-commit-organizer`: 整理当前 Git 改动并创建范围清楚、信息可追踪的提交。
   - `change-plan`: 维护明确 change 的 proposal、design、tasks 和结构检查。
   - `openspec-explore`、`openspec-propose`、`openspec-apply-change`、`openspec-archive-change`: 分别维护 OpenSpec change 的探索、提案、实施和归档阶段。
   - `codex-shell-permissions`: 指导 shell 失败后的下一步命令选择, 并在用户要求时维护 Codex 权限 rules。
   - `decision-records`: 以可回放记录与索引维护长期决策及其演进关系。
   - `subagent-orchestration`: 维护复杂任务的子代理拆分、上下文控制、写入所有权和结果审计。
5. 仓库内 skill 的实际清单以 `skills/*/SKILL.md` 为准; 新增、重命名或移除 skill 时同步更新本节概览。

## 工作流程

1. 修改前先检查主仓库状态; 保留无关改动, 目标路径已有改动时先检查 diff, 无法确认能够安全延续时再询问用户。
2. 编辑前先通过 `docs/navigation.md` 判断内容 owner; 只在当前文件适合承接该信息时修改当前文件。
3. 理解实现代码结构、符号调用关系或改动影响时, 优先使用当前可用的 CodeGraph 工具; 结果不精确、索引陈旧或工具不可用时, 再用带路径过滤的 `rg` / `rg --files` 补充。CodeGraph 的环境、索引与 MCP 边界见 `docs/tooling.md#环境自举`。
4. 修改 `scripts/` 或 `tools/` 下的实现代码时, 先读取 `docs/coding-style.md`, 再按任务读取相关行为 owner 和 `docs/tooling.md`。
5. 修改 skill 本体时进入 `skills/<skill-name>/`; 只修改项目级文档、脚本、CI 或配置时, 不顺手改 skill 本体。
6. 同时修改 skill 本体和可分发工具源码时, 先确认 `tools/` 源码、`scripts/` 构建适配和 `skills/` 生成产物的 owner 分工, 再让文档和验证入口保持一致。
7. 新增 skill 时, 在 `skills/<skill-name>/` 放置本体并包含 `SKILL.md`, 按需在 `docs/skills/` 增加人类介绍, 再确认聚合打包和自更新脚本覆盖该 skill。
8. 新增或调整主仓库自动化时放在 `scripts/`; 新增需要随 skill 分发的工具实现时放在 `tools/`, 真实跨工具运行时能力再进入 `tools/shared/` 或独立协议 owner; skill 专属规则仍留在对应 skill 目录。
9. 打包产物、依赖目录和 workflow 运行产物不作为长期源文件提交。

## 写作约定

1. 正文主要使用中文; 除用户要求、目标文件已有语言要求或代码/API 名称外, 新增维护文本保持中文。
2. 规则写成当前推荐做法、判断条件或验收标准; 不把旧方案、迁移痕迹或一次性错误写成长期提醒。
3. 新增长期规则前先判断是否引入新的 owner 边界、执行约束或验收标准; 只是已有规则的重复例子时, 合并到 owner 位置或删除。
4. 跨文件引用优先指向稳定 owner 文档; 不在多个位置重复解释同一规则。

## 决策记录

1. 决策记录只记录后续维护需要回放原因的判断, 不作为变更日志。
2. Skill 行为、触发条件、读取策略、引用 owner、规则边界或验收标准发生变化时, 按决策记录规则判断是否达到记录门槛。
3. 项目级决策只在改变长期维护契约、目录边界、自动化交付方式或跨文件 owner 时记录。
4. 单个 skill 专属决策要写明适用 skill 和当前 `skills/<skill-name>/` 路径, 避免写成全部 skill 的通用规则。
5. 普通文字修正、格式调整、链接修复和按既有规则执行的一次性细节不记录。

## 验证与交付

1. 修改主仓库维护文档、`scripts/`、`tools/`、CI、配置或 `skills/` 目录结构后, 优先运行 `bun run check`。
2. 只改某个 skill 本体时, 根据该 skill 内容选择最小验证; 涉及打包输入、hash 或 updater 时同步运行主仓库相关检查。
3. 提交或汇报前说明实际运行过的验证; 未运行验证时直接说明原因。
