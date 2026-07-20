# Agent Instructions

## 目标与适用范围

1. 本文件约束 agent 在本仓库内的协作方式、改动边界和交付检查。
2. 本仓库是 Codex skills 单仓库, 集中维护多个 skill 本体、共享工具链、决策记录、聚合打包发布和项目级维护说明。
3. `skills/` 是 skill 本体根目录; 每个一级目录代表一个可打包分发的 skill, 且必须包含 `SKILL.md`。
4. 根目录维护跨 skill 的共享能力, 包括仓库说明、维护约定、决策记录、工具链、自动化、CI 和聚合发布。
5. 长期文档只沉淀当前仓库内可维护、可复用、当前有效的信息; 仓库外路径、临时来源、迁移过程和一次性调查上下文不进入长期文档。
6. 改动范围以用户请求为准; 不为整理风格、统一措辞或顺手清理而重写无关文件。

## Skill 指代与概览

1. 在本仓库的对话、任务和维护说明中, 只提到 `skill`、skill 名称或某类 skill, 且未直接给出路径时, 默认指 `skills/` 下由本仓库维护的 skill。
2. 对话中直接给出路径时, 按该路径定位 skill; 不因本仓库存在同名目录而改写其来源。
3. 解析到仓库内 skill 后, 以对应的 `skills/<skill-name>/SKILL.md` 为行为入口, 并按该文件的读取策略加载必要引用。
4. 当前仓库主要维护以下能力:
   - `product-architecture-thinking`: 在需求、设计、实现、排障、重构与审查中, 从产品结果和架构责任校准局部技术判断, 再回到实现。
   - `test-evidence-review`: 评估测试固定的契约、证明价值与维护成本，登记自动化证明、人工审查风险和发现豁免，并检查测试入口角色、Git Scope 与未登记入口。
   - `prompt-optimize`: 独立组成一个分发单元, 优化 prompt、agent 指令、规则、任务、需求、模板和工作流等结构化文本。
   - `skill-maintainer`: 分析 skill 与分发单元的组成、主要类型、能力归属和依赖边界, 以单元级自包含基线和环境适配完成交付, 并随包提供单 skill 机械结构验证。
   - `git-commit-organizer`: 整理当前 Git 改动并创建范围清楚、信息可追踪的提交。
   - `openspec-explore`、`openspec-propose`、`openspec-apply-change`、`openspec-archive-change`: 四者共同组成一个分发单元, 覆盖 OpenSpec change 的探索、提案、实施和归档流程。
   - `codex-shell-permissions`: 指导 shell 失败后的下一步命令选择, 并在用户要求时维护 Codex 权限 rules。
   - `decision-records`: 恢复、审阅和维护可回放的长期决策、JSON 当前索引与历史关系。
   - `subagent-orchestration`: 编排边界清楚的子代理任务, 并控制主线程上下文和并行协作范围。
5. 仓库内 skill 的实际清单以 `skills/*/SKILL.md` 为准; 新增、重命名或移除 skill 时同步更新本节概览。

## 内容 Owner

1. `skills/<skill-name>/` 承接对应 skill 的行为、触发条件、读取策略、执行流程、引用文件、边界和验收标准。
2. `docs/skills/<skill-name>.md` 或集合说明文档承接面向人类阅读的 skill 介绍、项目起点和发展方向; 这些内容不进入 skill zip, 也不作为 agent 执行时必须读取的 skill 本体。
3. 主仓库承接跨 skill 共享的校验、打包、聚合发布、依赖入口、CI 和自动化。
4. `docs/coding-style.md` 承接实现代码的通用质量规则; `docs/tooling.md` 承接脚本、安装、校验、打包、CI 和发布细节; `README.md` 只保留项目入口说明。
5. `skills/decision-records/references/decision-record-rules.md` 是决策记录格式、当前成员、历史关系和维护事务的唯一固定契约; `docs/decisions/decision-index.json` 承接本仓库当前决策索引, 项目专属记录门槛由本文件承接。
6. `AGENTS.md` 只承接项目级 agent 协作约定; skill 专属规则、编码细则、工具链细节和单条决策原因应写入各自 owner。
7. 同一判断只在最稳定的 owner 位置完整解释; 非 owner 位置只保留摘要、触发条件或引用。

## 工作流程

1. 修改前先检查主仓库状态, 识别已有未提交改动。
2. 编辑前先判断内容 owner; 只在当前文件适合承接该信息时修改当前文件。
3. 修改 `scripts/` 下的实现代码时, 先读取 `docs/coding-style.md`, 再按任务读取相关行为 owner 和 `docs/tooling.md`。
4. 修改 skill 本体时进入 `skills/<skill-name>/`; 只修改项目级文档、脚本、CI 或配置时, 不顺手改 skill 本体。
5. 同时修改 skill 本体和共享工具链时, 先确认 owner 分工, 再让脚本、文档和验证入口保持一致。
6. 新增 skill 时, 在 `skills/<skill-name>/` 放置本体并包含 `SKILL.md`, 按需在 `docs/skills/` 增加人类介绍, 再确认聚合打包和自更新脚本覆盖该 skill。
7. 新增或调整共享脚本时优先做成跨 skill 通用能力; skill 专属规则应留在对应 skill 目录。
8. 打包产物、依赖目录和 workflow 运行产物不作为长期源文件提交。

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

1. 修改主仓库维护文档、脚本、CI、配置或 `skills/` 目录结构后, 优先运行 `bun run check`。
2. 只改某个 skill 本体时, 根据该 skill 内容选择最小验证; 涉及打包输入、hash 或 updater 时同步运行主仓库相关检查。
3. 提交或汇报前说明实际运行过的验证; 未运行验证时直接说明原因。
