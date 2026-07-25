# Index Runtime

`tools/index-runtime/` 是派生状态索引的共享读取与同步协议 owner。它提供通用 JSON 外壳、领域定义、查询、revision 新鲜度和确定性同步；领域仍拥有原始事实、state parser、身份和查询 key。

项目级源码、生成与分发边界见 [项目工具链](../../docs/tooling.md)。

## 领域接入契约

领域通过 `StateIndexDefinition` 提供：

1. `namespace` 和 `definitionVersion`。
2. 同步且确定性的 `parseMetadata`，以及接收只读 `{ metadata }` 上下文的 `parseState`。
3. 返回同一时点 `{ revision, metadata, states }` 的 `read`，以及低成本 `readRevision`。
4. 接收同一 metadata 上下文的稳定唯一 id 和一个或多个 `exact`、`range` 或 `text` key 策略。
5. 可选的 `validateIndex`；它只在完整静态索引经过条目投影和规范化后运行，不参与 runtime state overlay。
6. 可选的 `fieldOrder: "definition"`；使用时由 `keyStrategies` 的声明顺序定义 key 顺序，由 `parseState` 返回对象的字段顺序定义领域 state 及其嵌套对象顺序。

`parseMetadata` 和 `parseState` 必须校验领域字段并确定性接受领域自身输出。通用层在投影条目前先完成 metadata 解析，再把规范化结果复制为内部递归冻结的 JSON 树；它不冻结或修改 snapshot 与 runtime 调用方提供的原始对象。逐条 parser、id 和 key 只能读取这一递归只读上下文，不能观察 entries 或部分索引。确需跨条目检查时使用后置 `validateIndex`；它接收递归只读的完整静态索引，失败统一映射为 `state-index.index-validation-failed`。parser 输出、metadata 契约或 id、key 的名称、模式和含义变化时提升 `definitionVersion`；不改变投影的实现重构和普通源内容变化不提升版本。

Valibot Schema 是索引结构和查询输入的真源：通用层固定使用 `schemaVersion: 2` 并要求顶层 `metadata` 是合法 JSON 对象，领域提供 metadata、state、keys、key definitions 和 source revision 的具体 Schema，再由 `createStateIndexSchema` 组合完整索引 Schema。没有集合级数据的领域也必须显式使用空对象 Schema 和 `"metadata": {}`；schema v1 或缺少 metadata 的索引直接失败，不提供兼容回退。

## 读取与查询

1. `createStateIndexRuntime(...).open()` 校验一次当前 revision，并返回绑定该索引快照的不可变 reader；reader 的递归只读 `metadata` 暴露领域已收窄的集合级类型，嵌套对象与数组也不能修改。
2. `createStateIndexReader(...)` 在构造边界同步执行与持久化读取相同的结构、definition 和领域校验，并持有独立的递归冻结规范化快照。调用方随后修改原始 metadata、state 或 entries 不会影响 reader；非法输入抛出 `TypeError`，消息保留对应的 `state-index.*` 诊断 code。
3. Reader 提供 `query`、按 id 的 `get` 和遍历全部分页的 `all`；同一 reader 上的多次读取不重复校验 revision，需要观察新状态时重新 `open`。
4. 查询结果包含与索引快照相同的只读 metadata，并支持 id 或已声明 key、exact all/any/none、range、text、存在性、多字段排序和带上限的 offset/limit。
5. `range` 数值按数值顺序比较，字符串按固定字典序比较；时间等领域顺序先映射为能保持真实顺序的标量。
6. 查询可以叠加由同一定义产生的完整 runtime state；同 id 临时替换静态条目，新 id 临时追加，磁盘索引保持不变。overlay 使用持久索引的同一 metadata 上下文，不能替换或合并 metadata。

## Revision 与同步

1. 同一 `definitionVersion` 下，revision 相等必须保证完整 metadata 与 state 投影相同。任何可能改变 metadata、成员、state、id 或 keys 的源变化都必须改变 revision。
2. `syncStateIndex` 从完整 metadata 与 state 快照检查或重建 JSON，写入前再次核对 revision，在根目录边界内原子替换并读回验证；它不写领域源。
3. 索引只提供完整同步。增量协议只有在领域证据和独立长期决策出现后才引入。
4. 索引不保存生成时间；条目始终按 id 固定全序输出，key 值始终按固定全序输出，领域 metadata 和 state 中的数组保持 parser 返回顺序。metadata 对象始终递归按字段名字典序规范化；默认模式也按相同规则规范化 state 对象，`fieldOrder: "definition"` 则改用通用外壳语义顺序、key 策略声明顺序和 `parseState` 的领域字段顺序，不改变条目排序。
5. 构建、解析、加载、查询和序列化必须使用同一个领域定义；`serializeStateIndex` 显式接收该定义，`fieldOrder` 不作为索引中的自描述字段持久化。解析带领域定义的索引时，`keyDefinitions` 的数组顺序也属于定义契约。
6. 序列化固定使用 LF；检查时把 Git checkout 可能产生的 CRLF 视为等价。

## 依赖与验证

当前消费者是 `decision-records`、`investigation-report` 和 `verification-evidence`。其他领域必须先完成自身 state、revision、key 和端到端成本设计，不能只因现有先例自动接入。

公共入口是 `src/index.ts`，行为测试是：

```bash
bun run test:index-runtime
```

测试覆盖领域外形、parser 边界、revision、reader 快照、runtime state、查询、确定性同步和规模场景；规模测量只作为接入证据，不定义持续性能 SLO。
