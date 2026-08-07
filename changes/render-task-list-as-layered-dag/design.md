# Design

本设计让 JSON serializer 和 task-list renderer 并列消费同一个 raw result object；projection 保存完整领域语义，renderer 只派生显示结构。

## Context

### 当前 owner 事实

- [`TaskGraphService.listTasks`](../../tools/task-graph/src/service.ts) 当前返回按 task ID 排序的 `Record<string, TaskSummary>`。每项只有 `taskId`、`title`、`parentId`、`phase`、`effectiveState` 和 `nextAction`，不能恢复 effective control reason、dependency 或 exclusion。
- [`TaskProjection`](../../tools/task-graph/src/types.ts) 已拥有 `effectiveControl`、完整 blockers、effective dependencies/exclusions、children、dependents 和 `nextAction`；这些字段由图投影统一推导。
- [`runTaskGraphCli`](../../tools/task-graph/src/cli.ts) 当前让全部协议内结果经过 `JSON.stringify(result) + LF`；现有全局参数没有 `--json`。
- [`Task Graph`](../../skills/task-graph/SKILL.md) 规定 exclusion 对称且只禁止同时运行，不建立完成顺序。只有对端处于 `running` 或 `recovery-needed` 并形成 `exclusion-running` blocker 时，当前 task 的 claim 才实际受阻。
- Parent 是结构与完成门禁；dependency 是有向无环执行约束。两者都连接推进上下文，只有 dependency 决定 layer。

### 实施协调约束

本 change 修改 task-graph 自身的参数解析、输出路由和生成产物，因此待集成 CLI 不能同时承担中央 task graph 协调。实施期间，中央 queue、claim、renew 和 complete 继续使用当前稳定分发 CLI 及 compatible runtime；待集成 CLI 只操作隔离 fixture 或临时 root。

协调入口只在改动集成到中央 checkout，并从该入口确认 runtime compatible、无生成漂移、默认 `task list` 与 `task list --json` 的只读 smoke check 全部通过后切换。此前的本地测试、生成结果或版本号变化都不构成切换依据。

### 稳定术语

- **Raw result object**：service/dispatch 产生的内存 `TaskGraphResult`；serializer 与 renderer 都直接消费它。
- **List projection**：`task list` success result 的 `data`，类型为 `Record<string, TaskListItem>`。
- **实际 task ID**：`TaskListItem.taskId` 原值，例如 `task-000016`；node、关系和排序均直接使用该值。
- **全量 list view**：同一次输出包含索引中的全部 task，因此每个 parent、dependency 和 exclusion endpoint 都对应输出中的真实 node。
- **Track**：由 parent 与 effective dependency 连接形成的 weakly connected component；track 只表达推进上下文，不表示可并行性。
- **Dependency layer**：仅由 effective dependency DAG 推导的 `L<n>`。
- **Run mutex pair**：由 effective exclusion 形成的无向 task pair，只表达两个 endpoint 不能同时运行。
- **Active mutex blocker**：projection 中 kind 为 `exclusion-running` 的 blocker；其 related task 正处于 `running` 或 `recovery-needed`。

## Goals / Non-Goals

目标：

- 默认 `task list` 直接表达 track、dependency layer、parent、effective state、control reason、next action 和 run mutex。
- Raw result object 是完整语义的单一来源；renderer 不读取 index、不解析 JSON 文本，也不重新推导领域状态。
- 显示投影通过稳定排序和显式 folding 降低冗余，同时让被折叠信息仍可由程序化 `listTasks()` 或 `--json` 恢复。
- 相同 raw result 与 render context 产生逐字节相同的文本，不依赖 title 的 Unicode 显示宽度。

非目标：

- 不改变持久数据、约束继承、调度、事务或错误码语义。
- 不把 track 数解释为可并行数，也不把 exclusion 解释成 dependency。
- 不为所有 command 建立 renderer registry 或新增公开 renderer 扩展 API。
- 本 change 只提供全量静态文本视图，不承担过滤、分页、自动收缩或交互。

## Decisions

### 1. 输出路由由已识别的操作决定

Service/dispatch 继续返回结构化 `TaskGraphResult`。CLI 在协议结果写入 stdout 前按以下优先级选择输出函数：

