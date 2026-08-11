---
name: task-graph
description: >-
  维护当前工作中可恢复的非线性任务图。用于同时存在多个候选任务、动态追加、
  真实父子分解、依赖、并发排斥或跨上下文恢复时，通过权威 JSON 索引查询、
  选择、领取并收敛任务；少量固定顺序步骤继续使用当前对话计划。
compatibility: "Requires Node.js ^22.22.2 || ^24.15.0 || >=26.0.0 and Git for pending staging; workspace task-index mutations require a caller-provisioned compatible native runtime."
metadata:
  version: "11"
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
3. 工作目标只是选择、创建、配置或审计执行者；task graph 只维护任务协调事实，不决定执行者或执行方式。
4. 个人长期 TODO、项目排期、通知或跨项目任务管理。

## 内容 owner 与工具

1. 本文件承接触发、任务记录判断、调度流程、权限边界、恢复和交接。
2. `scripts/task-graph.mjs` 同时是 CLI 和程序化导入模块。Service 与 dispatch 先产生结构化 raw result object；CLI 再按已识别的操作选择 JSON serializer、task-list renderer 或 task-index stage renderer。程序化调用直接导入同一份公开导出，不经过文本 renderer、JSON 往返或另一套 SDK 实现。
3. `scripts/task-graph.d.mts` 及其包内声明树从同一 TypeScript 实现机械生成。[task index Schema](references/task-graph-index.schema.json) 描述权威索引结构。精确命令、参数、是否需要 native runtime、raw result 和错误结构以 JSON help 的 `requiresMutationRuntime`、公开声明及 Schema 为准；调用前使用 `help` 或 `help <command-path>` 恢复当前契约。
4. 目标仓库的 `docs/task-graph/task-graph-index.json` 是该工作区任务图的唯一权威索引，只能通过工具事务化修改。系统临时目录中的空锁文件与原子写临时文件都不是事实源。

## 对象模型

1. 索引根级 `tasks` 字典保存全部 task。任务默认平铺；某项的 `parentId` 指向另一 task 时才形成真实父子关系。允许同时存在多个互不相连的顶层任务或子图，不存在 scope、group、work 或虚拟 root。
2. Task ID 是字典键和稳定引用身份；创建后必须使用工具返回的实际 ID。Task title 是独立显示文本，可以重名。
3. Task entry 把 `content` 与 `state` 分开：`content` 保存标题、目标、可选 `acceptance` 完成提示、紧凑上下文、引用和结果；`state.control` 保存候选、排队、等待或暂停意图；`state.execution` 保存尝试、租约和终结状态；`state.relations` 保存父任务、依赖和排斥。`acceptance` 没有状态语义。
4. 可行动性、有效控制、阻塞原因、继承关系和待恢复状态由查询投影计算，不作为第二份状态写回 task entry。

## Task result 与版本锚点

1. `content.result` 保存 task 进入终态时的当前语义结果，不保存工作中间态或默认事件历史。
2. Result 默认只包含结果摘要和确有长期价值的稳定 owner 引用。分支、当前提交和 lease 是执行或集成交接信息；没有定义清楚的长期消费者时，不把 Git commit SHA 复制为 result 引用。
3. 目标仓库用 Git 管理 task index 时，首次包含该终态 entry 的提交是 task 结果的版本锚点。它只证明“该仓库版本已经记录此终态结果”，不证明 task 唯一对应某个实现提交。
4. 工作区 task mutation 只改变权威索引，`index stage` 只改变 Git pending。二者都不表示版本锚点已经形成；是否 stage、commit 或交付仍由调用方按当前授权显式决定。
5. Task result 不是审计日志。成功事实需要撤销时，将其作为独立终态纠正问题处理；当前环境提供对应显式流程时使用该流程。Failed task 再执行使用 `retry`。二者都不通过修改 succeeded result 元数据替代。

## 按 task ID 分段暂存索引

