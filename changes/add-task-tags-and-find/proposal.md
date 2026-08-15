# Proposal

本 change 仍处于 `draft`，对应 `task-000008`。它为 task-graph 增加只承担分类与发现的 task tags，以及直接扫描权威索引的轻量 `find`；本文拥有产品结果、范围与成功标准，[`design.md`](design.md) 拥有精确接口和行为契约，[`tasks.md`](tasks.md) 拥有实施与验证顺序。

## Why

当前根级 task 字典能够按 ID 展示单个任务，也能通过 `task list` 展示完整拓扑和调度状态，但缺少稳定的发现元数据与面向定位的查询入口。使用者只能预先知道最终 task ID，或读取完整列表后自行扫描 title、goal、acceptance 和 context；这既不利于恢复较早任务，也会诱使调用方各自实现不一致的 JSON 搜索逻辑。

`task list` 的产品责任是展示完整任务图，不能为了发现需求叠加默认过滤、模糊匹配或搜索排序。当前索引规模也不需要独立搜索索引、缓存或第二事实源。因此应增加一个边界明确的 `find`：直接读取同一份权威索引，按少量固定条件定位 task，并把完整内容读取继续交给 `task show`。

Tags 只解决人工分类和任务发现。它们必须在 task entry 被移除前持续存在并可独立维护，但不能改变 control、execution、父子、依赖、排斥、lease 或 result 语义。

## Outcome

- 每个 task content 可以保存零到多个唯一、CLI 友好的 tags；没有 tags 的既有索引仍可直接读取。
- 创建任务可以写入初始 tags；独立的 `update-tags` mutation 可以在任意 execution phase 原子替换或清空 tags，而 `update-content` 保留已有 tags。
- CLI 与公开 SDK 使用同一 `find` 契约，支持最终 task ID、title、单个 tag 和描述文本条件，并对组合条件取交集。
- Find 默认只定位 execution phase 为 `idle`、`running` 或可重试 `failed` 的任务；调用方显式选择后才纳入 `succeeded` 和 `cancelled`。
- Find 返回按 task ID 固定排序的 `{ taskId, title }` 集合；需要完整 task、projection 或状态详情时继续调用 `task show`。
- 查询直接扫描当前权威 index，不建立搜索索引、tag registry、排名、分页、查询语言或任意状态筛选协议。

## Scope

纳入范围：

- `content.tags?: string[]` 的持久化 Schema、规范化、最多 5 个 tags，以及单个 tag 的长度与字符限制。
- 创建任务时写入 tags，以及基于 expected revision 的全量 `update-tags` / clear mutation。
- Tags 在全部 execution phase 的维护边界、`updatedAt` 语义，以及 `update-content` 的 tags 保留行为。
- `TaskGraphService.findTasks`、create content tags、`update-task-tags` apply operation 和对应公开类型。
- `task find`、`task update-tags`、`task create --tag` 的 help、argv 校验和结构化输出。
- 最终 task ID、title、tag、描述文本的固定匹配语义，组合交集、默认完成态过滤和固定排序。
- Task-graph 领域说明、长期决策、协议版本、skill 版本、生成 bundle、SDK 声明与 JSON Schema。
- 源码、CLI、SDK、分发产物和兼容性测试，以及每个新增或修改测试入口的 test-evidence case。

不纳入范围：

- 修改 `task list` renderer 或公开 `TaskListItem`，或把 find 结果扩展成完整 task entry 批量接口。
- Tag 注册表、层级、别名、描述、颜色、继承、自动推断、全局治理或调度语义。
- 多 tag 查询、tag 条件的 AND/OR 语言、重复 find tag 参数或通用布尔表达式。
- 模糊匹配、相关度、分词、大小写策略选项、Unicode 规范化选项、分页或调用方可选排序。
- 任意 execution phase / effective state、关系、依赖、排斥或 lease 过滤器。
- 独立搜索索引、缓存、后台同步、外部搜索服务或第二份可写映射。
- 修改 task 删除、GC、成功撤销或 failed retry 的既有生命周期语义。

## Success Criteria

- 不含 `tags` 的 schema v2 index 保持合法；含 tags 的 entry 最多保存 5 个唯一、规范排序的合法 token，空集合不持久化为第二种无标签表示。
- Create、update-tags、clear 和 update-content-preserves-tags 行为通过源码 API、CLI 和生成 SDK 契约验证。
- `update-tags` 在 `idle`、`running`、`succeeded`、`failed` 和 `cancelled` 上均可通过 expected revision 执行，只更新 tags 与 entry `updatedAt`。
- Find 至少要求一个定位条件；ID 与 tag 精确匹配，title 与包含非空 result summary 的描述文本使用固定子串匹配，多种条件取交集，重复 find tag 参数失败。
- 默认结果包含 `idle`、`running`、`failed`，排除 `succeeded`、`cancelled`；`includeCompleted` 只负责把后两者纳入结果。
- Title 重名返回多个 match，无结果成功返回空数组；CLI 与 SDK 都返回按规范 task ID 升序排列的 `{ taskId, title }`。
- Read-only find 不要求 native mutation runtime；update-tags 继续使用既有锁、expected revision、原子写入和 canonicalization 边界。
- Task-graph 行为 owner、长期决策、协议与 skill 版本、生成物、测试实现和 test-evidence 账本互相一致，并通过目标检查与仓库统一检查。

## Affected Owners

| Owner | 本 change 的责任 |
| --- | --- |
| [`tools/task-graph/src/`](../../tools/task-graph/src/) | 持久化类型与 Schema、mutation、service 查询、CLI 和公开运行时导出 |
| [`tools/task-graph/tests/`](../../tools/task-graph/tests/) | 源码、CLI、SDK、分发模块和兼容行为证据 |
| [`scripts/build/task-graph.ts`](../../scripts/build/task-graph.ts) | 从运行时源码机械生成 bundle、source map、SDK 声明和 index JSON Schema；只有生成边界确需变化时修改源码 |
| [`skills/task-graph/SKILL.md`](../../skills/task-graph/SKILL.md) 与 [`docs/skills/task-graph.md`](../../docs/skills/task-graph.md) | AI 行为入口与人类说明中的当前 tags/find 契约、CLI/SDK 边界和版本 |
| [`docs/decisions/`](../../docs/decisions/) 与 [`docs/decisions/decision-index.json`](../../docs/decisions/decision-index.json) | 保存“tags 只用于发现、find 直接扫描权威索引”的长期架构理由及索引状态 |
| [`docs/test-evidence/`](../../docs/test-evidence/) | 为本 change 新增或修改的每个最小原生测试入口维护一个可检索 case，并同步派生索引 |
| `task-000008` | 中央 task graph 中的执行状态、依赖、排斥和结果；本 change 不 claim 或改写该任务 |
