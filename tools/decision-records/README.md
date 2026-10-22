# Decision Records 工具维护

本入口面向修改 CLI、SDK、实现或测试的维护者。查询和维护决策记录属于工具使用，执行入口是 [Skill](../../skills/decision-records/SKILL.md)，无需为普通记录操作加载本文件。

## Owner 与读取路径

| 修改对象 | 先读 |
| --- | --- |
| 记录模型、格式、生命周期或关系 | [领域规则](../../skills/decision-records/references/decision-record-rules.md)对应章节 |
| 命令前提、影响、结果或失败行为 | [CLI 操作契约](../../skills/decision-records/references/cli-operations.md)对应章节及实际 help |
| 查询、搜索或 trace 实现 | 下方查询投影与搜索协议；公开 API 声明由源码及生成 `.d.mts` 承接 |
| 关系解析、事务或输出实现 | 下方关系输入与诊断，以及公开操作对应章节 |
| 构建、分发或验证入口 | [项目工具链](../../docs/tooling.md#工具维护命令)、[编码规范](../../docs/coding-style.md)；测试改动按 [Test Evidence Review](../../skills/test-evidence-review/SKILL.md) |

源码在本目录，构建适配在 `scripts/build/decision-records.ts`，生成 CLI、声明与 Schema 分发到 `skills/decision-records/`。本 README 维护实现约束，不进入 skill 包。索引精确持久结构仍由生成 Schema 承接，操作语义只在 skill 对应 owner 维护。

## 查询投影

### 快照与关系筛选

list/trace 成功结果显式包含 `source={kind: "published-index", currentness: "unchecked", fallback: false}`；metadata search 在 searchInfo.source 中表达同一事实。正常 unchecked 不生成来源 warning。show 只用目标已读字节比较单条 revision，不扩大为全集验证。

严格加载后的领域投影复用本次冻结索引，保留完整关系校验；原始索引查询入口继续独立严格校验。完整来源检查把同轮已验证的正文投影与来源指纹交给索引文本检查，仍独立重读 revision 检测漂移，并比较完整预期索引文本。调用方持有的旧 scan 和独立同步操作各自重新读取来源。

关系图以单次操作内的一份稳定快照为作用域，通过[惰性访问器](../shared/src/graph/lazy-relation-graph.ts)按需构建：

- **按需复用**：首次实际访问图时构建，后续校验、`trace` 与关系筛选共用该图；`related-to` 使用同图的正反向邻接。
- **加载校验**：严格索引加载执行完整关系校验，因此普通 `list`、`show` 和 metadata 搜索成功时也各构图一次。
- **阶段边界**：新加载、来源重读和事务投影各建独立访问器，并完成所属阶段的校验。图与访问器仅由内部快照上下文持有。

`filterRelations` 属于 Decision 内部 list/search 查询记录，不进入索引、Schema 或公开导出边界。只在传入 related-to 或 relation-type 时出现，来自同一筛选快照。按 `(sourceId, type, target)` 去重并用 UTF-16 code-unit 词法序排序；前驱边由 anchor 指向结果，后继边由结果指向 anchor，both 取并集，type-only 取结果来源的指定类型出边。记录排序、total 与分页不变，文本命中证据单独计算。

### trace

两种 renderer 消费同一查询成功结果，JSON 序列化稳定 envelope，回显 anchorId、direction、limits；无限 depth 表示为 `"all"`。终端图含 header、Source、稳定 L0/L1 图层、关系或事件组与不完整边界。

- traceIds/contextIds 互斥，并集等于 entries keys；context 只闭合已跨越的完整拆分、纯归并或重划事件，不递归扩展。
- entry 保留完整 relations，已有 summary 原样投影，缺失省略。终端图只展开切片内部边；主体承接 source 边，复杂事件的 source 仅为 context 时按边显示完整 source、type、target 与摘要，不能使用匿名摘要。
- 摘要按 JSON 转义的完整单行文本展示，缺失显示 `[无摘要]`；显示归属不改变 coverage、成员或 JSON。
- coverage.complete 要求请求方向未被深度或预算截断且事件完整。多记录事件被预算阻断时，blockedEvent 保持全部成员及最小 requiredMaxRecords，不部分接纳；单记录预算阻断只形成 frontier。

### 搜索协议

成功搜索（含零命中）的内部查询结果包含即时、只读 searchInfo，不进入持久索引。query 保存 text、in、match、规范化 filters 和 limits；status 默认 active、alignment 默认 all、tags 默认 `[]`。可选 relationType/relatedTo/direction 只在使用时出现，relatedTo 为同一筛选快照解析的完整 ID，有目标时 direction 默认 both。

| 范围 | source | limits |
| --- | --- | --- |
| metadata | published-index / unchecked / false | maxRecords 默认 100，`--limit` 接受 1..1000；resources、preview 为 null。 |
| content | published-index+current-text / unchecked / false | maxRecords=20；扫描与预览预算如下。 |

content 扫描预算为 maxCandidateFiles=10,000、maxFileBytes=2 MiB、maxTotalBytes=20 MiB；预览预算为 contextLines=1、maxMatchesPerFile=3、maxPreviewCharacters=12,000（UTF-16 字符）。

计数和覆盖分别维护：

1. matched 按记录计数，包含已发现但无法返回的命中；precision 为 exact 或 lower-bound，returned 为实际返回数。
2. metadata 全量匹配、精确计数，只保留窗口内完整结果；超限时 scanComplete 为 true、resultsComplete 为 false。content 返回预算满后，在首个不能返回的命中文件停止并计入 matched；还有未检查文件则 lower-bound，恰为最后一个则 exact 且 scanComplete，但 resultsComplete 仍为 false。
3. 预览耗尽后继续在扫描与返回预算内识别命中，空 previews 保留身份；只有实际省略片段才标记预览受限，恰好用满预算或未返回记录均不影响 previewsComplete。
4. 完整零命中为 exact 0、returned 0，扫描、结果及 content 预览完整；metadata 预览为 null。必需读取、身份或路径安全错误及取消保持失败。
5. coverage.reasons 按 max-records、match-previews、preview-characters 顺序去重，未限制为 `[]`。

stdout 六行摘要均从同一结果渲染，字符串 JSON 转义，Filters 紧凑 JSON，Limits 只展示适用预算；无返回上限显示 `maxRecords=unlimited`，下界显示 `matched>=N`。warning 保留领域前缀，每类仅一次写 stderr：

- `search results limited: max-records`
- `search previews limited: match-previews,preview-characters`，只列实际原因。

content 按严格发布索引选择范围，匹配当前文件文本；同份安全读取的字节在匹配前核对 ID。索引失败走显式恢复，必需读取或身份错误保持失败；未同步的新对象与筛选变化在同步后进入范围。来源字段和覆盖共同限制全集结论。

## 关系输入与诊断

公开完整替换、分组和授权语义见 [CLI 关系契约](../../skills/decision-records/references/cli-operations.md#关系输入与核对)。实现需区分失败阶段：

| 阶段 | 例子与结果 |
| --- | --- |
| 参数形态 | 首组前关系选项、空组、只含摘要、clear 混用、原始重复 source/target、摘要形状错误：退出 2，零写入。 |
| 集合解析与领域预演 | selector 不存在或歧义、解析后重复 source/target、source 未选中、摘要未命中、alignment 不匹配、最终形状或闭合错误：退出 1，零写入。 |
| 历史确认、锁或写入 | 按实际 scope/outcome 报告；写入后失败不能声称零写入。 |

set-relations 与 Investigation Report 使用同一分组输入协议，具体错误归类仍以形态问题或需要集合知识为界。各 source 在同一事务中计算最终图，不能逐组留下非法中间状态。

relationReview 按规范 source ID 排序，覆盖全部所选成员，before 为同次准备读取的完整关系，after 为规范化完整最终集合。renderer 只从这些 before/after 派生边与摘要变化；预检 phase 为 preflight，正式成功为 committed，失败不附成功 review。

`new` 的 stdout 只集中回显完整 ID、标题、路径及自身 readiness，不默认打印全文或固定下一步；warning/error 留在 stderr。创建与候选读取不附带全集发布预检；即时输出不保存日志、遥测或 receipt，普通查询与参数错误不附会 mutation 结果。

## 交付验证

按改动运行 `bun run test:decision-records-cli`；源码改动后用 `bun run sync:decision-records-cli` 生成，再运行 `bun run check:decision-records-cli`。涉及公开行为时同步对应 skill 文档与版本，测试改动维护 Case 账本；最终运行项目 `bun run check`，分别报告机械证据与语义审查。