1. 本节的 Git `pending` 指下一次提交使用的待提交快照，不是工作区 task index 或 task execution state。`index stage` 只替换该快照中的 task index 路径；工作区索引、任务状态和索引外路径保持不变。
2. CLI 至少提供一次 `--task <id>`，选择多个 task 时为每个 ID 重复该参数，例如 `index stage --task task-000001 --task task-000002`。ID 必须规范且不重复。程序化调用使用 `TaskGraphService.stageTaskIndex(taskIds)`。
3. 命令读取当前 Git `HEAD` 中的 task index 作为基线；HEAD 尚无该文件时使用当前 Schema 的空索引作为基线。目标工作区中的完整索引是本次候选快照。选中且候选存在的 task 使用候选条目；选中且只在基线存在的 task 被删除；未选中 task 保持基线条目。指定 ID 在两端都不存在时拒绝。
4. 根级 `revision` 和 `nextTaskId` 描述完整 task index，不能归属单个 task。目标始终使用候选快照的两个水位，并拒绝相对基线回退；即使水位来自未选中 task 的变化，也不从目标中剥离。
5. 合成目标重新通过完整 Schema、语义和关系校验，再由规范 serializer 产生 canonical JSON。父子、依赖、对称排斥或生命周期约束无法在合成索引中成立时整批拒绝；命令不会为修复关系而自动扩大选择集。
6. 版本管理锁内同时确认 Git `HEAD` 仍是已读取的 commit，且该索引路径的既有 pending 快照仍逐字等于 HEAD 基线；HEAD 没有该文件时，该路径必须尚未进入 pending。另一批已暂存 task、并发 pending 写入或 HEAD 变化都返回 `REVISION_CONFLICT`，不累加、不合并、不覆盖；索引外 pending 路径保持不变。
7. 默认实际 `index stage` 使用单行稳定文本；显式全局 `--json` 返回同一 raw result。成功结果的顶层 `revision` 是目标 task index 的根级 revision，`state` 与 `changed` 分别只能组成 `staged`/`true` 或 `unchanged`/`false`。该命令需要可发现的 Git 仓库，但不加载工作区索引 mutation 的 native runtime；成功只证明 pending 快照已写入，不表示已经 commit、push 或交付。

## Task list 输出与程序化边界

1. 实际执行的 `task list` 默认输出全量静态文本视图；索引中的每个 task 使用实际 `taskId` 恰好出现一次。实际 `index stage` 默认输出专用单行文本。需要 raw result 的完整 JSON 序列化时，使用一个独立、无值且最多出现一次的全局 `--json`，它可以放在 command 前后。合法 `--json` 对任意协议内 success 或 failure 固定执行 `JSON.stringify(result) + "\n"`；help、version、其他 command、全局参数 failure，以及专用 route 建立前的 service construction / 全局路径校验 failure 默认也保持 JSON。Help 属于 help，已识别专用 route 后的局部参数错误才使用对应 failure 文本。输出路由依据已经识别的操作，不从 argv 前缀或 data shape 猜测。
2. `TaskGraphService.listTasks()` 返回结果的 `data` 是 `Record<string, TaskListItem>`；字典 key 等于 item 的 `taskId`。`TaskListItem` 直接复用 `TaskProjection` 的 effective control、完整 blockers、effective dependency/exclusion source、children、dependents 和 next action，只增加 title、direct parent 与 execution phase。公开面不保留 `TaskSummary` alias。
3. Renderer 以全部 list item 为 vertex，在 parent-child 之间和每条 effective dependency 的两端增加无向 track edge；每个弱连通分量是一个 track，孤立 task 自成 track，exclusion 不连接 track。Track 按成员中的最小实际 task ID 排序并从 `T01` 编号。没有 effective dependency 的 task 位于 `L0`，其余 task 的 layer 是全部 dependency layer 的最大值加一；parent 不改变 layer。Track 内依次按 layer、从顶层祖先到 direct parent 的实际 ID path、当前实际 task ID 排序。
4. 默认 node 始终显示 layer、实际 task ID、effective state 和 title，并按条件显示 direct parent、去重后的 dependency endpoint、blocker、active mutex、非空 control reason 与 next action。`blocked-by` 只保留 `dependency-failed`、`dependency-cancelled`、`ancestor-terminal`、`all-children-cancelled` 和 `descendant-lease`；`dependency-incomplete`、`child-incomplete` 与 control blocker 由同一全量视图中的关系、state 和 reason 表达，`exclusion-running` 转为 `mutex`。Children、dependents、完整 blockers、relation source 和 inheritance path 不在 node 重复展开，但始终保留在程序化 `listTasks()` 与 `task list --json` 中。
5. Success 摘要分别计数 tasks、tracks、actionable、running、recovery-needed 和 mutex-blocked。全部 effective exclusion pair 规范化为按实际 task ID 排序的无向 pair，对称去重后按较小 endpoint 分组并放在独立 `RUN MUTEX` section；只有已经形成 `exclusion-running` blocker 的对端才同时出现在受阻 node 的 `mutex` token 中。Exclusion 只禁止同时运行，不建立 dependency；track 数也不表示可并行数。
6. 文本 renderer 使用固定 inline/block form；有效 columns 低于 `80`，或去重后的 `needs`、`blocked-by`、`mutex` 任一超过三个 item 时，node 使用 block form；run mutex group 在 columns 低于 `80` 或右 endpoints 超过三个时使用 block form。缺少有效 columns 时回退到 `80`。Title、reason、task ID 的长度和 Unicode 显示宽度不触发自动换行、截断、隐藏或任务重排。摘要、各 track 与 `RUN MUTEX` 是独立 section，相邻 section 之间一个空行，结果只以一个 LF 结束。Renderer 只消费 raw result 并派生显示结构，不读取索引、不解析 JSON 文本，也不重新推导领域状态。
7. 当前 CLI 协议版本是 `3.1.0`。默认 `task list` 与 `index stage` 文本输出以及公开 `TaskListItem`、`TaskIndexStageResult` 类型都是协议边界；需要原始序列化的 CLI 调用方必须显式使用 `--json`。Renderer、render context、track、layer 与 folded token 保持内部显示边界，不扩展为公开领域 API。

