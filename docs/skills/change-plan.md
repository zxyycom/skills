# Change Plan

`change-plan` 为一个明确 change 创建可版本化、可审阅和可交接的临时计划，并提供发现、展开、检查与目录归档组成的基础生命周期。它保留 OpenSpec 计划材料中有价值的职责分离，但不建立 capability、delta spec、主 spec 合并或派生索引。

## 为什么需要它

项目的稳定文档可以拥有当前行为和接口，长期决策可以保存跨 change 的理由，但一次 change 仍需要临时回答为什么做、做到什么程度、采用什么方案、按什么顺序改以及怎样验证。只把这些信息留在对话中，会让跨会话实施、审阅和交接重新恢复范围。

`change-plan` 使用 `proposal.md`、`design.md` 和 `tasks.md` 分别承接目标与范围、当前 change 的设计上下文，以及带 Readiness 门禁的实施和验证清单。计划建立与结构通过不等于实施许可。

## 能力边界

1. 项目 owner 文档继续拥有稳定事实、行为、接口和验证语义。
2. 项目已有长期决策 owner 时，跨 change 持续有效的理由和方向进入该 owner。
3. Change plan 只拥有本次 change 的临时目标、局部判断、开放问题、任务和验证安排。
4. 随包 CLI 提供 `list`、`show`、`check` 和 `archive`；它只处理直接目录发现、artifact 读取、结构与任务门禁和无覆盖移动，不判断内容正确性、验证充分性或批准状态。
5. Change 根目录的直接子目录表示 active change，`archive/` 的直接子目录表示历史；归档不产生额外 metadata 或 spec 同步。

实际 skill 位于 [`skills/change-plan/`](../../skills/change-plan/)。

## 发展方向

当前基础命令面只承接 `list`、`show`、`check` 和 `archive`。后续能力仍以反复出现的现实需要为前提；不预先增加 create、restore、delete、跨根搜索、索引或完整 specification 生命周期。
