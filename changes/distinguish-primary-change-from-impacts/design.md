# Design

本设计在现有 Scope 与 Decisions 内增加 `Intended Change`、`Resulting Impacts` H3，并由 CLI 统一检查固定结构。

## Context

- Proposal 已用 `Outcome`、`Scope`、`Success Criteria` 与 `Affected Owners` 表达结果和范围，design 与 tasks 承接方案、实施和验证。
- 现有 checker 只验证固定 H1、H2、非空内容和 tasks 语法，无法机械恢复 Scope 与 Decisions 内的目标/影响关系。
- 影响项继续属于同一 Change，不需要独立目录、metadata、stage、进度或归档状态。

## Goals / Non-Goals

目标：

- 在现有 `Scope` 与 `Decisions` 内固定 `Intended Change` 和 `Resulting Impacts`，让同一结构贯穿 proposal 与 design。
- 让 CLI 对所有受检 Change 验证固定 H3 的存在、顺序、唯一性和非空内容。
- 保持 task progress、Git 距离、授权门禁和 Change 独立生命周期的现有责任边界。

非目标：

- 不增加 parent、child、aggregate、subchange、依赖传播或父级聚合归档语义。
- 不为影响项增加独立目录、metadata、stage、tasks 文件、CLI 查询身份或完成状态。

## Decisions

### Intended Change

已确认方向：

- 一个 Change 以一句结果说明确定 Outcome，并继续只有一套 artifacts、metadata、stage、task progress 和归档结果。
- 受检 proposal 的 `Scope` 与 design 的 `Decisions` 固定使用 `Intended Change`、`Resulting Impacts` 两个 H3；stage 只决定必需 artifacts 与 H2，不改变这两个 H2 的内部结构。
- Metadata 继续只承接 Draft/Plan stage 与 Plan Git 基线；archived metadata 只作为历史文件保留，不参与结构或状态解释。
- Tasks 继续只使用 Readiness、Implementation 与 Verification；具体任务从预期调整及逐项影响处理共同派生。

### Resulting Impacts

- Markdown checker 需要在指定 H2 范围内验证 H3 的缺失、重复、顺序和非空内容。
- 测试 fixture、分发 CLI 和人类说明需要使用同一固定结构。
- 归档前由 active check 完整门禁；归档后查询继续返回 `stage: null`、`metadata: null`。

## Risks / Trade-offs

- 固定结构为两个 H2 各增加两个 H3；简单 Change 也需要在 `Resulting Impacts` 明确写“无”。
- CLI 只能证明标题和内容存在，不能证明影响确由目标触发；skill 的语义审阅仍是必要门禁。

## Open Questions

无。

## Implementation Observations

- 文档审计统一使用 `Outcome`、`Intended Change` 与 `Resulting Impacts`，并让行为入口、固定模板与验收使用相同术语。
- H3 owner 与必需序列使用显式领域类型，标题、内容校验由职责独立的纯函数完成。
- 缺失、重复、顺序错误和空内容分别使用独立原生测试节点与测试证据 case。
