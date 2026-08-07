# Proposal

本 change 计划把 `task-graph task list` 的默认输出改为低冗余的分层 DAG，并让 task-list renderer 与 JSON serializer 共同消费 command 返回的 raw result object。

## Why

当前 CLI 对所有 command 统一执行 `JSON.stringify`。这种做法能够方便、完整地序列化 raw result object，但没有针对 `list` 的用途设计信息层次：平铺 task 字典无法直接呈现推进线和拓扑层级，关系来源与反向关系容易重复出现，关键状态和阻塞原因也与低优先级细节处于同一权重。

`task list` 的用途是恢复当前任务图并支持推进规划。调用者应能从一次输出判断有哪些推进线、各任务位于哪一层、当前为何可行动或阻塞，以及哪些动作不能同时运行，而不必重新拼接多个 task 详情或从完整 JSON 中恢复图。

默认输出还必须避免依赖字符显示宽度的布局。Task title 可能包含中日韩字符、emoji 或长文本；让这些文本参与方框、跨列连线或右侧字段补齐，会使相同内容在不同终端中失去稳定结构。

本 change 不建立“人类输出”和“机器输出”两套语义。Raw result object 是唯一共同输入；JSON serializer 提供便捷的完整序列化，task-list renderer 则针对 `list` 进行信息选择、分组、去重和布局。

## Outcome

完成后，`task-graph task list` 默认输出按推进线（track）分组、按 dependency layer 排列的纵向 DAG。每个 task 只出现一次；task ID、title、有效状态、parent、dependency、next action 和会改变当前推进判断的 blocker 都有明确文本表达。

有效 exclusion 不进入 DAG 连线。Renderer 在独立 `RUN MUTEX` 区域对称去重并按 endpoint 分组；只有对端处于 `running` 或 `recovery-needed`、从而形成实际 blocker 时，受阻 task 才显示行内 mutex 信息。

Service 和 dispatch 继续先返回结构化 raw result object。`task list` 默认选择 task-list renderer；全局 `--json` 选择通用 JSON serializer；尚未注册 renderer 的其他 command 继续使用 JSON serializer 作为默认回退。

## Scope

纳入范围：

- 扩展 `task list` 的结构化 list projection，使同一 raw result object 包含 renderer 所需的状态、parent、有效 dependency、有效 exclusion、blocker、children 与 dependents。
- 建立以 raw result object 为输入的输出选择层，并增加全局布尔参数 `--json`。
- 实现默认 task-list renderer，包括推进线、dependency layer、信息优先级、重复信息折叠、运行互斥汇总、标准/窄布局和确定性排序。
- 同步 task-graph 行为 owner、公开声明、生成产物、help、行为测试、测试证据与达到门槛的长期决策。

不纳入范围：

- 不为 `task show`、`actionable`、mutation、help 或 version 设计新的 command-specific renderer。
- 不增加 pretty JSON；`--json` 只序列化 raw result object。
- 不改变 task index Schema、parent、dependency、exclusion、claim、lease 或完成门禁语义。
- 不计算业务优先级、资源容量、最大可并行集合或自动选择下一批 task。
- 不引入通用图布局框架、横向方框 DAG、颜色依赖、交互式终端 UI、过滤或分页。

## Success Criteria

1. 不带 `--json` 的 `task-graph task list` 默认输出纵向分层 DAG；全部 task 被划入确定排序的 track，并各自恰好出现一次。
2. 输出首部和 track/node 层次能够直接回答 task 总数、track 数、actionable 数、running 数、recovery-needed 数，以及被活动 mutex 阻塞的 task 数。
3. 每个 node 使用显式 token 表达 ID、有效状态、parent、dependency、next action 和有实际判断价值的 blocker；parent 或关系方向不只依赖缩进、颜色或视觉位置。
4. Renderer 折叠对称 exclusion、反向关系和重复继承来源；被折叠的信息仍完整保留在 list projection，可由程序化调用或 `--json` 恢复。
5. Exclusion 不合并 track、不建立先后顺序，也不暗示取消。全部有效 mutex pair 规范化、对称去重并集中显示；当前生效的 mutex blocker 同时定位到受阻 task。
6. 标准与窄布局不使用包围可变 title 的方框、跨 title 连线、ANSI 颜色或 Unicode padding；TTY、非 TTY、中文、emoji、长 title 和密集关系均有确定行为。
7. 任意 command 显式使用 `--json` 时，CLI 直接执行 `JSON.stringify(rawResult) + LF`；现有 envelope、revision、错误码、stdout/stderr 分工和退出码保持不变。未注册 renderer 的 command 在无 `--json` 时仍使用同一 serializer。
8. 行为 owner、公开声明、生成产物、skill 独立版本、长期决策和测试证据与实现一致，task-graph 行为测试及完整仓库检查通过。

## Affected Owners

- [`skills/task-graph/SKILL.md`](../../skills/task-graph/SKILL.md) 与 [`docs/skills/task-graph.md`](../../docs/skills/task-graph.md)：默认 list、`--json` raw serialization、track/layer 与运行互斥的使用契约。
- `tools/task-graph/src/service.ts`、`types.ts`、`graph.ts`：list projection 及其公开类型。
- `tools/task-graph/src/cli.ts` 与新增 task-list layout/renderer 模块：输出选择、信息取舍、布局与错误呈现。
- `tools/task-graph/tests/`：projection、layout、renderer、CLI 协议与分发回归。
- `scripts/build/task-graph.ts` 与 `skills/task-graph/scripts/`：公开声明和分发产物的单向生成。
- `docs/decisions/task-graph/`：raw result object、serializer/renderer 边界和默认 task-list renderer 输出的长期判断。
- `docs/test-evidence/task-graph/` 与派生测试证据索引：新增或调整的最小原生测试入口。
