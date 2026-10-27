# 仓库导航

本文帮助人类和 agent 按任务找到本仓库的先读内容，并确定新增或修改内容应由哪个 owner 承接。本文只维护任务路由、稳定内容 owner 和仓库位置；具体行为与领域规则由对应 owner 完整解释。

目标已经指向明确文件时可以直接读取；否则先从“任务路由”定位主要 owner，再按当前任务实际涉及的条件补读。

## 任务路由

| 任务 | 先读 | 按需补读 |
| --- | --- | --- |
| 了解项目或选择 skill | [README](../README.md)、[仓库模型](repository-model.md) | `docs/skills/<skill-name>.md` 中对应的人类介绍 |
| 使用或审阅某个 skill | `skills/<skill-name>/SKILL.md` | 该入口按读取策略指向的 `references/`、`scripts/` 或其他材料；按需读取对应 `docs/skills/<skill-name>.md` |
| 排查或解决 Bug | [复杂 Bug 调查与报告](complex-bug-investigation.md) | 目标代码、测试和领域 owner；需要形成报告时，读取 [Investigation Report](../skills/investigation-report/SKILL.md) 及其固定契约 |
| 维护或恢复非线性任务图 | [Task Graph](../skills/task-graph/SKILL.md)，按其流程使用工具查询 | 需要检查权威数据位置时见下方 owner 表；需要持久 change、长期知识或代理编排时按该 skill 的交接条件读取对应 owner |
| 仅设计测试方案或测试验收方法 | [Test Design](../skills/test-design/SKILL.md) | [项目测试边界](tooling.md#工具-cli-与-git-fixture-测试边界)、目标行为 owner 和相关实现；方案交付不自动创建测试、Case 或索引。涉及测试实现审查或改动时，另按 [Test Evidence Review](../skills/test-evidence-review/SKILL.md) 核对证据 |
| 新增、修改、删除或审查测试实现 | [Test Design](../skills/test-design/SKILL.md)、[Test Evidence Review](../skills/test-evidence-review/SKILL.md) | [工具 CLI 与 Git fixture 测试边界](tooling.md#工具-cli-与-git-fixture-测试边界)、[测试账本覆盖](tooling.md#测试证据账本)、目标测试及被测契约；核对后按需写入 Case。仅运行既有测试或仅修改被测对象不触发此证据维护流程 |
| 查询、整理或修复测试证据 Case | [Test Evidence Review](../skills/test-evidence-review/SKILL.md) | 写入 Case 时读取该 skill 的目录契约；需要改进测试实现时再进入 Test Design |
| 创建、显著扩展或大幅重构 skill | [Skill Maintainer](../skills/skill-maintainer/SKILL.md)、已有目标 skill 的 `SKILL.md` | 真实流程、关键判断、约束或验收仍隐含或冲突时读 [Skill Design Discovery](../skills/skill-design-discovery/SKILL.md)；涉及通用分发边界时读 [仓库模型](repository-model.md) |
| 调整仓库定位、skill 选择与启用边界或通用分发边界 | [仓库模型](repository-model.md) | 涉及具体打包、发布或 updater 机制时读 [项目工具链](tooling.md)；只影响特定 skill 时读其行为 owner |
| 维护项目文档或优化其 AI 可读性 | 目标文档及本文的内容 owner | 需要改善 AI 对文档的理解或使用时读 [AI-Ready Docs](../skills/ai-ready-docs/SKILL.md)；纯视觉润色不触发 |
| 修改项目级 agent 协作约定 | [AGENTS](../AGENTS.md) | 改变任务路由或内容 owner 时读本文；需要让文档更适合 AI 阅读和使用时读 [AI-Ready Docs](../skills/ai-ready-docs/SKILL.md) |
| 修改工具源码、项目脚本、校验、打包、CI 或 updater | [项目工具链的源码与依赖边界](tooling.md#源码与依赖边界)、[编码规范](coding-style.md) | 按工具链开头的读取策略选择相关章节；修改 `tools/<tool-name>/` 时补读该目录的局部契约；工具服务特定 skill 时再读其行为 owner；改变通用分发边界时读 [仓库模型](repository-model.md) |
| 维护视频源码、Windows 开发或验收视频 zip | [视频工具维护](../tools/video-understanding/README.md) | [CI 与发布](tooling.md#ci-与发布)；实际媒体、网站与 OCR 支持范围由 [Video Understanding](../skills/video-understanding/SKILL.md) 的参考材料承接 |
| 修改调查或决策工具的 CLI、SDK 或测试实现 | [调查工具维护](../tools/investigation-report/README.md)、[决策工具维护](../tools/decision-records/README.md)中对应入口 | 所改行为的领域规则与 CLI 操作契约；普通报告或决策维护从各自 skill 进入 |
| 新增、修改或移除 Gate Check | [Gate Check 编写与接入](gate-check-authoring.md) | [项目工具链的权威 Vibe 门禁](tooling.md#权威-vibe-门禁)、[编码规范](coding-style.md)；涉及测试实现或 Case 时读 [Test Evidence Review](../skills/test-evidence-review/SKILL.md) |
| 成批审阅或持续纠正记录 | [记录维护入口](record-maintenance-workflow.md) | 按对象选择[决策流程](record-maintenance/decisions.md)或[调查流程](record-maintenance/investigations.md)及其领域 skill；明确使用 JEV 时读取 [Lightweight Judgment](../skills/lightweight-judgment/SKILL.md) |
| 恢复、审阅或维护长期决策 | [Decision Records](../skills/decision-records/SKILL.md)，按需使用 show、list、search 或 trace 查询 | 相关决策 Markdown、领域规则和所选 CLI 操作或恢复章节；索引位置见下方 owner 表 |
| 创建、更新或审阅调查报告 | [Investigation Report](../skills/investigation-report/SKILL.md)，按需使用 show、list、search 或 trace 查询 | 相关调查报告、领域规则和所选 CLI 操作或恢复章节；索引位置见下方 owner 表 |
| 整理并创建 Git 提交 | [Git Commit Organizer](../skills/git-commit-organizer/SKILL.md) | 当前 Git 状态、diff 和目标改动的验证结果 |

同一任务跨越多个 owner 时，只补读实际受影响的文档；目录相邻或主题相近本身不扩大读取范围。

## 未来事项的载体选择

先按事项当前需要保存的唯一结果选择最小载体；主题相近、将来可能实施或希望持续关注，都不足以同时建立多种载体。

| 当前需要保存的结果 | 最小载体 | 载体退出条件 |
| --- | --- | --- |
| 只在当前任务中形成的想法、比较或临时步骤 | 当前任务上下文 | 当前任务结束后不另行持久化；当前请求或生效项目规则要求保留独立调查时，按 [Investigation Report](../skills/investigation-report/SKILL.md) 建立报告 |
| 跨 change 持续影响后续选择的方向、理由和长期约束 | Decision record | 决策按自身生命周期修订、拆分或归档；`active + unaligned` 只表示未来方向，不自动产生实施 task 或等待状态 |
| 已经明确、需要跨文件或 owner 持久规划和交接的实施 change | Change plan | 完成后删除；不再实施的 draft 不作为未来资料柜。需要保留的独立调查材料按[报告触发与边界](../skills/investigation-report/SKILL.md#目标与适用范围)另行归位 |
| 已选择的当前工作所需的非线性协调，或具有明确外部条件的等待 | Task Graph task | 目标达成后完成；目标放弃或不再具有当前协调价值时取消；`waiting` 必须写明能够被观察的外部条件 |
| 单个 Change 内的 readiness、implementation 和 verification 分解 | 该 Change 的 `tasks.md` | complete 后随 Change 目录删除，历史由 Git 恢复；不复制为 Task Graph 子任务，除非其中一项已经成为需要独立租约、关系或跨 Change 协调的当前工作 |

确需组合载体时使用单向引用，不复制状态、任务分解、理由或长期结论：Change 和 Task 可以引用适用的 Decision，Task Graph task 可以引用它正在协调的 Change，Change 的 `tasks.md` 继续拥有 Change 内进度。下游载体退出时只回写自己拥有的结果；稳定事实、长期方向和历史调查分别归位到对应 owner。

## 内容 Owner

| 内容 | Owner | 承接范围 |
| --- | --- | --- |
| 项目首页 | `README.md` | 项目起点、当前方向和面向人类的 skill 入口 |
| Agent 协作约定 | `AGENTS.md` | 仓库级适用范围、skill 概览、工作流程、写作约定、决策门槛和交付要求 |
| 仓库导航 | `docs/navigation.md` | 任务对应的先读内容、稳定内容 owner 和仓库位置 |
| 仓库模型 | `docs/repository-model.md` | 仓库目标、skill 选择与启用、集中维护和轻量分发边界、受管记录身份与位置、验证职责 |
| 项目工具链 | `docs/tooling.md` | 环境、稳定命令、源码与生成边界、校验、打包、Git hook、CI 和 release 主线 |
| 编码规范 | `docs/coding-style.md` | `scripts/` 与 `tools/` 实现代码的归属、边界、类型、组织和风险验证规则 |
| Gate Check 编写与接入 | `docs/gate-check-authoring.md` | 新增、修改或移除 Gate Check 时的类型选择、建模要求、接入步骤、npm 随包文档入口和交付检查；Gate 运行时事实仍由 `docs/tooling.md` 承接 |
| 复杂 Bug 调查与报告规则 | `docs/complex-bug-investigation.md` | 复杂 Bug 的识别、调查主线、修复验证、报告触发与证据要求和其他 owner 交接 |
| 记录维护工作流 | `docs/record-maintenance-workflow.md` 及 `docs/record-maintenance/` | 决策与调查分别拥有主代理审查清单、处置和验收；公共层承接执行、局部 JEV 辅助与对账，领域语义及事务由各自 skill 承接 |
| Skill 人类介绍 | `docs/skills/<skill-name>.md` | 面向人类的定位、项目起点和发展方向；不作为 agent 执行入口，也不进入 skill zip |
| Skill 本体 | `skills/<skill-name>/SKILL.md` 及其相邻材料 | 单个 skill 的触发、行为、读取策略、执行流程、边界、验收和分发内容 |
| 任务图索引 | `docs/task-graph/task-graph-index.json` | 当前工作中 task、真实父子、显式依赖与排斥、执行租约的唯一权威事实；只由 task-graph 工具事务化修改，复杂有效状态由查询投影 |
| 测试证据账本 | `docs/test-evidence/cases/*.md`、`docs/test-evidence/test-evidence-index.json` | 每个 Markdown 承接一个权威 Case，索引 JSON 是 Case-only 查询投影。项目实体快照与覆盖策略由项目工具链承接，格式和维护事务由 `skills/test-evidence-review/` 承接 |
| 共同记录操作 | `tools/record-operations/` | Decision Records 与 Investigation Report 的共同操作编排、阶段证明交接和失败边界；领域规则与适配仍归各域，stage 协调仍归 Index Runtime；入口见该目录 README |
| 可分发工具源码 | `tools/<tool-name>/` | 随 skill 分发的源码、声明、测试、fixture 和局部组件契约；`tools/shared/` 承接跨工具运行时不变量，`tools/skill-package/` 承接发布端与 updater 共用的分发协议 |
| 主仓库自动化与共享交付 | 主仓库根目录、`scripts/` 和 CI 配置 | 命令编排、生成适配、共享校验、打包、聚合发布、依赖入口、Git 和 CI 自动化；不承接随 skill 分发工具的运行时源码 |
| 调查报告 | `docs/investigations/<investigation-id>.md`、`docs/investigations/investigation-index.json` | Markdown 承接形成时认识与依据，JSON 是派生索引。[Investigation Report](../skills/investigation-report/SKILL.md) 是行为入口，按任务路由读取报告契约、CLI 操作与 Schema |
| 长期决策 | `docs/decisions/*.md`、`docs/decisions/archive/*.md`、`docs/decisions/decision-index.json` | Markdown 承接完整判断、生命周期、对齐状态与演进，JSON 是派生索引。[Decision Records](../skills/decision-records/SKILL.md) 是行为入口，按任务路由读取领域规则、CLI 操作与 Schema |

## 维护规则

1. 新增、移动或移除稳定内容 owner、内容类型、仓库位置或任务路由时更新本文；只有项目级协作约束同时变化时才同步 `AGENTS.md`。
2. 新增、重命名或移除单个 skill 时，按 `AGENTS.md` 更新 skill 概览，并按需更新 `README.md` 或 `docs/skills/` 中的人类入口；内容类型与路径模式未变时，本文不逐项登记 skill。
3. 本文不列出单条决策、单份调查报告、脚本实现文件或 skill 内全部引用，避免把可发现的明细复制成第二份索引。
4. 同一判断只在最稳定的 owner 完整解释，非 owner 位置只保留摘要、触发条件或链接；项目内文档冲突时以 owner 内容为准，无法确定 owner 时先报告冲突。

## 交付验证

验证范围以 [AGENTS](../AGENTS.md) 的“验证与交付”为准，命令用途和完整检查入口由 [项目工具链](tooling.md) 承接。修改本文或入口链接后，至少确认链接有效、任务路由与内容 owner 一致，且没有复制对应 owner 的领域规则。
