# Design

本设计以“持久 state、声明提取、内存查询”为主线，复用共享 Runtime，同时让 definition 保留字段含义和每个持久索引的明确 owner。

## Context

- Change 基线 `f936ba8636e54321ad83692af1f796f0464a3991` 的 Index Runtime schema v3 使用 `entries[id] = { keys, state }`，顶层 `keyDefinitions` 保存字段名称和 mode。查询对 entries 线性筛选和排序，因此 keys 是预计算投影，不是倒排索引。
- 四个生产 definition 已核对完毕：Decision 为 name/tag/status/alignment；Investigation 为 name/tag/formed-at/relation-type；catalog 为 search/topic；ledger 为 search/tag/test。所有领域查询按保留 `id` 升序排序；没有领域生产调用 `exists` filter。
- Decision 的字段都来自直接 state path 或终点数组。Investigation 的 relation-type 是 `relations[*].type`，formed-at 将单个 `formedAt` 文本规范化为跨时区可比较的 instant。
- catalog search 由 entry ID 与 state `searchText` 组成；`searchText` 已保存 title、Contract、Proves 和 Entry 的组合文本。catalog topic 由 `state.sourcePath` 的首路径段产生，并由 `metadata.topics` 交叉验证；state 不保存重复 topic。
- ledger search 由 entry ID 与 state `searchText` 组成，tag/test 来自 state 数组。基线的 `queryTestEntities` 直接读取 `entry.keys.test` 构造 Test→Case 反向关系；当前实现读取 `state.testIds`。
- 基线中 catalog 与 ledger 都指向 `docs/test-evidence/test-evidence-index.json`、同为 namespace `test-evidence`，但 definitionVersion、metadata、state 和字段集不同。两套严格 source layout 本已互斥，且没有文档将该同路径声明为过渡协议；两者都有 `sync-index --write`，最后写入者可覆盖该路径。当前 ledger 使用独立 path；旧共享路径的 definition mismatch 只作为可恢复 fallback，不能成为共享 owner。
- 当前 fast open 先读取通用外壳、检查 definition identity 与 source revision；不 current 的 snapshot 在读取领域 state 前失败。current snapshot 建立 reader 时以显式 definition 对完整 state 执行封闭提取与领域校验。
- 当前工作树相对 Change 基线的原始 JSON 字节数，Decision、Investigation、catalog 分别缩小 22.35%、29.63%、34.69%。真实仓库不含 ledger source layout，故没有第四份可比较索引；这些数值说明本次输入的结果，不构成固定压缩指标。

## Goals / Non-Goals

目标：

- 让每个持久索引只表达可重建 state snapshot、metadata、definition identity 和 source currentness。
- 让 definition 通过小型封闭描述声明字段，并由 Runtime 统一提取、规范化、缓存、筛选和排序。
- 让同一 state 在 build、check、query、overlay、sync 与适用 selected staging 中使用相同字段语义。
- 让 Decision、Investigation、catalog 与 ledger 通过一次 schema 升级进入 state-only 协议，并保持各自已审计的行为。
- 为 catalog 和 ledger 赋予不同持久 index path，消除相同路径的 writer owner 冲突，而不合并两个 Test Evidence 产品模型。

非目标：

- 不建立倒排索引、持久全文索引、相关性排序、正则协议或跨领域聚合查询。
- 字段描述不接受任意函数、动态代码、字符串表达式或任意字符串 transform。
- 不把 `sourceRevision`、领域 writer、关系语义和领域 query DTO 移入共享提取器。
- 不将 catalog 与 ledger 的 source layout、Case 模型、metadata 或 CLI/API 合并；两者继续互斥，独立 index path 不表示可在同一 workspace 同时启用。
- 不改变 catalog 的 topic/Case/state/searchText/selected staging，或 ledger 的 Test/tag/search/fallback；ledger 不因本 Change 获得 selected staging。

## Decisions

### Intended Change

