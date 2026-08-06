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

实际 skill 位于 [`skills/task-graph/`](../../skills/task-graph/)。
