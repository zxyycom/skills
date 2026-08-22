# Change Plan

`change-plan` 为明确 Change 保存可版本化、可审阅和可交接的临时实施上下文。Active Change
只使用 `draft` 与 `plan` 两种 stage；完成后的 Change 进入 `archive/` 并以 archived 目录
status 保存历史。

## 为什么需要它

项目文档拥有稳定事实和行为，长期决策保存跨 Change 的方向与理由，但一次 Change 仍需要在
对话之外持续回答为什么做、采用什么设计、按什么顺序实施以及怎样验证。`change-plan` 用
proposal、design 和 tasks 把这些内容组织成一个可恢复的实施单元。

固定 artifact 结构在 proposal 的 `Scope` 与 design 的 `Decisions` 中使用
`Intended Change` 记录预期调整，使用 `Resulting Impacts` 记录由该调整产生且实现 `Outcome`
必须处理的影响。两部分继续共享同一套 tasks、stage、进度和归档结果。

Draft 保存最小 proposal 与初始 design；Plan 保存完整 proposal、design 与 tasks。
Readiness、Implementation 和 Verification 都在 Plan 内推进，其 checkbox 表达实际任务进度，
不会派生新的生命周期状态。

## 主要能力

1. `list`、`show`、`check` 和 `check-all` 分别承担发现、展开、单项门禁和集合门禁。
2. `plan` 确认 Draft，或在重新审阅现有 Plan 后刷新 Git 基线；`archive` 归档已经完成的 Plan。
3. Plan 查询直接提供基线后的 first-parent 提交数和 Change 目录外累计变化行数，帮助操作者决定需要怎样复核当前计划；可用距离只提供上下文，不驱动生命周期。
4. Active metadata 只接受规范 Draft 或具有非空 Git 基线的规范 Plan；无效 metadata 所在目录仍可发现，但不能投影为合法 stage 或由写入命令自动迁移。
5. Archived status 和 stage 只由目录决定；历史 metadata 不参与 checker 或查询解释。
6. 随包 MJS 同时提供 CLI 和随当前实现变化的直接 import 表面；需要稳定交互时使用固定 CLI 契约与 JSON 结果。

## 能力边界

项目 owner 继续拥有稳定事实、接口和验证语义，长期判断进入项目已有决策 owner。Change
artifacts、机械检查、语义审阅与当前任务授权提供不同证据：`plan` 记录基线，`archive` 移动目录，
两者都不代替实施或归档授权。不再实施的 active Change 通过项目普通文件删除和版本控制流程退出。

实际 skill 位于 [`skills/change-plan/`](../../skills/change-plan/)。Agent 行为从
[`SKILL.md`](../../skills/change-plan/SKILL.md) 进入；字段、严格 metadata 边界、六个命令、输出和机械门禁以
[固定契约](../../skills/change-plan/references/change-plan-contract.md) 为准。