1. **持久格式以 state 为条目。** 通用 schema 的 `entries` 使用稳定 ID 键控领域 state；顶层保留 schemaVersion、namespace、definitionVersion、metadata 和 sourceRevision。集合 metadata 与两个 ID record 的成员关系继续接受完整校验。
2. **definition 是查询契约入口。** parser、runtime 与 query 均通过 definition 取得 state parser、完整集合 validator 和字段描述。字段 name/mode/source/path/展开/normalization 变化时提升 definitionVersion；持久文件不重复字段描述。未来独立调用方同样显式选择 definition。
3. **查询字段使用纯数据描述。** source 是 discriminated union，仅支持 entry ID、安全 state path、终点标量数组、路径中的显式 `each`、单值 `instant`，以及 `sourcePath` 的固定首路径段。首路径段 source 只从一个已验证的相对 POSIX state path 输出首个 segment；它没有可配置 segment index、分隔符或 callback。多个 source 的值组成同一字段，可表达 Test Evidence ID + searchText，而无需拼接持久查询值。
4. **统一提取和诊断。** 普通 path 可读取标量或终点标量数组；`each` 只展开实际数组；`instant` 只接受一个时间文本并形成有限时间戳；首路径段只接受合法相对 POSIX path。路径只读取 own property。缺失可选路径形成空值；容器、终点、时间或路径不合法时，诊断包含 entry ID、字段和 source。
5. **reader 内物化查询值。** 当前 snapshot 的查询值按 entry 生成并由 reader 缓存；一次查询中的多个 filter/sort 不重复遍历 state。runtime overlay 用同一 definition 为 overlay state 建值并覆盖同 ID 视图。纯查询不把缓存写回索引。
6. **现有查询语义保持稳定。** exact、range、text、exists、输入校验、文本规范化、多值 sort 拒绝、确定排序与 offset/limit/total 沿用当前协议。多个 source 只影响取值，不改变 mode 的匹配规则。ledger Test→Case 反向映射从 state `testIds` 建立，避免 reader 内查询值成为公开依赖。
7. **严格边界验证完整投影。** build、definition-aware parse/check、sync 和适用 selected staging 对完整目标 state 集合执行 parser、字段提取与 validateIndex。fast open 可以先由通用外壳和 sourceRevision 拒绝不可用 snapshot；建立 reader 时验证 state 与字段，不读取领域源建立 fallback。
8. **Test Evidence index identity 分离。** catalog 保持 `docs/test-evidence/test-evidence-index.json`，ledger 使用 `docs/test-evidence/test-evidence-ledger-index.json`。各自 read/check/sync/fallback 只操作 own path；ledger 旧共享路径的定义不匹配可作为可恢复旧索引被重建到新 path，不覆盖 catalog index。catalog selected staging 只操作 catalog path；ledger 维持无 selected staging。
9. **协议升级通过重建落地。** schemaVersion 升级，Decision、Investigation、catalog 与 ledger definition、领域 JSON Schema 和独立 index path 声明同步更新。各领域 check 为不兼容 snapshot 给出对应 sync recovery。维护源码、catalog 分发 bundles/source maps/`.d.mts`、以及适用 SDK declaration 通过正式生成入口同步。

### Resulting Impacts

- **通用类型。** 持久 StateIndex 与 reader materialized view 成为不同类型；持久 entry 只有 state，查询值不成为序列化或公开索引字段。公开领域结果继续返回既有稳定 ID 和 state 摘要。
- **定义校验。** definition validator 需要验证 field name/mode、source kind、非空安全 path、`each` 位置、instant cardinality、首路径段输入和保留 ID key 冲突。多 source 使用既有标量规范化、去重和固定排序。
- **快速读取。** currentness 检查继续只读取索引与来源 revision，不解析领域源。get/query/all reader 必须使用 definition；需要查询时才物化当前 snapshot。
- **staging 与 revision。** source fingerprint 继续覆盖所有会改变 state 或查询结果的来源。Decision、Investigation 和 catalog selected staging 按 ID 组合 state/revision 并在发布前完整验证；ledger 没有 selected staging，不能把 catalog 的 pending/CAS 契约推广给它。
- **领域接入。** Decision 使用直接 path；Investigation 使用直接 path、relation `each` 和 instant；catalog 使用 entry ID、state searchText 和 sourcePath 首段，同时以领域 parser 保留 topic metadata membership；ledger 使用 entry ID、state searchText/tags/testIds，并以 state `testIds` 支持反向查询。
- **Test Evidence path 边界。** ledger 的新 indexPath 需要同步其 schema、API/CLI result、workspace allowed-member/identity checks、fixture 与 fallback diagnostics。catalog 的固定 root 规则和生成 skill artifact 不承接 ledger；若后续要求两套 layout 共存，必须另立产品 Change。
- **分发与证据。** Index Runtime README、领域契约、Decision SDK、Investigation API、catalog API/CLI、JSON Schema、fixture、生成物和最小原生测试 case 随协议同步。ledger 目前没有 `skills/test-evidence-review/` 的分发制品；实施时只同步其实际 API declaration/CLI 边界，不虚构 skill 生成物。
- **长期判断。** `260905-separate-persistent-state-from-query-projection` 已作为 active + aligned 后继，明确 state snapshot、definition fields、sourceRevision currentness 与独立 index identity 的 owner 分工。

## Risks / Trade-offs

- 查询字段从构建期副本读取改为 reader 内计算；缓存可限制重复成本，但需以现有性能 fixture 比较 build/open/query 和大集合 Test Evidence 查询。
- 索引调试需要同时查看 state 与 definition。正式入口已是领域 CLI/API，接受此成本以换取单一持久事实和更小同步面。
- 固定首路径段是 catalog 已有 topic 兼容所必需的唯一额外 source，不是可扩展 transform 机制。其类型、输入 grammar 和测试必须防止演变为表达式语言。
- 一次协议升级影响四个 definition 和多个生成边界。串行迁移、独立 Test Evidence index path、全量重建与 workspace consumer 扫描必须证明当前持久格式不混入旧协议，也不会发生路径覆盖。
- Test Evidence 是兼容消费者而非本轮优化目标。ledger indexPath 调整只消除 owner 冲突；不代表 layout、Case 粒度、topic、Test relation 或证据充分性调整。

## Open Questions

无。四个字段矩阵、catalog 首路径段和 ledger path owner 已由当前 definition、生产调用、schema、fixture 与领域测试核对；实现中不得以新的任意 derive 回避这些边界。
