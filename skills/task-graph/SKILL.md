---
name: task-graph
description: >-
  维护当前工作中可恢复的非线性任务图。用于同时存在多个候选任务、动态追加、
  真实父子分解、依赖、并发排斥或跨上下文恢复时，通过权威 JSON 索引查询、
  选择、领取并收敛任务；少量固定顺序步骤继续使用当前对话计划。
compatibility: "Requires Node.js ^22.22.2 || ^24.15.0 || >=26.0.0; mutations require a caller-provisioned compatible native runtime."
metadata:
  version: "6"
---

# Task Graph

## 目标

把会影响当前调度的 task、父子结构、依赖、排斥和执行归属保存为可查询、可恢复的权威事实，使 agent 不必在上下文中重新推演任务拓扑。

Task graph 是协调事实源，不是长期知识 owner。Task 可以一直保留到协调价值消失；“临时”描述的是内容职责，而不是强制存活时长。稳定需求、设计理由、测试证据和最终知识仍由项目已有 owner 承接，task entry 只保存执行所需摘要和引用。

## 使用条件

以下情况使用：

1. 用户明确要求创建、维护、恢复或执行 task graph。
2. 当前工作同时存在多个任务，并涉及候选集合、动态追加、真实父子分解、非线性依赖、并发排斥或跨上下文恢复。

以下情况不使用：

1. 只有少量按固定顺序执行的步骤；此时继续使用当前对话计划。
2. 需要长期审阅、正式设计或跨阶段交接的明确 change；此时使用 `change-plan`。
3. 需要创建、配置或审计代理；task graph 只交付已就绪任务的协调事实，代理编排由 `subagent-orchestration` 承接。
4. 个人长期 TODO、项目排期、通知或跨项目任务管理。

## 内容 owner 与工具

1. 本文件承接触发、任务记录判断、调度流程、权限边界、恢复和交接。
2. `scripts/task-graph.mjs` 同时是 CLI 和程序化导入模块。Service 与 dispatch 先产生结构化 raw result object；CLI 再按已识别的操作选择 JSON serializer 或 task-list renderer。程序化调用直接导入同一份公开导出，不经过文本 renderer、JSON 往返或另一套 SDK 实现。
3. `scripts/task-graph.d.mts` 及其包内声明树从同一 TypeScript 实现机械生成。[task index Schema](references/task-graph-index.schema.json) 描述权威索引结构。精确命令、参数、raw result 和错误结构以 JSON help、公开声明及 Schema 为准；调用前使用 `help` 或 `help <command-path>` 恢复当前契约。
4. 目标仓库的 `docs/task-graph/task-graph-index.json` 是该工作区任务图的唯一权威索引，只能通过工具事务化修改。系统临时目录中的空锁文件与原子写临时文件都不是事实源。

## 对象模型

1. 索引根级 `tasks` 字典保存全部 task。任务默认平铺；某项的 `parentId` 指向另一 task 时才形成真实父子关系。允许同时存在多个互不相连的顶层任务或子图，不存在 scope、group、work 或虚拟 root。
2. Task ID 是字典键和稳定引用身份；创建后必须使用工具返回的实际 ID。Task title 是独立显示文本，可以重名。
3. Task entry 把 `content` 与 `state` 分开：`content` 保存标题、目标、可选 `acceptance` 完成提示、紧凑上下文、引用和结果；`state.control` 保存候选、排队、等待或暂停意图；`state.execution` 保存尝试、租约和终结状态；`state.relations` 保存父任务、依赖和排斥。`acceptance` 没有状态语义。
4. 可行动性、有效控制、阻塞原因、继承关系和待恢复状态由查询投影计算，不作为第二份状态写回 task entry。

## Task list 输出与程序化边界

