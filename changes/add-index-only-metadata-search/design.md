# Design

本设计用“范围选择 + 领域适配器”把权威文件全文搜索与已发布索引元数据搜索分开，复用同一文本语义而不复制领域数据或建立新的搜索索引。

## Context

- 当前 Decision `search` 位于 `tools/decision-records/src/decision-query-service.ts`：先以索引和来源校验构造 `sourcePath → ID`，再调用 `searchFileText`；索引异常或不新鲜时会验证 Markdown 并只读 fallback。Investigation `search` 在 `tools/investigation-report/src/query.ts` 中有同类 `loadCurrentInvestigationIndex` 与来源 fallback。
- `loadCurrentDecisionIndex` 与 `loadCurrentInvestigationIndex` 经 Index Runtime 的 current loader 核对来源 revision，因此会读取受管实体；两个领域另有 `loadDecisionIndex` / `loadInvestigationIndex` 可只读取、解析和领域校验已持久化索引。metadata 范围必须选择后者。
- Decision index entry key 是稳定 Decision ID，state 已保存 `name`、`sourcePath`、生命周期字段、`title`、`purpose`、`background`、`decision`、`tags` 与 `relations`；Investigation index entry key 是报告 ID，state 已保存 `name`、`sourcePath`、`formedAt`、`title`、`question`、`tags`、`relations` 与 `resourceIds`。当前 relation state/schema 尚无 `summary`，而 `add-relation-summaries` 是它的唯一来源/投影 owner；本 Change 的硬前置是该 Change 已 complete、目录已退出，并可在其完成 revision 审阅最终的可选 `relations[].summary` 结构、索引定义/Schema、同步结果、生成制品和测试证据。
- `tools/shared/src/file-text-search/index.ts` 目前把 NFKC、小写、空白规范化、命中范围和 all/any/phrase 判断绑定在物理行搜索流程中：全文 `all` 可跨行，`phrase` 只在同一物理行。新核心必须保留这些文本语义及范围映射能力。
- 本 Change 的直接消费者是后续实施者：只读本目录的三个 artifacts 即可确定 CLI 范围、数据权威性、字段白名单、失败语义、受影响 owner 和验证出口；当前实现与稳定 owner 仍是实现时的事实来源。

## Goals / Non-Goals

目标：

- 把 `content` 与 `metadata` 的数据来源、失败策略和输出证据明确为互不替代的契约。
- 让两个领域使用同一规范化和匹配定义，同时由各领域保留字段选择、结构过滤、摘要和错误映射责任。
- 让 metadata 结果指出字段和值，不借由派生 `searchText`、拼接字段或正文预览推断命中。
- 让 relation summary 的文本命中仍归属 relation 所在的来源记录，并以结构化 `matchedRelations` 提供定位，不把关系图另一端当成被搜到的实体。

非目标：

- 不改变 `search <text>` 默认全文搜索、其文件安全边界、预览格式、资源限制、来源 fallback 或结构过滤语义。
- 不把 `sourcePath`、生命周期、时间、资源引用或 relation `type`/`target` 变成自由文本字段，也不修改 `list`、`show`、`trace` 或既有 relation type 结构过滤协议。
- 不增加 `--in relations`、target 反向查询或关系图遍历；relation summary 只作为 `--in metadata` 的一个来源记录 segment。
- 不实现或修改 relation summary 的来源 parser/writeback、graph/lifecycle、Schema、definition version、source revision、rename 或旧索引迁移；这些均由 `add-relation-summaries` 交付。
- 不纳入 Test Evidence、Index Runtime `text` mode、`searchText` 的删除、持久全文索引、正则/相关性排序，或跨领域统一 CLI/DTO。

## Decisions

### Intended Change

