# Design

本设计把 state index 中承担稳定身份的集合统一为按 id 键控的对象，并用同样的 id 组织可快速读取和独立组合的来源 revision。

## Context

当前通用运行时存在四个身份集合：领域完整读取的 `states`、持久化 `entries`、runtime overlay 和选择性暂存需要处理的 revision 条目。它们的主要操作都是按稳定 id 校验、替换、追加、删除或获取，但前三者仍以数组表达，并由 definition 的 `identify` 再次恢复 id。

当前三个消费者都已经在领域读取阶段知道稳定 id：decision-records 与 investigation-report 使用相对路径，test-evidence 使用 case id。通用查询仍需建立 `Map` 或扫描条目，说明当前数组表示没有承接真实使用方式。

新鲜度路径必须保持独立价值。现有千条 investigation-report 规模测试中，完整同步约为 1.5 秒，快速新鲜度读取约为 64 毫秒，包含检查的一次查询约为 107 毫秒。具体数值受环境影响，但快速路径与完整解析属于不同成本级别；本 change 不能通过重新投影全部 state 来获得来源 revision。

长期方向由 [`use-id-keyed-state-index`](../../docs/decisions/index-runtime/use-id-keyed-state-index.md) 承接。选择性 `pending` 写入由 [`stage-selected-index-entries`](../stage-selected-index-entries/) 承接，本设计只建立其前置索引契约。

## Goals / Non-Goals

目标：

- 稳定 id 在领域读取边界已经显式存在，并作为 snapshot、索引、runtime overlay 与来源 revision 的唯一集合键。
- 持久化索引可以直接按 id 获取、比较和组合条目，不保存第二份通用 entry id。
- 完整读取与快速新鲜度读取使用同一个结构化来源 revision 契约，快速路径不执行领域解析。
- schema v3、类型、运行时、领域 Schema 与三个消费者一次性迁移，没有双格式分支。
- 所有对象键操作保持确定性并对特殊键安全；解析后的索引必须通过 Schema、身份键和来源 revision 集合校验。

非目标：

- 不改变领域事实源、state 内部结构或 metadata 语义。
- 不把有顺序、分页或多值语义的集合改为对象。
- 不在本 change 中写入版本控制 `pending`。
- 不承诺任意 filter 查询变成常数时间，也不建立持续缓存或 watcher。

## Decisions

1. **身份集合统一按 id 键控。** `StateSnapshot.states`、`StateIndex.entries`、`ReadonlyStateIndex.entries` 和 `StateIndexQueryOptions.runtimeStates` 使用只读 id record。对象键必须通过现有 id 文本规则；id 是唯一权威身份，definition 删除 `identify`。

   ```ts
   type StateRecord<State extends object> = Readonly<{
     [id: string]: State;
   }>;

   type StateSnapshot<State extends object, Metadata extends JsonObject> = {
     metadata: Metadata;
     sourceRevision: StateSourceRevision;
     states: StateRecord<State>;
   };
   ```

   领域在构造 record 前负责发现重复的领域身份，不能先覆盖后交给通用层。通用层在读取键后、调用 state parser 前校验 id。

2. **projection context 显式携带 id。** `parseState` 与每个 key strategy 接收只读 `{ id, metadata }`；它们不再从 state 字段恢复通用身份。state 仍是领域拥有的不透明 JSON 对象，领域可以保留与键同值的 `path` 或 `id`，但通用运行时不依赖或自动校验这些字段。

3. **持久化条目与有序查询结果使用不同形状。** schema v3 的 `entries` 是 `id -> { keys, state }` 对象，不在值内保存 `id`。reader 的 `get` 和查询结果仍返回 `{ id, keys, state }`，由运行时在消费边界附加对象键；查询结果继续使用数组以表达排序和分页。

   ```json
   {
     "schemaVersion": 3,
     "namespace": "example",
     "definitionVersion": 1,
     "metadata": {},
     "sourceRevision": {
       "metadata": "sha256:metadata",
       "entries": {
         "a": "sha256:source-a"
       }
     },
     "keyDefinitions": [
       { "name": "status", "mode": "exact" }
     ],
     "entries": {
       "a": {
         "keys": { "status": ["active"] },
         "state": { "title": "A" }
       }
     }
   }
   ```