1. 实际执行的 `task list` 默认输出全量静态文本视图；索引中的每个 task 使用实际 `taskId` 恰好出现一次。需要 raw result 的完整 JSON 序列化时，使用一个独立、无值且最多出现一次的全局 `--json`，它可以放在 command 前后。合法 `--json` 对任意协议内 success 或 failure 固定执行 `JSON.stringify(result) + "\n"`；help、version、其他 command、全局参数 failure，以及 task-list route 建立前的 service construction / 全局路径校验 failure 默认也保持 JSON。`task list --help` 属于 help，已识别 list 后的局部参数错误才使用默认 task-list failure 文本。输出路由依据已经识别的操作，不从 argv 前缀或 data shape 猜测。
2. `TaskGraphService.listTasks()` 返回结果的 `data` 是 `Record<string, TaskListItem>`；字典 key 等于 item 的 `taskId`。`TaskListItem` 直接复用 `TaskProjection` 的 effective control、完整 blockers、effective dependency/exclusion source、children、dependents 和 next action，只增加 title、direct parent 与 execution phase。公开面不保留 `TaskSummary` alias。
3. Renderer 以全部 list item 为 vertex，在 parent-child 之间和每条 effective dependency 的两端增加无向 track edge；每个弱连通分量是一个 track，孤立 task 自成 track，exclusion 不连接 track。Track 按成员中的最小实际 task ID 排序并从 `T01` 编号。没有 effective dependency 的 task 位于 `L0`，其余 task 的 layer 是全部 dependency layer 的最大值加一；parent 不改变 layer。Track 内依次按 layer、从顶层祖先到 direct parent 的实际 ID path、当前实际 task ID 排序。
4. 默认 node 始终显示 layer、实际 task ID、effective state 和 title，并按条件显示 direct parent、去重后的 dependency endpoint、blocker、active mutex、非空 control reason 与 next action。`blocked-by` 只保留 `dependency-failed`、`dependency-cancelled`、`ancestor-terminal`、`all-children-cancelled` 和 `descendant-lease`；`dependency-incomplete`、`child-incomplete` 与 control blocker 由同一全量视图中的关系、state 和 reason 表达，`exclusion-running` 转为 `mutex`。Children、dependents、完整 blockers、relation source 和 inheritance path 不在 node 重复展开，但始终保留在程序化 `listTasks()` 与 `task list --json` 中。
5. Success 摘要分别计数 tasks、tracks、actionable、running、recovery-needed 和 mutex-blocked。全部 effective exclusion pair 规范化为按实际 task ID 排序的无向 pair，对称去重后按较小 endpoint 分组并放在独立 `RUN MUTEX` section；只有已经形成 `exclusion-running` blocker 的对端才同时出现在受阻 node 的 `mutex` token 中。Exclusion 只禁止同时运行，不建立 dependency；track 数也不表示可并行数。
6. 文本 renderer 使用固定 inline/block form；有效 columns 低于 `80`，或去重后的 `needs`、`blocked-by`、`mutex` 任一超过三个 item 时，node 使用 block form；run mutex group 在 columns 低于 `80` 或右 endpoints 超过三个时使用 block form。缺少有效 columns 时回退到 `80`。Title、reason、task ID 的长度和 Unicode 显示宽度不触发自动换行、截断、隐藏或任务重排。摘要、各 track 与 `RUN MUTEX` 是独立 section，相邻 section 之间一个空行，结果只以一个 LF 结束。Renderer 只消费 raw result 并派生显示结构，不读取索引、不解析 JSON 文本，也不重新推导领域状态。
7. 当前 CLI 协议版本是 `3.0.0`。默认 `task list` 文本输出和公开 `TaskListItem` 类型都是 major-version 边界；需要原始序列化的 CLI 调用方必须显式使用 `--json`。Task-list renderer、render context、track、layer 与 folded token 保持内部显示边界，不扩展为公开领域 API。

## 工作流程

### 0. 仅为 mutation 准备 runtime

1. 使用满足 `^22.22.2 || ^24.15.0 || >=26.0.0` 的 Node.js 运行 CLI；Bun 只用于本 skill 源仓库的构建和测试。Help、version、runtime 查询、普通只读查询和模块导入不需要 native runtime。
2. 在本次上下文第一次 mutation 前调用 `runtime info`。默认 tool home 是 `~/.tools/task-graph`；非空 `TASK_GRAPH_TOOL_HOME` 完整覆盖该目录。
3. 按返回状态继续：
   - `compatible`：可以开始 mutation。
   - `missing`：取得用户对 npm 联网和 tool home 写入的明确授权后，将 `installCommand.command` 和完整 `installCommand.args` 原样执行，再重新调用 `runtime info`。
   - `incompatible`：停止 mutation，报告精确目录和 `reason`；修复或删除既有目录前另行取得授权。
