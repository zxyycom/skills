# Index Runtime

`tools/index-runtime/` 是派生状态索引的共享读取与同步协议 owner。它提供 schema v3 的通用 JSON 外壳、ID 键控身份集合、结构化来源 revision、领域定义、查询和确定性同步；领域仍拥有原始事实、稳定 ID 的发现与去重、state parser、来源指纹和查询 key。

项目级源码、生成与分发边界见 [项目工具链](../../docs/tooling.md)。

## 领域接入契约

领域通过 `StateIndexDefinition` 提供：

1. `namespace` 和 `definitionVersion`。
2. 同步且确定性的 `parseMetadata`，以及接收只读 `{ id, metadata }` 上下文的 `parseState`。
3. 返回同一时点 `{ sourceRevision, metadata, states }` 的 `read`；`states` 是 `id -> state` record，`sourceRevision` 是 `{ metadata, entries: id -> fingerprint }`。
4. 只返回同一结构化来源清单的低成本 `readRevision`。
5. 接收同一 `{ id, metadata }` 上下文的一个或多个 `exact`、`range` 或 `text` key 策略。
6. 可选的 `validateIndex`；它只在完整静态索引经过条目投影和规范化后运行，不参与快速打开或 runtime state overlay。
7. 可选的 `fieldOrder: "definition"`；使用时由 `keyStrategies` 的声明顺序定义 key 顺序，由 `parseState` 返回对象的字段顺序定义领域 state 及其嵌套对象顺序。

领域必须在构造 state record 前发现重复身份；record 键是通用层的唯一 ID，definition 不再从 state 恢复身份。通用层在调用 `parseState` 前校验 record 键，parser 和 key strategy 可以直接读取 context 中的 `id`。state 内可以保留领域拥有的同名 `id` 或 `path`，但通用层不解释或自动核对这些字段。

`parseMetadata` 和 `parseState` 必须校验领域字段并确定性接受领域自身输出。完整投影先解析 metadata，再把规范化结果复制为内部递归冻结的 JSON 树；它不冻结或修改 snapshot 与 runtime 调用方提供的原始对象。逐条 parser 和 key 只能读取递归只读的 `{ id, metadata }`，不能观察 entries 或部分索引。确需跨条目检查时使用后置 `validateIndex`；失败统一映射为 `state-index.index-validation-failed`。parser 输出、metadata 契约、ID 或 key 的名称、模式和含义变化时提升 `definitionVersion`；不改变投影的实现重构和普通源内容变化不提升版本。

## Schema v3 与持久化形状

Valibot Schema 是索引结构和查询输入的真源。通用层固定使用 `schemaVersion: 3`：

- `entries[id]` 保存 `{ keys, state }`，值内不重复保存 `id`。
- `sourceRevision.metadata` 保存 metadata 来源指纹，`sourceRevision.entries[id]` 保存对应 state 来源指纹。
- `entries` 与 `sourceRevision.entries` 的 ID 集合必须完全一致。
- fingerprint 是领域拥有的不透明非空文本；同一 definition 下，相等必须保证对应来源不会产生不同投影。
- `keyDefinitions`、多值 key、查询 filter/sort、查询结果和领域数组继续使用数组并保留各自的顺序语义。

领域通过 `createStateSourceRevisionSchema` 和 `createStateIndexSchema` 组合自身的 fingerprint、metadata、state、keys 与 key definitions Schema。通用解析边界使用标准 `JSON.parse`，随后校验 schema v3、ID、revision 和成员一致性；不探测 JSON 文本中已经被标准解析覆盖的重复成员。schema v2 使用 `state-index.schema-version-unsupported` 稳定拒绝，不提供兼容读取或自动迁移；领域从权威源重新同步即可。

所有 ID record 都通过 own-property 或安全构造读取，不依赖原型链。`__proto__`、`constructor` 等符合 ID 文本规则的键可以正常构建、解析、序列化和查询。

## 快速打开、完整校验与查询

1. `createStateIndexRuntime(...).open()` 读取持久化索引，校验通用 schema、definition identity、key definitions、ID/revision 成员和一次当前 `readRevision`，再返回绑定该快照的 reader。
2. 快速打开不调用领域 `read`、`parseState`、key strategy、`validateIndex` 或完整 builder。一次成功打开后，同一 reader 的 `get/query/all` 不重复读取 revision；需要观察新状态时重新 `open`。
3. 消费者的领域 JSON Schema/check 入口负责其持久化领域形状；`parseStateIndex({ definition })`、`createStateIndexReader(...)`、build 和 sync 是需要重新执行领域 parser、key 投影与完整 `validateIndex` 的严格边界。结构合法但领域投影被手工篡改的检查属于这些严格边界，不应退化常规快速读取。
4. Reader 提供按 ID 的 `get`、`query` 和遍历全部分页的 `all`。静态 `get(id)` 直接读取 `entries[id]`；输出在消费边界附加 `{ id, keys, state }`，查询结果继续使用数组。
5. 查询支持 ID 或已声明 key、exact all/any/none、range、text、存在性、多字段排序和带上限的 offset/limit。`range` 数值按数值顺序比较，字符串按固定字典序比较；时间等领域顺序先映射为能保持真实顺序的标量。
6. 查询可以叠加由同一定义产生的 `id -> state` runtime record；同 ID 临时替换静态条目，新 ID 临时追加，磁盘索引保持不变。overlay 使用持久索引的同一 metadata 上下文，不能替换或合并 metadata。

## Revision 与同步

1. `read` 与 `readRevision` 对同一来源必须产生相同的结构化清单。任何可能改变 metadata 的输入都必须改变 metadata fingerprint；任何可能改变成员、state 或 keys 的输入都必须改变、增加或删除对应 ID fingerprint。
2. `readRevision` 只执行一次领域来源发现与内容读取，并在同一遍读取中计算 metadata 与逐 ID fingerprint；它不调用 Markdown/state parser、构造 keys、执行 `validateIndex` 或再次扫描来源。
3. `syncStateIndex` 从完整 snapshot 检查或重建 JSON，写入前再次读取并核对结构化 revision，在根目录边界内原子替换并读回验证；它不写领域源。
4. 索引只提供完整同步。选择性 pending 写入由独立协议承接，不能把该职责并入常规 runtime。
5. 序列化使 `entries` 与 `sourceRevision.entries` 的输出确定且不依赖输入 record 的插入顺序；调用方不应依赖某一种 JSON 对象成员排序算法。key 值按固定全序输出，领域 metadata 和 state 中的数组保持 parser 返回顺序。
6. metadata 对象始终递归按字段名字典序规范化；默认模式也按相同规则规范化 state 对象，`fieldOrder: "definition"` 则改用通用外壳语义顺序、key 策略声明顺序和 parser 返回的领域字段顺序。
7. 序列化固定使用 LF；检查时把 Git checkout 可能产生的 CRLF 视为等价。

## 依赖与验证

当前消费者是 `decision-records`、`investigation-report` 和 `test-evidence`。其他领域必须先完成自身 state、ID、来源 revision、key 和端到端成本设计，不能只因现有先例自动接入。

公共入口是 `src/index.ts`，行为测试是：

```bash
bun run test:index-runtime
```

测试覆盖 schema v3、领域 parser 边界、特殊 ID、revision 成员、reader 快照、runtime overlay、查询、确定性同步、快速打开调用计数和一千/五千条规模场景；规模测量只作为接入证据，不定义持续性能 SLO。
