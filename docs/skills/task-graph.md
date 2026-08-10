# Task Graph

`task-graph` 用仓库内一个权威 JSON 索引保存当前工作中会影响调度的任务事实，并用默认 `task list` 把全量任务投影为可导航的分层视图。它面向多个候选、动态追加、真实父子分解、非线性依赖、并发排斥和跨上下文恢复；只有少量固定顺序步骤时，继续使用当前对话计划即可。任务可以一直保留到协调价值消失，“临时”只表示它不承接长期知识，并非按时间强制过期。

## 为什么需要它

复杂工作经常包含彼此独立、部分依赖或不能同时执行的任务。只把这些关系留在对话里，经过上下文压缩、任务追加或多个执行者竞争后，就需要重新询问和推演。`task-graph` 把已确认的任务、关系和执行租约交给事务化工具维护，让 agent 能从同一事实源恢复可行动集合和阻塞原因；默认 list 负责降低阅读冗余，raw projection 继续保存完整机器语义。

## 数据模型

Task entry 将目标内容与调度状态分开：内容保存标题、目标、可选 `acceptance` 完成提示、紧凑上下文、引用和结果；状态分别保存调度控制、执行尝试与租约、父子关系、依赖和排斥。标题和目标说明要做什么；`acceptance` 只在已有明确标准时提供辅助，不会被工具解释为调度或完成门禁，也不表示必须进行用户验收。可行动性、有效控制和阻塞原因由工具从权威索引计算，不要求调用方维护第二份派生状态。

程序化 `listTasks()` 返回结果的 `data` 是以实际 task ID 为键的 `TaskListItem` 字典；每项复用完整 `TaskProjection`，并增加 title、direct parent 和 execution phase。Track label、dependency layer、折叠 token、缩进和摘要计数只属于 renderer 的临时显示结构，不写回 projection。精确字段和状态转移以实际 [Task Graph skill](../../skills/task-graph/SKILL.md) 与 [task index Schema](../../skills/task-graph/references/task-graph-index.schema.json) 为准。

## 默认任务清单

1. `task list` 默认输出索引中的全部 task，每项使用实际 `taskId` 恰好出现一次；它不做过滤、分页、自动收缩或 `outside-view` 占位。
2. Parent 与 effective dependency 把任务连接成 track；孤立 task 自成 track。Layer 只由 effective dependency 决定，parent 不提升 layer。Track 用于恢复推进上下文，不表示能够并行运行。
3. Node 直接显示 effective state、parent、dependency、非空 control reason、next action，以及不能从同一全量视图恢复的终态或层级 blocker。普通未完成关系、反向关系和继承来源可以折叠，但仍完整保留在 raw projection。
4. Effective exclusion 不进入 track 或 layer。全部排斥 pair 在独立 `RUN MUTEX` section 中对称去重；只有正在形成 claim blocker 的对端才同时出现在对应 node 上。因此 run mutex 不会被误读为 dependency 或完成顺序。
5. 输出按实际 task ID 和图关系确定性排序。Inline/block form 只受固定 columns 门槛和每类关系项数量控制；中日韩字符、emoji、长 title 或 reason 不触发自动换行、截断、隐藏或任务重排。

需要机器可读的完整结果时，使用独立、无值且最多出现一次的全局 `--json`；它可以位于 command 前后。合法 `--json` 让任意协议内 success/failure 直接序列化 raw result。Help、version、没有专用文本 renderer 的 command 和全局参数 failure 默认保持 JSON；help 不切换到 task-list 或 task-index-stage renderer。

## 按 task ID 分段暂存

`index stage --task <id>...` 用于让一次提交只包含显式选中的 task index 变化。命令以 Git `HEAD` 索引为基线、中央工作区索引为候选，选中 task 取候选条目，未选中 task 保持基线条目；新增和删除也通过同一 ID 选择表达。`revision` 与 `nextTaskId` 属于完整中央协调状态，因此目标使用候选水位且不能相对基线回退。

合成后的完整索引必须重新通过 Schema、语义、关系闭合和 canonical 校验。需要同时变化的父子、依赖或对称排斥端点没有一并选择时，命令拒绝而不会自动扩大提交范围。写入在版本管理锁内核对 `HEAD` 和该索引现有 pending；另一批 task 已经暂存、并发写入或基线变化时不会被覆盖。工作区索引与索引外 pending 路径始终保持原状，commit、其他领域文件和最终提交范围仍由调用方负责。

默认实际 `index stage` 返回稳定单行文本；显式 `--json` 返回同一 raw result。该操作只写 Git pending，不改变任务状态，所以不加载 task-index mutation native runtime，但目标必须位于可用 Git 仓库中。

## 能力边界

1. `docs/task-graph/task-graph-index.json` 是工作区当前任务状态的唯一权威索引；根级 `tasks` 字典保存全部任务，复杂状态和反向关系由工具查询投影。
2. 任务默认平铺；`parentId` 存在时才形成真实父子关系。允许多个互不相连的顶层任务或子图，不使用 scope、group、work 或虚拟 root。
3. 随 skill 分发的 CLI 负责索引校验、关系约束、revision 事务、执行租约、显式批量任务清理、按 task ID 构造 pending 索引和输出路由。除显式 `index stage` 外，工具不改变 Git；它也不自动推断关系、选择业务优先级、运行包管理器或 commit。Service 与 dispatch 先产生结构化 raw result；JSON serializer 与两个专用文本 renderer 只负责输出。程序化调用直接导入同一模块的公开导出；SDK 不是另一层实现、接口清单或稳定性层，TypeScript 声明也从该实现机械生成。
4. `change-plan` 继续承接需要持久审阅和交接的明确 change；`subagent-orchestration` 继续承接代理创建、配置和结果审计。Task graph 只向这些 owner 交付紧凑任务事实。
5. 任务被排队或领取不等于取得文件、外部系统、不可逆操作、提交或发布权限。

当前 CLI 协议版本是 `3.1.0`。默认 `task list`、`index stage` 文本和公开 `TaskListItem`、`TaskIndexStageResult` 是协议契约，不提供 `TaskSummary` alias；依赖 raw CLI 序列化的调用方必须显式使用 `--json`。Renderer、render context、track、layer 和 folded token 保持内部显示边界，不作为公开领域 API。

## Native runtime

分发 CLI 的 Node.js 范围由 skill frontmatter 声明；Bun 只用于本仓库构建和测试。只读 task-graph 命令、Git pending staging、help 和模块导入不需要 native runtime。Task-index mutation 依赖调用方在用户工具目录准备的原生锁扩展；`runtime info` 是唯一准备入口，负责返回精确目录、兼容状态、诊断和缺失时的 npm argv。调用方取得联网与写入授权后执行该 argv，CLI 本身不运行包管理器。

Mutation 使用系统临时目录 `task-graph-locks` 中按索引绝对路径 hash 定位的稳定空文件和操作系统 advisory lock。锁只覆盖一次索引事务，句柄关闭或进程退出后由操作系统释放；锁文件不保存 owner、heartbeat 或 stale 状态。工具不在工作区创建锁，也不管理项目 `.gitignore`。该边界只承诺受测平台上的同主机本地文件系统；兼容性必须由 `runtime info` 的直接版本、API 和真实探针共同确认。

原子提交由 `write-file-atomic` 完成；resolve 即表示本次调用成功，不执行提交回读。调用 reject 时统一返回 `WRITE_OUTCOME_UNKNOWN`，调用方必须重读索引和目标实体后再判断，不根据磁盘现状猜测能否安全重放。

安装授权、失败恢复和完整执行契约位于 [`skills/task-graph/`](../../skills/task-graph/)。
