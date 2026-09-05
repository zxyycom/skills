# Proposal

本 Change 为 Decision Records 与 Investigation Report 增加同一领域内的直接关系筛选，使结构条件能够先缩小记录集合，再执行全文或元数据搜索。

## Why

两个领域已经支持 tag 以及各自的状态、对齐或形成时间筛选，也能搜索正式 Markdown 正文或已发布索引 metadata；`trace` 则能从已知记录展开关系图。当前查询无法直接表达“只在与某条已知记录有直接关系的记录中搜索”，调用方必须先执行 `trace`，再自行拼接 ID 与搜索结果，容易退回手工文件搜索。

关系目标、方向与类型在两个领域中具有相同的查询含义，但 selector、关系类型、错误、结果和分发制品分别属于各自领域。本 Change 统一行为约束和验收，不建立跨 skill 查询入口或运行时依赖。

## Outcome

- Decision Records 与 Investigation Report 的 `list` 和 `search` 都能按一个领域内目标 selector、直接关系方向和可选关系类型筛选正式记录。
- 关系条件与已有 tag、状态、对齐或形成时间条件取交集；content search 只读取筛选后的正式 Markdown，metadata search 只匹配筛选后的索引 state。
- 查询保持各领域既有结果、排序、分页或 limit 语义，并能继续用返回的完整 ID 调用 `show` 或 `trace`。

## Scope

### Intended Change

- 两个领域的查询 API 与 CLI 增加单个关系目标和方向参数；目标使用本领域现有的标准 ID 优先、唯一 name 回退 selector 规则，方向使用 `predecessors`、`successors` 或 `both`，默认 `both`。
- Investigation 保留现有单个关系类型筛选；Decision 增加对应的单个关系类型筛选。关系目标与类型同时出现时必须命中同一条直接边。
- 每个领域从当前查询所使用的正式 index snapshot 解析目标并计算直接关联 ID，再与已有结构条件组合；content search 继续把候选 `sourcePath` 文件列表交给共享文本搜索，metadata search 继续只读取索引。
- 更新两个领域的行为 owner、CLI 帮助、公开类型、生成分发制品、skill 版本和必要的人类说明。

### Resulting Impacts

- Decision Records 的 query request、CLI 参数解析与输出入口需要携带关系条件；其查询服务需要在 list、content search 和 metadata search 中使用同一直接关系谓词。
- Investigation Report 的 query/search options、CLI 和查询实现需要解析关系目标，并让已有 relation type 在目标存在时与目标约束同一条边。
- 两个领域都需要保留 selector 诊断、content 只读 fallback、metadata 索引权威性、结果 DTO、排序、分页或 limit，以及 metadata `matchedRelations` 的现有含义。
- 索引 state 已包含完整直接关系，因此不修改 Index Runtime、索引 schema、持久字段、关系图语义或历史记录，也不要求迁移或回填。
- 新增或修改的最小原生测试入口按 Test Evidence Review 契约维护对应 case，并同步派生索引。

### Non-Goals

- 跨领域关系、跨 skill 查询 API、统一知识查询 skill、仓库专用聚合 CLI 或共享领域 DTO。
- 多跳关系筛选、多个关系目标、OR、NOT、嵌套条件组、查询 DSL、相关性排序或任意结构条件组合协议。
- 持久反向关系索引、完整正文索引、候选记录搜索、资源正文搜索，或 relation target 实体内容搜索。
- 改变 `trace` 的图展开责任，或把结构筛选命中的关系伪装成 metadata 文本命中证据。

## Success Criteria

- 两个领域的 `list` 与 `search` 接受一个 `related-to` selector；标准 ID 精确解析，非标准输入按唯一 name 解析，目标不存在或 name 歧义返回领域既有风格的可行动错误。
- `predecessors` 只返回目标直接指向的前序记录，`successors` 只返回直接指向目标的后继记录，`both` 返回两者去重并沿用领域排序；省略方向时等于 `both`，没有目标时提供方向是参数错误。
- 只提供 relation type 时，返回含任意该类型直接边的记录；同时提供目标和类型时，target 与 type 必须由同一个 relation 对象满足。
- 关系条件与重复 tag 的 AND 以及 status、alignment 或 formedAt 条件取交集；合法无匹配查询成功返回空结果。
- Content search 只把最终候选 state 的 `sourcePath` 交给共享文件搜索；只读 fallback 使用本次完整验证产生的同一临时 snapshot 解析目标和筛选，不依赖陈旧持久索引。
- Metadata search 只读取持久索引并先应用相同结构条件；`matchedFields` 和 `matchedRelations` 仍只表示文本实际命中的 segment。
- Investigation 的 list 分页与 total、两个领域的既有结果 DTO、排序、search limit、warning 和错误边界保持兼容。
- 领域行为 owner、公开类型、CLI 帮助、生成 bundle、skill 版本、测试证据和仓库检查一致；实现不新增共享领域查询抽象或持久索引结构。

## Affected Owners

| Owner | 本 Change 的责任 |
| --- | --- |
| [`tools/decision-records/src/`](../../tools/decision-records/src/) | Decision 查询类型、selector 解析、关系筛选、CLI 参数和执行入口 |
| [`skills/decision-records/`](../../skills/decision-records/) 与 [`docs/skills/decision-records.md`](../../docs/skills/decision-records.md) | Decision 行为规则、AI 与人类查询入口、skill 版本、生成 CLI 与 SDK 声明 |
| [`tools/investigation-report/src/`](../../tools/investigation-report/src/) 与 [`tools/investigation-report/api/`](../../tools/investigation-report/api/) | Investigation options、关系筛选、CLI 和公开声明源 |
| [`skills/investigation-report/`](../../skills/investigation-report/) 与 [`docs/skills/investigation-report.md`](../../docs/skills/investigation-report.md) | Investigation 固定查询契约、AI 与人类查询入口、skill 版本和生成 CLI 声明 |
| [`tools/decision-records/tests/`](../../tools/decision-records/tests/) 与 [`tools/investigation-report/tests/`](../../tools/investigation-report/tests/) | 两个领域的最小查询、CLI、公开声明和分发行为证据 |
| [`docs/test-evidence/`](../../docs/test-evidence/) | 为新增或修改的最小原生测试入口维护唯一 case，并同步统一派生索引 |
| [`260905-search-authoritative-files-with-index-identity`](../../docs/decisions/search-authoritative-files-with-index-identity.md) | 已对齐的长期边界：领域索引先做结构筛选，再以显式 `sourcePath` 搜索权威文件并反查完整 ID；本 Change 不修改该决策 |
