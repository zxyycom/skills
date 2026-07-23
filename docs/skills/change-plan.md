# Change Plan

`change-plan` 为一个准备实施的明确 change 创建可版本化、可审阅和可交接的临时计划。它保留 OpenSpec 计划材料中有价值的职责分离，但不建立 capability、delta spec、主 spec 合并或专属归档系统。

## 为什么需要它

项目的稳定文档可以拥有当前行为和接口，长期决策可以保存跨 change 的理由，但一次 change 仍需要临时回答为什么做、做到什么程度、采用什么方案、按什么顺序改以及怎样验证。只把这些信息留在对话中，会让跨会话实施、审阅和交接重新恢复范围。

`change-plan` 使用 `proposal.md`、`design.md` 和 `tasks.md` 分别承接目标与范围、当前 change 的设计上下文，以及带 Readiness 门禁的实施和验证清单。计划建立与结构通过不等于实施许可。

## 能力边界

1. 项目 owner 文档继续拥有稳定事实、行为、接口和验证语义。
2. 项目已有长期决策 owner 时，跨 change 持续有效的理由和方向进入该 owner。
3. Change plan 只拥有本次 change 的临时目标、局部判断、开放问题、任务和验证安排。
4. 随包 CLI 只检查目录、标题、章节和任务语法，不判断内容正确性或批准状态。

实际 skill 位于 [`skills/change-plan/`](../../skills/change-plan/)。

## 发展方向

第一版只提供固定三文件结构和只读检查器。后续能力只有在真实使用反复暴露同一需要时再扩展，例如计划状态查询、项目级 change 发现或完成证据；不预先恢复完整 specification 或归档系统。