1. 全局参数解析失败：构造 JSON failure envelope 并使用 JSON serializer。
2. 全局参数合法且包含 `--json`：全部 success/failure、help 和 version 使用 JSON serializer。
3. 未指定 `--json`，且 router 已识别为实际执行 `task list`：success 和 command-local failure 使用 task-list renderer。
4. 未指定 `--json` 的 help、version、其他 command 或尚未识别为 `task list` 的 command failure：使用 JSON serializer。
5. 尚未构造协议内 result 就发生未处理 fault：保持 stderr 和退出码 `2`，不伪造 envelope。

`task list --help` 属于 help 路由，默认使用 JSON serializer；router 已识别 `task list` 后发生的非法 list option 或 arity failure 属于 task-list 路由。实现应传递明确的 route kind，不能只根据 argv 前缀或 raw data shape 猜测 renderer。

`--json` 的合法语法只有一个独立、无值、最多出现一次的全局 token；它可以位于 command 前后。其他拼写和重复出现沿用全局参数错误契约，不新增变体语义。JSON serializer 固定执行 `JSON.stringify(result) + "\n"`，不增加 pretty、颜色、日志或 renderer 派生字段。

Task-list renderer 是内部纯函数。渲染异常向上抛出，不静默回退为 JSON；renderer 与 serializer 都只产生一个以单个 LF 结尾的 stdout 结果。

### 2. `TaskListItem` 复用 `TaskProjection` 语义

公开 list item type 直接替换 `TaskSummary`：

```ts
export type TaskListItem = TaskProjection & {
  title: string;
  parentId: string | null;
  phase: TaskExecutionPhase;
};
```

`TaskGraphService.listTasks()` 返回 `ServiceResult<Record<string, TaskListItem>>`。字典 key 必须等于 item 的 `taskId`；service 按实际 task ID 顺序构造字典，renderer 仍自行排序而不依赖 object insertion order。`TaskSummary` 不保留 alias。

`TaskProjection` 继续拥有 effective state/control、完整 blockers、effective dependency/exclusion source、children、dependents 和 next action；`TaskListItem` 只增加 list 所需的 title、direct parent 和 execution phase。这样 list projection 直接复用图 owner 的状态与约束推导，不复制算法。

List projection 不保存 track label、layer、缩进、render columns、摘要计数、folded blocker token 或预格式化文本。这些值只存在于 renderer 的临时 layout。完整 relation source 和 inheritance path 保留在 raw result 与 `--json` 中。

### 3. Track、layer 和排序分别使用明确关系

Renderer 先把 raw relation source 按 `targetTaskId` 折叠为显示 endpoint set；source 与 inheritance path 仍保留在 raw projection。

对 `data` 中的全部 task 建图：

1. Track graph 的 vertex 是全部实际 task ID。
2. 每个非空 `parentId` 在 parent 与 child 间增加无向 track edge。
3. 每个 `dependencies[].targetTaskId` 在 dependency 与当前 task 间增加无向 track edge。
4. Exclusion 不进入 track graph。
5. Track 是该无向图的 connected component；孤立 task 自成一个 track。

每个 task 的 layer 只使用 effective dependency endpoint：没有 dependency 的 task 为 `L0`；其余 task 的 layer 为全部 dependency layer 的最大值加一。Parent 不改变 layer。`needs:[...]` 显式表达当前 task 指向其 dependency 的方向。

Track 按成员中的最小实际 task ID 排序，并从 `T01` 开始编号；编号至少两位，不设两位上限。Track label 只用于本次输出导航，不进入 projection 或持久身份。Track 内按 layer、parent path、当前实际 task ID 依次排序；parent path 是从顶层祖先到 direct parent 的实际 task ID 序列，空 path 在前。每个 task 恰好渲染一次。

Renderer 始终以全部 `data` 为 vertex set，不进行筛选或收缩；有效 parent、dependency 和 exclusion endpoint 因此都必须定位到真实 task 与 track，不生成 `outside-view` 节点。

### 4. 显示投影只折叠可由同一视图恢复的信息

Node 字段按下表从 `TaskListItem` 派生：

| Raw 字段 | 显示 token | 显示条件与 folding |
| --- | --- | --- |
| `taskId` | `[<task-id>]` | 始终显示实际 task ID |
| `effectiveState` | `<state>` | 始终显示；不发明 `blocked` 等新状态 |
| `parentId` | `parent:[<task-id>]` | direct parent 非空时显示 |
| `dependencies[].targetTaskId` | `needs:[<id-list>]` | endpoint 去重后非空时显示 |
| 选定 blockers | `blocked-by:[<blocker-list>]` | folding 后非空时显示 |
| `exclusion-running` blockers | `mutex:[<id-list>]` | related task ID 去重后非空时显示 |
| `effectiveControl.reason` | `reason:<json-string>` | reason 非 `null` 时显示 |
| `nextAction` | `next:<action>` | action 非 `null` 时显示 |
| `title` | inline title 或 `title:<title>` | 始终显示，且是 node 最后一个字段 |

