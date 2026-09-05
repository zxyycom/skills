# Design

本设计以“持久 state、声明提取、内存查询”为主线，让共享运行时复用查询机制，同时让领域 definition 保留查询字段含义。

## Context

- Index Runtime schema v3 使用 `entries[id] = { keys, state }`，顶层 `keyDefinitions` 保存查询字段名称和 mode。查询对 entries 做线性筛选和排序，因此 keys 是预计算字段投影，不是倒排索引。
- Decision 的 name、tag、status、alignment 查询值都来自 state。Investigation 另有 `relations[*].type` 的数组成员投影，以及把 `formedAt` 规范化为可跨时区比较的 instant。
- Test Evidence catalog 与 ledger 使用 exact/text 查询字段；其中组合搜索值来自 entry ID 和多个 state 字段。它继续保持当前 source、state、topic、Case 与查询行为，只把查询值从持久副本改为 reader 内提取结果。
- 仓库内生产查询均通过 Decision、Investigation、Test Evidence definition 使用 Index Runtime。当前 definitionless parse/query 主要服务通用协议与 fast-open 实现，没有已建立的独立产品调用方。
- 当前 fast open 读取通用 JSON 并检查定义身份、查询字段声明和 source revision，然后在不运行领域 parser/key strategy 的情况下绑定当前 snapshot。目标 reader 仍可先完成外壳和 revision 检查；查询再通过已提供的 definition 对 generic JSON state 执行封闭提取。
- 当前数据下，采用直接 state entries 后，Decision、Investigation、Test Evidence 索引预计分别缩小约 22.1%、29.6%、34.9%。该测量用于确认问题规模和回归方向，不定义固定压缩指标。

## Goals / Non-Goals

目标：

- 让持久索引只表达可重建 state snapshot、metadata、定义身份和来源 currentness。
- 让领域 definition 通过小型封闭描述声明查询字段，并让通用运行时统一提取、规范化、缓存、筛选和排序。
- 让同一 state 在 build、check、query、overlay、sync 与 selected staging 中使用同一查询字段语义。
- 让 Decision、Investigation 和 Test Evidence 通过一次 schema 升级落到同一协议，同时保持各自现有行为。

非目标：

- 不建立倒排索引、持久全文索引、相关性排序、正则协议或跨领域聚合查询。
- 查询字段描述不接受任意函数、动态代码、字符串表达式或领域判断。
- `sourceRevision`、领域 writer、关系语义和各领域查询 DTO 不进入共享提取器责任。
- Test Evidence 继续使用当前目录、topic、Case ID、state、`searchText`、text mode 和审阅规则；本 Change 不优化或重新定义这些能力。

## Decisions

### Intended Change

1. **持久格式以 state 为条目。** 通用 schema 的 `entries` 使用稳定 ID 键控领域 state；顶层继续保存 schemaVersion、namespace、definitionVersion、metadata 和 sourceRevision。集合 metadata 与两个 ID record 的成员关系继续接受完整校验。
2. **definition 是查询契约入口。** parser、runtime 和 query 均通过 definition 取得 state parser、完整集合 validator 与查询字段描述。definitionVersion 在字段名称、mode、来源、路径、展开或规范化语义变化时提升；持久文件无需重复字段描述。未来独立调用方同样显式选择领域 definition。
3. **查询字段使用纯数据描述。** definition 以 discriminated union 声明字段 mode 与一组内置 source。source 支持 entry ID、state 路径、路径中的显式数组 `each`，以及单值时间路径的 `instant`。多个 source 的值组成同一查询字段，可表达 Test Evidence 现有 ID/title/searchText 组合，而无需拼接持久 key。
4. **统一提取和诊断。** 普通 path 可读取标量或终点标量数组；`each` 只展开实际数组；`instant` 只接受一个时间文本并形成有限时间戳。路径只读取 own property。缺失可选路径形成空值；容器或终点不合法时，诊断包含 entry ID、查询字段和 source。
5. **reader 内物化查询值。** 当前 snapshot 的查询值按 entry 生成并由 reader 缓存；一次查询中的多个 filter/sort 不重复遍历 state。runtime overlay 使用相同 definition 为 overlay state 建立值并覆盖同 ID 视图。纯查询不会把缓存写回索引。
6. **现有查询语义保持稳定。** exact、range、text、exists、查询输入校验、文本规范化、多值 sort 拒绝、确定排序与 offset/limit/total 沿用当前协议。查询字段来源数量只影响取值，不改变对应 mode 的匹配规则。
7. **严格边界验证完整投影。** build、definition-aware parse/check、sync 和 selected staging 对完整目标 state 集合执行 parser、查询字段提取与 validateIndex。fast open 可以先用通用外壳和 sourceRevision 拒绝不可用 snapshot；建立 reader 时验证 state 和查询字段，不读取领域源建立 fallback。
8. **协议升级通过重建落地。** schemaVersion 升级，Decision、Investigation、Test Evidence catalog 与 ledger definition 和领域 JSON Schema 同步更新；各领域 check 对不兼容 snapshot 给出对应 sync recovery。维护源码生成 bundles、source maps、`.d.mts` 和 SDK 声明，全量 sync 生成规范新索引。

