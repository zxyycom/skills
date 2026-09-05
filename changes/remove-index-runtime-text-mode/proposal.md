# Proposal

本 Change 在 Test Evidence 完成 tags 与布局演进后，按查询范围分别迁移其 catalog 和 ledger，最后删除 Index Runtime 的派生 `text` 查询模式与 `searchText` 副本。

## Why

Index Runtime 的 `text` mode 只能查询索引中拼接的文本副本。它无法说明命中了哪个元数据字段，也不能提供权威 Case Markdown 的行级全文命中和预览。当前 Test Evidence catalog 与 ledger 都仍消费 `searchText`，但两者不能被笼统视为全文搜索：它们已有可结构化筛选的索引字段，同时把部分 Contract/Proves 内容压入了不可归因的文本副本。

`adopt-tagged-test-evidence-cases` 尚未完成，仍在确定 Test Evidence 最终的 tags、平铺 sourcePath 和索引投影；`add-index-only-metadata-search` 尚未完成，拥有共享纯 segment matcher 的稳定导入契约与测试。因此本 Change 必须等待两个同级硬前置完成，不能基于当前 topic 布局、未稳定 matcher 或假定所有 Case 元数据已结构化来决定公开查询语义。

## Outcome

完成后，Test Evidence 的 metadata 查询只在同一份成功加载的、持久且已发布的 catalog 或 ledger 索引 snapshot 中逐字段匹配正式、可归因的索引字段；它不读取 Case Markdown 或 source revision、不回退构建内存实体投影，也不保存 `searchText`。真正的全文查询才通过受管 Case Markdown、同一 snapshot 的 `sourcePath → Case ID` 映射和文件搜索返回行级命中与预览。catalog、ledger 与其实体本地查询分别保留各自的身份、筛选、排序、total、分页和诊断契约，或通过明确的兼容演进处理。随后 Index Runtime 只保留 `exact` 与 `range`，持久索引不再含 `text` key 或 `searchText`。

## Scope

### Intended Change

- 把 `adopt-tagged-test-evidence-cases` 与 `add-index-only-metadata-search` 的完成作为同级串行硬前置；前者提供最终 Case 布局、tags、sourcePath、索引和公开查询契约，后者提供经测试的共享纯 segment matcher 稳定导入契约。任一前置未 complete 时不修改 Test Evidence 查询实现。
- 在前置完成后，为 catalog Case 查询、ledger Case 查询和 ledger Test entity 本地查询逐项建立范围矩阵：明确哪些已结构化字段是 metadata，哪些内容只属于权威 Case Markdown，以及旧的未限定 query 如何保持兼容或如何显式演进。
- 实现只读索引 snapshot 的 metadata 匹配与 `matchedFields`；metadata 查询遇到持久索引缺失、损坏或定义不匹配时失败并引导 `sync-index`，绝不读取实体或 source revision 来判定工作区是否陈旧，也绝不作为 fallback。
- 实现只对真正全文范围使用的受管文件搜索：从相同 snapshot 的权威 `sourcePath` 建立唯一 Case ID 映射，搜索后返回 Case ID、行号与预览；不得由 basename、tag 或文件扫描反推 Case 身份。
- 迁移所有 Test Evidence 实际 `searchText` / text-key 消费者，再删除 Index Runtime 的 text key、filter、mode、schema、类型、实现、测试和生成物；使用既有同步入口要求重建旧索引。

### Resulting Impacts

- Test Evidence 具有独立的 catalog 与 ledger source/index owner。两者的 metadata 字段、Case source authority、公开 DTO 和 fallback/diagnostic 不能因共享 matcher 而合并或互相推断。
- Contract 与 Proves 只有在前置完成后的索引中以可命名、可归因字段正式投影时才可参与 metadata 查询；仅存在于旧 `searchText` 的内容必须属于全文范围，不能为了搜索保留拼接副本。
- metadata 查询与 content 查询的可用性不同：前者仅陈述已发布索引 snapshot 的事实；后者读取权威 Case Markdown 并以 snapshot 做身份映射。两者都必须明确索引、来源路径和映射异常的诊断边界。
- 当前 `list --query`、ledger Case query 与 Test entity query 的排序、total、offset/limit、结构筛选和 JSON/CLI 结果是公开契约。迁移必须保持它们，或在实施前写明版本化/显式 scope 的兼容演进，不能因先枚举或分页文件而悄然改变结果。
- 删除 text mode 是破坏性的 Index Runtime 协议与持久索引 schema 演进；所有 consumers、schema、bundles、source maps、声明、fixture 和测试必须在同一交付单元迁移，旧索引不得静默解释。

## Success Criteria

- `adopt-tagged-test-evidence-cases` 与 `add-index-only-metadata-search` 均已 complete；前者的最终字段、sourcePath、Case ID、source authority、公开查询与生成物，以及后者的共享纯 segment matcher 稳定导入契约和测试，均被记录为本 Change 的实施基线。
- 每个 Test Evidence 查询入口都有可审计的 metadata/content/实体本地范围和兼容矩阵。metadata 命中只来自同一索引 snapshot 的字段白名单并返回 `matchedFields`；它不读取实体、不 fallback、不持久化文本副本。
- content 命中只搜索受管权威 Case Markdown，通过同一 snapshot 的唯一 `sourcePath → Case ID` 映射返回 Case ID、行号与预览；结构筛选、确定排序、total 与分页符合该入口已确认或已发布的演进契约。
- catalog、ledger 与 ledger Test entity 查询，以及所有实际 Index Runtime consumers 都不再依赖 `searchText` 或 `text` key。StateIndexDefinition 只声明 `exact` / `range`，并严格拒绝 `text` 定义和 filter。
- 更新后的 Test Evidence、Index Runtime、Decision 及仓库检查通过；Investigation 的 exact/range 回归测试证明删除公共协议未损伤既有领域行为。长期查询指导和测试证据已由各自 owner 交接，且没有把前置 Change 的所有权带入本 Change。

## Affected Owners

- `changes/adopt-tagged-test-evidence-cases/` 与 `changes/add-index-only-metadata-search/` 是本 Change 的同级硬前置；本 Change 不修改任一目录，也不把其 Draft 设想当作实现事实。
- `tools/test-evidence/` 的 catalog、ledger、Case source、entity index、CLI/API、schema、fixture 与测试分别拥有 Test Evidence 查询和来源边界。
- `tools/shared/src/file-text-search/` 拥有由硬前置交付的纯 segment matcher、行号和预览稳定导入契约；`tools/test-evidence/` 只拥有领域字段选择、snapshot 映射和结果投影。
- `tools/index-runtime/` 拥有 StateIndexDefinition、持久 index、查询协议及其 schema/types/runtime/生成物。
- `skills/test-evidence-review/`、`docs/decisions/use-fixed-index-query-modes.md` 与 Test Evidence 账本分别拥有长期查询指导、长期理由和测试证据登记。