## 工作流程

### 0. 仅为工作区索引 mutation 准备 runtime

1. 使用满足 `^22.22.2 || ^24.15.0 || >=26.0.0` 的 Node.js 运行 CLI；Bun 只用于本 skill 源仓库的构建和测试。Help、version、runtime 查询、普通只读查询、`index stage` 和模块导入不需要 native runtime。
2. 在本次上下文第一次工作区 task index mutation 前调用 `runtime info`。默认 tool home 是 `~/.tools/task-graph`；非空 `TASK_GRAPH_TOOL_HOME` 完整覆盖该目录。
3. 按返回状态继续：
   - `compatible`：可以开始工作区 task index mutation。
   - `missing`：取得用户对 npm 联网和 tool home 写入的明确授权后，将 `installCommand.command` 和完整 `installCommand.args` 原样执行，再重新调用 `runtime info`。
   - `incompatible`：停止工作区 task index mutation，报告精确目录和 `reason`；修复或删除既有目录前另行取得授权。
4. CLI 不静默安装、联网或改写 runtime；只有 `runtime info` 返回 `compatible: true` 才执行工作区 task index mutation。

### 1. 恢复索引与任务图

1. 让 shell 当前目录位于目标仓库根目录，并从本 skill 的实际安装路径调用 `scripts/task-graph.mjs`。相对 `--root` 和默认索引路径按目标工作区解析。
2. 先调用 `index info`，读取 revision、`valid`、`canonical` 和 diagnostics。只有 `valid: true` 且 `canonical: true` 才继续。收到 `INDEX_NOT_FOUND` 时，在 runtime 前置满足后调用 `index init`，再重新查询。其他读取、Schema 或规范化失败必须停止，不能手写、覆盖或隐式迁移索引。
3. 使用默认 `task list` 恢复全量分层任务视图；需要 revision、完整关系来源、完整 blocker 或自动处理时使用 `task list --json` 或程序化 `listTasks()`。使用 `actionable` 恢复当前合法下一动作；按需用 `task show <task-id>` 读取完整任务和投影。索引文件本身已经界定工作区，不再要求额外容器或标签才能定位任务。

### 2. 记录任务与关系

#### 判定关系

1. 先读取最新的相关 task 内容、关系投影和稳定 owner。关系依据只来自用户要求、已经确认的 task 目标与上下文、稳定 owner、既有拓扑或已确认执行约束；业务优先级、方便的执行顺序、主题相近或可能冲突都不是拓扑事实。
2. 对每个候选关系独立判断其是否成立、端点以及 dependency 方向。上述事实能够唯一确定结论时，agent 主动写入，不要求用户逐条确认；多个关系可以各自成立并同时记录。
3. 存在多种合理拓扑或证据不足时保持不写。只有缺失判断会实质影响协调并且无法从现有事实继续时，才请求用户确认。
4. 写入前核对支持结论的事实及其唯一决定的关系类型、端点和方向。需要跨上下文恢复依据时，只在 task `context` 或 `references` 中保存必要的紧凑事实或稳定 owner 引用，不保存推理过程，也不新增关系理由字段。语义判断由 agent 承担；工具只校验并写入显式关系，不从自然语言自动生成关系、优先级或最佳并行集合。