4. CLI 不静默安装、联网或改写 runtime；只有 `runtime info` 返回 `compatible: true` 才执行 mutation。

### 1. 恢复索引与任务图

1. 让 shell 当前目录位于目标仓库根目录，并从本 skill 的实际安装路径调用 `scripts/task-graph.mjs`。相对 `--root` 和默认索引路径按目标工作区解析。
2. 先调用 `index info`，读取 revision、`valid`、`canonical` 和 diagnostics。只有 `valid: true` 且 `canonical: true` 才继续。收到 `INDEX_NOT_FOUND` 时，在 runtime 前置满足后调用 `index init`，再重新查询。其他读取、Schema 或规范化失败必须停止，不能手写、覆盖或隐式迁移索引。
3. 使用默认 `task list` 恢复全量分层任务视图；需要 revision、完整关系来源、完整 blocker 或自动处理时使用 `task list --json` 或程序化 `listTasks()`。使用 `actionable` 恢复当前合法下一动作；按需用 `task show <task-id>` 读取完整任务和投影。索引文件本身已经界定工作区，不再要求额外容器或标签才能定位任务。

### 2. 记录任务与关系

1. 只写入能够从用户要求、稳定 owner 或明确工作事实确认的任务和关系。工具不会从自然语言自动补全依赖、排斥、优先级或最佳并行集合。
2. 尚未选入当前执行的真实任务使用 `candidate`；已经选择执行的任务使用 `queued`；等待外部输入或暂停时保存明确原因。顶层任务不能继承 control，子任务可以继承最近祖先的软控制。
3. 每个 task 都表示真实目标。需要分解时创建真实子任务并记录 `parentId`；父任务通过子任务与租约状态构成的完成门禁收敛。
4. 每个 task 必须说明标题和目标；`acceptance` 只在已有明确标准时保存为可选辅助。省略或使用空数组不会阻止排队、领取或完成，也不是自动验收门禁。
5. 只有确认完成顺序时才记录 dependency，只有确认不能同时运行时才记录 exclusion。使用 `apply` 在一个 expectedRevision 下原子创建相互引用的任务和关系。
6. 创建、更新和关系修改都携带最新 expectedRevision。冲突后重新读取相关视图并重新判断，不盲目重放旧 mutation。

### 3. 查询、选择与领取

1. 每轮调度先读取 `actionable` 投影及其 revision。就绪叶子和待恢复叶子可以 `claim`，满足完成门禁的父任务可以 `complete`。
2. 工具可以返回多个可行动 task 及其排斥边，但不替 agent 或用户选择业务优先级。选择任务后，在开始实际工作前成功执行 `claim`，并保存 lease ID、actor 和到期时间。
3. `claim` 只用于叶子任务并在最新索引上重新验证约束。父任务不领取租约，满足门禁后使用最新 expectedRevision 完成。

### 4. 执行与收敛

1. Lease 持有者负责跟踪到期时间；工作可能越过到期时间时，在有效期内主动 `renew`。
2. 完成、失败、释放或运行中取消必须使用匹配的当前 lease。释放时显式选择下一本地 control；失败后需要继续工作时先 `retry`，再重新查询和领取。
3. 租约过期后，使用 `task show` 读取最新任务和 revision，再通过 `claim --recover-lease <旧 lease> --expected-revision <最新 revision> --reason <原因>` 原子写入新 lease。恢复三元组缺一不可，活动租约不能提前接管。
4. 有子任务的父任务只有在直接子任务全部成功或取消、至少一个成功且不存在活动或待恢复后代租约时才能完成。该判断不读取任何 `acceptance`；取消父任务会按门禁递归取消未终结后代，并保留已经终结的结果。

### 5. 动态追加、恢复与交接

