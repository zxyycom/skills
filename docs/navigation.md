# 仓库导航

本文帮助人类和 agent 按任务找到本仓库的先读内容，并确定新增或修改内容应由哪个 owner 承接。本文只维护任务路由、稳定内容 owner 和仓库位置；具体行为与领域规则由对应 owner 完整解释。

目标已经指向明确文件时可以直接读取；否则先从“任务路由”定位主要 owner，再按当前任务实际涉及的条件补读。

## 任务路由

| 任务 | 先读 | 按需补读 |
| --- | --- | --- |
| 了解项目或选择 skill | [README](../README.md)、[仓库模型](repository-model.md) | `docs/skills/<skill-name>.md` 中对应的人类介绍 |
| 使用或审阅某个 skill | `skills/<skill-name>/SKILL.md` | 该入口按读取策略指向的 `references/`、`scripts/` 或其他材料；按需读取对应 `docs/skills/<skill-name>.md` |
| 创建、显著扩展或大幅重构 skill | [Skill Maintainer](../skills/skill-maintainer/SKILL.md)、已有目标 skill 的 `SKILL.md` | 真实流程、关键判断、约束或验收仍隐含或冲突时读 [Skill Design Discovery](../skills/skill-design-discovery/SKILL.md)；涉及通用分发边界时读 [仓库模型](repository-model.md) |
| 调整仓库定位、skill 选择与启用边界或通用分发边界 | [仓库模型](repository-model.md) | 涉及具体打包、发布或 updater 机制时读 [项目工具链](tooling.md)；只影响特定 skill 时读其行为 owner |
| 修改项目级 agent 协作约定 | [AGENTS](../AGENTS.md) | 改变任务路由或内容 owner 时读本文；需要让文档更适合 AI 阅读和使用时读 [AI-Ready Docs](../skills/ai-ready-docs/SKILL.md) |
| 修改工具源码、项目脚本、校验、打包、CI 或 updater | [项目工具链](tooling.md)、[编码规范](coding-style.md) | 修改 `tools/<tool-name>/` 时补读该目录的局部契约；工具服务特定 skill 时再读其行为 owner；改变通用分发边界时读 [仓库模型](repository-model.md) |
| 恢复、审阅或维护长期决策 | [决策索引](decisions/decision-index.json)、[Decision Records](../skills/decision-records/SKILL.md) | 相关决策 Markdown；写入或结构审阅前按 skill 读取固定契约 |
| 创建、更新或审阅调查报告 | [调查索引](investigations/investigation-index.json)、[Investigation Report](../skills/investigation-report/SKILL.md) | 相关调查报告；创建、更新、拆分或结构审阅前按 skill 读取固定契约 |
| 整理并创建 Git 提交 | [Git Commit Organizer](../skills/git-commit-organizer/SKILL.md) | 当前 Git 状态、diff 和目标改动的验证结果 |

同一任务跨越多个 owner 时，只补读实际受影响的文档；目录相邻或主题相近本身不扩大读取范围。

## 内容 Owner

| 内容 | Owner | 承接范围 |
| --- | --- | --- |
| 项目首页 | `README.md` | 项目起点、当前方向和面向人类的 skill 入口 |
| Agent 协作约定 | `AGENTS.md` | 仓库级适用范围、skill 概览、工作流程、写作约定、决策门槛和交付要求 |
| 仓库导航 | `docs/navigation.md` | 任务对应的先读内容、稳定内容 owner 和仓库位置 |
| 仓库模型 | `docs/repository-model.md` | 仓库目标、使用者假设、skill 选择与启用边界、集中维护和轻量分发边界 |
| 项目工具链 | `docs/tooling.md` | 环境、稳定命令、源码与生成边界、校验、打包、Git hook、CI 和 release 主线 |
| 编码规范 | `docs/coding-style.md` | `scripts/` 与 `tools/` 实现代码的归属、边界、类型、组织和风险验证规则 |
| Skill 人类介绍 | `docs/skills/<skill-name>.md` | 面向人类的定位、项目起点和发展方向；不作为 agent 执行入口，也不进入 skill zip |
| Skill 本体 | `skills/<skill-name>/SKILL.md` 及其相邻材料 | 单个 skill 的触发、行为、读取策略、执行流程、边界、验收和分发内容 |
| 可分发工具源码 | `tools/<tool-name>/` | 随 skill 分发的源码、声明、测试、fixture 和局部组件契约；`tools/shared/` 承接跨工具运行时不变量，`tools/skill-package/` 承接发布端与 updater 共用的分发协议 |
| 主仓库自动化与共享交付 | 主仓库根目录、`scripts/` 和 CI 配置 | 命令编排、生成适配、共享校验、打包、聚合发布、依赖入口、Git 和 CI 自动化；不承接随 skill 分发工具的运行时源码 |
| 调查报告 | `docs/investigations/<category-id>/<semantic-slug>.md`、`docs/investigations/investigation-index.json` | 主题 Markdown 承接可独立复核的报告；`skills/investigation-report/references/investigation-report-contract.md` 是格式与维护事务的固定契约，JSON 是派生索引 |
| 长期决策 | `docs/decisions/<topic-id>/*.md`、`docs/decisions/decision-index.json` | 决策 Markdown 承接生命周期、对齐状态和完整语义；`skills/decision-records/references/decision-record-rules.md` 是固定契约，JSON 是全生命周期查询投影 |

## 维护规则

1. 新增、移动或移除稳定内容 owner、内容类型、仓库位置或任务路由时更新本文；只有项目级协作约束同时变化时才同步 `AGENTS.md`。
2. 新增、重命名或移除单个 skill 时，按 `AGENTS.md` 更新 skill 概览，并按需更新 `README.md` 或 `docs/skills/` 中的人类入口；内容类型与路径模式未变时，本文不逐项登记 skill。
3. 本文不列出单条决策、单份调查报告、脚本实现文件或 skill 内全部引用，避免把可发现的明细复制成第二份索引。
4. 同一判断只在最稳定的 owner 完整解释，非 owner 位置只保留摘要、触发条件或链接；项目内文档冲突时以 owner 内容为准，无法确定 owner 时先报告冲突。

## 交付验证

验证范围以 [AGENTS](../AGENTS.md) 的“验证与交付”为准，命令用途和完整检查入口由 [项目工具链](tooling.md) 承接。修改本文或入口链接后，至少确认链接有效、任务路由与内容 owner 一致，且没有复制对应 owner 的领域规则。
