# Proposal

本 Change 把未知领域身份时的发现入口收敛为索引协同的文件全文搜索，并作为可实施计划而非产品实现。

## Why

Decision Records 的 `list` 只做结构化筛选，Investigation Report 的现有 `--text` 只投影 title 与 question；两者都无法从权威 Markdown 正文中发现主题、给出命中位置，或以稳定领域 ID 返回结果。AI 因而绕过领域 CLI 使用手工文件搜索。把全文复制到派生索引会放大索引与同步负担，也不能预先保存查询相关片段。

## Outcome

Decision Records 和 Investigation Report 各提供 `search` 发现能力：先在当前索引已列出的受管权威 Markdown 中以 all、any 或 phrase 搜索，再由同一索引快照的 `sourcePath` 映射回完整领域 ID，并由领域输出摘要与 rg 风格命中预览；当前索引不能使用时，完整验证权威来源后只读降级。没有持久全文索引、正则查询或跨领域统一 CLI。

## Scope

### Intended Change

- 在 `tools/shared/src/file-text-search/` 新建共享运行时模块，接收互斥的受管 glob pattern 或显式规范文件列表，并只读取该选择集；它没有独立 CLI、README 或分发目标，而是由领域 CLI build 内联。
- 固定 `all`、`any`、`phrase` 三种文本匹配和确定性命中预览，供领域适配器复用。
- 让 Decision Records 和 Investigation Report 的正式记录搜索优先以当前索引得到显式文件列表，并以同一快照的 `sourcePath` 反查 ID；领域仍拥有 lifecycle、过滤、摘要和 CLI 输出。
- 移除 Investigation 对 Index Runtime `text` key 的依赖，改由新 `search` 读取全文；保留它的其它结构化索引 key。
- 更新两个 skill、领域契约、类型/Schema、测试、构建生成物和必要的长期决策演进。

### Resulting Impacts

- 共享搜索的 `root` 是调用领域的受管集合根，输入与输出 `sourcePath` 均为相对此 root 的规范 POSIX 路径，并直接与领域索引 state 的 `sourcePath` 同形；不得做 workspace-relative 转换。
- 领域正式搜索无论是否含 status、tag、alignment、formedAt 或 relation-type 条件，都优先从当前索引得到受管显式 file list；结构条件只进一步缩小该列表。只有当前索引缺失、损坏、不可读取或不新鲜时，才完整验证权威来源并建立只读内存投影/列表。共享模块的 pattern 选择能力保留给受管调用者和独立测试，不得因此把 candidate、resource、索引或其他文件混入领域搜索。
- `sourcePath → ID` 只由同一 index snapshot entries 建立唯一 Map；不为 Index Runtime 增加通用 sourcePath key，且映射不完整或不唯一时不得猜 ID 或把部分结果称为完整。
- `search` 是新公开 CLI 形状；现有 `list` 继续是结构化浏览，`show`/`trace` 继续接受 ID 或现有 selector。
- Decision 默认范围仍为 active；Investigation 仍只含正式报告并排除 candidate 与 `_resources`。本阶段不迁移 Test Evidence，也不删除 Index Runtime 的 `text` 协议。

## Success Criteria

- 共享模块对同一受管 root 中的 pattern 与等价显式文件列表产生确定、受限的 root-relative `sourcePath`、行号与原文预览；领域结果额外含来自同一快照的完整 ID。
- `all`、`any`、`phrase` 的空白、NFKC、大小写、重复词、无结果、非法输入、UTF-8/路径越界和上下文合并语义都有直接测试；phrase 仅在单一物理行连续命中，all/any 可由不同物理行的词共同满足。
- Decision 正文独有词和 Investigation 正文独有词可分别由新 CLI 找到，索引显式文件选择与 sourcePath/ID 映射一致，且 fallback 只在当前索引缺失、损坏、不可读取或不新鲜时发生。
- Investigation 不再声明或查询 `text` key，其他 consumers 不受本 Change 破坏；所有受影响分发 artifacts、schemas、领域检查与仓库检查通过。

## Affected Owners

- `tools/shared/src/file-text-search/` 及其共享测试，作为无独立 CLI/README/分发目标的跨工具运行时实现。
- `tools/decision-records/`、`skills/decision-records/` 与 `docs/decisions/`。
- `tools/investigation-report/`、`skills/investigation-report/` 与 `docs/investigations/` 的索引/查询契约。
- `tools/index-runtime/` 仅作为保留 exact/range 结构查询的消费者边界；其 text 模式在后继 Change 退出。
- `scripts/build/`、已生成 skill CLI/声明/Schema 和对应测试证据 owner。
