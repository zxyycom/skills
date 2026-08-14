# Proposal

Change Plan 只接受规范 Draft 与 Plan metadata，当前仓库中的旧 active metadata 通过一次性迁移退出。

## Why

旧 `implementation`、`shelved` 与 `baseCommit: null` 的只读投影没有持续产品价值，却要求工具长期维护第二套 active metadata 类型、隐藏状态投影、特殊查询不变量和跨命令测试矩阵。建立本 Change 时，仓库只有两个 active Change 使用旧形状，且都可以在不刷新 Git 基线的情况下机械改写为规范 Plan；archived 历史本来就不解析 metadata。

## Outcome

- Active Change 的读取、检查和写入只接受规范 Draft 或具有非空 `baseCommit` 的规范 Plan。
- 旧 `implementation`、`shelved` 与 null-base Plan 按普通 invalid metadata 处理，不再投影、恢复或自动迁移。
- 已识别的两个旧 active Change 原地改写为规范 Plan，并保留各自既有 `baseCommit`。
- 行为 owner、长期决策、源码、生成 CLI、测试与测试证据只描述严格规范 metadata。

## Scope

纳入范围：

- 一次性迁移 `check-all-change-plans` 与 `establish-task-correction-and-successor-evolution` 的 metadata。
- 删除兼容 schema、reader、类型、null-base 距离分支及其查询和 lifecycle 行为。
- 让旧 metadata 在 `list`、`show`、`check`、`check-all`、`plan` 与 `archive` 中使用现有 invalid metadata 诊断和失败通道。
- 修订 governing decision，同步 change-plan 的 skill 入口、固定契约、人类介绍、生成产物、测试及测试证据。

非目标：

- 不增加迁移命令、schema version、兼容开关或弃用期。
- 不改写 archived Change 的历史 metadata，也不让 checker 开始解析它。
- 不刷新被迁移 Change 的 `baseCommit`，不替它们完成语义复核、任务或归档授权。
- 不改动或纳入与本 Change 无关的工作区内容和 Git 状态。

## Success Criteria

1. 规范 parser、active reader 与 writer 使用同一 strict schema，只接受 `{ "stage": "draft" }` 和具有非空 `baseCommit` 的 `{ "stage": "plan" }`。
2. `implementation`、`shelved`、旧 `shelf` 和 `baseCommit: null` 不再出现在 active metadata 运行时类型或读取分支；checker 对这些输入报告 `invalid-metadata`，`plan` 与 `archive` 均失败且不修改目标。
3. 两个现存旧 active Change 改写为规范 Plan 后仍保留原基线，并通过单项检查；没有其他 active metadata 依赖旧形状。
4. `list` 继续发现 metadata 无效的 active Change，但不把它投影为 Plan；`show`、`check` 与 `check-all` 通过既有诊断和退出通道报告失败。
5. `plan` 只接受结构有效的规范 Draft 或 Plan；不提供隐藏迁移路径和旧状态别名。
6. behavior owner、agent 入口、skill 版本、源码、生成 CLI、原生测试入口及其一一对应的 test-evidence case 保持一致。
7. 后继决策在实现和验证完成后标记 aligned；目标测试、生成检查、决策检查、测试证据检查和 `bun run check --full` 通过。

## Affected Owners

- `skills/change-plan/SKILL.md`、`skills/change-plan/references/change-plan-contract.md` 与 `docs/skills/change-plan.md`：严格 active metadata 契约、失败行为和维护流程。
- `docs/decisions/change-plan/`：以完整后继修订生命周期决策中的兼容方向。
- `tools/change-plan/src/`：metadata schema/reader、checker、Git distance 与生命周期输入边界。
- `tools/change-plan/tests/` 与 `docs/test-evidence/change-plan/`：旧输入拒绝、集合可发现性、写入不变性及现有规范行为的证据。
- `skills/change-plan/scripts/change-plan.mjs*`：从工具源码重新生成的分发 CLI。
- `changes/check-all-change-plans/.change-plan.json` 与 `changes/establish-task-correction-and-successor-evolution/.change-plan.json`：一次性规范迁移。
