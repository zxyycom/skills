# Task Graph

`task-graph` 用仓库内一个权威 JSON 索引保存当前工作中短命但会影响调度的任务事实。它面向多个候选、动态追加、真实父子分解、非线性依赖、并发排斥和跨上下文恢复；只有少量固定顺序步骤时，继续使用当前对话计划即可。

## 为什么需要它

复杂工作经常包含彼此独立、部分依赖或不能同时执行的任务。只把这些关系留在对话里，经过上下文压缩、任务追加或多个执行者竞争后，就需要重新询问和推演。`task-graph` 把已确认的任务、关系和执行租约交给事务化工具维护，让 agent 能从同一事实源恢复可行动集合和阻塞原因。

## 数据模型

Task entry 将目标内容与调度状态分开：内容保存目标、验收、紧凑上下文、引用和结果；状态分别保存调度控制、执行尝试与租约、父子关系、依赖和排斥。可行动性、有效控制和阻塞原因由工具从权威索引计算，不要求调用方维护第二份派生状态。精确字段和状态转移以实际 [Task Graph skill](../../skills/task-graph/SKILL.md) 与 [task index Schema](../../skills/task-graph/references/task-graph-index.schema.json) 为准。

## 能力边界

1. `docs/task-graph/task-graph-index.json` 是仓库当前短期任务状态的唯一权威索引；task entry 保持紧凑，复杂状态和反向关系由工具查询投影。
2. Scope 可以包含多个顶层真实任务，任意任务都可以分解为真实子任务；不使用 group、work 或虚拟 root。
3. 随 skill 分发的 JSON-only CLI 负责索引校验、关系约束、revision 事务、执行租约和 scope 级清理，工具不自动推断关系、选择业务优先级、运行包管理器或改变 Git 状态。
4. `change-plan` 继续承接需要持久审阅和交接的明确 change；`subagent-orchestration` 继续承接代理创建、配置和结果审计。Task graph 只向这些 owner 交付紧凑任务事实。
5. 任务被排队或领取不等于取得文件、外部系统、不可逆操作、提交或发布权限。

## Native runtime

分发 CLI 的 Node.js 范围由 skill frontmatter 声明；Bun 只用于本仓库构建和测试。只读 task-graph 命令、help 和模块导入不需要 native runtime。Mutation 依赖调用方在用户工具目录准备的原生锁扩展；`runtime info` 是唯一准备入口，负责返回精确目录、兼容状态、诊断和缺失时的 npm argv。调用方取得联网与写入授权后执行该 argv，CLI 本身不运行包管理器。

Mutation 使用系统临时目录 `task-graph-locks` 中按索引绝对路径 hash 定位的稳定空文件和操作系统 advisory lock。锁只覆盖一次索引事务，句柄关闭或进程退出后由操作系统释放；锁文件不保存 owner、heartbeat 或 stale 状态。工具不在工作区创建锁，也不管理项目 `.gitignore`。该边界只承诺受测平台上的同主机本地文件系统；兼容性必须由 `runtime info` 的直接版本、API 和真实探针共同确认。

原子提交由 `write-file-atomic` 完成；resolve 即表示本次调用成功，不执行提交回读。调用 reject 时统一返回 `WRITE_OUTCOME_UNKNOWN`，调用方必须重读索引和目标实体后再判断，不根据磁盘现状猜测能否安全重放。

安装授权、失败恢复和完整执行契约位于 [`skills/task-graph/`](../../skills/task-graph/)。
