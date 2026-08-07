# Design

本设计以 raw result object 为单一语义输入，由通用 JSON serializer 和 task-list renderer 两个并列输出函数分别提供完整序列化与低冗余分层视图。

## Context

### 文档用途

后续实现或审阅 agent 应能只读取本 change 的 proposal、design、tasks 及其中直接引用的 owner，恢复输出架构、list projection、track/layer 语义、信息取舍、mutex 表达、兼容边界、改动 owner 和验证出口；对话中的预览与解释不属于实施前置。

### 当前事实

- [`TaskGraphService.listTasks`](../../tools/task-graph/src/service.ts) 当前返回按 task ID 排序的 `Record<string, TaskSummary>`；每项只有 ID、title、parent、execution phase、effective state 和 next action，不能恢复 dependency 或 exclusion。
- [`runTaskGraphCli`](../../tools/task-graph/src/cli.ts) 当前让所有协议内结果经过 `writeResult`，执行 `JSON.stringify(result)` 并追加 LF；现有全局参数没有 `--json`。
- [`Task Graph`](../../skills/task-graph/SKILL.md) 规定 exclusion 对称且只禁止同时运行，不建立完成顺序。候选 task 可以同时存在；一方处于 `running` 或 `recovery-needed` 时，另一方的 claim 才受到实际阻塞。
- Parent 是结构与完成门禁；dependency 是有向无环执行约束。两者都影响 task 是否属于同一推进上下文，但只有 dependency 决定拓扑 layer。
- 当前行为 owner 把 CLI 定义为 JSON-only。JSON 是 raw result object 的通用序列化，并没有单独承接 list 的可读性、信息优先级或冗余控制。

### 已确认目标

- `task list` 默认使用自定义分层 DAG renderer。
- `--json` 直接序列化同一 raw result object；JSON 不是 renderer 的输入，也不是另一套语义模型。
- 第一版列出索引中的全部 task，不增加过滤或分页。
- 其他 command 暂不新增 renderer，并继续使用 JSON serializer 作为默认回退。

### 稳定术语

- **Raw result object**：service/dispatch 产生的内存 `TaskGraphResult`；它是 serializer 与 renderer 的共同输入。
- **List projection**：`task list` raw result 的 `data`，以 task ID 字典保存 renderer 和程序化调用共同需要的语义字段。
- **JSON serializer**：对 raw result object 执行 `JSON.stringify` 并追加 LF 的通用输出函数。
- **Task-list renderer**：只消费 raw result object 与显式 render context，并为 `task list` 选择、分组、去重和排列信息的纯函数。
- **推进线（track）**：在 parent/child 与有效 dependency 的无向闭包上形成的 weakly connected component。Track 不表示其中或彼此之间必然可以并行。
- **Dependency layer**：只由有效 dependency DAG 计算的 `L<n>`；dependency endpoint 位于被其阻塞 task 的更低 layer。
- **Run mutex pair**：由 effective exclusion 形成的无向 task pair，只表示两个 endpoint 不能同时运行。
- **Active mutex blocker**：run mutex pair 的一方处于 `running` 或 `recovery-needed`，从而实际阻止另一方 claim 的当前 blocker。

## Goals / Non-Goals

目标：

- 默认 `task list` 能直接呈现推进线、dependency layer、parent、状态、next action 和运行互斥。
- Renderer 通过摘要、分组、稳定字段顺序和重复关系折叠降低阅读与上下文恢复成本。
- List projection 是图语义的唯一来源；renderer 不重新读取索引、不解析 JSON 文本，也不复制状态推导规则。
- 需要完整 raw serialization 的调用方能够显式选择 `--json`，并延续当前 JSON envelope 与进程协议。
- 任意 Unicode title 不决定连接线、右侧字段或后续 node 的位置。

非目标：

- 不把 CLI 划分为两套面向不同读者的语义模式。
- 不把 track 数宣称为当前可并行数；exclusion 和 execution state 必须另行参与判断。
- 不改变 task graph 的持久数据、调度、继承或事务模型。
- 不为所有 command 建立 renderer registry 的外部扩展 API。
- 不在终端复刻通用图可视化；第一版优先确定性、低冗余和可测试性。

## Decisions

### 1. Raw result object 先于全部输出函数

Service/dispatch 继续返回结构化 `TaskGraphResult`，不返回预格式化文本。CLI 输出阶段接收 command path、全局 format 选择、raw result object 和可注入 render context，再按以下优先级选择输出函数：

