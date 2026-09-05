# Tasks

任务先恢复四个现有 definition 和查询行为基线，再依次落地通用持久格式、声明提取、领域兼容和全量重建，最后用协议、回归、性能和仓库检查共同验收。

## Readiness

- [ ] 0.1 审计 Index Runtime 与 workspace 的全部 StateIndexDefinition、`keyStrategies`、`keyDefinitions`、definitionless parse/query、fast-open、get/query/all、runtime overlay、sync 和 selected staging 调用；列出 Decision、Investigation、Test Evidence catalog/ledger 之外的真实 consumer，若出现依赖持久 keys 的生产调用则先修订 Plan。
- [ ] 0.2 为四个领域 definition 建立查询字段矩阵，逐项记录 name、exact/range/text mode、entry ID/state path 来源、终点 cardinality、`each`、instant、filter/sort/exists 用途和公开结果；证明内置 source 可覆盖全部现有字段。
- [ ] 0.3 固定 Test Evidence 兼容基线：记录 catalog/ledger 的 state、topic、Case ID、test/tag/search 条件、文本匹配、排序、total、offset/limit、CLI/API、selected staging、fixture、生成物和 Test Evidence case；确认本 Change 只替换 StateIndex 持久与提取机制。
- [ ] 0.4 列出受影响 Index Runtime、Decision、Investigation、Test Evidence 最小原生测试入口及现有 Test Evidence case；确定需要新增或更新的 case、统一索引同步入口、领域生成命令和长期 Decision 演进目标。

## Implementation

- [ ] 1.1 在 `tools/index-runtime/` 定义并校验封闭查询字段描述，支持 entry ID、一个或多个安全 state path、终点标量数组、显式数组 `each` 和单值 `instant`；实现统一提取、标量规范化、去重、排序、缓存和含 entry ID/query field/source 的错误诊断。
- [ ] 1.2 将持久 StateIndex schema/type/canonicalization/parser/serializer 收敛为 `entries[id] = state`，保留 namespace、definitionVersion、metadata、sourceRevision 和 ID 成员闭合；区分持久 snapshot 与 reader materialized view，并移除 definitionless parse/query 表面。
- [ ] 1.3 让 reader 的 exact/range/text/exists、filter/sort、offset/limit/total 和 runtime overlay 使用内存查询值；保持 ID 保留 key、文本规范化、重复查询字段、非法输入、多值 sort、不可变快照和确定顺序契约。
- [ ] 1.4 让 build、strict parse/check、current open、sync 与 selected staging 使用新持久格式和同一提取规则；保持 source revision 快速 currentness、集合校验、并发漂移检测、原子发布、pending CAS 和恢复诊断。
- [ ] 1.5 迁移 Decision definition、state/index Schema、查询与生成声明到 entry ID/直接 path source；重建 Decision 索引并保持 list、show、trace、metadata/content search、生命周期、rename、selected sync/stage 和错误映射。
- [ ] 1.6 迁移 Investigation definition、state/index Schema、查询与生成声明到直接 path、relation `each` 和 `instant` source；重建 Investigation 索引并保持 list、show、trace、metadata/content search、limit、资源、关系、rename、selected sync/stage 和错误映射。
- [ ] 1.7 迁移 Test Evidence catalog/ledger definition、Schema、查询内部读取和生成声明到 entry ID/现有 state path source；重建统一索引，并保持 0.3 记录的领域模型、查询、staging 和公开结果不变。
- [ ] 1.8 演进 Index Runtime 长期 Decision，明确持久 state、definition 查询字段和 sourceRevision 的 owner；更新 README、领域契约、0.4 确认的 Test Evidence cases，并只通过正式入口重建所有索引、bundles、source maps、`.d.mts` 与 SDK 声明。

## Verification

- [ ] 2.1 运行 Index Runtime definition/protocol/query/runtime 测试，证明 entry ID、多 path、terminal array、`each`、instant、缺失值、非法容器/标量、去重、text 规范化、跨时区 range、exists、多字段 sort、分页、缓存、overlay 和 abort/不可变边界。
- [ ] 2.2 运行 Index Runtime materialization/storage/staging/performance 测试，证明 state-only round trip、ID/revision 成员闭合、旧 schema 明确拒绝、currentness 快速失败、strict 全量提取、selected entry 组合、CAS/并发恢复与 build/open/query 性能处于 0.1 建立的可接受基线。
- [ ] 2.3 运行 Decision 全量测试、生成检查和实际 CLI smoke，证明新索引重建后结构过滤、确定排序、metadata/content search、关系摘要、生命周期、rename、selected sync/stage 与索引恢复保持兼容。
- [ ] 2.4 运行 Investigation 全量测试、生成检查和实际 CLI smoke，证明直接字段、relation-type、formedAt 跨时区范围、metadata/content search、limit、关系/资源、rename、selected sync/stage 与索引恢复保持兼容。
- [ ] 2.5 运行 Test Evidence catalog、ledger、CLI、selected staging 与生成检查，对照 0.3 逐项证明 Case ID、topic、test/tag/search、text mode、排序、total、offset/limit、sourcePath、统一索引和 Test Evidence case 行为没有变化。
- [ ] 2.6 扫描维护源码、公开声明、JSON Schema、fixtures、生成物和持久索引，确认 StateIndex entry 没有持久 `keys`/`{state}` 包装、没有顶层持久 `keyDefinitions`、没有 definitionless query；同时确认 Test Evidence 当前 `searchText`、text mode 和产品契约未被顺手改写。
- [ ] 2.7 比较三个仓库索引在基线与新格式下的规范字节数，并运行 `bun run check`；人工复核长期 Decision、Index Runtime README、领域查询指导、生成物与测试证据，确认目标架构成为文档和实现的共同重心且没有旧持久协议残留。