### Resulting Impacts

- **通用类型。** 持久 StateIndex 与 reader 内部 materialized view 成为不同类型；持久 entry 只有 state，查询值不成为序列化或公开索引字段。公开领域结果继续返回稳定 ID 和既有 state 摘要。
- **定义校验。** definition validator 需要验证查询字段 name/mode、source kind、非空安全路径、`each` 位置、instant cardinality 和保留 ID key 冲突。多 source 使用现有标量规范化、去重和固定排序。
- **快速读取。** currentness 检查继续只读取索引与来源 revision，不解析领域源。get/query/all reader 必须使用 definition；需要查询时才形成当前 snapshot 的查询值。
- **staging 与 revision。** source fingerprint 继续覆盖所有可能改变 state 或查询结果的来源。selected staging 按 ID 组合 state 和 entry revision，在目标发布前执行完整 definition 校验。
- **领域接入。** Decision 使用 entry ID 或直接路径；Investigation 使用直接路径、relation `each` 和 instant；Test Evidence 使用 entry ID 与现有 state 字段组合，并保持现有 exact/text mode、过滤和输出。
- **分发与证据。** Index Runtime README、领域 skill/contract、Decision SDK、Investigation API、Test Evidence API/CLI、JSON Schema、fixtures、生成物和最小原生测试 case 随协议同步；统一 Test Evidence 索引只通过正式 sync 入口重建。
- **长期判断。** 实施交付前演进 `maintain-rebuildable-read-side-index-boundary` 或建立其后继，固定“持久 state snapshot、definition 查询字段、sourceRevision currentness”的 owner 分工。

## Risks / Trade-offs

- 查询字段提取从构建期副本读取改为 reader 内计算；缓存可限制重复成本，但需要以现有性能 fixture 比较 build/open/query 和大集合 Test Evidence 查询。
- 索引调试需要同时查看 state 与对应 definition。正式入口已经是领域 CLI/API，因此接受该成本以换取单一持久事实和更小同步面。
- 多 source、`each` 和 instant 应覆盖全部现有字段；新 source kind 只有出现第二个可靠消费者时才进入共享协议，避免形成表达式语言。
- 一次协议升级会同时影响四个 definition 和多个生成边界。串行迁移、全量重建与 workspace consumer 扫描必须证明没有混用两种 entry 结构。
- Test Evidence 是必要兼容消费者而不是本轮优化目标。其测试只证明现有行为未受索引结构变化影响，不以本 Change 扩大或重写测试理念。

## Open Questions

无。字段来源和现有查询行为由当前四个 definition 提供实施基线；若审计发现内置 source 无法表达实际字段，应先修订并重新计划，而不是在实现中增加任意 derive。
