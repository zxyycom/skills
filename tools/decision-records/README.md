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

list/trace 成功结果显式包含 `source={kind: "published-index", currentness: "unchecked", fallback: false}`；metadata search 在 searchInfo.source 中表达同一事实。正常 unchecked 不生成来源 warning。show 通过安全 FileHandle 读取完整正文，以同 inode、严格 UTF-8 解码的同一字节核对 ID，再比较单条 revision；不套 content/preview 预算，不扩大为全集验证。

正式查询由[共同操作 owner](../record-operations/README.md)加载严格结构、字段和 definition，并复用本次冻结索引；原始索引查询入口继续独立严格校验。图的作用域与阶段边界如下。

关系图以单次操作内的一份稳定快照为作用域，通过[惰性访问器](../shared/src/graph/lazy-relation-graph.ts)按需构建：

- **按需复用**：首次实际访问图时构建，后续校验、`trace` 与关系筛选共用该图；`related-to` 使用同图的正反向邻接。
- **实际依赖**：无关系条件不构图；关系筛选和 trace 验完整发布图，不只验命中子图。普通发现成功不声明全集健康。
- **阶段边界**：新加载、来源重读和事务投影各建独立访问器，并完成所属阶段的校验。stage 的纯计算仅在[新鲜等价证据](../index-runtime/README.md#记录领域的内部暂存协调)成立后允许调用内复用，不省略本阶段真实来源、payload 与身份验收；图与访问器不跨调用保留。

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

### 候选操作

候选动作通过共同 owner 编排索引状态、安全发现、身份冲突、所选准备及列表 warning/显式目标失败；领域负责 status/archive 位置、正文解析和直接依赖。`new` 的 target name 选择候选与可见正式身份，`show-candidate` 的 selector 只选择候选。合法索引与真正缺索引的身份发现范围见[候选恢复规则](../../skills/decision-records/references/maintenance-recovery.md#候选身份发现与索引状态)。

同阶段来源与 ID→source 映射直接交给所选 readiness 和 show；创建 stdout 的 readiness 来自自身实际写入并验收的 scaffold，无需再次扫描候选全集。它只表达自身准备，不声明全局关系闭合或采用授权。

## stage 的领域适配

公开 scope、选择与结果保证见[暂存操作契约](../../skills/decision-records/references/cli-operations.md#待提交快照)。共同 scope 策略、H/W/P 投影兼容、pending 基底选中刷新与准备→fresh 复核→发布顺序由 [Index Runtime 内部记录暂存协调器](../index-runtime/README.md#记录领域的内部暂存协调)承接，本领域不另行维护同形流程。

领域适配负责 ID／name 选择、status／alignment 与根或 archive 位置、正式正文的 ID／投影／来源指纹、已知旧位置及 pending-only 身份，并保留完整演进图闭合。index 不读取工作区正文；all/domain 每阶段独立验证所选来源及必要依赖，无关坏正文不作为局部门禁。未知位置的未同步身份重现由显式 check／sync 发现。

可变来源与成员只在本阶段有效；固定 H 的不可变事实可调用内复用。Decision 所选正文仍按既有常规文件表示写入，不套用 Investigation 资源树的执行位策略。各 scope 的 payload 与完整 pending 身份保证由上述共同协调器承接。

`decision-stage-refresh.ts` 的 `decisionStageSuccess` 将共同协调结果映射为本领域成功 envelope：`preservedPendingPaths` 是 scope 中所有未更新 snapshot 成员，`pendingFileCount` 计完整 scope 成员，不改成仅相对 H 的变化路径。来源失败、pending conflict 与恢复失败按真实阶段映射，不把普通失败附会为 mutation。

## 非 stage 事务与恢复

`decision-transaction.ts` 将局部发布基线和严格全集两种领域准备适配给 `tools/record-operations/src/transaction.ts`；`decision-transaction-plan.ts` 提供领域提案、适用来源与成员保护，再经共同计划归一化保留实际写集，`decision-transaction-projection.ts` 负责领域索引投影。普通维护不扩大全集正文 scope；首次 publish、严格 rename/discard 和带删除 evolve 也不能绕开共同编排。stage 继续使用原协调器。

共同 owner 持有[事务顺序与实际写集恢复](../record-operations/README.md#事务事实与恢复)；领域适配提供每阶段所需的来源、成员、投影与写集，不另拼写入或索引恢复流程。调用者的提交结果与对账动作分别见[操作结果](../../skills/decision-records/references/cli-operations.md#结果与恢复)和[恢复规则](../../skills/decision-records/references/maintenance-recovery.md#中断写入)。

same ID / same path rename 在合法发布投影或真实缺索引身份发现、必要来源安全及可见冲突确认后走独立 fresh 的零写路径，不规范正文、索引或 mode，不读取历史确认；真实 rename 继续严格验证全集和历史。删除末条正式记录保留合法空索引。

## 检查与同步

全量只读 check 把首次安全采集的正文投影、身份与来源指纹交给共同操作，比较完整预期索引文本；不在结束时重读全集，不保证结束新鲜度或跨文件原子快照。调用方持有的旧 scan 不能作为新一次检查的来源事实。

全量同步将完整来源 scan 的已验字节、身份与状态投影直接交给共同操作。`decision-selected-sync.ts` 提供本域解析、来源 revision、前后关系邻居/完整演进事件与全图验证，交给共同局部同步入口；其已知路径、未读基线与独立 fresh 边界见[共同操作](../record-operations/README.md#同阶段证据与后续复核)，调用者结果见 [CLI 检查与同步](../../skills/decision-records/references/cli-operations.md#检查与同步)。不改变原始 `syncDecisionIndex` 的通用完整验证契约、stage 或其他消费者。

## 交付验证

按改动运行 `bun run test:decision-records-cli`；源码改动后用 `bun run sync:decision-records-cli` 生成，再运行 `bun run check:decision-records-cli`。涉及公开行为时同步对应 skill 文档与版本，测试改动维护 Case 账本；最终运行项目 `bun run check:changed`，分别报告机械证据与语义审查。
