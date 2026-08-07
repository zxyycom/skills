---
name: task-graph
description: >-
  维护当前工作中短期、可恢复的非线性任务图。用于同时存在多个候选任务、
  动态追加、真实父子分解、依赖、并发排斥或跨上下文恢复时，通过权威 JSON
  索引查询、选择、领取并收敛任务；少量固定顺序步骤继续使用当前对话计划。
compatibility: "Requires Node.js ^22.22.2 || ^24.15.0 || >=26.0.0; mutations require a caller-provisioned compatible native runtime."
metadata:
  version: "3"
---

# Task Graph

## 目标

把当前工作中短命但会影响调度的 task、父子结构、依赖、排斥和执行归属保存为可查询、可恢复的权威事实，使 agent 不必在上下文中重新推演任务拓扑，也不会把短期协调状态扩张为长期项目计划。

## 使用条件

以下情况使用：

1. 用户明确要求创建、维护、恢复或执行 task graph。
2. 当前工作同时存在多个短期任务，并涉及候选集合、动态追加、真实父子分解、非线性依赖、并发排斥或跨上下文恢复。

以下情况不使用：

1. 只有少量按固定顺序执行的步骤；此时继续使用当前对话计划。
2. 需要长期审阅、正式设计或跨阶段交接的明确 change；此时使用 `change-plan`。
3. 需要创建、配置或审计代理；task graph 只交付已就绪任务的协调事实，代理编排由 `subagent-orchestration` 承接。
4. 个人长期 TODO、项目排期、通知或跨项目任务管理。

## 内容 owner 与工具

1. 本文件承接触发、任务记录判断、调度流程、权限边界、恢复和交接。
2. `scripts/task-graph.mjs` 是 JSON-only 管理入口；它负责 runtime 探测与安装指引、索引校验、关系、状态事务、租约和 scope 清理。模块可以安全导入，只有作为主模块运行时进入 CLI。
3. `scripts/task-graph.d.mts` 提供公开 TypeScript 声明；[task index Schema](references/task-graph-index.schema.json) 提供权威索引的机器结构。精确命令、参数、结果和错误以 CLI 的 JSON help、公开声明及 Schema 为准；调用具体命令前先用 `help` 或 `help <command-path>` 恢复当前契约，不凭记忆猜测参数。
4. 目标仓库的 `docs/task-graph/task-graph-index.json` 是当前短期任务状态的唯一权威索引，只能通过工具修改；系统临时目录中的空锁文件与索引目录内的原子写临时文件都不是事实源。
5. 稳定需求、长篇背景、设计理由、测试证据和最终结果继续由项目已有 owner 承接。Task entry 只保存执行所需摘要和引用。

## 对象模型

1. Scope 是一次短期协调边界，使用稳定 ID、可读 key 和宿主 binding 定位；一个 scope 可以包含多个顶层真实任务。
2. Task entry 把 `content` 与 `state` 分开：`content` 保存目标、验收、紧凑上下文、引用和结果；`state.control` 保存候选、排队、等待或暂停意图；`state.execution` 保存尝试、租约和终结结果；`state.relations` 保存父任务、依赖和排斥。
3. 可行动性、有效控制、阻塞原因、继承关系和待恢复状态由查询投影从权威索引计算，不作为第二份状态写回 task entry。

## 工作流程

### 0. 仅为 mutation 准备 runtime

1. 使用满足 `^22.22.2 || ^24.15.0 || >=26.0.0` 的 Node.js 运行 CLI；Bun 只用于本 skill 源仓库的构建和测试，不是分发 CLI 的受支持执行器。Help、version、runtime 查询和 task graph 只读查询不需要准备 native runtime。
2. 在本次上下文第一次 mutation 前调用 `runtime info`，读取确定性的 runtime ID、目录和状态。默认 tool home 是 `~/.tools/task-graph`；非空 `TASK_GRAPH_TOOL_HOME` 完整覆盖该目录。
3. 按 `runtime info` 的状态继续：
   - `compatible`：可以开始 mutation。
   - `missing`：取得用户对 npm 联网和 tool home 写入的明确授权后，将返回的 `installCommand.command` 作为可执行命令、完整 `installCommand.args` 作为参数原样调用，再重新调用 `runtime info`。不得自行改写包版本、prefix 或参数。
   - `incompatible`：停止 mutation，报告工具返回的精确目录和 `reason`；工具不会覆盖、修复或删除既有目录，需要修复时先取得对应文件操作授权。
