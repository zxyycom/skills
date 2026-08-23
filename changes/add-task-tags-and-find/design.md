# Design

本 design 把 tags 设计成 task content 中可独立维护的发现元数据，并把 find 设计成 `TaskGraphService` 对权威 index 的确定性只读扫描；产品结果和范围以 [`proposal.md`](proposal.md) 为准，[`tasks.md`](tasks.md) 只能安排本文已经确定的实施与证据。

## Context

- 当前 `TaskIndex` 是根级 `Record<taskId, TaskEntry>`，`TaskContent` 包含 title、goal、acceptance、context、references 与 result，持久化 Schema 使用严格对象和 `schemaVersion: 2`。
- `task list` 读取整个 index、计算 projection 并返回完整调度视图；`task show` 返回单个完整 entry 与 projection。Find 的消费者只需要定位 task，不需要第三个批量详情接口。
- 当前图结构 mutation 通过 `TaskGraphService.apply`、expected revision、native lock 和原子写入执行；execution mutation 另有 lease 或 expected revision 前置条件。
- 当前 `update-content` 全量替换描述内容，并禁止 `running`、`succeeded` 和 `cancelled`。Tags 必须独立于该限制，否则已完成 task 无法继续分类，描述更新也可能意外清空 tags。
- 当前大多数 CLI command 使用标准 JSON envelope；只有明确拥有 renderer 的命令使用专门文本输出。Find 不需要新增 renderer。
- Task-graph bundle、source map、公开 SDK 声明和 index JSON Schema 都从 `tools/task-graph/src/` 机械生成，不存在第二套手写声明 owner。
- `task-000040` 拥有 result 与集成版本锚点的说明，`task-000037` 拥有成功任务重开、result/audit 与终态 mutation。实施前需要在 Readiness 中确认前者的目标状态已经进入当前基线，并避免与后者同时修改 task-graph 核心 owner。

## Goals / Non-Goals

目标：

- 为 task entry 提供零到多个稳定、唯一、CLI 友好的发现标签。
- 让 tags 在 entry 被移除前独立于 execution phase 可维护，同时保持现有并发和原子写契约。
- 为 CLI 和 SDK 建立一套小而确定的 task locator，消除调用方自行扫描 JSON 的需要。
- 让默认 find 集合面向仍可能需要操作的 task，同时保留显式查询已成功或已取消历史 task 的能力。
- 只返回定位所需字段，并让完整读取继续由 `task show` 承担。
- 保持旧 index 可读，并从同一运行时源码生成全部分发契约和证据。

非目标：

- 不建立搜索平台、派生索引、tag registry、ranking、pagination 或可扩展查询语言。
- 不赋予 tags 调度、状态、拓扑、继承、身份或删除语义，也不修改 result、成功撤销、failed retry、task remove 或 index stage。
- 不通过 find 复制 `task list`、`task show` 或 actionable projection，也不增加多 tag、任意状态或调用方排序条件。

## Decisions

### Intended Change

#### Tags authority and persisted shape

`TaskContent` 增加可选字段：

```ts
export type TaskContent = {
  title: string;
  goal: string;
  acceptance: string[];
  context: string | null;
  references: Record<string, string>;
  result: TaskResult | null;
  tags?: string[];
};
```

Tags 的唯一可写事实位于对应 task entry 的 `content.tags`。不存在 tag registry、反向 tag map 或派生搜索索引。没有 tag 时省略 `tags`；create 或 update 输入为空数组时 canonical content 同样省略该字段，避免 `undefined`、缺失和空数组成为多种持久化语义。

单个 tag 必须满足：

1. 按 Unicode code point 计数，长度为 1–64。
2. 字符只来自 Unicode 字母、Unicode 数字、`-`、`_`、`.`。
3. 至少包含一个 Unicode 字母或数字，且第一个字符不能是 `-`。
4. 同一个 tags 数组内值唯一；重复输入失败，不静默去重。

该集合允许中文等无需 shell 转义的普通文字，同时排除空白、引号、反斜杠、路径分隔符和常见 shell 元字符。Tag 身份使用原始字符串精确比较，不做大小写折叠或 Unicode 规范化。Canonical writer 使用现有 locale 无关 `compareText` 对 tags 排序。

每个 task 最多保存 5 个 tags。持久化 Schema、create、update-tags、CLI help 和边界测试使用同一上限；第 6 个 tag 使整个请求失败，不截断或部分写入。

#### Create and update-tags mutation

Persisted tags 属于 content，因此 create 的程序化输入也把 tags 放在 `content` 中；`update-content` 仍只接收既有描述字段，避免“省略 tags 是保留还是清空”的双重语义。新增一个只供 create 使用的扩展类型：

```ts
export type CreateTaskContentInput = TaskContentInput & {
  tags?: string[];
};

export type CreateTaskOperation = {
  kind: "create-task";
  alias?: string;
  content: CreateTaskContentInput;
  parentId?: string | null;
  control?: TaskControlInput;
};
```

