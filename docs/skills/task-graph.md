# Task Graph

`task-graph` 用仓库内一个权威 JSON 索引保存当前工作中短命但会影响调度的任务事实。它面向多个候选、动态追加、真实父子分解、非线性依赖、并发排斥和跨上下文恢复；只有少量固定顺序步骤时，继续使用当前对话计划即可。

## 为什么需要它

复杂工作经常包含彼此独立、部分依赖或不能同时执行的任务。只把这些关系留在对话里，经过上下文压缩、任务追加或多个执行者竞争后，就需要重新询问和推演。`task-graph` 把已确认的任务、关系和执行租约交给事务化工具维护，让 agent 能从同一事实源恢复可行动集合和阻塞原因。

## 能力边界

1. `docs/task-graph/task-graph-index.json` 是仓库当前短期任务状态的唯一权威索引；task entry 保持紧凑，复杂状态和反向关系由工具查询投影。
2. Scope 可以包含多个顶层真实任务，任意任务都可以分解为真实子任务；不使用 group、work 或虚拟 root。
3. 随 skill 分发的 JSON-only CLI 负责索引校验、关系约束、revision 事务、执行租约和 scope 级清理，工具不自动推断关系、选择业务优先级或改变 Git 状态。
4. `change-plan` 继续承接需要持久审阅和交接的明确 change；`subagent-orchestration` 继续承接代理创建、配置和结果审计。Task graph 只向这些 owner 交付紧凑任务事实。
5. 任务被排队或领取不等于取得文件、外部系统、不可逆操作、提交或发布权限。

## Native runtime

分发 CLI 支持 Node.js `^22.22.2 || ^24.15.0 || >=26.0.0`；Bun 只用于本仓库构建和测试。只读命令、help 和模块导入不需要 native runtime。首次 mutation 前先运行 `runtime info`；缺失时，在取得 npm 联网与用户工具目录写入授权后显式运行 `runtime install`，随后用 `runtime check` 验证精确依赖闭包和真实 lock/unlock 探针。普通命令、mutation 和 updater 不会静默联网或修复 runtime。

Runtime 默认安装在 `~/.tools/task-graph/runtimes/<runtime-id>/`，非空 `TASK_GRAPH_TOOL_HOME` 完整覆盖 tool home。Skill、Git 和 zip 只携带精确 manifest 与 lockfile，不携带 `.node`。无效既有 runtime 和崩溃遗留的 `.install-*` 不会自动删除；后者只能在操作者确认精确目录不属于活动安装后显式清理。

Mutation 使用长期存在的空 `<index-path>.lock` 普通文件和操作系统 advisory lock。锁只覆盖一次索引事务，句柄关闭或进程退出后由操作系统释放；不再存在 owner metadata、heartbeat、stale 判定或手工抢锁恢复。该边界只承诺受测平台上的同主机本地文件系统；其他平台必须由 `runtime check` 失败关闭，不能从包名外推支持。

实际 skill 位于 [`skills/task-graph/`](../../skills/task-graph/)。