1. 指定 `--json`：调用 JSON serializer，自定义 renderer 不执行。
2. 未指定 `--json` 且 command path 为 `task list`：调用 task-list renderer。
3. 未指定 `--json` 且 command 没有 renderer：调用 JSON serializer 作为默认回退。
4. CLI 尚未构造 raw result object 就发生启动级故障：保持当前 stderr 与退出码 `2` 行为。

`--json` 是可位于 command 前后的全局无值布尔参数，不可重复。JSON serializer 固定为 `JSON.stringify(result) + "\n"`，不增加 pretty、颜色、日志或 renderer 派生字段。

Task-list renderer 是纯函数。它可以重排、分组、摘要和删除显示层重复，但不能发明 raw result object 中不存在的状态；渲染失败不得静默回退为 JSON 并伪装成成功的默认输出。两个输出函数都只向 stdout 写入一个以单个 LF 结尾的结果，不混入日志或进度文本。

### 2. List projection 保存完整语义，不保存布局

`TaskGraphService.listTasks()` 继续返回以 task ID 为 key 的字典，并把当前 `TaskSummary` 扩展为明确命名的 list item 类型。每个 item 保留：

- `taskId`、`title`、`parentId`、`phase`、`effectiveState` 和 `nextAction`；
- 有效 dependencies 与 exclusions，包括声明来源和继承路径；
- `children`、`dependents` 与完整 blockers。

List projection 不保存 `T01`、`L0`、缩进、换行、终端宽度、摘要计数或预格式化文本。这些值由 renderer 临时派生，不能成为第二份领域状态。

### 3. Track 与 layer 使用不同关系

Renderer 用 parent/child 与有效 dependency 的无向闭包计算 track。Exclusion 不参与 track 计算，否则并发约束会把原本不同的推进线合并。

每个 track 内按有效 dependency DAG 计算 layer：

1. 没有有效 dependency 的 task 位于 `L0`。
2. 其他 task 位于其全部 dependency 最大 layer 加一。
3. Dependency 的方向在文本中表达为当前 task `needs:[dependency-id]`；视觉顺序不单独承担方向语义。
4. Parent 不改变 dependency layer，只影响 track 归属和 parent 表达。

Track 按成员中的最小 task ID 排序，并按一基索引编号为 `T${String(index).padStart(2, "0")}`，例如 `T01`、`T02`、`T100`。编号只是 renderer 内定位符，不进入 list projection 或持久身份。Track 内先按 layer 排序；同层的 parent path 使用从顶层祖先到 direct parent 的 task ID 序列做字典序比较，空 path 在前，最后以当前 task ID 打破平局。每个 task 只出现一次。

### 4. 信息层次与字段取舍是 renderer 的显式契约

Renderer 按以下层次输出；每层只承接会改变该层判断的信息：

| 输出层次 | 默认内容 | 冗余控制 |
| --- | --- | --- |
| 全局摘要 | `tasks`、`tracks`、`actionable`、`running`、`recovery-needed`、`mutex-blocked` task 数 | 不重复静态 pair 数或可从 track/node 直接计数的明细 |
| Track 标题 | 本次输出的 `T<n>` 与该 track 的 task 数 | 不把存在 exclusion 的 track 标成整体冲突或不可并行 |
| Node 主行 | layer、task ID、effective state、title | Title 始终位于最后，不在其后补齐字段 |
| Node 关系字段 | direct parent、effective dependency endpoints、非空 next action、会补充因果信息的 blockers | Children、dependents、完整继承路径和对称反向关系不逐 node 重复 |
| `RUN MUTEX` | 全部规范化 effective exclusion pairs | 每个无向 pair 只表达一次，并按共同 endpoint 分组 |

标准 node 使用以下固定字段顺序；方括号中的字段按条件省略：

```text
[indent] L<n> [task-id] <effective-state> [parent:[id]] [needs:[ids]] [blocked-by:<summary>] [mutex:[ids]] [next:<action>] <title>
```

Parent indentation 只用于扫描，`parent:[id]` 才是权威关系表达。`blocked-by` 只显示 effective state 本身不能说明的因果信息：每项使用 `<kind>@<related-task-id>`，没有外部 related task 时只显示 kind，并按 kind、related task ID 排序。已经由 state、`needs` 或行内 `mutex` 完整表达的信息不重复输出。`next` 只在 `nextAction` 非空时显示。

### 5. Run mutex 与 DAG 分区表达

Renderer 把每条 effective exclusion 规范化为 `(minTaskId, maxTaskId)`，再对继承展开和对称投影产生的重复 pair 去重。存在 pair 时，在全部 track 后输出 `RUN MUTEX`。

