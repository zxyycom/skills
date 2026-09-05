# Index Runtime

`tools/index-runtime/` 是可重建派生状态索引的共享读取与同步协议 owner。它提供 schema v4 通用外壳、ID 键控 state snapshot、结构化来源 revision、definition-owned 查询字段、reader 内查询物化、确定性同步与 selected staging。领域继续拥有原始事实、稳定 ID、state/metadata parser、来源 fingerprint、集合校验和领域查询 DTO。

项目级源码、生成与分发边界见[项目工具链](../../docs/tooling.md)。

## 领域 Definition

领域通过 `StateIndexDefinition` 提供：

1. `namespace` 与正整数 `definitionVersion`。
2. 同步且确定性的 `parseMetadata`，以及接收只读 `{ id, metadata }` 上下文的 `parseState`。
3. `read`，在同一时点返回 `{ sourceRevision, metadata, states }`；`states` 为 `id -> state`，`sourceRevision` 为 `{ metadata, entries: id -> fingerprint }`。
4. `readRevision`，只返回与 `read` 同构的低成本来源清单。
5. 非空 `queryFields`；每个字段声明 `name`、`exact | range | text` mode 和一个或多个封闭 source descriptor。
6. 可选 `validateIndex`；完整 build、严格 parse/load、成功 current load、sync 和 selected staging 都在解析全部 state、验证全部查询字段后调用它。
7. 可选 `fieldOrder: "definition"`；启用后，持久 state 保留 `parseState` 返回的字段顺序，否则对象字段按字典序规范化。

查询字段只接受以下 source：

```ts
queryFields: [
  {
    name: "search",
    mode: "text",
    sources: [
      { kind: "entry-id" },
      { kind: "state-path", path: ["searchText"] }
    ]
  },
  {
    name: "tag",
    mode: "exact",
    sources: [{ kind: "state-path", path: ["tags"] }]
  },
  {
    name: "relation-type",
    mode: "exact",
    sources: [
      {
        kind: "state-path",
        path: ["relations", { kind: "each" }, "type"]
      }
    ]
  },
  {
    name: "formed-at",
    mode: "range",
    sources: [
      {
        kind: "state-path",
        path: ["formedAt"],
        normalization: "instant"
      }
    ]
  },
  {
    name: "topic",
    mode: "exact",
    sources: [{ kind: "source-path-first-segment" }]
  }
]
```

- `entry-id` 读取 record ID。
- `state-path` 的字符串 segment 只读取 own property。缺失 property 产生空值；需要继续读取时遇到非对象、`each` 遇到非数组、或终点不是合法标量/标量数组时失败。
- 终点数组作为多值字段读取；路径内只有显式 `{ kind: "each" }` 才展开数组成员。
- `normalization: "instant"` 只允许 `range` 字段和不含 `each` 的单值路径；输入必须是可解析为有限时间戳的一个字符串。
- `source-path-first-segment` 只读取 state own property `sourcePath`，校验其为规范相对 POSIX 路径并输出首段。它是固定兼容 source，不接受字段名、segment 参数、分隔符、callback 或其他 transform。
- 多 source 的标量结果合并后按类型和值去重并固定排序。definition descriptor 不接受函数、字符串表达式或开放扩展点。

record 键是通用层的唯一 ID。领域必须在构造 state record 前发现重复身份；通用层不从 state 恢复身份，也不自动核对 state 内同名 `id` 或 path。parser 输出、metadata、查询字段 source/name/mode 或含义变化时必须提升 `definitionVersion`。

## Schema v4 与持久化

Valibot Schema 是索引外壳和查询输入的真源。持久索引固定为：

```json
{
  "schemaVersion": 4,
  "namespace": "example",
  "definitionVersion": 2,
  "metadata": {},
  "sourceRevision": {
    "metadata": "metadata-fingerprint",
    "entries": { "item-1": "item-fingerprint" }
  },
  "entries": {
    "item-1": { "title": "Example" }
  }
}
```

`entries[id]` 直接保存领域 state；没有 entry `{ state }` wrapper、持久查询值或顶层字段定义。`entries` 与 `sourceRevision.entries` 的 ID 集合必须完全一致。fingerprint 是领域拥有的不透明非空文本；同一 definition 下，相等必须保证对应来源不会产生不同 state 或查询结果。

`createStateSourceRevisionSchema` 组合领域 ID/fingerprint schema；`createStateIndexSchema` 组合 ID、metadata、state、source revision 与 definition identity，不接收查询字段 schema。schema v3 及其他旧版本以 `state-index.schema-version-unsupported` 拒绝；领域从权威来源重建，不提供双格式读取或自动迁移。

所有 ID record 使用 own-property 或安全 record 构造访问；`__proto__`、`constructor` 等符合 ID 文本规则的键能够正常构建、解析、序列化和查询。JSON 文件严格解码 UTF-8 后使用标准 `JSON.parse`；不探测标准解析已覆盖的重复 JSON member。

## 严格边界、currentness 与 reader

公开 `parseStateIndex`、`loadStateIndex`、`queryStateIndex`、`findStateIndexEntry` 以及 reader/runtime 构造都必须显式提供 definition。持久文件不是可脱离领域 definition 使用的自描述查询文件。

