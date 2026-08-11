# Proposal

> **归档状态：本 change 已归档。** 归档前 stage 为 `implementation`；中央任务 `task-000026` 已完成，[`tasks.md`](tasks.md) 中的 readiness、implementation 和 verification 项也已全部勾选，证明本 change 限定的仓库内部 Test–Case 多对多账本机制已经交付。归档不表示真实测试实体登记、全部 Case 重建、最终 skill 激活或正式分发已经完成；这些后续边界交给依赖它的 `task-000035`。

本文以下内容保留归档前的 proposal。正文中的“当前”“目标”和“后续”均按归档前的 implementation 边界理解，不作为当前仓库事实；[`design.md`](design.md) 保留当时的精确数据与行为契约，[`tasks.md`](tasks.md) 保留当时已经完成的实施和验证顺序。

## Why

当前测试账本把一个最小原生测试入口固定等同于一个 Case，混合了 runner 的选择与报告边界和文档的语义审查边界。该模型不能准确表达“多个测试共同支持一个语义结论”或“一个测试同时支持多个可独立检索的结论”，也让 Case 的合并、拆分和集中审查被测试节点数量机械限制。

Case 的产品价值是集中说明、发现和复核“当前测试证明了什么”，而不是复制 runner 结构。因此，项目认定的测试实体与人维护的语义 Case 必须分别划界，并通过一组闭合、可双向查询的多对多关系连接。

测试发现、测试身份、稳定 Test ID 和去重依赖具体项目。共享账本只能消费项目在固定 JSON 文件中登记的测试实体，再负责 Case、关系闭合、派生索引和查询；它不能猜测项目测试全集，也不能把文件结构合法等同于发现结果完整。

全部旧 Case 的重建和审查还会牵涉大量语义判断与测试问题。机制实现和真实重建必须有明确先后顺序，但两者之间没有可发布的产品阶段：先验证内部机制，再由 `task-000035` 从真实测试零开始建立新账本并一次性激活。

## Outcome

### 目标产品状态

- 项目在固定位置 `docs/test-evidence/test-entity-index.json` 维护版本化测试实体索引；账本操作只按工作区根读取该文件。
- `docs/test-evidence/cases/*.md` 保存 Case 语义和唯一 Test 关系事实；一个 Case 可以关联多个 Test，一个 Test 也可以关联多个 Case。
- 最终激活后的 `test-evidence-review` 从测试实体索引和 Case Markdown 派生 `docs/test-evidence/test-evidence-index.json`，保存每个 Case 的简易元数据及 Case、Test ID、Tag 查询投影。
- 严格检查以同一组 Case 关系证明结构闭合：每条边的两个端点存在，每个非空 Test 和 Case 都至少参与一条边；零 Test、零 Case 是合法默认状态。
- Topic 基础分类由零到多个 Tag 取代；Tag 只用于筛选和识别，不决定 Case 身份、目录归属或语义边界。

### 本 change 的交付状态

- 在 `tools/test-evidence/src/ledger/` 建立可导入的内部 API、argv CLI、Valibot Schema、派生索引适配和独立 fixture 测试。
- 只按现行一入口一 Case 规则维护本 change 实际新增或修改的测试入口及派生旧索引；该维护用于满足当前仓库门禁，不属于旧 Case 迁移、全量审计或新账本输入。
- 不修改 `test-evidence-review` 的行为入口、构建适配、分发制品或版本，也不把本 change 完成后的仓库状态定义为发布候选。

### 后续激活状态

- `task-000035` 暂存整个旧账本，从真实测试和语义 owner 零开始建立并审查全部新 Case，待新账本独立验收后才用旧 Case 做遗漏对照。
- 对照通过后，`task-000035` 在同一次最终切换中更新 skill 契约、默认入口、构建生成物和版本，并清除旧 catalog 行为。
- 机制建设和最终切换之间不进行正式分发。若外部流程提前强制打包，允许因尚未激活新机制而失败；不得为该打包增加双入口、兼容层或候选契约。下一次正式分发直接使用新机制。

## Scope

纳入范围：

- 固定测试实体索引的路径、版本化 Schema、读取边界、内容指纹和诊断。
- 空账本语义、按需存在的 `cases/` 目录，以及 Test 与 Case 双方无悬空不变量。
- 新 Case Markdown 的 `Tests`、`Tags`、`Contract` 和 `Proves` 契约。
- Case 侧唯一关系事实、双来源 revision、严格闭合校验和双向查询。
- 可删除重建的 Case 账本索引、简易元数据、查询 key、新鲜度检查和原子写入。
- 仓库内部 ledger API/CLI、Valibot 机器 Schema 和 fixture 测试。
- 本 change 所触及测试入口在现行旧账本中的必要登记和派生索引同步。
- 项目实体索引新鲜度检查与共享关系检查之间的组合责任。
- `task-000035` 的依赖、输入、旧账本暂存、真实审计、最终切换和清理门禁。

