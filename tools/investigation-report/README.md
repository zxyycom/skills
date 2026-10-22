# Investigation Report 工具维护

本入口面向修改 CLI、SDK、实现或测试的维护者。创建、查询和维护报告属于工具使用，执行入口是 [Skill](../../skills/investigation-report/SKILL.md)，无需为普通记录操作加载本文件。

## Owner 与读取路径

| 修改对象 | 先读 |
| --- | --- |
| 报告模型、格式、关系、资源 | [领域契约](../../skills/investigation-report/references/investigation-report-contract.md)对应章节 |
| 命令前提、影响、结果或失败行为 | [CLI 操作契约](../../skills/investigation-report/references/cli-operations.md)对应章节及实际 help |
| 查询、搜索或 trace 实现 | 下方查询投影与搜索协议；公开 API 声明由源码及生成 `.d.mts` 承接 |
| 写入、同步或暂存实现 | 下方写入与阶段事实，以及公开操作对应章节 |
| 构建、分发或验证入口 | [项目工具链](../../docs/tooling.md#工具维护命令)、[编码规范](../../docs/coding-style.md)；测试改动按 [Test Evidence Review](../../skills/test-evidence-review/SKILL.md) |

源码在本目录，构建适配在 `scripts/build/investigation-report.ts`，生成 CLI、声明与 Schema 分发到 `skills/investigation-report/`。本 README 维护实现约束，不进入 skill 包。索引精确持久结构仍由生成 Schema 承接，操作语义只在 skill 对应 owner 维护。

## 查询投影

list 从严格加载产生的本次 reader 取得冻结索引与查询结果，复用字段物化，领域关系上下文与 facets 各准备一次。原始索引查询入口保持完整校验；reader 的生命周期与验证边界由 [Index Runtime](../index-runtime/README.md)承接。

### 候选读取

同一查询阶段复用候选源字节、身份映射、引用与资源依据，正式共享 owner 按实际引用读取。没有可用索引或出现未知、移动 owner 时，身份发现可扩大，局部读取仍不证明正式全集健康。

`new` 在身份归一化前取得一次有效 formedAt；显式非法值失败，不能回退默认。stdout 只集中回显身份、标题、路径与三项 readiness，warning/error 留在 stderr；起草与候选读取不附带全集发布预检，readiness 不就绪不撤销已成功创建的候选。

### 关系图上下文

单次操作内，每份不可变投影由独立的内部 [`InvestigationRelationContext`](src/relation-context.ts) 绑定条目和惰性关系图：

- **按需复用**：首次实际访问图时构建正反向邻接和 ID 映射，后续图操作共用同一引用；无关系条件的 `list` 和 metadata 搜索不构图。
- **顺序责任**：构图保留投影边序，证据、诊断与 `trace` 各自在输出时确定顺序。
- **阶段边界**：同次发布索引查询复用所属投影上下文；集合变更或进入新的准备、复核与恢复阶段时，另建上下文并完成所属阶段的校验。图的生命周期止于本次快照。

### 关系筛选与 trace

- `filterRelations` 是公开 Investigation list/search entry API 的可选字段，只在有关系条件时出现，来自同一筛选快照。按 `(sourceId, type, target)` 去重并以 UTF-16 code-unit 词法序排序；前驱边由 anchor 指向结果，后继边由结果指向 anchor，both 取并集，type-only 取结果来源的指定类型出边。该字段不进入索引 Schema，记录排序、分页与 limit 不变。
- trace 的两种 renderer 消费同一成功查询，不重读索引或重新选择。JSON 原样序列化稳定 envelope，含 anchorId、direction、limits；无限 depth 表示为 `"all"`。
- `traceIds` 与 `contextIds` 互斥，并集等于 entries keys。context 后续实际到达时提升为 trace member；完整拆分或纯归并事件整体接纳，预算不足不能部分加入。
- 每个 entry 只投影 title、formedAt、question、tags、完整 relations；ID 在 key 中，name、sourcePath、resourceIds 不进入 trace 结果。切片外 target 保持完整关系事实。
- 图按稳定 `L0/L1/...` 层次输出，每个 trace 节点只有一个主体块。主体或事件对端承接已展示边的方向与摘要；摘要按 JSON 转义的完整单行文本显示，缺失标记 `[无摘要]`。renderer 不改变 coverage、frontier 或 blockedEvent。
- `coverage.complete` 仅在无深度或预算截断时为真。普通单记录预算受阻只形成 frontier；多记录事件的 blockedEvent 保持完整 recordIds，requiredMaxRecords 表达整体接纳的最小预算。

### 搜索协议

公开 `InvestigationSearchResult` 用 status 判别：ok 时 `searchInfo` 完整，error 时为 null；失败不伪造计数。failureKind 区分 invalid-options 与 operation，对应 CLI 退出 2 与 1。`InvestigationSearchInfo` 是即时只读查询结果，不进入持久索引。

| 分组 | 实现要求 |
| --- | --- |
| query | 保存用于 matcher 的 text、in、match，以及规范化 filters、limits；未用可选条件省略。tags 默认 `[]`，时间回显等价 UTC，relatedTo 为同一筛选快照解析的完整 ID，direction 有目标时默认 both。 |
| source | metadata 固定 published-index / unchecked / false；content 固定 published-index+current-text / unchecked / false，表达发布范围与本次文本。 |
| counts | matched 按记录计数，包含已发现但不能返回的命中；precision 为 exact 或 lower-bound，returned 是实际返回数。 |
| coverage | 分别保存 scanComplete、resultsComplete、previewsComplete；reasons 按 max-records、match-previews、preview-characters 顺序去重，未限制为 `[]`。 |

两种搜索的 maxRecords 是实际 limit，默认 50、最大 1000。metadata 的 resources/preview 为 null；content 的预算为：

- 扫描：maxCandidateFiles = 2,000，maxFileBytes = 2 MiB，maxTotalBytes = 20 MiB。
- 预览：contextLines = 1，maxMatchesPerFile = 3，maxPreviewCharacters = 24,000（UTF-16 字符）。

metadata 保留切片前精确计数。content 返回预算满后，在首个不能返回的命中文件停止并将其计入 matched；仍有未检查文件时为 lower-bound，若该文件恰是最后一个则 exact 且 scanComplete，但 resultsComplete 仍为 false。

预览耗尽后继续在扫描与返回预算内识别命中，空 previews 仍保留身份。只在实际省略片段时标记预览受限，恰好用满预算及未返回记录均不影响该字段。完整零命中为 exact 0、returned 0，扫描、结果和 content 预览完整；必需读取、身份或路径安全错误及取消保持失败。

默认 stdout 的六行摘要均从同一结果生成：字符串 JSON 转义，Filters 紧凑 JSON，Limits 只展开适用预算，下界为 `matched>=N`。warning 保留领域前缀，每类仅一次写 stderr：

- `search results limited: max-records`
- `search previews limited: match-previews,preview-characters`，只列实际原因。

content 使用严格发布索引与领域图选择范围，先判断候选预算，再安全读取所选文本并在匹配前核对同份字节的 ID。索引失败走显式恢复，读取与身份错误保持失败；当前文本不证明全集来源新鲜或跨文件原子快照。

## 写入与阶段事实

### 事务与诊断

工作区 mutation 共用集合锁，写前独立核对相关来源、索引和成员，保护范围外工作。publish 以索引发布为提交点；set-relations 的 review 从准备阶段读取的完整 before 与规范化完整 after 生成，按 source ID 排列，正式成功与预检分别为 committed/preflight，失败不返回成功 review。

关系输入形态问题在 CLI 边界以参数错误拒绝，需要集合知识的解析与绑定属于领域失败。单值参数重复退出 2；合法 repeatable 参数保留集合或分组语义。

删除通过同文件系统 tombstone 保存恢复范围。提交前失败恢复完整旧组合；提交后只精确清理预演成员，不递归删除未知字节。rename 新目标独占创建，资源复制后核对类型、权限、大小、内容，旧成员再次确认未变后逐个清理。回滚只撤销仍等于事务快照的新内容，并只恢复仍缺失的旧路径；并发漂移保留现场并报告 partial-or-unknown。

诊断有可靠系统证据时才增加净化的 category、operation 和 target；权限或工具故障不映射为无条件重试。即时输出不保存日志、遥测或 receipt。只对真实 mutation 声明 scope/outcome。

### 检查与同步

全量 check 使用首次采集的同一份身份、源字节、解析结果与资源事实，每份正文读取一次；单阶段复用不构成跨调用缓存。同步（含预检）及其他写操作仍在各自边界重新取得可变来源，拒绝期间漂移。

前序历史 warning 依据固定 HEAD 的直属正式来源身份或合法 basename，而非 HEAD 索引声明。有直接关系时完整验证直属 formal payload，可只保留身份前三行所需前缀；不足时按固定 revision 补读。legacy、移动来源、缺失或不一致索引不改变 source-presence 语义；无关正式对象读取失败仍报告历史检查不可用。无直接关系时不获取历史。

### stage 的目录与来源

公开 scope、选择与安全前提见 [暂存操作契约](../../skills/investigation-report/references/cli-operations.md#待提交快照)。实现另外保持：

1. 准备和写前复核阶段各自维护目录名字索引，使用时仍核对身份、类型和 canonical 路径。同身份目录 metadata 改变时重新枚举，核对相关 exact、casefold 和缺失匹配；发现相关匹配、完整树成员或目录替换，容许无关 sibling 活动。目录事实只在本阶段有效。
2. 两阶段在获取资源字节前检查资源根、owner 及全部路径分量，零引用或空树也不跳过。引用路径按领域字符契约，未引用成员只按安全普通文件路径检查。
3. all/domain 从发布声明及已变化 pending 身份确定所选正文、旧位置、直接资源与正式 owner 依赖；每阶段验证相关来源投影、指纹与资源安全。index 不读取工作区正文。未同步工作区未知位置的身份重现由显式检查／同步发现，stage 只核对所选已知受管位置。
4. 两阶段重新取得可变工作区成员、字节、文件表示、发布索引和全 pending 快照。每阶段至多读一次 core.fileMode，关闭时复用已取得的完整 pending 表示依据。固定 revision 的 HEAD 索引和资源成员可跨阶段复用，锁内仍核对当前 HEAD 指针及完整 pending 的路径、字节、表示。
5. 完整 pending 保护使用共享层完整成员与实际内容身份，只保留所选更新路径的字节；准备、写前、锁内和写后均验证全部范围对象的完整 payload。节省保留与复制不减弱完整对象读取失败及深层腐败检查。
6. 来源路径的真实系统失败与 symlink、case、成员问题分别承接。候选与查询的普通验证返回问题集合，stage 复核从详细检查取得 failure；无可靠信号时不猜类别或附会写入结果。

all/domain 的 preservedPendingPaths 是本领域 scope 中相对固定 HEAD 已变化但不在目标内的 pending 路径，含 staged 删除；只从路径变化 metadata 取得，不为此读取全部 HEAD 正文。index/all 的索引以捕获的 pending 为基底组合选中投影，domain 保持 pending 索引字节或缺失状态。局部来源访问随所选对象、必要依赖及已暂存位置变化增长；完整索引、图和 pending 仍有集合级成本。

## 交付验证

按改动运行 `bun run test:investigation-report-check`；源码改动后用 `bun run sync:investigation-report-check` 生成，再运行 `bun run check:investigation-report-check`。涉及公开行为时同步对应 skill 文档与版本，测试改动维护 Case 账本；最终运行项目 `bun run check`，分别报告机械证据与语义审查。
