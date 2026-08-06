# Proposal

本 change 计划创建 `task-graph` skill 及其事务化状态工具，以显式任务图替代 agent 对短期任务关系的临场记忆；本文只保存后续实施计划。

## Why

当前线性计划只能表达有限顺序，无法稳定维护大量候选任务、父子结构、前置依赖和并发排斥。`subagent-orchestration` 只在任务已经被拆分并决定委派后管理代理切面，`change-plan` 则面向需要持久审阅和交接的明确 change；两者都不拥有当前工作中短命但高价值的任务状态。继续依赖 agent 在对话中询问、记录和重新推演，会在上下文压缩、任务追加或并发执行后丢失调度事实并引入写入冲突。

## Outcome

仓库新增可独立选择和分发的 `task-graph` skill，以及随其分发的专用 CLI。该能力通过长期存在的权威 JSON task index 保存短期任务条目，显式维护内容、控制与执行状态、父子层级、完成依赖、并发排斥、执行租约和受控清理，并为 agent 提供确定性的查询、领取和生命周期操作。

## Scope

纳入范围：

- 定义 `task-graph` 的触发、行为、与 `change-plan`、`subagent-orchestration` 的交接边界及完成标准。
- 实现权威 JSON task index 的 schema、校验、确定性序列化、作用域、revision 和受控清理。
- 实现任务创建、读取、查询、关系维护、控制状态、事务领取、完成、失败、释放、暂停、取消、追踪、检查和清理的工具入口。
- 实现父子森林、依赖 DAG、对称排斥、状态继承、有效状态和阻塞原因投影。
- 完成可分发工具源码、skill 生成产物、项目集成、人类说明、测试与测试证据账本维护。

不纳入范围：

- 个人长期 TODO、项目管理、排期、通知或跨项目任务服务。
- 每任务 Markdown、默认事件历史、永久任务归档或把 task index 纳入项目事实文档。
- 由工具自动推断未记录的依赖、排斥、业务优先级或最优调度集合。
- 取代 `change-plan` 的持久 change 计划，或取代 `subagent-orchestration` 的代理创建、运行配置和结果审计。

## Success Criteria

- 一个 task entry 能在 JSON 索引中紧凑保存身份、内容和显式状态，复杂有效状态只由工具确定性投影。
- 工具拒绝父子环、依赖环、非法排斥、悬空引用、非法状态组合和不满足前置条件的领取。
- 子任务能够继承祖先软控制与约束、显式覆盖允许的控制状态并增加局部约束，实际执行状态不会被错误继承。
- 多个执行者不能同时领取同一任务或正在排斥的任务，陈旧 revision、错误租约和失败写入不会覆盖有效状态。
- 完成或取消的短期任务能在引用和租约解除后安全清理，不产生逐任务文档或永久归档负担。
- 新 skill、工具、生成产物、说明、打包集成、原生测试和测试证据通过各自验证及主仓库检查。

## Affected Owners

- `skills/task-graph/`：skill 行为入口、按需契约和实际分发内容。
- `tools/task-graph/`：task index、图验证、事务、查询和 CLI 的可维护源码与测试。
- `scripts/`、项目配置和打包入口：从工具源码生成 skill 产物并纳入检查与独立制品。
- `docs/skills/task-graph.md`、`README.md`、`AGENTS.md`：人类入口和仓库内 skill 概览。
- `docs/decisions/task-graph/`：已经确认的长期方向及其后续对齐状态。
- `docs/test-evidence/`：新增原生测试入口对应的显式 case 与派生索引。
- `tools/index-runtime/`、`tools/shared/`、`tools/version-control/`：只有实施调查证明存在可复用且责任一致的通用原语时才受影响。
