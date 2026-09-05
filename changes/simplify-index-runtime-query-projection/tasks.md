# Tasks

任务记录 state-only Runtime 与独立 Test Evidence index identity 的真实进度；每个已完成项的证据见文末。

## Readiness

- [x] 0.1 已在 Change 基线扫描生产 definition、definition-aware parse/query、fast open、get/query/all、overlay、sync 和 staging 调用。唯一四个领域 definition 是 Decision、Investigation、Test Evidence catalog 与 ledger；没有 definitionless 生产 consumer。基线中唯一直接消费持久查询值的是 ledger `queryTestEntities` 的 `entry.keys.test`，当前实现改读 `state.testIds`。
- [x] 0.2 已建立字段矩阵：Decision `name/tag/status/alignment` 都是 exact；Investigation `name/tag` exact、`formed-at` range instant、`relation-type` 为 `relations[*].type` exact；catalog `search` text、`topic` exact；ledger `search` text、`tag/test` exact。所有生产查询按保留 `id` 升序排序，未调用 exists；直接 path、终点数组、`each`、instant、entry ID + searchText 都可表达，catalog topic 需要固定 sourcePath 首路径段 source。
- [x] 0.3 已固定 Test Evidence 兼容基线。catalog state 为 `id/title/summary/sourcePath/line/endLine/entries/searchText`，topic 由 sourcePath 与 topic metadata 决定，保留 Case ID、text-all、topic、ID 排序、total、offset/limit、只读 fallback、selected sync/staging 和 catalog CLI/API。ledger state 为 `title/summary/sourcePath/testIds/tags/searchText`，保留 Case ID、test/tag/search 交集、ID 排序、total、offset/limit、只读 fallback 和 ledger CLI/API；ledger 没有 selected staging。两套 layout 互斥；基线的同路径 writer owner 冲突由 ledger 独立 path 解决。
- [x] 0.4 已确认最小原生测试与交付边界：Index Runtime `tools/index-runtime/tests/run.ts`；Decision `tools/decision-records/tests/run.ts` 与 `skills/decision-records/` 生成制品；Investigation `tools/investigation-report/tests/run.ts` 与 `skills/investigation-report/` 生成制品；catalog/ledger `tools/test-evidence/tests/run.ts`，catalog 的 `skills/test-evidence-review/` schema、declaration、bundle/source map 和对应 `docs/test-evidence/` Case。ledger 无对应 skill 生成制品，只同步实际 API/CLI declaration 边界。长期 Decision 已由 active + aligned 的 `260905-separate-persistent-state-from-query-projection` 承接。

## Implementation

- [x] 1.1 在 `tools/index-runtime/` 定义并校验封闭字段描述：entry ID、一个或多个安全 state path、终点标量数组、显式数组 `each`、单值 `instant` 与固定 sourcePath 首路径段。首路径段 source 只接受已验证相对 POSIX state path，不接受任意 transform、segment 参数或 callback；统一提取、标量规范化、去重、排序、缓存和含 entry ID/field/source 的诊断已落地。
- [x] 1.2 持久 StateIndex schema/type/canonicalization/parser/serializer 已收敛为 `entries[id] = state`，保留 namespace、definitionVersion、metadata、sourceRevision 与 ID 成员闭合；持久 snapshot 与 reader materialized view 已区分，definitionless parse/query 表面已移除。
- [x] 1.3 reader 的 exact/range/text/exists、filter/sort、offset/limit/total 与 runtime overlay 已使用内存查询值；ID 保留字段、文本规范化、重复字段、非法输入、多值 sort、不可变 snapshot 和确定顺序保持。领域没有 exists 调用，未因此扩大公开行为。
- [x] 1.4 build、strict parse/check、current open、sync 与适用 selected staging 已使用 state-only 格式和同一提取规则；source revision 快速 currentness、集合校验、并发漂移检测、原子发布、pending CAS 与恢复诊断保持。selected staging 只覆盖既有 Decision、Investigation、catalog 边界，ledger 未新增该能力。
- [x] 1.5 已迁移 Decision definition、state/index Schema、查询与生成声明至 entry ID/直接 path source；Decision 索引已重建，list、show、trace、metadata/content search、生命周期、rename、selected sync/stage 与错误映射保持。
- [x] 1.6 已迁移 Investigation definition、state/index Schema、查询与生成声明至直接 path、relation `each` 和 instant source；Investigation 索引已重建，list、show、trace、metadata/content search、limit、资源、关系、rename、selected sync/stage 与错误映射保持。
- [x] 1.7 已迁移 catalog definition、Schema、查询和 catalog 生成声明至 entry ID + searchText source、固定 sourcePath 首段 topic source；state 不保存 `topic`，topic metadata membership、catalog indexPath、selected sync/stage、公开输出和 Test Evidence case 规则保持。
- [x] 1.8 已迁移 ledger definition、Schema、查询和实际 API/CLI declaration 至 entry ID/state path source；Test→Case 反向关系改读 `state.testIds`。ledger index identity 已迁移到 `docs/test-evidence/test-evidence-ledger-index.json`，并同步 workspace root member/identity checks、sync/check/fallback diagnostics、fixtures 与 machine `indexPath` 输出；未合并 catalog/ledger layout、metadata 或 definition。
- [x] 1.9 已归档前序 Index Runtime Decision，并建立 active + aligned 后继，明确持久 state、definition fields、sourceRevision 与独立 index identity 的 owner；README、领域契约和 0.4 确认的 Test Evidence cases 已同步到当前协议。