4. 只有 `runtime info` 返回 `compatible: true` 才开始 mutation。该命令只验证固定直接包版本、锁 API 和当前平台真实探针，不联网、不创建持久文件；普通查询、mutation、模块导入和 updater 都不会静默安装或联网。

### 1. 恢复索引与 scope

1. 让 shell 当前目录位于目标仓库根目录，并从本 skill 的实际安装路径调用 `scripts/task-graph.mjs`。相对 `--root` 和默认索引路径按目标工作区解析，不按 skill 安装目录解析。
2. 先调用 `index info`，读取 revision、`valid`、`canonical` 和 diagnostics；只有 `valid: true` 且 `canonical: true` 才继续。收到 `INDEX_NOT_FOUND` 时，在已经满足 mutation runtime 前置后调用 `index init`，再重新调用 `index info`。其他读取、Schema 或规范化失败必须停止，不能手写、覆盖或隐式迁移索引。
3. 按用户或宿主提供的定位信息恢复开放 scope：显式 scope ID 使用 `scope show`；scope key 或 binding 使用 `scope list` 的对应过滤参数。只有零项匹配时才创建；多项匹配、唯一性冲突或信息不足时保持只读并暴露缺口。

### 2. 记录任务与关系

1. 只写入能够从用户要求、稳定 owner 或明确工作事实确认的任务和关系；工具不会从自然语言自动补全依赖、排斥、优先级或最佳并行集合。
2. 尚未选入当前执行的真实任务使用 `candidate`；已经选择执行的任务使用 `queued`；等待外部输入或暂停时保存明确原因。顶层任务不能继承 control，子任务可以继承最近祖先的软控制。
3. 每个 task 都表示真实目标。需要分解时创建真实子任务，不创建 group、work 或虚拟 root；父任务通过子任务完成门禁收敛。
4. 只有确认完成顺序时才记录 dependency，只有确认不能同时运行时才记录 exclusion。使用批量 `apply` 在一个 expectedRevision 下原子创建相互引用的任务和关系。
5. 任务新增、内容或 control 更新以及关系修改都携带最新 expectedRevision。冲突后重新读取完整相关视图并重新判断，不盲目重放旧 mutation。

### 3. 查询、选择与领取

1. 每轮调度先读取 actionable 投影及其 revision，并按需读取 task trace。`actionable` 只表示当前存在合法下一动作：就绪叶子任务和待恢复叶子任务可以 `claim`，已满足门禁的父任务可以 `complete`。
2. 工具可以返回多个可行动 task 及其排斥边，但不替 agent 或用户选择业务优先级。选择具体 task 后，在开始实际工作前成功执行 `claim`，并保存返回的 lease ID、actor 和到期时间。
3. `claim` 只用于叶子任务并在最新索引上重新验证约束；不要用旧 revision 推断领取仍然成立。父任务不领取租约，满足门禁后使用最新 expectedRevision 完成。

### 4. 执行与收敛

1. 执行期间由 lease 持有者跟踪到期时间；工作可能越过到期时间时，在有效期内主动 `renew`。
2. 完成、失败、释放或运行中取消必须使用匹配的当前 lease。释放时显式选择下一本地 control；失败后需要继续工作时先 `retry`，再重新查询和领取。
3. 租约过期后不要继续普通 lease 操作。读取当前 task、trace 和最新 revision，再用 `claim --recover-lease <旧 lease> --expected-revision <最新 revision> --reason <原因>` 原子写入新 lease。恢复三元组缺一不可，旧 lease 必须匹配；活动租约不能被该入口提前接管。
4. 有子任务的父任务只有在直接子任务全部成功或取消、至少一个成功且不存在活动或待恢复后代租约时才能完成。取消父任务会按工具门禁递归取消未终结后代，并保留已经终结的结果。