不纳入范围：

- 共享层发现测试、执行项目发现工具、决定测试实体身份、生成 Test ID 或合并重复测试。
- 在新模型中登记本仓库真实测试实体，或批量重建、审计、搬运、暂存、删除当前旧 Case。
- 修改与新机制验证无关的真实测试实现，或在没有审计事实时预先建立迁移问题子任务。
- 切换当前 `test-evidence-review` 默认流程、真实 `docs/test-evidence` 布局、构建适配或默认 catalog 入口。
- 提升 skill 版本、生成新 ledger 分发制品，或为未完成状态建立可发布兼容路径。
- 建立 Tag 注册表、Tag 层级、必选基础分类或自动 Tag 推断。
- 在关系边上编码执行顺序、AND/OR、角色、权重、证明比例或覆盖百分比。
- 实现下游 `stage-selected-test-evidence`，或执行 `task-000035` 的真实迁移与最终激活。

## Success Criteria

### 机制证据

- 账本操作只需工作区根即可定位测试实体索引、Case 和派生索引，不存在第二种项目接入协议。
- 测试实体索引表达版本、项目来源 revision、稳定 Test ID、名称和 locator；共享层严格校验结构与规范顺序，但不接管实体发现、身份、去重或新鲜度证明。
- 空实体索引、缺失或为空的 `cases/` 和零条目派生索引构成合法账本；任一侧非空后，全部 Test 与 Case 都必须参与合法关系。
- Case 支持非空唯一 Test ID 集合和零到多个唯一 Tag；Case ID 不由 Test ID、Tag 或路径推导。
- Case 账本索引只保存简易 Case 元数据和查询投影；完整 `Contract`、`Proves` 与唯一可写关系仍由 Case Markdown 拥有。
- Case → Tests、Test → Cases 和 Tag → Cases 查询来自同一组 Case 关系，不引入第二份可写映射。
- 项目新鲜度检查与共享闭合检查的责任、顺序和证明边界明确；共享结果不会把固定 JSON 的合法性夸大为测试发现完整性。
- Fixture 证明合法空账本、一对多、多对一和多对多通过，并使未知端点、任一侧悬空、重复关系、来源漂移和陈旧索引稳定产生约定结果。

### 交付证据

- 新 ledger 源码 API、CLI、Valibot Schema 和 fixture 互相一致，并通过目标测试、类型检查和所有不依赖最终 skill 激活的仓库检查。
- 本 change 新增或修改的每个最小原生测试入口继续满足现行测试证据规则；这些旧格式 Case 不被视为新账本迁移材料。
- 最终 diff 不切换 skill、构建链、真实账本布局、分发版本或长期决策状态。
- 若统一检查只因尚未完成最终激活而在打包步骤失败，结果明确记录为 `task-000035` 的延期门禁；其他失败仍须处理。
- 中央 task graph 保持 `task-000035` 对 `task-000026` 的依赖，并由 `task-000035` 独占真实重建、遗漏对照、最终激活、升级验证、旧档删除和决策对齐责任。

## Affected Owners

| Owner | 本 change | `task-000035` |
| --- | --- | --- |
| [`tools/test-evidence/`](../../../tools/test-evidence/) | 新增 ledger 源码、内部 API/CLI、Schema、fixture 和测试 | 让最终构建直接消费已经验证的 ledger 源码，并删除旧实现 |
| [`docs/test-evidence/`](../../../docs/test-evidence/) | 只为本 change 触及的测试入口维护现行旧格式 Case 和派生索引；不改变布局 | 暂存整个旧账本，从零建立并验收新账本，遗漏对照后删除旧账本与暂存目录 |
| [`scripts/build/test-evidence.ts`](../../../scripts/build/test-evidence.ts) 与 [`skills/test-evidence-review/`](../../../skills/test-evidence-review/) | 不修改 | 一次性切换构建输出、行为契约、默认入口和 skill 版本 |
| [`maintain-closed-many-to-many-test-case-relations.md`](../../../docs/decisions/test-evidence-review/maintain-closed-many-to-many-test-case-relations.md) 与 [`fix-test-evidence-workspace-contract.md`](../../../docs/decisions/test-evidence-review/fix-test-evidence-workspace-contract.md) | 前者保持 `unaligned`，后者继续描述当前 Topic 事实 | 新账本成为当前事实后更新并对齐 |
| [`stage-selected-test-evidence`](../stage-selected-test-evidence/) | 已由独立任务完成并归档，当前入口使用现行 Case ID | 最终切换时按既定范围删除旧 catalog 实现及引用，不保留旧、新入口并存 |
| 中央 task graph | `task-000026` 拥有机制建设 | `task-000035` 作为依赖前者的独立根任务拥有真实迁移与激活 |
