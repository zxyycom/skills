# Proposal

本 change 计划创建 `task-graph` skill、仓库级权威 task index 及其事务化管理工具，以显式短期任务图替代 agent 对候选、顺序、继承和并发关系的临场记忆；本文只承接实施前的目标、范围和验收，不作为运行态 task 状态或最终机器协议的事实源。

## Why

当前线性计划只能表达有限顺序，无法稳定维护大量候选任务、父子结构、完成依赖和并发排斥。`subagent-orchestration` 只在任务已经被拆分并决定委派后管理代理切面，`change-plan` 则面向需要持久审阅和交接的明确 change；两者都不拥有当前工作中短命但高价值的任务状态。继续依赖 agent 在对话中询问、记录和重新推演，会在上下文压缩、任务追加或并发执行后丢失调度事实并引入写入冲突。

## Outcome

仓库新增可独立选择和分发的 `task-graph` skill，以及随其分发的专用 CLI。该能力通过 `docs/task-graph/task-graph-index.json` 中长期存在的权威 JSON 索引保存短期 task entry，以嵌套字典维护 scope 和真实父子任务，分离内容、控制状态和执行状态，并通过确定性有效投影、revision 事务、执行租约和 scope 级清理为 agents 提供可恢复的协调事实。CLI 的正常结果和可预期失败只输出 JSON，不维护第二套人类文本协议。

## Scope

纳入范围：

- 定义 `task-graph` 的触发、行为、与 `change-plan`、`subagent-orchestration` 的交接边界及完成标准。
- 创建仓库级权威索引 `docs/task-graph/task-graph-index.json`，并实现其 schema、嵌套 scope/task 字典、稳定 ID、revision、单调下一 ID 计数器、严格校验和确定性序列化。
- 实现任务创建、批量 apply、读取、查询、父子与关系维护、控制状态、事务领取、续租、完成、失败、释放、重试、暂停、取消、恢复、追踪、检查和 scope 清理入口。
- 实现父子森林、依赖 DAG、对称排斥、祖先控制与约束继承、真实父任务完成门禁、有效状态和完整阻塞原因投影。
- 实现跨进程短事务锁、revision compare-and-swap、原子文件替换、执行租约和失败恢复边界。
- 完成可分发工具源码、skill 生成产物、项目集成、人类说明、原生测试与测试证据账本维护。

不纳入范围：

- 个人长期 TODO、项目管理、排期、通知、跨设备同步或跨项目任务服务。
- 每任务 Markdown、默认事件历史、永久 task 归档或把短期 task entry 解释为长期项目事实。
- 单 task 清理、后台自动 GC、默认保留计时器或为了提前删除 task 而物化父任务聚合历史。
- 由工具自动推断未记录的依赖、排斥、业务优先级、资源锁或最优调度集合。
- 跨 scope 关系，或取代 `change-plan` 的持久 change 计划和 `subagent-orchestration` 的代理创建、运行配置及结果审计。
- 自动 stage、commit 或以其他方式改变 task index 的 Git 生命周期。
- 跨主机共享文件系统上的并发写入；第一版只协调同一工作区所在主机内的进程。

## Success Criteria

- 权威索引使用 `scopes[scopeId].tasks[taskId]` 的嵌套字典查找实体，字典键承接身份，不在 entry 内重复保存同一 ID。
- 一个 task entry 只紧凑保存 content 与显式 state；children、反向关系、有效控制、有效状态、阻塞路径和可执行动作只由工具根据完整索引确定性投影。
- 每个 task 都是真实任务；任意 task 可以有子任务，有子任务的父任务按统一完成门禁收敛，不引入 `work`、`group` 或虚拟 root task 类型。
- 工具拒绝父子环、展开后的依赖环、非法排斥、悬空引用、跨 scope 关系、非法状态组合和不满足前置条件的领取或父任务完成。
- 子任务继承祖先软控制、依赖和排斥约束，可显式覆盖软控制并增加局部约束；实际执行状态不会被错误继承。
- 有效状态按照固定优先级投影；`actionable` 只返回当前可合法执行 `claim` 或父任务 `complete` 的 `ready` task，并同时返回完整、结构化 blocker 与下一动作。
- 多个执行者不能同时领取同一任务或违反排斥边界；陈旧 revision、错误租约、过期未恢复租约和失败写入不会覆盖有效状态。
- 自动陈旧锁恢复只能回收已经确认原进程失效的同主机锁；写入提交点前失败保持原索引，提交点后结果无法确认时返回明确的未知结果并要求调用方重新查询。
- CLI 每次调用只返回一个 JSON 结果；批量 apply 在同一事务中创建任务和关系，可预期失败返回稳定错误 code 与可重试信息。
- scope 只有在全部顶层任务进入成功或取消终态、没有活动或待恢复租约且结果已确认交付后才能原子清理；revision 与 `nextIds` 继续保留且 ID 不复用。
- 新 skill、工具、生成产物、仓库级索引 owner、说明、打包集成、原生测试和测试证据通过各自验证及主仓库检查。

## Affected Owners

- `skills/task-graph/`：skill 行为入口、按需协议、生成后的 CLI、声明、schema 和实际分发内容。
- `tools/task-graph/`：task index schema、图验证、状态投影、事务存储、领域 API、JSON CLI 和测试的可维护源码。
- `docs/task-graph/task-graph-index.json`：仓库当前短期任务状态的唯一权威索引；只由 task-graph 工具修改。
- `docs/navigation.md`：新增仓库级 task index 内容 owner 与任务路由。
- `scripts/`、`package.json`、`.gitignore`、检查和打包入口：从工具源码生成 skill 产物并纳入测试、检查与独立制品，同时排除 task-graph 的锁、临时文件和隔离残留。
- `docs/skills/task-graph.md`、`README.md`、`AGENTS.md`：人类入口和仓库内 skill 概览。
- `docs/decisions/task-graph/`：已经确认的长期方向及其实施后对齐状态。
- `docs/test-evidence/`：新增原生测试入口对应的显式 case 与派生索引。
