# Design

本设计先依据完成后的 Test Evidence 索引字段划定 metadata 与 content，再在不改变领域身份的前提下退出通用 text 协议；它不把所有现有 `--query` 误迁为文件全文搜索。

## Context

- Index Runtime 当前以 `text` 作为 StateIndex key mode/filter，并对派生字符串实施 NFKC、小写和按词包含匹配。删除该协议前必须迁移全部实际 consumer。
- 当前 catalog 的索引 state 有 Case ID、title、summary、entries、sourcePath、行范围和 `searchText`。`searchText` 由 title、Contract、Proves 与 Entry 拼接而成；Contract/Proves 当前不是可单独归因的 catalog 索引字段。
- 当前 ledger Case state 有 title、summary、sourcePath、testIds、tags 和 `searchText`。其权威 Case source 解析 Contract/Proves；`searchText` 拼接 title、Contract、Proves、testIds 与 tags。ledger Test entity query 则匹配 entity index 的 ID、name 与 locators，是独立于 Case Markdown 的本地实体查询。
- `adopt-tagged-test-evidence-cases` 正在决定 tags、平铺文件布局、最终 `sourcePath` 和 public query；`add-index-only-metadata-search` 拥有共享纯 segment matcher 的稳定导入契约与测试。二者是同级硬前置；本 Change 只在两个完成 revision 上重新取得字段、行为与 matcher 契约事实。

## Goals / Non-Goals

目标：

- 让正式、可归因的 Case metadata 仅由 catalog 或 ledger 持久、已发布的索引 snapshot 查询；不读取 source revision，因此只陈述该 snapshot 的事实，并能报告命中字段。
- 让真正的 Case 全文搜索只读取权威受管 Markdown，返回可定位的行级证据与预览。
- 保持 catalog、ledger 与 ledger Test entity 的不同 source authority、身份和结果投影，并按已确认契约保持或明确演进公开查询。
- 在所有消费者完成迁移后，从 Index Runtime 与领域索引彻底删除 text mode 与 `searchText`。

非目标：

- 不在本 Change 决定或实施 Test Evidence 的 tags、平铺目录、Case ID、topic 退出或选择性暂存；这些由硬前置 Change 拥有。
- 不把 Contract/Proves 为搜索目的重新拼接为 `searchText`，也不声称它们当前已是所有索引中的 metadata 字段。
- 不增加 regex、相关性排序、持久全文索引、跨领域 CLI、自动同步或 metadata 的实体 fallback。
- 不把 ledger Test entity 本地 locator 查询伪装为 Case Markdown 全文搜索，或借机改变其独立 API。

## Decisions

### Intended Change