4. **`sourceRevision` 是可组合的来源清单。** `StateSourceRevision` 固定包含一个 metadata 来源指纹和一个按 id 键控的条目来源指纹对象。指纹是领域拥有的不透明非空文本；相等表示在同一 definition 下，对应来源不会产生不同的 metadata 或 state 投影。

   - `sourceRevision.entries` 的 id 集合必须与 snapshot `states` 或持久化 `entries` 完全相同。
   - metadata 的任何权威输入变化必须改变 `sourceRevision.metadata`。
   - 可能改变某个 id 的存在、state 或 keys 的任何权威输入变化必须改变或增删该 id 的条目指纹。
   - 一个来源影响多个 id 时，领域可以为这些 id 使用相同指纹或分别计算包含全部依赖的指纹；通用层不解释来源路径。

5. **完整读取与快速读取返回同一 revision 结构。** `StateIndexDefinition.read` 返回 metadata、state record 和同一时点的 `sourceRevision`；`readRevision` 只返回 `StateSourceRevision`。普通 build/sync 使用完整 snapshot，runtime `open` 使用快速 revision 与持久化清单比较。

   每个领域的快速读取最多执行一次既有来源发现与内容读取，在同一遍读取中计算 metadata 和逐 id 指纹。它不得调用 Markdown/state parser、构造 keys、执行 `validateIndex` 或再次读取同一来源。一个成功打开的 reader 后续执行 `get/query/all` 不再调用 `readRevision`。

6. **对象键规范化不改变数组语义。** 通用序列化使 `entries` 与 `sourceRevision.entries` 的输出确定且不依赖输入顺序，不额外规定 JSON 对象成员必须使用某一种文本排序。metadata/state 对象继续遵守既有 field order 规则。`keyDefinitions`、query filters/sorts、查询结果、多值 key 和领域数组保持数组。

   所有 id record 使用 own-property 检查或无原型内部对象，不通过原型链读取。索引 JSON 按标准 JSON 语义解析，再验证 Schema、id 合法性以及 `entries` 与 `sourceRevision.entries` 的成员一致性；`__proto__`、`constructor` 等符合文本规则的 id 必须作为普通键安全往返。

7. **schema v3 一次性替换 schema v2。** 通用 parser、领域 Schema 和生成产物只接受 schema v3；schema v2 以稳定版本诊断失败，由领域 sync 从权威源重建。通用外壳迁移本身不要求提升领域 `definitionVersion`；只有领域 state、metadata、id 或 key 含义变化时才按既有规则提升。

8. **字典只优化按 id 操作。** reader 静态 `get` 直接读取 `entries[id]`；runtime overlay 先按 id 替换或追加，再复用既有投影和校验。普通 filter、text、range、sort 和分页仍遍历候选条目，本 change 不宣称建立倒排查询结构。

## Risks / Trade-offs

- schema v3 会同时改变公共类型、持久化索引、领域 Schema、生成产物和 fixture；不保留 schema v2 读取能减少长期分支，但要求三个消费者在同一实施中完成迁移并重建派生索引。
- 每个 id 增加一个来源指纹会扩大索引和快速 revision 结果；它换取选择性组合与轻量新鲜度检查，实施必须证明没有新增源读取遍数或完整 parser 调用。
- id record 在 JavaScript 中存在原型敏感键风险；实现必须在统一边界处理，不能让每个消费者自行规避。
- 领域必须能把 metadata 与每个 id 的来源影响表示为稳定指纹。当前三个消费者具有明确路径或 case id；未来无法满足该义务的领域不能只复用部分契约接入。
- 按 id 直接获取会变快，但完整校验、任意过滤与排序仍与条目数量线性相关。
- 当前性能实测来自缓存较热的临时目录；验收以“单次读取、零完整 parser”结构门禁为主，并保留规模测量防止明显墙钟退化。

## Open Questions

无。