`blocked-by` 只保留会补充终态或层级因果的 kind：`dependency-failed`、`dependency-cancelled`、`ancestor-terminal`、`all-children-cancelled`、`descendant-lease`。每项写成 `<kind>@<related-task-id>`，按 kind、related task ID 排序并去重。

其余 blocker 按已有可见信息折叠：

- `dependency-incomplete` 由 `needs` 和全量视图中的 dependency node state 表达。
- `child-incomplete` 由 child 的 `parent` token 和 node state 表达。
- `exclusion-running` 转为 `mutex`。
- `control-candidate`、`control-waiting`、`control-paused` 由 effective state 表达；非空原因由 `reason` 表达。

Children、dependents、relation source、inheritance path 和未显示的完整 blockers 不在 node 重复展开，但始终保留在 raw projection。

### 5. Render context 只选择固定 form

内部 render context 为 `{ columns }`，其中 `columns` 是正整数。CLI 按以下顺序得到规范值：

1. 测试或内部调用显式注入的有效值；
2. TTY stdout 的有效 `columns`；
3. 规范回退值 `80`。

Node 在 `columns >= 80` 且 folding、排序和去重后的 `needs`、`blocked-by`、`mutex` 各不超过三个 item 时使用 inline form；否则使用 block form。Run mutex group 在 `columns >= 80` 且右 endpoints 不超过三个时使用 inline form；否则使用 block form。

`columns` 不承诺硬性行宽。Title、reason、task ID 或 token 的字符数和 Unicode cell width 不参与 form 选择，也不触发自动换行、截断、隐藏或重新分配 task。输出只使用 ASCII space 缩进，不使用 ANSI、box drawing 或 Unicode padding。

### 6. Success renderer 使用固定文本契约

以下 notation 适用于本节：

- `<task-id>` 是实际 `TaskListItem.taskId`。
- `<n>` 和 `<layer>` 是非负十进制整数；`<state>`、`<action>` 和 `<title>` 分别是 item 的 `effectiveState`、非空 `nextAction` 和单行 title 原值。
- `<id-list>` 是去重后的实际 task ID 按字典序排序，再用 `,` 连接；逗号后没有空格。
- `<blocker-list>` 是排序后的 `<kind>@<related-task-id>`，同样用 `,` 连接。
- `<json-string>` 是对 string 执行 `JSON.stringify` 的结果，包含 JSON 引号和 escaping。
- `<json-value>` 是对任意 `JsonValue` 执行 `JSON.stringify` 的结果。
- `<indent>` 是 direct parent depth 乘两个 ASCII space。
- Angle-bracket placeholder 在输出时由对应值替换；示例中的方括号、冒号和标点都是 literal。

Success 的第一行固定为：

```text
TASK LIST tasks=<n> tracks=<n> actionable=<n> running=<n> recovery-needed=<n> mutex-blocked=<n>
```

`actionable` 是 `nextAction` 非 `null` 的 task 数；`running` 和 `recovery-needed` 按 effective state 计数；`mutex-blocked` 是至少有一个 `exclusion-running` blocker 的 task 数，同一 task 只计一次。空 list 只输出六个计数均为 `0` 的摘要和末尾 LF。

每个非空 track 是一个 section，首行固定为：

```text
TRACK T01 tasks=<n>
```

Inline node 的完整字段顺序如下；条件不成立的 token 连同其前导 space 整体省略：

```text
<indent>L<layer> [<task-id>] <state> parent:[<task-id>] needs:[<id-list>] blocked-by:[<blocker-list>] mutex:[<id-list>] reason:<json-string> next:<action> <title>
```

Block node 的主行只保留 layer、实际 task ID 和 state。非空 continuation 按以下顺序输出，并在 `<indent>` 后再缩进两个 ASCII space；`title` 始终存在且最后输出：

```text
<indent>L<layer> [<task-id>] <state>
<indent>  parent:[<task-id>]
<indent>  needs:[<id-list>]
<indent>  blocked-by:[<blocker-list>]
<indent>  mutex:[<id-list>]
<indent>  reason:<json-string>
<indent>  next:<action>
<indent>  title:<title>
```