#### 记录 task 内容与控制

1. 只为能够从用户要求、稳定 owner 或明确工作事实确认的真实目标创建 task，并说明标题和目标。`acceptance` 只在已有明确标准时保存为可选辅助；省略或使用空数组不会阻止排队、领取或完成，也不是自动验收门禁。
2. 尚未选入当前执行的真实任务使用 `candidate`；已经选择执行的任务使用 `queued`；等待外部输入或暂停时保存明确原因。顶层任务不能继承 control，子任务可以继承最近祖先的软控制。

#### 区分三类关系

每类关系独立应用自己的记录门槛：

| 关系 | 记录条件、方向与边界 |
| --- | --- |
| 父子 `parentId` | 只有子任务是父任务目标的真实组成部分，并且父任务应通过子任务完成门禁收敛时，才让子任务的 `parentId` 指向父任务。共享主题、共同引用或便于分组不足以形成父子关系。 |
| 完成依赖 `dependsOn` | 只有结果消费者在前置任务成功产生所需结果前不能正确完成，或其执行本身必须消费该结果时，才让消费者的 `dependsOn` 指向前置任务。偏好的先后顺序或两个任务服务同一交付不足以形成完成依赖。 |
| 并发排斥 `excludes` | 只有已确认执行约束表明两个任务同时运行会不安全、不合法或破坏正确性时，才记录对称 `excludes`。可能接触相同文件、由同一执行者处理或希望串行推进不足以形成并发排斥；它只限制并发，不代替完成依赖。 |

#### 写入与冲突恢复

1. 创建、更新和关系修改都携带最新 expectedRevision；创建相互引用的任务和关系时，使用 `apply` 在同一 revision 下原子写入。
2. Revision 冲突后重新读取相关 task、关系投影和执行约束，再按“判定关系”重新判断。结论仍唯一时使用最新 revision 写入；否则保持不写或请求确认，不盲目重放旧 mutation。

### 3. 查询、选择与领取

1. 每轮调度先读取 `actionable` 投影及其 revision。就绪叶子和待恢复叶子可以 `claim`，满足完成门禁的父任务可以 `complete`。
2. 工具可以返回多个可行动 task 及其排斥边，但不替 agent 或用户选择业务优先级。选择任务后，在开始实际工作前成功执行 `claim`，并保存 lease ID、actor 和到期时间。
3. `claim` 只用于叶子任务并在最新索引上重新验证约束。父任务不领取租约，满足门禁后使用最新 expectedRevision 完成。

### 4. 执行与收敛

1. Lease 持有者负责跟踪到期时间；工作可能越过到期时间时，在有效期内主动 `renew`。
2. 只有 task goal 已经达到时才写入终态。Goal 包含主线集成、发布或外部确认时，自验证和分支提交只是中间交付，不能提前 `complete`。
3. 完成、失败、释放或运行中取消必须使用匹配的当前 lease，并遵守“Task result 与版本锚点”。释放时显式选择下一本地 control；失败任务需要继续工作时先 `retry`，再重新查询和领取。
4. 租约过期后，使用 `task show` 读取最新任务和 revision，再通过 `claim --recover-lease <旧 lease> --expected-revision <最新 revision> --reason <原因>` 原子写入新 lease。恢复三元组缺一不可，活动租约不能提前接管。
5. 有子任务的父任务只有在直接子任务全部成功或取消、至少一个成功且不存在活动或待恢复后代租约时才能完成。该判断不读取任何 `acceptance`；取消父任务会按门禁递归取消未终结后代，并保留已经终结的结果。

### 5. 动态追加、恢复与交接

1. 新任务出现时先读取最新 revision 和相关任务详情，再以普通 create 或原子 `apply` 追加；不要用记忆中的旧拓扑直接写入。
2. 上下文恢复后重新执行 `index info`、`task list` 和 `actionable`。对 `running` 或 `recovery-needed` task 先确认实际执行者和 lease，不能因当前对话不记得它就释放或覆盖。
3. 需要长篇背景、正式设计、跨阶段任务或稳定理由时，把内容交给 `change-plan`、决策记录或对应事实 owner，并在 task 中只保留紧凑引用。
4. 调用方决定实际执行者和执行方式；task graph 只向执行者提供目标、完成提示、约束和 lease 边界，并继续按同一 claim、renew 与收敛规则维护协调状态。