默认按左 endpoint 分组以减少重复，例如：

```text
RUN MUTEX - cannot run at the same time

T01 [task-000016] mutex T02 [task-000020], T03 [task-000021]
T01 [task-000018] mutex T02 [task-000020]
```

同一行的每个右 endpoint 都只与左 endpoint 形成独立 pair；右 endpoints 之间不因此建立关系。精确 task ID 是关系身份，`T<n>` 只帮助定位 track。

Static pair 只表示潜在并发约束。只有 blocker 表明对端正在 `running` 或 `recovery-needed` 时，受阻 task 的 node 才显示 `mutex:[task-id]`，并计入摘要中的 `mutex-blocked` task 数。完整 relation source 和 inheritance path 只保留在 list projection。

### 6. 布局只依赖显式 render context

Renderer 从注入的 `columns` 选择两个固定布局：

- `columns >= 80`：标准布局；node 字段按固定顺序位于同一主行，endpoint 集合超过三个时转入固定缩进 continuation line。
- `columns < 80`：窄布局；node 主行只保留 layer、ID 和 state，title 与每类 relation 分别进入固定缩进 continuation line。
- TTY 使用 stdout columns；缺失 columns 的非 TTY 使用规范值 `80`。

档位只由 `columns` 决定，不由 title 内容或 Unicode cell width 决定。两种布局都不使用包围 title 的方框、跨 title 连线、box drawing、ANSI 颜色或 Unicode padding。相同 raw result object 与 render context 必须产生逐字节相同输出。

### 7. 协议失败也使用同一输出选择

`task list` 已进入协议的 failure 在默认模式下由 task-list renderer 输出：主行包含 `error.code`、`message`、`revision` 和 `retryable`；非空 details 按 key 字典序进入 continuation line，每项使用 `key=<JSON.stringify(value)>`。使用 `--json` 时仍序列化完整 failure object。

这一规则不改变错误码、revision 恢复、stdout/stderr 分工或退出码。其他 command 的 failure 在本 change 中仍使用 JSON serializer。

### 8. Public 兼容与 owner 同步

默认 `task list` 从通用 JSON serialization 改为 task-list renderer 输出，是有意的 public CLI 变化。需要 raw result serialization 的调用方必须增加 `--json`，不能依赖 TTY 自动猜测。兼容边界如下：

- `--json` 的 envelope、revision、错误码、retryable、stdout/stderr、退出码和单 LF 规则保持不变。
- List item 保留全部既有字段；新增关系和 blocker 字段是满足 renderer 与程序化恢复所需的结构化扩展。
- JSON serialization 不包含 track 编号、layer、摘要折叠、字符布局或其他 renderer 派生值。
- 其他 command 即使不写 `--json` 也保持当前 JSON 默认输出。

实现必须更新 task-graph skill 中的 JSON-only 说明、面向使用者的介绍和 help。长期判断按可独立演进边界分别评估“raw result object 与并列输出函数”和“默认 task-list renderer 输出”，不让 change plan 替代决策 owner。

代码只修改 `tools/task-graph/` 的维护源码；公开声明和 `skills/task-graph/scripts/` 由既有构建入口生成。Skill 分发内容变化时提升独立版本。新增或修改的每个最小 `test()` 入口按 test-evidence owner 维护单独 case 并同步派生索引。

## Risks / Trade-offs

- Track 只说明 task 在 parent/dependency 图上相连，不证明 track 之间当前可并行。稳定术语、独立 mutex 区和 `mutex-blocked` 摘要限制这一误读。
- 既有调用若继续使用无参数 `task list` 会得到 task-list renderer 输出。`--json` 提供明确的 raw serialization 出口，但默认变化仍是 public contract change。
- List projection 增加关系与 blocker 后，JSON serialization 体积会扩大。该代价换取 serializer、renderer 与程序化调用共享一个完整语义源。
- 密集 exclusion 仍可能形成较长区段。Endpoint 分组、对称去重、固定 continuation 和 DAG 分区保证主图不被交叉线污染；第一版不通过截断隐藏调度事实。
- 不使用颜色和连接字符降低了装饰性，但让输出在普通终端、日志、复制粘贴和无颜色环境中保持相同语义。
- 标准与窄布局会产生不同文本。显式两档、可注入 columns、80 列非 TTY 回退和双档快照测试限制差异。

## Open Questions

无。Raw result/output-function 边界、list projection、track/layer、信息取舍、mutex、失败呈现、宽度回退、兼容出口和第一版非目标均已固定。