## Verification

- [x] 2.1 已运行 Index Runtime definition/protocol/query/runtime 测试，覆盖 entry ID、多 path、terminal array、`each`、instant、固定 sourcePath 首段、缺失值、非法容器/标量/path、去重、text 规范化、跨时区 range、exists、多字段 sort、分页、缓存、overlay 和 abort/不可变边界。
- [x] 2.2 已运行 Index Runtime materialization/storage/staging/performance 测试，覆盖 state-only round trip、ID/revision 成员闭合、旧 schema 拒绝、currentness 快速失败、strict 全量提取、适用 selected entry 组合、CAS/并发恢复，以及 1,000/5,000 条场景的现有性能阈值。
- [x] 2.3 已运行 Decision 全量测试和 CLI smoke，证明新索引重建后结构过滤、确定排序、metadata/content search、关系摘要、生命周期、rename、selected sync/stage 与索引恢复兼容。
- [x] 2.4 已运行 Investigation 全量测试和 CLI smoke，证明直接字段、relation-type、formedAt 跨时区范围、metadata/content search、limit、关系/资源、rename、selected sync/stage 与索引恢复兼容。
- [x] 2.5 已运行 catalog 全量测试、CLI 和 selected sync/staging；Case ID、state 无 topic、sourcePath→topic、searchText/text mode、排序、total、offset/limit、fallback、catalog indexPath 和 Test Evidence case 行为保持。
- [x] 2.6 已运行 ledger 全量测试和 CLI；Case ID、test/tag/search、text mode、排序、total、offset/limit、fallback 与无 selected staging 保持。新 ledger indexPath 不读写 catalog index；旧共享路径 mismatch 只返回可行动恢复。
- [x] 2.7 已扫描维护源码、公开声明、JSON Schema、fixtures、生成物和三份当前持久索引：StateIndex entry 不含持久 `keys` 或 `{state}` 包装、没有顶层 `keyDefinitions`、没有 definitionless query，也没有 ledger `entry.keys.test`。catalog 的 `searchText`、text mode、state 无 topic 与产品契约保持。
- [x] 2.8 已以 Change 基线比较实际存在的 Decision、Investigation、catalog 索引字节数，并人工复核长期 Decision、Index Runtime README、领域查询指导、生成物与测试证据。三份索引已共同表达持久 state、definition fields、sourceRevision 与独立 index identity；必要的旧协议拒绝和恢复说明仍在对应 owner。
- [x] 2.9 已在同一硬件与同一 workload 下比较 Change 基线和 state-only 版本。1,000 条 build/parse/query 为 64.99/42.14/26.99ms → 56.93/34.08/49.15ms，字节为 745,020 → 351,980；5,000 条为 186.14/171.99/103.86ms → 128.89/148.28/218.70ms，字节为 3,741,020 → 1,767,980。查询物化约增加至两倍，但整体测试 wall time 为 753ms → 733ms，索引字节约减少 52.7%，并保持既定性能门槛。
- [x] 2.10 已正式运行 `sync:decision-records-cli`、`sync:investigation-report-check`、`sync:test-evidence-cli`、`sync:test-evidence-catalog`，随后三项生成检查、Test Evidence 83/83 和 catalog 803 cases 均通过。最终 `bun run check` 为 33 passed、0 failed；28 项 unavailable 均为 release-only 检查。

## Completion Evidence

- 已取得的实现验证证据为：Index Runtime suite 60/60、Decision suite 213/213、Investigation suite 152/152、Test Evidence suite 83/83；此前 typecheck、lint、format、生成检查、领域索引检查和基础 `bun run check` 也曾通过。
- 生成 owner 已正式刷新 Decision、Investigation、Test Evidence 制品，并由目录 owner 发布 Test Evidence 派生索引；三项生成检查、Test Evidence 83/83、catalog 803 cases 与最终 `bun run check` 均通过。最终检查为 33 passed、0 failed，28 项 release-only unavailable。
- `260905-separate-persistent-state-from-query-projection` 为 active + aligned 后继；旧决策已归档。它是长期理由的 owner，不把实现进度复制到决策正文。
- 以下为从 Change 基线 `f936ba8636e54321ad83692af1f796f0464a3991` 与当前工作树直接读取的原始 JSON 字节数。真实仓库选择 catalog layout，故没有 ledger source/index 文件；不能把它当作第四个可比较索引。

  | 索引 | 基线字节 | 当前字节 | 变化 |
  | --- | ---: | ---: | ---: |
  | Decision | 475,583 | 369,293 | -106,290（-22.35%） |
  | Investigation | 41,151 | 28,957 | -12,194（-29.63%） |
  | Test Evidence catalog | 1,831,199 | 1,195,872 | -635,327（-34.69%） |