`loadCurrentStateIndex` 和 `runtime.open()` 先用私有通用 envelope parser 校验 schema、definition identity、ID/revision 成员，再调用一次 `readRevision`。不 current 的 snapshot 在读取领域 state parser、字段提取或集合 validator 前快速失败；current snapshot 随后严格解析全部 metadata/state、验证全部查询字段和集合契约。

reader 为当前 snapshot 的每个 entry 物化私有 `{ id, state, queryValues }` 并缓存；查询值不进入持久索引或公开 entry。一个 reader 的后续 `get/query/all` 不再读取 revision，也不重复提取静态查询值。要观察新 revision，必须重新 `open`。公开 entry 始终只有 `{ id, state }`，公开 metadata、state 和完整索引 view 都是与调用方输入分离的递归冻结快照。

查询支持：

- 保留 `id` 或 definition 声明字段；
- exact `all | any | none`、range、text、exists；
- 多字段排序，未显式排序时按 `id` 升序；
- offset、limit 和过滤前后可核对的 `total`；
- 文本 NFKC/小写规范化；
- 多值字段拒绝作为 sort key；相同 sort 值最终以 `id` 打破平局。

runtime state overlay 是 `id -> state`。同 ID 临时替换静态 entry，新 ID 临时追加；overlay 使用持久 snapshot 的 metadata 上下文，经同一 parser 和查询字段提取器物化，不修改磁盘索引或静态缓存。overlay 不执行完整集合 `validateIndex`。

## 索引路径边界

`indexPath` 必须是规范化 POSIX 相对路径。Runtime 把 `context.root` 解析为规范根目录，再沿已有组件逐段核对文件系统身份：根目录本身和指向根内的目录符号链接可用；指向根外的中间目录或目标文件在读取、同步写入或按 ID staging 前以 `state-index.index-path-invalid` 拒绝。

目标不存在时，剩余路径锚定到最近的已存在规范祖先。同步逐级创建并复核实际父目录仍在根内，再原子替换目标并读回验证。

## Revision、sync 与 selected scope

`read` 和 `readRevision` 必须产生相同结构化来源清单。任何可能改变 metadata 的输入都必须改变 metadata fingerprint；任何可能改变成员、state 或查询结果的输入都必须改变、增加或删除对应 ID fingerprint。

`syncStateIndex`：

1. 完整 `read`、parse、字段提取与集合验证；
2. 写入前再次 `readRevision` 并拒绝并发漂移；
3. 规范序列化 state-only snapshot；
4. check 比较当前文本，write 在根目录边界内原子替换并读回验证；
5. 不写领域源。

省略 scope 或 `{ kind: "all" }` 是全量同步。`{ kind: "selected", selectedIds }` 只限制本次允许接纳的 ID 变化，不减少来源读取、完整验证或最终发布范围。selected 需要可信 baseline；对 baseline/candidate 的 state 与逐 ID revision 计算 `changedIds`。新增选择新 ID，删除选择旧 ID，rename 同时选择旧/新 ID。集合 metadata/revision 变化、所选 ID 两侧均不存在、或存在未选择变化都会在写前失败。成功 write 发布的仍是完整 candidate，字节等同同来源的全量重建。

## 按 ID staging 到 pending

`stageSelectedIndexEntries` 与 runtime `stageSelectedEntries` 是独立的版本管理 pending 操作，不读取领域来源，也不由 selected sync 调用。

操作固定 current revision；严格解析 revision 中的 baseline 与工作区同路径 candidate，核对集合 metadata，再按同一 ID 存在性规则组合 state 和逐 ID fingerprint。组合结果重新执行完整 parser、查询字段提取、集合验证与规范序列化，不复制任何内存查询值。目标 pending 通过受锁 compare-and-swap 替换；目标外 pending、工作区索引和领域源保持不变。

竞争返回 `pending-conflict` 且不覆盖 winner。可恢复写失败报告 `pending: { outcome: "no-change" }`；只有无法证明恢复完整时返回 `pending-recovery-failed` 与 `partial-or-unknown`，调用方必须通过版本管理公共 API 对账目标范围后再决定后续动作。

## 诊断与验证

`StateIndexDiagnostic` 始终包含稳定 `code`、`path` 和 `stateId`（不适用时为 `null`）。查询字段提取失败的 message 同时定位 entry ID、字段名和 source descriptor。明确的文件系统或版本管理失败可以附带净化后的 cause category、operation、target 和 detail；领域 parser/validator 异常不猜测为系统失败。

公共入口是 `src/index.ts`。行为测试：

```bash
bun run test:index-runtime
```

测试覆盖 schema v4 state-only round trip、封闭 source validation、entry ID、多 source、终点数组、`each`、instant、固定 sourcePath 首段、缺失值、非法容器/标量/path、去重、exact/range/text/exists、排序/分页、reader/overlay、currentness、sync、selected scope、pending CAS、特殊 ID、不可变快照、abort 和一千/五千条规模场景。规模测量是回归证据，不定义持续性能 SLO。
