# Design

本设计以独立 `task-graph` 分发单元和权威 JSON 状态工具兑现 proposal，并把尚未实现的长期方向与本 change 的实施选择分开维护。

## Context

已确认事实与方向：

- [`own-short-lived-task-orchestration`](../../docs/decisions/task-graph/own-short-lived-task-orchestration.md) 确认 `task-graph` 拥有短期任务图，持久 change 和代理委派继续由既有 owner 管理。
- [`use-authoritative-json-index-for-short-lived-tasks`](../../docs/decisions/task-graph/use-authoritative-json-index-for-short-lived-tasks.md) 确认长期存在的是 JSON 运行时容器，task 是无需独立 Markdown 或永久归档的短期条目。
- [`separate-task-content-state-and-effective-projection`](../../docs/decisions/task-graph/separate-task-content-state-and-effective-projection.md) 确认内容、显式状态和查询投影分离。
- [`model-task-topology-and-inheritance-explicitly`](../../docs/decisions/task-graph/model-task-topology-and-inheritance-explicitly.md) 确认父子、依赖、排斥及继承语义必须显式维护。
- [`coordinate-task-execution-with-transactional-claims`](../../docs/decisions/task-graph/coordinate-task-execution-with-transactional-claims.md) 确认共享索引通过 revision、事务领取和租约协调执行。
- 当前 `index-runtime` 的已对齐 owner 是跨领域派生状态索引；task index 是权威可变状态源，不能在没有新契约的情况下把现有派生索引能力当作实现前提。
- 仓库规则要求 `tools/` 保存随 skill 分发的工具源码，`scripts/` 保存构建适配，`skills/` 保存行为本体和实际分发内容；新增测试时同步维护测试证据账本。

文档权威与阅读顺序：

1. 上述五条 `task-graph` 决策拥有已经确认的长期方向；实现不得在 change 中静默改写这些方向。
2. `proposal.md` 拥有本次 change 的目标、范围和成功标准；本文件只拥有兑现 proposal 的当前设计、风险与开放问题。
3. `tasks.md` 拥有实施顺序和进度；checkbox 不改变决策状态，也不单独构成实施授权。
4. 实现完成后，`skills/task-graph/SKILL.md` 和工具契约将成为当前行为与机器协议 owner；在此之前，五条决策保持 `unaligned`。

本文统一使用以下术语：

- `task index`：工具独占写入、长期存在的权威 JSON 运行时容器。
- `task entry`：task index 中一个短期任务的紧凑 JSON 记录。
- `task scope`：在同一索引中隔离一组相关任务的稳定边界，精确身份仍由 Q1 决定。
- `显式状态`：task entry 中持久保存的 control、execution、relations 和 timestamps。
- `有效投影`：工具根据完整索引查询生成且不写回 task entry 的状态、继承来源、反向关系和阻塞原因。

必要假设：运行时允许 task 工具在一个可配置且可写的位置长期保存索引，并允许共享该任务图的 agents 访问同一状态文件。精确位置和隔离标识仍是实施前待决项。

## Goals / Non-Goals

目标：

- 为单个工作区内一个或多个短期任务 scope 提供唯一、可恢复和可并发更新的权威状态。
- 让任务内容保持紧凑，同时让控制、执行、层级、顺序、排斥和租约拥有独立可验证结构。
- 让 agent 从工具获得 runnable 集合、有效状态和完整阻塞理由，并只能通过受控命令改变状态。
- 让 skill 与 CLI 组成一个完整分发单元，同时保留与其他 skills 的可选交接而不建立隐含安装依赖。

非目标：

- 不设计长期项目管理产品、跨设备同步、通知、日历或人工团队权限系统。
- 不把完整任务执行计划、长篇上下文或执行日志塞入 task entry。
- 不使用事件溯源或永久 tombstone 作为第一版任务历史。
- 不让工具根据自然语言或工作区 diff 自动建立正式拓扑。

## Decisions

- Skill 稳定身份和源码目录使用 `task-graph`；同名工具源码位于 `tools/task-graph/`，构建后的 CLI、声明和 updater 进入 `skills/task-graph/scripts/`。
- 实现以 [`use-authoritative-json-index-for-short-lived-tasks`](../../docs/decisions/task-graph/use-authoritative-json-index-for-short-lived-tasks.md) 和 [`separate-task-content-state-and-effective-projection`](../../docs/decisions/task-graph/separate-task-content-state-and-effective-projection.md) 为 schema 语义输入；精确字段、合法值和校验进入工具的机器契约，不在本 change 复制第二份字段规范。
- 实现以 [`model-task-topology-and-inheritance-explicitly`](../../docs/decisions/task-graph/model-task-topology-and-inheritance-explicitly.md) 为图语义输入；查询必须暴露有效约束的来源和阻塞路径，不物化需要多处同步的展开关系。
- 实现以 [`coordinate-task-execution-with-transactional-claims`](../../docs/decisions/task-graph/coordinate-task-execution-with-transactional-claims.md) 为并发语义输入；精确锁、时钟和恢复协议在 Q3 收敛后进入工具 owner。
- Change 创建与长期决策建立不授权实现。本计划在开放问题解决、Readiness 完成且用户后续明确开始实施前保持草案状态。

## Risks / Trade-offs

- 单文件权威索引简化了 task owner，但多个 agents 会竞争同一写入点；必须在实现前选定跨进程锁、原子替换和陈旧 revision 处理，不能只依赖进程内互斥。
- 继承控制和祖先约束可以减少重复关系，但有效状态解释更复杂；查询结果必须给出来源和阻塞路径，测试需要覆盖多层继承与局部覆盖。
- 排斥关系使用显式 task ID 容易理解，却可能在大量同类资源冲突时产生多条边；第一版不提前引入资源锁语言，只有现实案例证明 pairwise 关系不足时再扩展。
- 不保存永久历史降低维护面，但会失去任务级审计；需要长期回放的结果必须在清理前交给现有稳定 owner，不能事后从 task index 恢复。
- 复用 `index-runtime` 或 `version-control` 的底层能力可能降低重复实现，也可能把派生索引或待提交快照契约错误扩展到运行时状态；只有责任和事务语义一致时才允许依赖。

## Open Questions

- Q1：运行时 task index 默认位于工作区隐藏目录、宿主任务状态目录还是显式 `--tasks-dir`；如何稳定标识并隔离不同 Codex task、线程或根任务 scope？
- Q2：权威可变索引是否只复用 `index-runtime` 的 schema、查询或规范化原语，还是需要独立 mutable-state owner；若扩展通用 owner，哪些已确认现实场景共同依赖该契约？
- Q3：跨进程锁、revision compare-and-swap、临时文件替换、租约时钟、续租、过期和强制恢复的精确协议是什么？
- Q4：终态 task 的默认保留窗口、依赖结果消费证明、根 scope 原子清理和显式 `gc`/`close` 命令怎样组合，才能既不提前删除又不长期积累？
- Q5：第一版对外状态名称、失败后的重试状态和父任务完成策略需要固定成哪些最小合法集合？
