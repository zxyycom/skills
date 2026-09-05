# Proposal

本 Change 为 Decision Records 与 Investigation Report 的 `search` 增加可与全文搜索明确区分的纯索引元数据范围，并把计划写成实施者可直接核对 owner、边界与验收的说明。

## Why

两领域的正式索引已投影其可发现元数据，但现有 `search` 只搜索权威 Markdown；它在索引不可用或不新鲜时还会读取实体建立只读降级。把元数据查询也做成实体搜索会重复读取、无法可靠报告命中字段，并把“已发布索引快照”与工作区未同步来源混为一谈。

## Outcome

`decision-records search <text> --in metadata` 与 `investigation-report search <text> --in metadata` 只读取相应已发布索引，按既有结构条件和统一 `all|any|phrase` 匹配领域字段及可选 relation summary，返回来源记录的完整 ID、领域摘要、`sourcePath`、`matchedFields` 和 `matchedRelations`；`--in content` 保持现有权威 Markdown 搜索及其兼容行为，并继续作为默认值。

## Scope

### Intended Change

- 为两个既有 `search <text>` CLI 增加严格的 `--in content|metadata`，省略时固定为 `content`；`list` 继续只承担精确结构化筛选。
- 从 `tools/shared/src/file-text-search/` 抽取最小纯文本匹配核心，使文件搜索把物理行、元数据适配器把单个字段值都传为独立 segment，而不建立通用领域搜索框架。
- 让 metadata adapter 只读取并解析已发布的 Decision 或 Investigation 索引，先沿用现有结构条件，再按领域字段白名单匹配，并返回确定的 `matchedFields`。
- metadata 将已发布的非空 `relations[].summary` 作为其来源记录的独立 segment，并用 `matchedRelations` 返回命中的 `{ type, target, summary }`；relation 的写入、图语义和索引投影仍由各领域的稳定 relation owner 承接。
- 更新两个领域的行为说明、CLI/API 类型和生成制品；为新增或调整的最小原生测试入口维护测试证据及其派生索引。

### Resulting Impacts

- `content` 与 `metadata` 是不同的权威边界：前者保留实体文件搜索、行预览和既有只读 source fallback；后者绝不读取实体、资源或 candidate，绝不验证来源新鲜度、自动同步、重建索引或从实体 fallback。
- metadata 查询必须使用只解析持久索引的读取路径，不能调用会扫描 Markdown 的 current/freshness loader；索引缺失、损坏、definition 不兼容或其他读取失败时以非零失败返回可行动诊断，指向 `check` 与 `sync-index`。
- Decision 匹配 entry ID、`name`、`title`、`purpose`、`background`、`decision`、`tags` 和当前记录 `relations[].summary`；Investigation 匹配 entry ID、`name`、`title`、`question`、`tags` 和当前记录 `relations[].summary`。`sourcePath`、时间、status、alignment、resourceIds 仍只用于定位或结构过滤；relation `type`/`target` 可保留既有结构关系职责，但不作为自由文本搜索 segment。
- `all` 可由同一来源记录的不同字段或 relation summary segment 共同满足，`any` 命中任一 segment，`phrase` 只能在一个字段值、tag 值或单条 relation summary 内连续匹配；不得拼接字段、跨 tag/summary、以 target 记录反向命中，或再生成/持久化 `searchText`。
- 缺失或空 relation summary 不贡献匹配。metadata 命中始终返回拥有该 relation 的来源记录；`matchedRelations` 只列其中实际命中 summary 的 `{ type, target, summary }`，而不是把 target 记录、type 或 target 字符串当作文本命中。
- 本 Change 只消费已发布的 relation summary 投影，不实现或修改 summary 的来源、索引、Schema 或迁移。
- Test Evidence 与 Index Runtime 的 `text` mode/`searchText` 迁移不在本 Change，仍由 `remove-index-runtime-text-mode` 及其 Test Evidence 前置处理。

## Success Criteria

- 两个 CLI 均接受 `--in content|metadata`，省略 `--in` 与显式 `--in content` 的结果、预览、fallback 和退出边界兼容；`list` 没有新增模糊文本参数。
- metadata 搜索只使用索引 snapshot，证明查询不会打开任何实体 Markdown；索引失败不会静默回退，且诊断能引导 `check` / `sync-index`。
- 匹配字段、模式和规范化可重复验证：`all` 可跨字段，`any` 可命中任一字段，`phrase` 不跨字段或数组成员；结果只报告实际命中的白名单字段，不含行预览或非白名单内部值。
- 缺失/空 summary 不命中；命中 summary 只返回来源记录及精确 `matchedRelations(type,target,summary)`，不因 target/type 文本或 target 记录而命中。
- Decision metadata 不新增 `--limit`、`--offset`、`total` 或记录分页，并按既有确定顺序返回全部匹配记录；Investigation metadata 先按既有确定顺序形成全部匹配记录，再应用唯一现有的 `--limit`（默认 50、最大 1000），且同样不提供 `--offset`、`total` 或分页。两个领域的既有结构过滤、稳定 ID 和公开摘要保持有效；候选、资源、索引 JSON 文本和未同步实体内容均不被误报为 metadata 匹配。
- 相关 unit/CLI 测试、生成制品检查、测试证据目录检查和 `bun run check` 通过。

## Affected Owners

- `tools/shared/src/file-text-search/` 与 `tools/shared/tests/file-text-search.test.ts` 承接纯文本匹配和文件适配的最小公共不变量。
- Decision Records、Investigation Report 的稳定关系 owner 承接 relation `summary` 的来源/写回、graph/lifecycle、索引投影、Schema、definition version、rename、兼容和验证；本 Change 只读取已发布投影。
- `tools/decision-records/`、`skills/decision-records/SKILL.md` 与 `scripts/build/decision-records.ts` 承接 Decision metadata 搜索 adapter、CLI/API 输出及 `decision-records.mjs`、source map、入口 `.d.mts` 和 `decision-records-sdk/` 声明制品。
- `tools/investigation-report/`、`skills/investigation-report/SKILL.md` 与 `scripts/build/investigation-report.ts` 承接 Investigation metadata 搜索 adapter、CLI/API 输出及 `check-investigations.mjs`、source map 和入口 `.d.mts` 制品。
- `docs/test-evidence/decision-records/`、`docs/test-evidence/investigation-report/` 及统一测试证据索引承接本 Change 修改的最小原生测试入口；`docs/test-evidence/test-evidence-topics.json` 的既有 topic 定义不因本 Change 改变。