### 6. 清理不再需要的任务

1. 时间经过本身不触发清理。只在显式选择的任务已经成功或取消、结果已经交付且这些任务不再承担协调价值时考虑删除。
2. 使用 `task remove --task <id>... --expected-revision <n> --results-delivered` 原子删除显式批次。所选任务必须全部终态，并且父子、依赖和排斥关系不能跨越所选集合与保留集合；任一 blocker 会使整个批次无变更。
3. 工具不运行后台 GC、不自动选择清理对象，也不复用已分配 ID。`acceptance`、删除成功或工具成功都不表示用户已经验收；真实交付和验证仍按当前任务要求判断。

## 权限与并发边界

1. `queued`、`claim`、lease actor 和 task result 都只是协调事实，不授予文件写入、外部系统调用、不可逆操作、子代理创建、提交或发布权限。
2. 工作区 task index mutation 不自动 stage 或 commit。只有调用方显式执行 `index stage --task ...` 时，工具才按本文件的分段暂存契约替换该索引的 Git pending 内容；它不决定其他文件范围，也不 commit。
3. Native 短事务锁只保护一次工作区 task index mutation；实际工作期间不持有文件锁。该锁位于系统临时目录 `task-graph-locks`，由规范索引绝对路径的 hash 定位并使用操作系统 advisory lock；句柄关闭或进程退出即释放。`index stage` 使用“按 task ID 分段暂存索引”一节定义的独立版本管理 pending 写入锁。两类锁都不在目标工作区创建文件，也不读取、创建或修改项目 `.gitignore`。
4. Exclusion 只禁止同时运行，不建立先后顺序。多个执行者竞争时，以第一个成功 claim 后的权威索引为准。

## 错误恢复

1. 正常结果和可预期失败都从 stdout 返回一个 LF 结尾的协议结果。默认实际 `task list` 与 `index stage` 分别使用固定 success/failure 文本；其他 command、help、version 和全局参数 failure 默认使用 JSON envelope。需要机械读取 `ok`、`error.code`、`retryable`、revision 和结构化 details 时显式使用合法 `--json`，不要从 message 文本推断协议。
2. Revision 冲突或领取竞争后重新查询；只有错误明确可重试且当前事实仍支持原意时才重试。
3. 工作区索引 mutation 返回 `WRITE_OUTCOME_UNKNOWN` 时，写入可能已经越过原子提交点。先调用 `index info` 并读取目标任务，确认工作区 revision 与结果后再决定下一步，绝不盲目重放。
4. `index stage` 返回 `WRITE_OUTCOME_UNKNOWN` 时，未知对象是 Git pending 中的索引路径，`index info` 只能读取工作区，不能用于判断待提交快照。停止继续暂存，读取并对账该 pending 路径与 HEAD 基线、本次目标；无法唯一确认或恢复时交给该 pending 范围的 owner，不重试也不绕过现有内容。
5. Node/runtime 不支持、native 锁获取、索引读取、Schema 或完整图校验失败时停止写入，保留诊断并交给对应维护者处理；不得绕过工具直接修 JSON。

## 完成标准

1. 当前任务图可以从权威索引恢复；task、真实父子、依赖和排斥只包含已经确认的事实。
2. 每项实际执行都在成功 claim 后进行，并以匹配 lease 完成、失败、释放或取消；终态 result 与版本锚点符合本文件的独立契约，task goal 没有在中间交付阶段被提前完成。过期执行只通过恢复 claim 接管，父任务按完成门禁收敛。
3. 工作区 revision 冲突、工作区未知写入结果或 pending 未知恢复结果没有被盲目重试，活动与待恢复执行没有被静默覆盖。
4. 权限判断、执行者选择、持久 change 和长期知识仍由各自 owner 承接，没有被 task graph 状态替代。
5. 工作区索引 mutation runtime 已通过当前平台探针；不再需要的终态任务只有在结果交付、关系闭合并获得显式清理确认后才删除，其余任务可以继续保留。
6. 默认 `task list` 的 track、dependency layer、folding 与独立 run mutex 没有改变持久拓扑或调度语义；需要完整机器语义的调用方使用同一 raw projection 或显式 `--json`，不从显示布局反推领域状态。
7. 分段暂存目标使用候选索引的根级水位、选中候选 task 与未选中基线 task，并通过完整校验；工作区、索引外 pending 和另一批 task 的 pending 变化没有被覆盖。
