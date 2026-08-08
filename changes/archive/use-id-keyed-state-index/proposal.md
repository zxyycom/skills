# Proposal

本 proposal 定义 `index-runtime` 的 ID 键控迁移：在不增加源扫描遍数或完整解析成本的前提下，让每个条目的来源状态可以独立组合。

## Why

实施前，`StateSnapshot.states`、持久化 `StateIndex.entries` 和 runtime overlay 都使用数组，领域再通过 `identify` 从 state 中反推出 id。三个消费者已经拥有稳定 id，运行时却仍要检查重复身份、建立临时映射并在按 id 获取时扫描数组；持久化条目还会重复保存同一个 id。

选择性暂存进一步要求索引能够把 revision 与工作区中的不同条目组合成一个完整目标。若只保存整个集合的单一 `sourceRevision`，索引运行时无法只凭选中 id 组合出目标来源状态；若改为重新解析全部领域源并计算完整投影，又会让常规查询失去快速新鲜度检查的价值。

因此，索引需要把稳定 id 直接作为集合键，并把 metadata 与各 id 的来源指纹显式保存在同一个可组合 revision 清单中。领域仍拥有源文件、state 内容和指纹算法；通用运行时只管理 id、投影、校验、查询、确定性存储和新鲜度比较。

## Outcome

- `StateSnapshot.states`、持久化 `entries`、runtime overlay 和来源指纹条目统一使用按稳定 id 键控的对象。
- `StateIndexDefinition` 不再通过 `identify` 反推身份；state parser 与 key 策略直接获得当前 id 和只读 metadata 上下文。
- 状态索引升级为 schema v3；持久化 `entries[id]` 只保存该条目的 `state` 与派生 `keys`，id 只由对象键表达。
- `sourceRevision` 使用 `{ metadata, entries }` 清单；`entries[id]` 保存该条目来源的不可解释指纹，id 集合与索引条目严格一致。
- `readRevision` 继续提供只读取并计算来源指纹的快速路径，不调用领域 state parser、不重建完整索引，也不增加第二遍源读取。
- 按 id 的 `get` 使用直接查找；有排序和分页语义的查询结果继续使用数组。

## Scope

纳入范围：

- `StateIndex`、`ReadonlyStateIndex`、`StateSnapshot`、definition、projection context、runtime overlay、reader 和查询内部表示的 id 键控契约。
- schema v3、通用与领域 JSON Schema、确定性序列化、解析、规范化、完整校验和 schema v2 拒绝行为。
- metadata 来源指纹、逐 id 来源指纹、完整读取与快速 `readRevision` 的一致性，以及单次轻量扫描约束。
- decision-records、investigation-report 和 test-evidence 的 definition、source reader、查询适配、生成产物和派生索引迁移。
- test-evidence 的完整与快速读取迁移到同一身份边界；精确源格式由[测试证据目录契约](../../skills/test-evidence-review/references/catalog-contract.md)唯一承接。
- 特殊对象键、id 集合不一致、来源指纹不一致和快速路径退化的稳定失败与验证。
- 长期决策、现有选择性暂存 change 的前置关系和新增或修改测试入口的测试证据。

不纳入范围：

- 选择或写入 `pending` 索引；该能力继续由 [`stage-selected-index-entries`](../stage-selected-index-entries/) 负责。
- 领域 Markdown、目录表、topic 表、代码或其他事实源的写入、暂存或提交。
- 把查询结果、key definitions、排序规则、多值 key 或领域列表统一改成对象。
- 让通用层解释 state 内部字段、禁止领域保留与 id 同值的 `path` / `id` 字段，或修改 metadata 的领域语义。
- 为任意查询建立倒排索引、缓存、持续 watcher 或通用性能 SLO。
- 读取 schema v2、自动迁移旧文件或保留双格式兼容层；现有索引是可重建派生文件，随消费者一次性再生成。

## Success Criteria

- 领域完整读取直接返回 `id -> state`，definition 不再包含 `identify`；非法 id 在进入 state parser 前失败。
- schema v3 使用 `entries[id] -> { keys, state }`，持久化条目不重复保存 `id`；序列化结果确定且不依赖输入顺序。
- `sourceRevision.metadata` 表示 metadata 来源，`sourceRevision.entries[id]` 表示对应 state 来源；其 id 集合与 `states` / `entries` 完全一致。
- `read` 与 `readRevision` 对同一来源得到相同 revision 清单；成员、metadata 来源或任一条目来源变化都能使清单产生对应变化。
- test-evidence 的完整与快速读取使用目录契约定义的同一 case ID；快速路径不解析 case body，正文仍完整参与对应条目指纹。
- 快速新鲜度检查只完成一次来源发现与读取，不调用领域 state parser 或完整 index builder；一个 reader 打开后多次 `get/query/all` 不重复检查。
- 千条 investigation-report 规模场景保持百毫秒级新鲜度读取与查询，不退化到完整解析重建的秒级成本；实施验证记录前后测量结果。
- `get(id)` 直接查找静态条目或同 id runtime overlay；过滤、排序和分页结果仍按既有数组契约返回。
- `__proto__` 等特殊合法 id 能够安全往返；非法 id、source revision 缺失或多余成员不会被错误解释。
- 三个现有消费者、派生索引、领域 Schema、生成产物、类型检查、测试证据和 `bun run check` 通过。

## Affected Owners

- [`tools/index-runtime/README.md`](../../tools/index-runtime/README.md)、`tools/index-runtime/src/` 与 `tests/`：schema v3、id 键控类型、来源 revision、查询、同步和性能证据。
- `tools/decision-records/`、`tools/investigation-report/` 与 `tools/test-evidence/`：领域 state/source reader、快速 revision、Schema、查询适配和生成入口。
- `docs/decisions/decision-index.json`、`docs/investigations/investigation-index.json` 与 `docs/test-evidence/test-evidence-index.json`：随消费者重建的派生索引。
- `skills/decision-records/`、`skills/investigation-report/`、`skills/test-evidence-review/` 及相关 `scripts/build/`：实际分发的生成 Schema、类型和运行时代码。
- [`docs/decisions/index-runtime/use-id-keyed-state-index.md`](../../docs/decisions/index-runtime/use-id-keyed-state-index.md) 与统一决策索引：记录并跟踪长期索引格式方向。
- [`stage-selected-index-entries`](../stage-selected-index-entries/) 与对应长期决策：在本 change 对齐后按 id 键和逐条来源指纹构造目标索引。
- [`docs/test-evidence/`](../../docs/test-evidence/)：新增或修改最小测试入口的权威 case 与派生索引。
