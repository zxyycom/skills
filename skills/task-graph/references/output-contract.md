# Task Graph 输出与程序化契约

本参考承接 CLI 可观察输出及程序化调用契约；调度流程见 [Task Graph](../SKILL.md)。

## Task list 输出与程序化边界

### 输出选择

实际执行的 `task list` 默认输出全量静态文本视图；索引中的每个 task 使用实际 `taskId` 恰好出现一次。实际 `index stage` 默认输出专用单行文本。需要 raw result 的完整 JSON 序列化时，使用一个独立、无值且最多出现一次的全局 `--json`，它可以放在 command 前后。合法 `--json` 对任意协议内 success 或 failure 固定执行 `JSON.stringify(result) + "\n"`；help、version、其他 command、全局参数 failure，以及专用 route 建立前的 service construction / 全局路径校验 failure 默认也保持 JSON。Help 属于 help，已识别专用 route 后的局部参数错误才使用对应 failure 文本。

### 程序化结果

`TaskGraphService.listTasks()` 返回结果的 `data` 是 `Record<string, TaskListItem>`；字典 key 等于 item 的 `taskId`。`TaskListItem` 直接复用 `TaskProjection` 的 effective control、完整 blockers、effective dependency/exclusion source、children、dependents 和 next action，只增加 title、direct parent 与 execution phase。公开面不保留 `TaskSummary` alias。

### 文本视图的拓扑

文本视图中，parent-child 与 effective dependency 相连的 task 构成同一 track；孤立 task 自成 track，exclusion 不连接 track。Track 按成员中的最小实际 task ID 排序并从 `T01` 编号。没有 effective dependency 的 task 位于 `L0`，其余 task 的 layer 是全部 dependency layer 的最大值加一；parent 不改变 layer。Track 内依次按 layer、从顶层祖先到 direct parent 的实际 ID path、当前实际 task ID 排序。

### 节点和摘要

默认 node 始终显示 layer、实际 task ID、effective state 和 title，并按条件显示 direct parent、去重后的 dependency endpoint、blocker、active mutex、非空 control reason 与 next action。`blocked-by` 只保留 `dependency-failed`、`dependency-cancelled`、`ancestor-terminal`、`all-children-cancelled` 和 `descendant-lease`；`dependency-incomplete`、`child-incomplete` 与 control blocker 由同一全量视图中的关系、state 和 reason 表达，`exclusion-running` 转为 `mutex`。Children、dependents、完整 blockers、relation source 和 inheritance path 不在 node 重复展开，但始终保留在程序化 `listTasks()` 与 `task list --json` 中。

Success 摘要分别计数 tasks、tracks、actionable、running、recovery-needed 和 mutex-blocked。全部 effective exclusion pair 规范化为按实际 task ID 排序的无向 pair，对称去重后按较小 endpoint 分组并放在独立 `RUN MUTEX` section；只有已经形成 `exclusion-running` blocker 的对端才同时出现在受阻 node 的 `mutex` token 中。Exclusion 只禁止同时运行，不建立 dependency；track 数也不表示可并行数。

### 排版

文本 renderer 使用固定 inline/block form；有效 columns 低于 `80`，或去重后的 `needs`、`blocked-by`、`mutex` 任一超过三个 item 时，node 使用 block form；run mutex group 在 columns 低于 `80` 或右 endpoints 超过三个时使用 block form。缺少有效 columns 时回退到 `80`。Title、reason、task ID 的长度和 Unicode 显示宽度不触发自动换行、截断、隐藏或任务重排。摘要、各 track 与 `RUN MUTEX` 是独立 section，相邻 section 之间一个空行，结果只以一个 LF 结束。

### 协议边界

当前 CLI 协议版本是 `3.1.0`。默认 `task list` 与 `index stage` 文本输出以及公开 `TaskListItem`、`TaskIndexStageResult` 类型都是协议边界；需要原始序列化的 CLI 调用方必须显式使用 `--json`。Renderer、render context、track、layer 与 folded token 保持内部显示边界，不扩展为公开领域 API。
