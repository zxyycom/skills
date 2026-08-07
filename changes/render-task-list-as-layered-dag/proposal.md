# Proposal

本 change 计划把 `task-graph task list` 的默认输出改为低冗余的分层 DAG，并让默认 renderer 与 JSON serializer 共同消费 command 返回的 raw result object。

## Why

当前 CLI 对所有 command 统一执行 `JSON.stringify`。这种序列化完整且适合程序化消费，但平铺 task 字典不能直接呈现推进线、dependency layer 和运行互斥；调用者需要自行重建图，关系来源与反向关系也会和当前状态、阻塞原因处于同一信息层级。

`task list` 的主要用途是恢复当前任务图并支持推进规划。一次默认输出应直接回答有哪些推进线、每个 task 位于哪一层、当前为何可行动或等待，以及哪些 task 不能同时运行，同时保留显式入口恢复完整 raw result。

默认布局还必须独立于 title 的显示宽度。中日韩字符、emoji 或长 title 不应改变关系字段、后续 node 的位置或输出中 task 的可见性。

## Outcome

完成后，`task-graph task list` 默认输出纵向分层视图：全部 task 各出现一次，按 track 分组、按 dependency layer 排序，并始终使用 list item 的实际 `taskId`。Parent、dependency、effective state、control reason、next action 和有判断价值的 blocker 都由显式 token 表达。

Effective exclusion 不参与 DAG。全部 run mutex pair 在独立 `RUN MUTEX` section 中对称去重；只有已经形成 claim blocker 的 mutex 才同时显示在受阻 node 上。

Service 和 dispatch 仍先产生结构化 raw result object。实际执行的 `task list` 在默认模式下选择 task-list renderer；合法的全局 `--json` 选择通用 JSON serializer；help、version 和其他 command 默认继续使用 JSON serializer。

## Scope

纳入范围：

- 扩展 `task list` projection，使 raw result object 包含 effective control、parent、effective dependency、effective exclusion、children、dependents 和完整 blocker 语义。
- 建立明确的输出路由，并增加只能出现一次的全局无值参数 `--json`。
- 实现 task-list 的 track/layer 派生、显示折叠、run mutex 汇总、inline/block form 和确定性排序。
- 同步行为说明、help、公开类型、生成产物、版本、长期决策和测试证据。

不纳入范围：

- 不为 help、version、`task show`、`actionable` 或 mutation command 增加默认 renderer。
- 不改变 task index Schema、parent、dependency、exclusion、claim、lease 或完成门禁语义。
- 不计算优先级、资源容量、最大可并行集合或下一批 task。
- 本 change 始终输出索引中的全部 task；不增加过滤、分页、自动收缩、隐藏 task 或 `outside-view`。
- 不增加 pretty JSON、交互式终端 UI、通用图布局框架或依赖颜色的语义。

## Success Criteria

1. 默认 `task list` 把索引中的全部 task 划入稳定排序的 track，并按 dependency layer 输出；每个 node 使用实际 `taskId` 且恰好出现一次。
2. 摘要、track、node 和 `RUN MUTEX` 分别承接全局计数、推进关系、task 当前信息和运行排斥；exclusion 不合并 track，也不建立先后或取消语义。
3. 普通未完成 dependency、普通未完成 child、反向关系和继承来源在显示层折叠；终态或层级 blocker、control reason 仍直接可见，完整语义可从同一 projection 或 `--json` 恢复。
4. Inline、block 和 failure 输出的字段顺序、换行、缩进、section 间隔与末尾 LF 有逐字节契约；title 的 Unicode cell width 不触发自动换行、收缩或隐藏。
5. 合法 `--json` 对任意协议内 success/failure 执行 `JSON.stringify(rawResult) + LF`；help、version、其他 command 和全局参数 failure 的默认输出仍为 JSON，实际 `task list` 的默认协议结果使用 list renderer。
6. 行为 owner、公开类型、CLI version、skill version、生成产物、长期决策和测试证据与实现一致；task-graph 行为测试和完整仓库检查通过。

## Affected Owners

- [`skills/task-graph/SKILL.md`](../../skills/task-graph/SKILL.md) 与 [`docs/skills/task-graph.md`](../../docs/skills/task-graph.md)：默认 list、raw `--json`、track/layer 与 run mutex 的使用契约。
- `tools/task-graph/src/service.ts`、`types.ts`、`graph.ts`：list projection 及其公开类型。
- `tools/task-graph/src/cli.ts` 与 task-list layout/renderer 源码：输出路由、显示投影、布局和 failure 呈现。
- `tools/task-graph/tests/`：projection、layout、renderer、CLI 协议与生成产物回归。
- `scripts/build/task-graph.ts` 与 `skills/task-graph/scripts/`：公开声明和分发产物的单向生成。
- `docs/decisions/task-graph/`：raw result/output-function 边界和默认 task-list renderer 的长期判断。
- `docs/test-evidence/test-evidence-topics.json`、`docs/test-evidence/task-graph/` 与派生索引：CLI 责任描述和新增或调整的最小原生测试入口。