`UpdateTaskContentOperation.content` 继续使用不含 tags 的 `TaskContentInput`。这样 persisted、create 与 show 都保持 `content.tags` 关系，而 tags 的后续 mutation 仍只有一个明确入口。

新增全量 replacement operation：

```ts
export type UpdateTaskTagsOperation = {
  kind: "update-task-tags";
  taskId: string;
  tags: string[];
};
```

程序化调用沿用现有图变更入口，不增加 `TaskGraphService.updateTaskTags` 便利方法：

```ts
await service.apply({
  expectedRevision,
  operations: [{ kind: "update-task-tags", taskId, tags }]
});
```

这与 update-content、update-control 和 relation mutation 使用同一 batch/CAS 契约，避免第二种程序化写入表面。Operation 名称只承诺“更新后的完整集合”，不使用容易被理解成增量添加的 `set`、`add` 或 `remove`；本 change 不增加 tags patch API。CLI 的成功数据继续按既有 `task update-*` 约定返回 `{ taskId }`。

Engine 先验证 task 存在和全部 tags，再原子替换 canonical tags。该 operation 允许 task 自身 execution phase 为 `idle`、`running`、`succeeded`、`failed` 或 `cancelled`；它不读取 lease，也不改变 control、execution 或 relations。

提交与当前 canonical tags 相同的完整集合仍按现有 apply mutation 语义成功：它更新 `updatedAt` 并消费一个 index revision。实现不为 tags 单独引入 no-op 检测或不同的 revision 规则。

CLI 契约为：

```text
task create ... [--tag <tag> ...]
task update-tags <task-id> --tag <tag>... --expected-revision <n>
task update-tags <task-id> --clear-tags --expected-revision <n>
```

Create 与 update-tags 中的 `--tag` 可多次出现，以构造多个不同 tag。Update-tags 的 `--tag` 和 `--clear-tags` 互斥，且必须提供其中一种；重复值是参数错误。SDK 通过 `tags: []` 清空，不增加单独 clear 方法。

#### Find query contract

公开查询类型固定为：

```ts
export type FindTasksOptions = {
  taskId?: string;
  title?: string;
  tag?: string;
  text?: string;
  includeCompleted?: boolean;
};

export type TaskFindMatch = {
  taskId: string;
  title: string;
};
```

`TaskGraphService.findTasks(options)` 返回 `ServiceResult<TaskFindMatch[]>`。`taskId`、`title`、`tag`、`text` 至少提供一个；`includeCompleted` 只扩展结果集合，不是独立查询条件。

四个定位条件在 SDK options 中各至多出现一次，对应 CLI option 也都是 singleton；任何重复 option 都是参数错误。`taskId` 使用现有 canonical task ID Schema，`tag` 使用本 design 的 tag token Schema。`title` 必须是 1–120 个 Unicode code point、单行且无首尾空白；`text` 必须是 1–2000 个 Unicode code point 且无首尾空白，与最大可搜索描述字段的长度一致。空字符串不能借由 `includes("")` 退化成隐式 list。

条件语义为：

| 条件 | 匹配边界 |
| --- | --- |
| `taskId` / CLI `--id` | 与规范最终 task ID 完全相等 |
| `title` / CLI `--title` | `content.title` 使用原始字符串 `includes` 子串匹配 |
| `tag` / CLI `--tag` | 与 `content.tags` 的一个成员完全相等；只能提供一次 |
| `text` / CLI `--text` | 搜索 title、goal、acceptance 各项、非空 context 和非空 `result.summary` |

`text` 不搜索 references 或 tags；这些字段分别由稳定引用和独立 tag 条件承接，不应因对象序列化细节产生意外命中。所有已提供的条件取交集。匹配不进行 case folding、Unicode normalization、分词、模糊扩展或 ranking；这是固定内部规则，不形成调用方可配置的搜索协议。

CLI 契约为：

```text
task find [--id <task-id>] [--title <text>] [--tag <tag>] [--text <text>] [--include-completed]
```

Find 的 `--tag` 与 update-tags 的 `--tag` 有不同基数：前者至多一次，后者可以用多个不同值构造完整 tags 数组。CLI help 必须分别表达该约束，不能通过同一个模糊的共享参数说明掩盖差异。

#### Default visibility, output, and ordering

Find 默认只扫描 task 自身 `state.execution.phase` 为 `idle`、`running` 或 `failed` 的 entry。`failed` 是默认结果中唯一保留的终态，因为现有 `retry` 可以让它重新进入可领取流程。Expired lease 对应的 task 仍具有 `running` phase，因此自然包含在默认结果中。

`includeCompleted: true` 或 `--include-completed` 只把 `succeeded` 和 `cancelled` 加入同一次扫描。Find 不接受 phase 或 effective-state 枚举，也不根据 projection、blocker、依赖或排斥重新解释该集合。

默认过滤也适用于精确 ID：查询一个 `succeeded` 或 `cancelled` task 的 ID 而未提供 `includeCompleted` 时成功返回空数组，不为精确 ID 建立隐式例外。

