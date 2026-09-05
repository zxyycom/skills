# Design

本设计以“共享模块产生受管文件命中事实、同一领域索引快照恢复身份、领域投影结果”为边界，将全文发现接入两个领域而不把正文复制进索引。

## Context

- `tools/index-runtime/` 当前的 `text` key 仅查询派生 key；Investigation 的 key 只含 title 与 question，不能提供正文行预览。Decision 没有 text key。
- Decision 和 Investigation 的 state 都保存经验证的、相对各自受管集合根的 `sourcePath`，且其集合验证要求各自路径唯一；路径不是身份，完整 ID 才是输出、关系和后续 `show`/`trace` 的身份。
- 现有 `use-fixed-index-query-modes` 决策仍允许 `text`，但其退出不能在本阶段发生：Test Evidence catalog 与 ledger 仍是实际消费者。
- `adopt-tagged-test-evidence-cases` 是独立 draft，可能变更 Test Evidence 的发现布局。本 Change 不修改、依赖或假定该布局。

## Goals / Non-Goals

目标：

- 提供可由多个领域复用、只读、受领域集合 root 约束的文件选择、匹配与预览核心。
- 让当前索引的结构筛选、显式受管文件列表与同快照 `sourcePath → ID` 反查成为全文搜索的协作步骤，而不是把 ID 从文件名推断出来。
- 以简易自然语言式 all/any/phrase 满足 AI 发现需求，并保持稳定、有限输出。

非目标：

- 不建立持久全文/倒排/向量索引、缓存或自动同步写入。
- 不提供正则、部分正则、相关性排序、查询表达式、跨领域 `records search` 或任意工作区 grep。
- 不建立独立 CLI、独立分发或 README；不改变 Test Evidence、删除 Index Runtime text mode、改变 Decision/Investigation ID 规则或把候选/资源纳入默认搜索。

## Decisions

### Intended Change

1. **共享运行时边界。** 在 `tools/shared/src/file-text-search/` 建立 TypeScript 模块、公开类型、实现与测试；它不解析 Markdown、不知道索引、ID、status 或领域摘要，也没有独立 CLI/分发目标。各领域 CLI build 直接内联依赖。请求固定为领域受管集合 `root`、互斥的 `patterns` 或 `files`、查询和有界 preview policy；结果只含相对此 root 的规范 POSIX `sourcePath` 与命中位置/预览。
2. **文件安全与选择。** `patterns` 只在 root 内做确定性 glob 发现并支持明确 exclude；`files` 只接受 root-relative POSIX path，规范化、去重和排序后逐一验证。拒绝绝对路径、`..` 逃逸、符号链接、非普通文件、越界解析、无效 UTF-8 与不受支持的选择组合；不把 glob 引擎或本机 `rg` 作为公开语义。
3. **三种匹配。** 默认 `--match all` 将规范化查询按空白拆为去重词，要求每个词至少命中一次，允许词分布在不同物理行；`any` 要求任一词，也允许跨行候选；`phrase` 要求完整规范化查询在同一物理行连续匹配，绝不跨换行。统一 NFKC、默认忽略大小写和查询空白语义；空查询与未知 mode 是参数错误。实现保留规范化文本到原文行/列范围的映射，使预览与行号永远定位权威原文，而不是规范化副本。
4. **rg 风格预览。** 每一命中文件返回受 policy 限制的命中行、列、原文片段和高亮范围；合并重叠的上下文窗口，限制每文件命中数、总文件数、总预览字符和 context 行数。输出按 root-relative sourcePath、行、列确定排序，显式报告截断而不伪装为完整。
5. **索引协作。** 领域适配器优先打开当前结构化索引，从同一 reader snapshot 的 entries 得到正式记录的 canonical `sourcePath → entry` 唯一 Map 和显式 `files` 列表；有结构条件时先过滤 entries 再缩小 files。搜索不得在无条件时转而传 pattern。仅当索引缺失、陈旧、损坏或不可打开时，领域才完整读取并验证权威集合，构建等价只读内存投影、Map 与 files，附 warning 且绝不写盘。每个命中必须恰好映射到一个 entry；异常、零映射或多映射使整个请求失败。Index Runtime 不新增通用 sourcePath key。
6. **领域 CLI。** Decision 增加 `search <text> [--match all|any|phrase]` 并复用现有 status/alignment/tag/limit 等结构条件，默认 active；Investigation 增加等价 `search` 并复用 tag、formedAt、relation type 等条件，仅查正式根目录报告。各自将共享 file result 与同快照 index entry 合成为完整 ID、当前领域摘要字段、sourcePath 和 preview；不抽象统一 CLI 或统一展示 DTO。
7. **旧 Investigation 窄搜索退出。** 删除 Investigation `text` key、`list --text` 及其 text projection，升级该领域 definition version 与 index Schema/fixtures/测试，并把用户指导改为：已知 ID 用 show，已知结构字段用 list，主题/正文措辞用 search，再以 ID show/trace。

### Resulting Impacts

- **路径同形与映射。** 共享 root 一律是领域受管集合根，`files` 与返回 `sourcePath` 和 state `sourcePath` 一致；领域不做 workspace 坐标转换。须测试非 ID basename、Decision archive 位置以及 Investigation 正式根目录，确认 entries Map 仍一一对应。
- **一致性与降级。** 当前索引路径中的 file list、Map、结构筛选与最终投影必须取自同一 reader snapshot；fallback 在完整权威来源读取中固定投影/Map/list。发现来源漂移、非法来源或在选择/读取之间无法验证时失败或给出既有领域恢复诊断，不返回混合快照结果。
- **模式与预览。** phrase 的单行限制避免跨行规范化/坐标歧义；all/any 的跨行语义仍需产生实际匹配行预览，并明确哪些词命中何处。pattern 功能只能由明确受管调用者使用，领域默认/正式搜索严格以索引或 fallback 文件列表排除 candidate、resource 与 index JSON。
- **公开契约/生成。** 更新 CLI 参数解析、文本输出、程序化结果类型、Index JSON Schema、generated bundles/declarations/source maps、skill references 与必要 test-evidence cases；只修改由本 Change 触及的 owner。
- **长期理由。** 通过 Decision Records 后继/演进记录固定“全文按需扫描权威文件、索引只做结构与定位”的长期边界；若现有固定查询模式决策的 text 退出理由尚未适用，只在第二阶段演进它。

## Risks / Trade-offs

- Unicode NFKC 后的命中坐标映射仍是最易产生错误预览的部分；实现前须用组合字符、全半角、CRLF 和单行 phrase fixture 定义事实，不能以 JavaScript 字符串索引猜测列。
- 每次 search 读取索引已选的权威文件，规模增长后可能比索引慢；当前小集合优先避免正文副本，未来只能以实测延迟另开 Change。
- 内存 fallback 提高可用性但必须完整验证来源；部分读取或 silently skip 会破坏结果完备性。
- 将共享实现置于 `tools/shared/` 依赖领域 bundle 内联，避免独立交付面，但必须用 build 测试证明三处 consumer 都不遗失模块。

## Open Questions

无；实施开始前按 Readiness 任务用现有 bundle、path 与 CLI fixture 确认上述契约能落到当前源码边界。
