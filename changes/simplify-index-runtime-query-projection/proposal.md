# Proposal

本 Change 将持久索引收敛为可重建的领域 state 快照，并以封闭、definition-owned 的字段描述在 reader 内物化查询值。

## Why

在 Change 基线 `f936ba8636e54321ad83692af1f796f0464a3991` 中，索引为每个 entry 同时保存领域 `state` 和由该 state 确定性形成的 `keys`。这些 keys 只服务逐条扫描的统一筛选与排序；仓库内生产查询已经携带相应领域 definition。因此，持久化第二份查询投影没有建立独立查询入口，却扩大索引体积、同步内容和 state/key 一致性校验面。

现有字段只需要有限提取：直接标量、终点标量数组、显式数组成员、时间 instant，以及 Test Evidence catalog 从已验证 `sourcePath` 取得首路径段。领域声明这些来源，Index Runtime 按同一协议提取和查询，无需把查询值写入索引文件。

## Outcome

每个持久索引以 `entries[id] = state`、集合 metadata、definition identity 和按 ID 对齐的 `sourceRevision` 构成完整快照。definition 使用少量内置 source 声明查询字段：entry ID、安全 state path、终点标量数组、显式 `each`、单值 `instant`，以及固定的 `sourcePath` 首路径段；不接受任意 transform 或表达式。reader 内缓存查询值并统一执行既有 exact/range/text/exists、排序和分页。

Decision、Investigation、Test Evidence catalog 与 ledger 保持已有领域查询语义。catalog 保持 topic、Case、文本查询和证据审阅模型，且不在 state 重复保存 topic；ledger 保持 Test/tag/search 查询与只读 fallback。catalog 索引继续使用 `docs/test-evidence/test-evidence-index.json`，ledger 改为独立的 `docs/test-evidence/test-evidence-ledger-index.json`，从而不再争用持久索引 owner。两套 Test Evidence source layout 仍是互斥产品布局，本 Change 不将它们合并。

## Scope

### Intended Change

- 将 Index Runtime 的持久 entry 规范收敛为 `entries[id] = state`，由 `namespace + definitionVersion` 绑定领域 definition，继续保存 metadata 与按 ID 对齐的 `sourceRevision`。
- 用代码内的封闭查询字段描述替代任意 key strategy。每个字段声明一个或多个 entry ID/state path source，可读取终点标量数组、展开实际数组成员、把单个时间文本规范化为 instant，或从已验证的 state `sourcePath` 取固定首路径段。
- 让 reader 从持久 state 或 runtime overlay state 按需形成查询值；build、strict check、sync 与适用的 selected staging 使用同一提取规则验证完整集合。
- 让所有 Index Runtime 查询入口显式取得领域 definition，不再把持久索引作为脱离领域契约的自描述查询文件。
- 迁移 Decision、Investigation、Test Evidence catalog/ledger 到新持久格式和查询字段描述；catalog 保持 selected staging，ledger 保持其现有无 selected staging 边界。
- 将 ledger 持久 index path 改为 `docs/test-evidence/test-evidence-ledger-index.json`。catalog 和 ledger 不共享索引文件；本 Change 不让其互斥 source layout 同时在一个 workspace 生效。
- 同步通用与领域 Schema、类型、生成制品、fixture、索引快照、长期决策和测试证据。

### Resulting Impacts