Inline 字段之间恰好一个 ASCII space。Title 是 schema 已保证的单行原值。Track header 与第一个 node 之间、同一 track 的 nodes 之间都没有空行。

存在 effective exclusion pair 时，在全部 track 后增加 `RUN MUTEX` section。Renderer 把每个 pair 规范化为 `(minTaskId, maxTaskId)`，对称去重，再按左 endpoint 分组。Header 固定为：

```text
RUN MUTEX - cannot run at the same time
```

Inline group 使用以下格式，右 endpoints 之间用 `, ` 连接：

```text
T01 [task-000016] mutex T02 [task-000020], T03 [task-000021]
```

Block group 使用以下格式：

```text
T01 [task-000016] mutex
  T02 [task-000020]
  T03 [task-000021]
```

Groups 按左 endpoint task ID 排序；右 endpoints 按 task ID 排序；groups 之间没有空行。每个右 endpoint 只与所在 group 的左 endpoint 形成 pair。Track label 只用于定位，实际 task ID 才是关系身份。

摘要、每个 track 和 `RUN MUTEX` 各自是 section。相邻 section 之间恰好一个空行；不输出尾部空 section；完整结果以一个 LF 结束。

### 7. Task-list failure 使用独立固定格式

输出路由已经识别为实际 `task list` 且未指定 `--json` 时，协议内 failure 首行固定为：

```text
TASK LIST ERROR code=<code> revision=<number|null> retryable=<true|false> message=<json-string>
```

`error.details` 的 own keys 按字典序各占一行；空 details 不输出 continuation：

```text
  detail <key>=<json-value>
```

Failure 只输出上述内容并以一个 LF 结束。`indexPath` 和完整 details 仍存在于 raw failure，合法 `--json` 会完整序列化它们。全局参数 failure、help、version 和其他 command failure 按第 1 节使用 JSON serializer。

这些规则不改变错误码、revision 恢复、retryable、stdout/stderr 分工或退出码。未处理 fault 仍使用 stderr 和退出码 `2`。

### 8. Public 变化、版本和 owner 同步

默认 `task list` 改为文本 renderer，公开 list item type 从 `TaskSummary` 改为 `TaskListItem`；两者都是有意的 breaking change，不保留兼容分支。需要 raw serialization 的调用方显式增加 `--json`。

本 change 将 `taskGraphVersion` 从 `2.0.0` 提升到 `3.0.0`，并把 `skills/task-graph/SKILL.md` 的独立 `metadata.version` 从 `5` 提升到 `6`。`TaskListItem` 经既有 `index.ts`/CLI 导出链路进入公开声明；task-list renderer 和 render context 保持内部实现边界。

实现同步以下 owner：

- `skills/task-graph/SKILL.md`、`docs/skills/task-graph.md` 和 help：默认 list、显式 `--json`、track/layer、folding 与 run mutex。
- `docs/decisions/task-graph/`：分别评估 raw result/output-function 边界和默认 list renderer 是否需要独立长期决策。
- `docs/test-evidence/test-evidence-topics.json`：把 task-graph CLI 责任从 JSON-only 更新为 serializer/renderer 输出协议。
- `docs/test-evidence/task-graph/`：每个新增或改名的最小 `test()` 入口各维护一个 case，并同步派生索引。

可分发工具实现只修改 `tools/task-graph/` 维护源码。`skills/task-graph/scripts/` 的 ESM、source map 和声明树由 `scripts/build/task-graph.ts` 单向生成，不手改生成产物。JSON serializer 继续保留现有 envelope、revision、错误码、retryable、stdout/stderr、退出码和单 LF 语义，也不包含 track、layer、folding 或布局派生值。

## Risks / Trade-offs

- Track 只表达 parent/dependency 连通性。独立 `RUN MUTEX` 和 active mutex token 用于防止把 track 误读成可并行集合。
- 全量 projection 会扩大 JSON，密集 task graph 也会产生较长文本；该代价换取单一完整语义源和无需猜测的全量视图。
- Inline 与 block form 会产生不同文本；固定阈值、显式 columns 和逐字节测试限制差异。
- 默认输出和公开 type name 都发生 breaking change；major CLI version 与显式 `--json` 让调用方能够识别并迁移。

## Open Questions

无。实施前需要的输出路由、projection、图关系、显示 folding、文本格式、版本和协调切换条件均已固定。