当前只有 `succeeded` task 可以拥有非空 result，因此 `result.summary` 实际只会在 `includeCompleted: true` 的查询中参与匹配。Find 不为 result 建立不同的可见性规则。

Title 允许重名，因此 find 始终返回数组。零个 match 是成功空数组；精确 ID 没有命中也不转成 `TASK_NOT_FOUND`。结果只包含 `taskId` 和 `title`，按现有 locale 无关 `compareText(taskId)` 升序排列。调用方需要 tags、phase、完整 content 或 projection 时调用 `task show`。`TaskListItem` 与 `task list` renderer 保持不变，不为 tags 增加第二个批量读取面。

CLI 使用标准 task-graph JSON envelope，不增加专用文本 renderer；envelope 中的 `revision` 是本次读取快照，`data` 与 SDK 的 `TaskFindMatch[]` 相同。Find 不提供分页、limit、sort 或 cursor。

#### Direct index scan

`findTasks` 对 `TaskGraphStore.read()` 返回的同一 index 快照做一次 O(N) 扫描、过滤与排序。它不读取派生文件、不写缓存、不调用 mutation runtime，也不需要先计算完整 task projection。

### Resulting Impacts

#### Existing content, lifecycle, and compatibility

`update-task-tags` 只修改 `content.tags` 与 `state.timestamps.updatedAt`，不改变其他 content。`updatedAt` 表示 entry 最近一次持久修改，不能被解释成完成时间；result 的版本锚点继续服从 task-000040 的 owner。

`update-content` 在构造新的描述内容时显式带回旧 `content.tags`，并继续服从原有 phase 限制。它不接受 tags 输入，也不能清空或替换 tags。

`schemaVersion` 保持 `2`：新字段可选，新 reader 能直接读取全部既有 index，不需要迁移或双 Schema 读取。CLI 公共协议做 minor bump，task-graph skill metadata version 在集成基线上递增；不硬编码尚未集成分支上的具体版本号，也不为旧版分发 CLI 建立兼容层。

#### Existing runtime and owner boundaries

`update-task-tags` 属于工作区 mutation，继续通过 `TaskGraphService.apply`、store native lock、expected revision、canonical candidate 和原子写入；CLI command help 标记 `requiresMutationRuntime: true`。`task create --tag` 继续通过同一 batch apply 边界执行。

运行时类型、Schema、engine、service 和 CLI 位于 `tools/task-graph/src/`。`scripts/build/task-graph.ts` 从这些导出机械生成分发 bundle、source map、SDK 声明和 index JSON Schema；除非现有生成闭包不能覆盖新导出，否则不修改 build owner。Skill 与人类说明只描述当前公开行为，不复制完整类型定义。

长期决策记录聚焦以下架构边界：tags 只承担发现；find 直接扫描权威 index；简单确定性匹配满足定位需求；不建立第二事实源或搜索平台。大小写、Unicode normalization 和具体 helper 实现只在 design/测试中固定，不扩写成决策记录的中心问题。

## Risks / Trade-offs

| 风险或取舍 | 控制 |
| --- | --- |
| Tags 可以自由创建，长期可能产生近义词或拼写漂移 | 第一版只提供受限 token 和精确匹配；出现真实治理消费者后再建立独立 owner，不预建 registry |
| 全量 replacement 可能清除调用方未读取的新 tags | 强制 expected revision；冲突后重新读取再提交，不增加隐式 merge 或 patch 语义 |
| 终态 task 修改 tags 会改变 `updatedAt` | 明确 `updatedAt` 是 entry 最近修改时间，不是完成时间；result 与完成审计由 task-000040/task-000037 的 owner 承接 |
| 同一 `--tag` 拼写在 find 与 update-tags 中基数不同 | Help、argv schema 和测试分别固定：find 至多一个，mutation 可以有多个不同值 |
| 原始字符串子串匹配可能漏掉大小写或 Unicode 表示不同的等价文本 | 定位工具优先确定性与低维护面；不增加规范化、模糊匹配或可配置搜索策略 |
| schema v2 新增可选字段后，旧分发 CLI 不认识含 tags 的 entry | 新 reader 向后读取旧 index，公共协议做 minor bump；仓库不维护旧 CLI 双读或迁移层 |
| task-000040 与本 change 重叠 docs、decision index 和版本 | Readiness 要求基于其集成结果更新 owner，避免覆盖 result/version 语义 |
| task-000037 与本 change 重叠 types、schema、engine、CLI、SDK、生成物和终态 mutation | 两项实现串行；后集成者必须让 reopen 与 tags mutation 互不清除对方数据，并补对应保留测试 |

## Open Questions

无。每个 task 最多保存 5 个 tags；`text` 搜索 title、goal、acceptance、context 和非空 `result.summary`，但不搜索 references 或 tags。Tags 的 token 规则、全量更新、全部 phase 可维护、find 单 tag 条件、默认 phase 集合、completed opt-in、组合关系、返回形状、排序和非目标均已确定。
