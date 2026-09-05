# Proposal

本 Change 让持久索引专注保存领域 state 快照，并让 Index Runtime 依据领域 definition 中的封闭提取描述提供统一查询。

## Why

当前索引为每个 entry 同时保存领域 `state` 和从该 state 确定性形成的 `keys`。这些 keys 服务统一筛选与排序，但查询仍逐条扫描；仓库内现有生产查询也都已携带对应领域 definition。因此，持久化同一份查询值没有带来独立查询入口，却扩大了索引体积、同步内容和 state/key 一致性校验面。

实际查询字段只需要少量通用提取方式：直接字段、标量数组、数组成员和时间 instant。领域可以声明字段来源，Index Runtime 负责按同一协议提取和查询，无需在索引文件中保存第二份查询投影。

## Outcome

索引文件以 `entries[id] = state`、集合 metadata、定义身份和来源 revision 构成完整持久快照。领域 definition 使用少量内置描述声明查询字段的一组来源，包括 entry ID、state 路径、数组展开和时间规范化；Index Runtime 在当前 reader 内形成并缓存查询值，统一执行现有 exact/range/text/exists、排序和分页。各领域继续使用已有 CLI/API 和查询语义，Test Evidence 保持当前目录、topic、Case、文本查询和证据审阅方式。

## Scope

### Intended Change

- 将 Index Runtime 的持久 entry 规范收敛为 `entries[id] = state`，由 `namespace + definitionVersion` 绑定领域 definition，继续保存 metadata 与按 ID 对齐的 `sourceRevision`。
- 用代码内的封闭查询字段描述替代任意 key strategy。每个字段声明一个或多个 entry ID/state 路径来源，可展开数组成员，并可对单个时间来源执行 instant 规范化。
- 让 reader 从持久 state 或 runtime overlay state 按需形成查询值；build、strict check、sync 与 selected staging 使用同一提取规则验证完整集合。
- 让所有 Index Runtime 查询入口显式取得领域 definition，不再把持久索引作为脱离领域契约的自描述查询文件。
- 迁移 Decision、Investigation、Test Evidence catalog/ledger 到新持久格式和查询字段描述，同时保持各领域现有查询输入、结果、排序、分页和错误边界。
- 同步通用与领域 Schema、类型、生成制品、fixture、索引快照、长期决策和测试证据。

### Resulting Impacts

- Index Runtime 的持久 schema、definition 类型、reader/query、runtime overlay、序列化、完整校验、sync 和 selected staging 都需要改用 state 与查询字段描述；查询值只存在于 reader 的内部 materialized view。
- Decision 与 Investigation 的结构筛选改由内存查询值承接；现有 metadata/content search、字段证据、关系、生命周期和资源边界保持不变。
- Test Evidence 只做协议兼容：catalog 与 ledger 保持现有 state、topic、Case ID、test/tag/search 条件、CLI/API、排序、total、offset/limit、selected staging 和 Test Evidence case 规则。现有 `searchText` 继续作为领域 state，text mode 继续作为当前结构查询模式。
- schema 升级会使现有持久索引明确不兼容。各领域通过既有 check/sync 入口从权威来源重建，不提供双格式读取；所有公开声明、JSON Schema、bundles、source maps、fixture 与仓库索引在同一交付序列保持一致。
- 查询提取失败必须定位 entry ID、查询字段和失败原因；路径只读取 own property，数组展开只接受实际数组，最终结果只接受合法标量或标量数组。
- `sourceRevision` 继续承担当前性判断和 selected 组合，领域 state 继续承担查询结果与领域元数据；本 Change 不把测试思想、文件布局或证据充分性移入 Index Runtime。

## Success Criteria

- 持久索引及其领域 JSON Schema 均使用 `entries[id] = state`，不再保存逐 entry 查询值、entry 的单层 state 包装或顶层查询字段副本；索引仍能确定性序列化、严格校验并按来源重建。
- 全部现有查询字段可由封闭描述表达；entry ID、多 state 路径、直接字段、标量数组、`relations[*].type`、跨时区 `formedAt` 和 Test Evidence 组合文本字段均有测试，且没有任意函数或表达式逃生口。
- runtime reader、overlay、build、strict parse/check、sync 与 selected staging 共享同一提取语义；缺失路径、非法容器、非法标量、重复值和多值排序均返回稳定结果或诊断。
- 仓库内生产查询全部显式携带领域 definition；无 definition 查询重载不再存在于源码或公开类型，持久索引和 fixture 不再包含逐 entry keys 或顶层 keyDefinitions。
- Decision、Investigation 和 Test Evidence 的现有查询、过滤、排序、分页、staging、生成物和错误恢复回归通过；Test Evidence 不发生 tags、布局、topic、Case 模型或公开搜索语义调整。
- schema 不兼容诊断、各领域全量重建、生成制品检查、测试证据检查和 `bun run check` 通过；交付记录当前索引体积与查询性能对照，证明没有不可接受的退化。

## Affected Owners

- `tools/index-runtime/` 与 `tools/index-runtime/README.md` 承接持久 state schema、查询字段描述、内存物化、runtime、sync、staging、诊断和通用测试。
- `tools/decision-records/`、`skills/decision-records/` 与 Decision 生成入口承接 Decision definition、Schema、查询回归、索引重建及分发声明。
- `tools/investigation-report/`、`skills/investigation-report/` 与 Investigation 生成入口承接 Investigation definition、时间/关系提取、查询回归、索引重建及分发声明。
- `tools/test-evidence/`、`skills/test-evidence-review/` 与其生成入口只承接新 StateIndex 协议的兼容适配、现有查询回归、索引重建和分发同步；其产品模型与优化方向不在本 Change。
- `docs/decisions/` 承接目标索引边界的长期理由，`docs/test-evidence/` 承接受影响最小原生测试入口的证据及统一派生索引。