1. **范围是 `search` 的显式输入。** 两个 CLI 和程序化 search options 增加 `in: "content" | "metadata"`，CLI 为 `--in content|metadata`，默认 `content`。现有 `--match`、Decision 的 status/alignment/tag 以及 Investigation 的 tag/formedAt/relation-type 继续先于文本匹配执行。Decision search 没有 `--limit`、`--offset` 或 `total`，metadata 不新增它们；Investigation search 只有 `--limit`（默认 50、最大 1000），没有 `--offset`、`total` 或记录分页，metadata 在形成既有确定顺序的全部匹配后才应用该 limit；`list` 不吸收文本发现职责。
2. **抽取 segment matcher，而非新领域抽象。** 共享模块保留文件选择、UTF-8/路径限制、物理行拆分、预览与截断；把查询校验、NFKC/小写/空白规范化、原文范围映射和 segment 命中抽为最小纯核心。核心接收显式 query 与独立 segment，返回每个命中 segment 的标识和原文范围。文件适配器继续把每条物理行作为 segment：`all` 在一个文件的多行间聚合，`phrase` 不跨行。metadata adapter 把每个标量字段值、每个 tag 值和每条非空 relation summary 作为独立 segment：`all` 在同一来源记录的不同 segment 间聚合，`phrase` 不跨字段、tag 或 summary。
3. **metadata 只读取发布快照。** 两个领域的 metadata branch 只调用各自的持久索引 loader，绝不调用 current loader、source revision 校验、collection scan、`searchFileText` 或实体读取。索引成功时只使用该 snapshot 的 entries；无法读取、解析、验证 namespace/definition 或领域 state 时直接返回领域错误，并明确建议先运行相应 `check`，再按需运行 `sync-index`。由于不读取来源，metadata 结果只陈述该 snapshot，不能断言它覆盖未同步工作区编辑。
4. **完成 revision 前置与 relation 消费。** 实施开始时必须确认 `add-relation-summaries` 已通过 Change Plan `complete`、目录不再是 active member，并记录可复现完成 revision。随后只按该 revision 已交付的 index state 读取可选 `relations[].summary`；不得回补、写入、重建或解释旧 relation 来源。summary 缺失或为空时不建立文本 segment；若 summary 有命中，始终返回 relation 的 source entry，绝不将 `target` 记录加入结果。每条 metadata 结果稳定包含 `matchedRelations`，其中只放该查询 source entry 上实际命中 summary 的 `{ type, target, summary }`，在无 relation-summary 命中时为空数组；它不产生或补入 target entry。
5. **白名单和结果投影由领域拥有。** Decision 按 `id`、`name`、`title`、`purpose`、`background`、`decision`、单个 `tags` 值和前置 Change 已投影的非空 relation summary 建立 segment；Investigation 按 `id`、`name`、`title`、`question`、单个 `tags` 值和同一前置投影建立 segment。结构条件过滤 entries 后才匹配。每条 metadata 命中返回稳定 ID、既有领域摘要、`sourcePath` 和按白名单固定顺序的 `matchedFields`；relation summary 不冒充普通字段，改以 `matchedRelations` 表达，数组字段只列实际命中的成员。metadata 不返回 `previews`、行号、文件扫描 truncation 或任何未命中/内部字段。
6. **兼容内容分支，分别测试和发布。** content 继续按 `sourcePath` 遍历并使用既有 preview `maxFiles` 截断：它不是记录分页，metadata 也不继承这些内部文件搜索限额。让新的 metadata DTO/文本输出清楚表明范围、命中字段与命中 relation；同步 Decision/Investigation 的 search 行为说明、help、公开 query types 与测试，随后从维护源码重建实际受影响的 CLI bundle、source map 和声明。relation summary 的 Schema/definition version/旧索引重建已由前置 Change 交付，本 Change 只检查其基线仍可消费。测试实现变动按既有 `decision-records` 与 `investigation-report` topic 一入口一 case 更新，并重建测试证据索引。

### Resulting Impacts

- **快照新鲜度取舍。** metadata branch 有意不发现实体与索引的漂移；同一实体修改后的 metadata 查询可以仍返回旧投影或不返回新词，这是“只读发布快照”的结果，不是允许 fallback 的错误。`check` 负责发现不一致，`sync-index` 负责接受并发布变化。
- **匹配证据。** 对 `all`，`matchedFields` 是含有至少一个命中查询词的所有普通字段 segment；relation summary 词则进入 `matchedRelations`。二者共同解释 source entry 如何满足条件，但不伪称每个字段或 summary 都包含全部词。对 `any` 和 `phrase`，只列实际产生匹配范围的字段/tag 或 relation summary；phrase 只在单条 summary 内连续。输出使用原始字段值和 `{ type, target, summary }`，匹配规范化只服务比较和范围定位。
- **边界失败。** 索引读取失败必须保留领域诊断、非零退出与 `check`/`sync-index` recovery，不映射为合法空结果；内容分支原有 source fallback 仍只属于 content。metadata 成功也不读取索引 JSON 以外的 Markdown、candidate、资源或 Test Evidence 文件。
- **结果量与分发。** Decision metadata 返回全部按既有确定顺序的匹配；Investigation metadata 仅在该完整有序集合形成后应用 `--limit`，不暴露 offset、total 或分页。content 不改变其 sourcePath 遍历和 preview 截断。summary 的持久 state/schema、definition version、旧索引重建和其生成制品由前置 Change 负责；本 Change 只重建和检查自己改变的 search CLI bundle与声明。新增或修改的最小原生 `test` 入口分别维护 case，不能把 `run.ts`、bundle 或 `bun run check` 登记为 case。

## Risks / Trade-offs

- 复用现有 current loader 会悄然读取实体并破坏 metadata 的核心承诺；实现和测试需要把“只读 published index”作为独立的可观察边界。
- 过度抽象 matcher 会迫使文件和两个领域共享 DTO、分页或错误模型；核心只共享文本/segment 不变量，外层仍由各 owner 负责。
- content 与 metadata 都支持相同 `--match`，但 segment 边界不同；文档和测试必须明确 content 的物理行 phrase 规则与 metadata 的字段值 phrase 规则，防止用户把一个范围的结果解释成另一个范围。
- relation summary 是 source-to-target 边的附注而非 target 属性；错误地拼入 type/target、反查 target 或把空 summary 归一化成可匹配文本，会扩大结果并误导使用者。实现和 fixture 必须对这些反例 fail closed；前置 Change 未完成时不得以本 Change 的临时 relation 实现绕过该风险。
- 已发布快照可因未同步来源而落后；这是可审计的查询边界。为获得当前实体事实，用户选择 `--in content` 或先通过 `check`/`sync-index` 维护索引，而非让 metadata 静默扩大读取。

## Open Questions

无。CLI 形状、默认范围、字段白名单、匹配语义、索引失败行为和 Test Evidence 排除范围均已确认。`add-relation-summaries` 的完成 revision 是实施硬门禁而非待决产品选择；未满足时停止本 Change，不以实现猜测替代前置交付。