1. **串行字段与 matcher 审计。** 实施从确认 `adopt-tagged-test-evidence-cases` 与 `add-index-only-metadata-search` 均已 complete 开始，记录两个完成 revision；前者提供最终 catalog/ledger source schema、state schema、definition、CLI/API 和 fixtures，后者提供经测试的共享纯 segment matcher 稳定导入契约。随后建立查询范围矩阵，为每个入口列出字段 owner、metadata 字段白名单、content source、旧 query 的映射、match 语义、输出、排序/total/分页和失败诊断。任一前置未完成或矩阵会违背本 Plan 时停止并先更新 Plan，而非依据 Draft 或替代 matcher 实现。
2. **Metadata 是纯索引字段查询。** catalog 和 ledger Case metadata 查询只加载一次成功的持久索引 snapshot，且不调用 source revision reader、index build 或实体扫描；先应用 exact/range 等结构条件，再对领域白名单中的 state/key/entry ID 字段逐项匹配。`all` 可以跨字段，`phrase` 必须落在单一字段值，数组逐值匹配；结果返回 Case ID、领域摘要、sourcePath 和 `matchedFields`。不创建拼接 `searchText`，不读取 Markdown，不以 source scan 或内存实体投影 fallback；索引缺失、损坏、定义不匹配或 snapshot 内字段/路径不一致时直接失败并指向既有 `sync-index` / check 入口；不读取工作区实体来验证或推断 snapshot 是否陈旧。
3. **Content 是权威文件查询。** 仅明确为 content 的 Case 查询才能使用 file-text-search。它先从同一成功 snapshot 取得结构筛选后的 entries，并以其中的权威 `sourcePath` 建立一对一 `sourcePath → Case ID` 映射；随后只搜索该显式受管文件集合。映射缺失、重复、非法或来源漂移为失败诊断，绝不从文件名、tag 或扫描结果推导 Case ID。命中投影包含 Case ID、领域摘要、sourcePath、物理行号、预览和命中范围；文件枚举、preview/scan 限额不得截断后再计算 total 或分页。
4. **catalog、ledger 与 entity 查询分别迁移。** catalog 与 ledger Case query 按矩阵分别实现 metadata/content adapter、结构筛选和结果投影。ledger Test entity query 继续由 entity index 的 ID/name/locators 做其本地结构文本匹配；它不依赖 Case `searchText`，也不读取 Case Markdown。若当前未限定 `list --query` / API `query` 无法无损映射，先发布明确 scope 或版本化诊断与迁移说明，再移除旧语义；不得静默把混合搜索改成 content-only 或 metadata-only。
5. **有序退出与重建。** 只有所有 catalog、ledger 和 entity 实际消费者都不再依赖 text 后，才从 Test Evidence state/source/parser/schema/fixture/API 删除 `searchText` 和 `search` key，并从 Index Runtime 删除 text key mode/filter、evaluator、overlay、validation、types、README、生成物和测试。提升必要 definition/schema version，旧持久索引通过既有同步入口明确要求重建，不作静默兼容。Investigation 只运行其既有 exact/range 回归测试，证明公共协议删除未损伤它。

### Resulting Impacts

- **snapshot 与权威性边界。** metadata 结果只代表已发布索引 snapshot，且不读取工作区实体来验证新旧；content 的文本证据来自权威 Markdown，但 Case 身份与结构筛选仍由同一 snapshot 赋予。两个入口都必须把索引错误与 Markdown/映射错误分开报告。
- **字段投影边界。** `sourcePath` 是定位与映射字段，默认不加入发现白名单；tags、testIds、Entry、title、summary、Contract、Proves 是否参加 metadata 以最终字段矩阵为准。Contract/Proves 未有命名投影时只能经 content 搜索，不能为了兼容而复制。
- **公共结果边界。** 必须先得到完整、确定的匹配 Case ID 集，再应用原入口的领域排序和 offset/limit，保持 total 与页边界；metadata 的 `matchedFields`、content 的行号/预览以及 scope 选择属于有意 API/CLI 演进，需受 schema、声明、文档和 fixture 共同约束。
- **错误与 fallback 边界。** metadata 不存在任何实体 fallback。content 仅按其矩阵规定处理权威文件读取；它不能把索引异常伪装为从实体恢复的 metadata，不能写回或自动重建索引。
- **分发与证据边界。** 删除 text 是 public programmatic API 和持久 schema 破坏性演进。所有受影响 bundles、source maps、JSON schema、`.d.mts`、fixture、测试证据 case 与长期决策必须同步更新。

## Risks / Trade-offs

- catalog 和 ledger 的当前 `searchText` 覆盖字段不同，且 ledger 有独立 entity index。共享 matcher 只能共享纯匹配机制，不能规定领域字段、来源或结果 DTO。
- 两个前置分别决定 Case tags/布局和共享 matcher 稳定导入契约；任一未完成时提前实现都会制造错误的 sourcePath 映射、未投影 metadata 或不稳定依赖。
- metadata 不做 fallback 或 source revision 检查会让索引异常直接可见，并使结果明确只代表已发布 snapshot，而不把未同步实体修改表述成元数据。content 需要受管路径和稳定映射，也必须清楚报告该前置失败。
- 退出 text mode 会使外部直接构造 text definition/filter 的用户收到严格失败。该非兼容性以 definition/schema version、迁移说明和重建诊断换取更小且职责清晰的运行时协议。

## Open Questions

无。两个前置完成后的字段/兼容矩阵和 matcher 契约审计是已计划的 Readiness 产物，不是允许按 Draft 猜测或替代实现的开放设计；若其事实否定本设计边界，必须先修订本 Plan 并重新运行 `plan`。