### 5. 动态追加、恢复与交接

1. 新任务出现时先读取最新 scope、revision 和相关 trace，再以普通 create 或原子 `apply` 追加；不要用记忆中的旧拓扑直接写入。
2. 上下文恢复后重新执行 `index info`、scope 定位和 actionable 查询。对 `running` 或 `recovery-needed` task 先确认实际执行者和 lease 状态，不能因当前对话不记得它就释放或覆盖。
3. 需要长篇背景、正式设计、跨阶段任务或稳定理由时，把内容交给 `change-plan`、决策记录或对应事实 owner，并在 task 中只保留紧凑引用。
4. 需要创建或审计代理时，把已就绪 task 的目标、验收、约束和 lease 边界交给 `subagent-orchestration`。没有该 skill 或当前环境不能创建代理时，在当前 agent 中按同一 claim 与 lease 规则顺序执行，不改变任务图语义。

### 6. 关闭 scope

1. 在关闭前确认全部顶层任务已经成功或取消，scope 中没有失败、活动租约或待恢复租约，并把需要长期保留的结果交付给用户或稳定 owner。
2. `scope list` 的每项 `close` 投影给出门禁和 blocker。只有调用方明确确认结果已经交付后，才用 `scope close --scope <id>... --expected-revision <n> --results-delivered` 原子关闭显式选择的一个或多个 scope。工具不删除单个 task，也不运行后台或按时间静默清理。
3. Scope 删除、task checkbox 或工具成功不表示用户已经验收；按当前任务的真实交付和验证标准单独确认完成。

## 权限与并发边界

1. `queued`、`claim`、lease actor 和 task result 都只是协调事实，不授予文件写入、外部系统调用、不可逆操作、子代理创建、提交或发布权限。
2. 工具只维护 task index，不自动 stage、commit 或决定索引是否进入某次提交。
3. 短事务锁只保护一次索引 mutation；实际任务执行期间不持有文件锁。锁位于系统临时目录 `task-graph-locks` 下，由规范索引绝对路径的 hash 定位，并使用操作系统 advisory lock；句柄关闭或进程退出即释放，不需要 owner、heartbeat、stale 判定或手工删除恢复。工具不在目标工作区创建锁，也不读取、创建或修改项目 `.gitignore`。
4. Exclusion 只禁止同时运行，不建立先后顺序。多个执行者竞争时，以第一个成功 claim 后的权威索引为准。

## 错误恢复

1. 正常结果和可预期失败都从 stdout 返回一个 LF 结尾 JSON envelope；读取 `ok`、`error.code`、`retryable`、revision 和结构化 details，不从 message 文本推断协议。
2. Revision 冲突或领取竞争后重新查询；只有错误明确可重试且当前事实仍支持原意时才重试。
3. 收到 `WRITE_OUTCOME_UNKNOWN` 时，mutation 可能已经越过原子提交点。先调用 `index info` 并读取目标实体，确认 revision 与结果后再决定下一步，绝不盲目重放。
4. Node/runtime 不支持、native 锁获取、索引读取、schema 或完整图校验失败时停止写入，保留诊断并交给对应维护者处理；不得绕过工具直接修 JSON。

## 完成标准

1. 当前 scope 可以从权威索引唯一恢复，task、真实父子、依赖和排斥只包含已经确认的事实。
2. 每项实际执行都在成功 claim 后进行，并以匹配 lease 完成、失败、释放或取消；过期执行只通过带恢复三元组的新 claim 接管，父任务按完成门禁收敛。
3. Revision 或未知写入结果没有被盲目重试，活动与待恢复执行没有被静默覆盖。
4. 权限判断、代理编排、持久 change 和长期事实仍由各自 owner 承接，没有被 task graph 状态替代。
5. Mutation 使用的 runtime 已通过当前平台真实探针；需要保留的结果已经交付，满足门禁并获得明确确认时，scope 已关闭或保留理由已经说明。