1. 新任务出现时先读取最新 revision 和相关任务详情，再以普通 create 或原子 `apply` 追加；不要用记忆中的旧拓扑直接写入。
2. 上下文恢复后重新执行 `index info`、`task list` 和 `actionable`。对 `running` 或 `recovery-needed` task 先确认实际执行者和 lease，不能因当前对话不记得它就释放或覆盖。
3. 需要长篇背景、正式设计、跨阶段任务或稳定理由时，把内容交给 `change-plan`、决策记录或对应事实 owner，并在 task 中只保留紧凑引用。
4. 需要创建或审计代理时，把已就绪 task 的目标、完成提示、约束和 lease 边界交给 `subagent-orchestration`。没有该 skill 或环境不能创建代理时，在当前 agent 中按同一 claim 与 lease 规则执行。

### 6. 清理不再需要的任务

1. 时间经过本身不触发清理。只在显式选择的任务已经成功或取消、结果已经交付且这些任务不再承担协调价值时考虑删除。
2. 使用 `task remove --task <id>... --expected-revision <n> --results-delivered` 原子删除显式批次。所选任务必须全部终态，并且父子、依赖和排斥关系不能跨越所选集合与保留集合；任一 blocker 会使整个批次无变更。
3. 工具不运行后台 GC、不自动选择清理对象，也不复用已分配 ID。`acceptance`、删除成功或工具成功都不表示用户已经验收；真实交付和验证仍按当前任务要求判断。

## 权限与并发边界

1. `queued`、`claim`、lease actor 和 task result 都只是协调事实，不授予文件写入、外部系统调用、不可逆操作、子代理创建、提交或发布权限。
2. 工具只维护 task index，不自动 stage、commit 或决定索引是否进入某次提交。
3. 短事务锁只保护一次索引 mutation；实际工作期间不持有文件锁。锁位于系统临时目录 `task-graph-locks`，由规范索引绝对路径的 hash 定位并使用操作系统 advisory lock；句柄关闭或进程退出即释放。工具不在目标工作区创建锁，也不读取、创建或修改项目 `.gitignore`。
4. Exclusion 只禁止同时运行，不建立先后顺序。多个执行者竞争时，以第一个成功 claim 后的权威索引为准。

## 错误恢复

1. 正常结果和可预期失败都从 stdout 返回一个 LF 结尾的协议结果。默认实际 `task list` 使用固定 task-list success/failure 文本；其他 command、help、version 和全局参数 failure 默认使用 JSON envelope。需要机械读取 list 的 `ok`、`error.code`、`retryable`、revision 和结构化 details 时显式使用合法 `--json`，不要从 message 文本推断协议。
2. Revision 冲突或领取竞争后重新查询；只有错误明确可重试且当前事实仍支持原意时才重试。
3. 收到 `WRITE_OUTCOME_UNKNOWN` 时，mutation 可能已经越过原子提交点。先调用 `index info` 并读取目标任务，确认 revision 与结果后再决定下一步，绝不盲目重放。
4. Node/runtime 不支持、native 锁获取、索引读取、Schema 或完整图校验失败时停止写入，保留诊断并交给对应维护者处理；不得绕过工具直接修 JSON。

## 完成标准

1. 当前任务图可以从权威索引恢复；task、真实父子、依赖和排斥只包含已经确认的事实。
2. 每项实际执行都在成功 claim 后进行，并以匹配 lease 完成、失败、释放或取消；过期执行只通过恢复 claim 接管，父任务按完成门禁收敛。
3. Revision 或未知写入结果没有被盲目重试，活动与待恢复执行没有被静默覆盖。
4. 权限判断、代理编排、持久 change 和长期知识仍由各自 owner 承接，没有被 task graph 状态替代。
5. Mutation runtime 已通过当前平台探针；不再需要的终态任务只有在结果交付、关系闭合并获得显式清理确认后才删除，其余任务可以继续保留。
6. 默认 `task list` 的 track、dependency layer、folding 与独立 run mutex 没有改变持久拓扑或调度语义；需要完整机器语义的调用方使用同一 raw projection 或显式 `--json`，不从显示布局反推领域状态。
