# 文档导航

阅读或修改本仓库内容前，先按任务定位主要 owner；先加载“先读”，再按当前任务实际涉及的条件补读第三列。本文只维护读取路由和稳定文档位置，具体规则进入对应 owner。

## 按任务阅读

| 任务 | 先读 | 需要时再读 |
| --- | --- | --- |
| 了解项目或选择 skill | [README](../README.md)、[仓库模型](repository-model.md) | `docs/skills/<skill-name>.md` 中对应的人类介绍 |
| 使用或审阅某个 skill | `skills/<skill-name>/SKILL.md` | 该入口按读取策略指向的 `references/`、`scripts/` 或其他材料；对应 `docs/skills/<skill-name>.md` |
| 创建、显著扩展或大幅重构 skill | [Skill Maintainer](../skills/skill-maintainer/SKILL.md)、已有目标 skill 的 `SKILL.md` | 真实流程、关键判断、约束或验收仍隐含或冲突时读 [Skill Design Discovery](../skills/skill-design-discovery/SKILL.md)；涉及通用分发边界时读 [仓库模型](repository-model.md) |
| 调整仓库定位、skill 选择方式或通用分发边界 | [仓库模型](repository-model.md) | 涉及具体打包、发布或 updater 机制时读 [项目工具链](tooling.md)；只影响特定 skill 时读其行为 owner |
| 修改项目级 agent 协作约定 | [AGENTS](../AGENTS.md) | 改变文档路由或 owner 时读本文；需要结构化改写时读 [Prompt Optimize](../skills/prompt-optimize/SKILL.md) |
| 修改共享脚本、校验、打包、CI 或 updater | [项目工具链](tooling.md) | 修改 `scripts/` 实现代码时读 [编码规范](coding-style.md)；按需补读对应 skill 的行为 owner 或 [仓库模型](repository-model.md) |
| 恢复、审阅或维护长期决策 | [决策索引](decisions/decision-index.json)、[Decision Records](../skills/decision-records/SKILL.md) | 相关决策 Markdown；写入或结构审阅前按 skill 读取固定契约 |
| 整理并创建 Git 提交 | [Git Commit Organizer](../skills/git-commit-organizer/SKILL.md) | 当前 Git 状态、diff 和目标改动的验证结果 |

同一任务跨越多个 owner 时，只补读实际受影响的文档；目录相邻或主题相近本身不扩大读取范围。

## 文档分层

| 类型 | 位置 | 承接内容 |
| --- | --- | --- |
| 项目首页 | `README.md` | 项目起点、当前方向和面向人类的 skill 入口 |
| Agent 协作约定 | `AGENTS.md` | 仓库内改动边界、工作流程、owner 规则和交付要求 |
| 文档导航 | `docs/navigation.md` | 任务到 owner 的读取路径，以及稳定文档类型的位置 |
| 仓库模型 | `docs/repository-model.md` | 仓库目标、使用者假设、skill 选择方式、集中维护和轻量分发边界 |
| 项目工具链 | `docs/tooling.md` | 脚本入口、依赖、校验、打包、发布、CI 和 updater 机制 |
| 编码规范 | `docs/coding-style.md` | `scripts/` 实现代码的归属、边界、类型、组织和风险验证规则 |
| Skill 人类介绍 | `docs/skills/<skill-name>.md` | 面向人类的定位、项目起点和发展方向；不作为 agent 执行入口，也不进入 skill zip |
| Skill 本体 | `skills/<skill-name>/SKILL.md` 及其相邻材料 | 单个 skill 的触发、行为、读取策略、执行流程、边界、验收和分发内容 |
| 长期决策 | `docs/decisions/decision-index.json`、`docs/decisions/<topic-id>/*.md` | 决策生命周期与检索投影，以及需要长期回放的目的、背景、采用方向和关系 |

## 维护规则

1. 新增、移动或移除稳定文档类型或任务路由时更新本文；owner 边界同时变化时再同步 `AGENTS.md` 的内容 Owner。
2. 新增、重命名或移除单个 skill 时，按 `AGENTS.md` 更新 skill 概览和对应入口；文档类型与路径模式未变时，本文不逐项登记 skill。
3. 本文不列出单条决策、临时调查材料、脚本实现文件或 skill 内全部引用，避免把可发现的明细复制成第二份索引。
4. 非 owner 位置只保留摘要和链接；规则归属不清时，先确定最稳定的 owner，再更新路由。

## 交付验证

验证范围以 [AGENTS](../AGENTS.md) 的“验证与交付”为准，命令用途和完整检查入口由 [项目工具链](tooling.md) 承接。修改本文或入口链接后，至少确认链接有效、任务路由存在明确 owner，且没有在本文重复定义 owner 规则。