- Index Runtime 的持久 schema、definition 类型、reader/query、runtime overlay、序列化、完整校验、sync 和 selected staging 都需要改用 state 与查询字段描述；查询值只存在于 reader 的内部 materialized view。
- Decision 与 Investigation 的结构筛选改由内存查询值承接；现有 metadata/content search、字段证据、关系、生命周期和资源边界保持不变。
- Test Evidence 只做协议兼容：catalog 保持 state、由 `sourcePath` 与 topic metadata 共同确定的 topic、Case ID、search 条件、CLI/API、排序、total、offset/limit、fallback 和 selected staging；ledger 保持 state、Case ID、test/tag/search 条件、CLI/API、排序、total、offset/limit 和 fallback，但没有 selected staging。现有 `searchText` 继续作为领域 state，text mode 继续作为当前结构查询模式。
- ledger 的 `indexPath` 是为消除真实持久 owner 冲突而有意改变的机器输出字段；其查询模型、source layout 和 Case/Test 语义不随之改变。catalog 和 ledger 的严格 source layout 继续互斥，不能据独立 index path 推断两者可同时使用。
- schema 升级使旧持久索引明确不兼容。各领域通过既有 check/sync 入口从权威来源重建，不提供双格式读取；公开声明、JSON Schema、bundles、source maps、`.d.mts`、fixture 与仓库索引在同一交付序列保持一致。
- 查询提取失败必须定位 entry ID、查询字段和 source；路径只读取 own property，数组展开只接受实际数组，首路径段只接受合法的相对 POSIX state path，最终结果只接受合法标量或标量数组。
- `sourceRevision` 继续承担 currentness 判断和适用 selected 组合，领域 state 继续承担查询结果与领域元数据；本 Change 不把测试思想、文件布局或证据充分性移入 Index Runtime。

## Success Criteria

- 持久索引及其领域 JSON Schema 均使用 `entries[id] = state`，不再保存逐 entry 查询值、entry 的单层 state 包装或顶层查询字段副本；索引仍能确定性序列化、严格校验并按来源重建。
- 全部四个 definition 的现有字段可由封闭描述表达：Decision 的 name/tag/status/alignment，Investigation 的 name/tag/formed-at/relation-type，catalog 的 search/topic，ledger 的 search/tag/test。entry ID、多 state path、终点标量数组、`relations[*].type`、跨时区 `formedAt`、Test Evidence 组合文本，以及 catalog `sourcePath` 首段→topic 均有测试；没有任意函数或表达式逃生口。
- runtime reader、overlay、build、strict parse/check、sync 与适用 selected staging 共享同一提取语义；缺失路径、非法容器/标量/路径、重复值和多值 sort 均返回稳定结果或诊断。
- 仓库内生产查询全部显式携带领域 definition；无 definition 查询重载不再存在于源码或公开类型，持久索引和 fixture 不再包含逐 entry `keys` 或顶层 `keyDefinitions`。ledger 的 Test→Case 反向查询从 `state.testIds` 读取，不再消费 `entry.keys.test`。
- Decision、Investigation 和 Test Evidence 的现有查询、过滤、排序、分页、生成物和错误恢复回归通过；catalog 的 selected staging 语义保持，ledger 不新增 selected staging；Test Evidence 不发生 tags、布局、topic、Case 模型或公开搜索语义调整，除 ledger 明确迁移到独立 indexPath 外。
- catalog 与 ledger 不再写入或读取同一持久 index path；各自 check/sync/fallback 对其 own path 行为可验证，并明确拒绝或诊断旧共享路径留下的不兼容索引。
- schema 不兼容诊断、各领域全量重建、生成制品检查、测试证据检查和 `bun run check` 通过；交付记录三个实际仓库索引相对 Change 基线的规范字节数。若要主张查询性能同比，必须在相同硬件与 workload 下记录基线和新格式的 build/open/query 计时；既有性能阈值不替代该对照。

## Affected Owners

- `tools/index-runtime/` 与 `tools/index-runtime/README.md` 承接持久 state schema、查询字段描述、内存物化、runtime、sync、staging、诊断和通用测试。
- `tools/decision-records/`、`skills/decision-records/` 与 Decision 生成入口承接 Decision definition、Schema、查询回归、索引重建及分发声明。
- `tools/investigation-report/`、`skills/investigation-report/` 与 Investigation 生成入口承接 Investigation definition、时间/关系提取、查询回归、索引重建及分发声明。
- `tools/test-evidence/` 承接 catalog 与 ledger 的 definition、独立 index identity、Schema、CLI/API、fallback 和查询回归；`skills/test-evidence-review/` 与其生成入口只承接 catalog 的分发制品和测试证据目录契约。其产品模型与优化方向不在本 Change。
- `docs/decisions/` 承接目标索引边界的长期理由；`docs/test-evidence/` 承接 catalog 的最小原生测试入口和其派生索引。ledger source layout 和 index 由 ledger contract/implementation owner 承接，不成为 catalog topic/case owner。
