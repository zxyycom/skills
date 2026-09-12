# 决策记录规则

本文件承接 Decision Records 的身份、正文、生命周期、关系与维护不变量。候选写入、已建立记录维护、身份更正、暂存或结构审阅前完整读取。是否值得记录及当前任务如何使用判断，见 [SKILL.md](../SKILL.md)；索引机器结构见 [Schema](decision-index.schema.json)，精确命令参数与输出查 `--help`，异常操作路径见[维护恢复](maintenance-recovery.md)。

## 记录身份与集合

每份 Markdown 保存一条决策，在 frontmatter `id` 中声明稳定 Decision ID。身份、当前位置和分类分别维护：

| 对象 | 定义 |
| --- | --- |
| Decision ID | 不含路径或扩展名的稳定身份。新记录使用有效日历日期组成的 `YYMMDD-<name>`，日期取候选创建时的 UTC 日。 |
| name | 标准 ID 的日期后缀，使用 kebab-case；无日期 legacy ID 的 name 是完整旧 ID。由 ID 派生，无需另存 frontmatter。 |
| sourcePath | 相对决策根的当前 POSIX 路径。basename 可为 ID 或语义文件名，移动文件不改变身份。 |
| tags | 有正文依据的记录级分类；与生命周期、alignment 和关系分别表达。 |
| 决策索引 | 从全部 active、archived Markdown 派生的统一查询投影，以完整 Decision ID 为键。 |

```text
docs/decisions/
├── decision-index.json
├── <name-or-decision-id>.md        # candidate 或 active
└── archive/
    └── <name-or-decision-id>.md    # archived
```

同一集合内 ID 和 sourcePath 分别唯一，状态与目录位置一致；受管记录均为上述目录的直属 Markdown。生命周期移动保留 basename。关系、索引和单项回读使用 frontmatter ID，索引负责定位而不是反向定义记录事实。无日期旧 ID 继续可读，身份更正使用 `rename`。

普通 selector 按以下顺序解析：

1. 移除一次大小写不敏感的末尾 `.md`。
2. 若剩余文本是有效标准 ID，精确查找该 ID；未命中即失败。
3. 否则按完整文本精确查 name：零项报告不存在，一项收敛为完整 ID，多项报告歧义供调用方选择。

路径只用于明确的 path/locator 参数；关系和后续操作使用解析后的完整 ID。

## 正文与候选准备

候选按以下 frontmatter 顺序和三个固定二级章节起草：

```markdown
---
title: <标题>
id: <decision-id>
status: candidate
alignment: null
createdAt: null
purpose: <精简目的>
background: <精简背景>
decision: <精简采用方向>
tags:
  - <tag>
relations: []
---

## 目的
- <希望长期达成或维护的结果>

## 背景
- <促成选择的事实、问题与关键约束>

## 决策
- 采用: <最终方向、核心理由和长期约束>
```

- **标题与摘要**：title、purpose、background、decision 各为 4–100 个 Unicode 码点的单行文本，摘要忠实概括正文。
- **分类**：tags 至少一个，每项符合 `^[a-z0-9]+(?:-[a-z0-9]+)*$`，唯一并按与 locale 无关的词法升序排列。
- **正文**：只使用依次排列的“目的、背景、决策”二级章节，直接展开完整含义；省去重复 H1、摘要和关系副本。“决策”至少包含一个非空“采用”。
- **编辑边界**：原地修正对既有判断的误述、补足其已有依据与边界。实际采用方向、适用范围或核心取舍变化时，按下节判断独立记录与演进；真实曾采用的判断不得伪装成文字错误覆盖。

候选准备分成两项机械事实：`scaffoldValid` 要求身份、位置、frontmatter、tags、关系语法和章节形状合法，章节可以暂为空；`bodyReady` 还要求三节均有内容且包含非空“采用”。语义审核和建立授权由 agent 另行完成。

`new` 从显式 metadata 原子、不覆盖地创建候选；输入 name 时自动加本次 UTC 日期，输入完整 ID 时日期须同日。同日同名冲突时零写入；与同名 legacy ID 冲突时，按 CLI 的 `migration-required` 提示显式处理身份。

writer 在候选、active 与 archive 位置都可用时优先选 name basename，否则使用完整 ID。创建成功后继续编辑或检查 readiness，正文未完成或辅助预检不可用也不重跑 `new`。`candidates` 与 `show-candidate` 从来源读取候选：单条非法来源可 warning 后跳过，显式目标非法则失败；集合成员或索引前提错误仍阻断查询。

## 记录边界与有效演进

先区分原判断的准确记录与实际采用方向的变化，再决定是否新建记录、是否建立关系：

1. **完善原记录**：候选讨论、同一判断的收敛，以及误述修正、既有理由补足和歧义消除，都回到原记录；已建立文本须忠实于实际采用的判断。
2. **独立新记录**：新判断需要单独修订、归档或判断对齐时独立成篇。承接既有方向时，还须说明原判断曾约束哪些选择，以及保留它能解释新判断的什么变化；仅是未采用的中间版本时，继续完善原候选。
3. **直接演进关系**：前后判断存在真实采用方向的承接、修订、替代等关系时才建立边。主题相近、时间先后、纠正次数和 Git 提交均不足以证明这种关系。

| 对照场景 | 处理 |
| --- | --- |
| 候选经过多轮讨论，或已提交记录遗漏了原本采用的约束 | 完善原候选或原记录，保留真实采用方向。 |
| 原方案已作为独立采用依据，后来因新的长期约束改变核心取舍 | 自包含新判断；确实承接原判断时建立相应演进边。 |
| 新增另一项同主题但独立的判断 | 独立记录，关系可为空。 |

已误建的记录或边在相应授权内直接纠正，不追加“纠错后继”。agent 根据内容与采用事实自行审查；Git 状态只用于版本与维护门禁，候选、active 和 archived 状态仍通过既有 CLI 维护。

## 生命周期与对齐

| 状态 | 已确认的事实 |
| --- | --- |
| `candidate` | 尚未建立，`alignment` 与 `createdAt` 都为 `null`，留在正式索引外。 |
| `active` | 已建立，仍是当前应恢复的判断。 |
| `archived` | 已建立，退出当前依据，保留演进历史。 |

所有已建立记录都必须有非空 alignment：`aligned` 表示完整方向已经成为当前事实并经核对；`unaligned` 表示已确认、会约束相关选择的未来方向，实施范围由当前任务另行授权。归档保留最后的非空值。alignment 不表示部分落地、任务优先级或实施授权。

`activate` 首次建立只接受 body-ready candidate，写入非空 alignment 与不可变 createdAt。完整未来方向成为当前事实并核对后，用 `mark-aligned` 更新 alignment。重新激活 archived 记录保留原 createdAt 和关系，并由本次 CLI 参数显式确认 alignment。Git 提交与暂存只保存版本管理状态，建立事实由 Markdown 生命周期表达。

已建立来源的 alignment 缺失、为 `null` 或不在枚举中均非法，不是归档的未知状态。唯一的非 CLI 例外是历史来源的原位字段修复：按[维护恢复](maintenance-recovery.md#已建立-alignment-无效)保留可信 Git 基线和能证明既有状态的历史材料，取得覆盖该字段的针对性授权后才修复；不得通过 activate、archive 或其他生命周期操作补造事件，也不得默认 `unaligned`。

alignment 始终作用于整条决策：完整方向成为当前事实并核对后，才能由 unaligned 标记为 aligned。可分别修订、归档或对齐的部分应拆成自包含后继；不可独立演进的局部落地仍保持整条 unaligned。已对齐记录后来偏离当前事实时报告一致性问题，保留对齐历史；新的未来目标另建记录。

## 演进关系

关系由后继指向真实直接前序，分类、普通引用或实施映射本身不足以形成演进边。

| 类型 | 判断如何变化 |
| --- | --- |
| `修订` | 保留主体方向并改变一部分。 |
| `替代` | 以完整新判断取代前序。 |
| `判定无效` | 前序依据不成立。 |
| `归并` | 整合多个前序。 |
| `拆分` | 把过粗前序重建为多个可独立使用的后继。 |
| `重划` | 把多个前序的长期含义按新 owner 边界分配给多个自包含后继。 |

```yaml
relations:
  - type: 修订
    target: 260827-define-index-boundary
    summary: 将查询投影移出持久索引
```

每个 target 是合法 Decision ID，在同一来源记录中唯一，完整图无自环、无环。候选关系先检查类型、ID、重复、自环和目标可解析性；候选建立前留在正式图外，活动前序也无需提前归档。

可选 summary 从来源记录视角说明该边：输入 trim 后为空则省略，非空须为单行且最多 40 个 Unicode 码点，超限拒绝。它补充边的说明，边身份、排序、去重和拓扑继续由 type、target 及领域图规则决定。

### 后继集合与语义闭合

`evolve` 通过重复 `--successor` 显式选择完整后继集合；每个 successor 是关系 source。该选择集只声明本次闭合事件的完整成员，并不要求成员采用同一最终 relations。事务在同一次处理中为全部成员计算各自完整最终关系，再维护关系、候选建立与活动前序归档。新候选也可通过 `activate` 的单后继入口建立相同关系事务。

| 演进形状 | 最终集合要求 |
| --- | --- |
| 非拆分、非重划的有效关系 | 只选择一个后继；纯归并至少有两个不同前序。 |
| 拆分 | 至少两个后继，每个后继恰有一条指向同一前序的拆分边；选择集等于该前序完整的直接拆分后继集合。 |
| 重划 | 至少两个后继和两个不同前序，每个后继至少有一条重划边且全为重划；所有前序至少被承接一次，前序与后继角色互斥，形成连通的稀疏二部图。选择集等于该连通分量的完整后继集合。 |

互不连通的重划分属独立事务；后来重划早先后继属于另一次事件。除图形合法外，agent 还须核对每个拆分或重划后继承接了直接前序继续有效的长期含义，并明确说明放弃、改写或判定无效的部分。

### 完整替换与摘要绑定

关系维护以每个 successor 的完整集合为单位。先选择完整 successor 集合，再为每个成员确定最终 relations：未覆盖的成员保留自身权威 Markdown 的完整原值；覆盖只替换其所属成员的整个集合，不合并旧关系。新集合未提供 summary 的边省略该字段，因而移除旧摘要。

| 输入意图 | 最终关系来源 |
| --- | --- |
| 首次 activate 或 evolve 省略所有关系覆盖 | 每个后继保留自身完整 relations 与 summary。候选首次建立优先使用此路径。 |
| 无分组的 `--relation` 与可选 `--relation-summary` | 同一完整 replacement 应用于全部所选后继。 |
| 无分组的 `--clear-relations` | 全部所选后继使用显式空集合。 |
| 以 `--relations-for <successor-selector>` 开始的组 | 该组 source 使用组内完整 replacement；未分组的所选后继仍保留自身原值。组内可用 `--clear-relations` 显式提供空集合。 |
| 重新激活 archived 记录 | 保留既有关系，拒绝关系或摘要覆盖。 |

`--relations-for` 开始一个后继组，直到下一个同名选项或命令结束；只有 `--relation`、`--relation-summary` 和 `--clear-relations` 随组归属，其他选项仍作用于整个事务。分组与统一覆盖互斥：出现分组后，首组之前不能有关系选项，且未分组成员不接收统一默认 replacement。

每个组必须在解析后唯一地指向一个已选 successor，并提供至少一条 `--relation` 或一个 `--clear-relations`。摘要可在同组 relation 前后出现；它按首个 `=` 分隔，后续 `=` 属于摘要，并且只绑定同组完整 `--relation` 集合中的唯一 target。不同组可对同一 target 写入不同摘要。

首组前关系选项、空组、只含摘要、clear 与 relation 或 summary 混用、原始重复 source 或 target、以及摘要形状错误属于参数错误：退出 `2` 且零写入。selector 不存在或歧义、解析后重复 source/target、source 未选中、摘要未命中、alignment 不匹配、最终关系形状或闭合错误属于集合解析与领域预演失败：退出 `1` 且零写入。历史确认、锁或写入阶段沿维护恢复的实际 outcome 报告，不能把写入后失败声称为零写入。精确参数顺序与诊断以 `evolve --help` 为准。

新候选的 `activate` 与 `evolve` 以 `relationReview` 承接关系核对：

- review 按规范 source ID 排列，覆盖全部所选后继（包括未分组或最终相同的成员）。每个 source 给出 `action`、同次准备读取的完整 `before` 和规范化完整 `after`；空集合为 `[]`。新候选的 action 恒为 `establish`，正式来源为 `replace` 或 `unchanged`。
- renderer 只从这组 before/after 推导新增、移除及摘要新增、变更或移除。完整 replacement 未提供摘要即清除旧摘要。
- `--preflight` 返回 `phase: preflight` 的预计 review 且零写入；正式成功才返回 `phase: committed`。失败不附成功 review，预检不构成提交凭据。

## 维护范围与确认

写入须在当前请求或生效项目规则授权的维护范围内；一般语义审查和委托内取舍由 agent 自行完成，新增记录或改变状态前说明将改变的判断和集合。超出范围、缺少关键事实或明确要求用户决定时再询问。候选正文、tags 及已建立记录不改变采用方向的编辑性修正可直接修改 Markdown；已建立记录的生命周期、alignment、关系、删除和身份更正通过 CLI 事务维护。历史来源的非法 alignment 只能按[维护恢复](maintenance-recovery.md#已建立-alignment-无效)取得字段修复授权后原位修复，不能假借生命周期事务。各工作区 mutation 共用集合锁，写前核对来源与相关版本状态，保护其他改动。

### 保留演进历史

CLI 根据 Git `HEAD` 是否记录受检 ID 触发额外维护确认：单独 archive 的目标，或关系事务所选后继的完整最终关系中的任一已建立直接前序尚未进入 HEAD 时，暂停并保持零写入；前序是 active 或 archived 均适用。先自行复核前序是否值得独立保留以及当前授权是否覆盖该操作；属于已委托判断时，agent 可明确选择 `--keep-unrecorded-history` 后重试，只有仍需用户授权或判断时才询问。

Git 工作树的 unborn HEAD 按空基线处理；Git 工作树外没有此确认门。机械提示依据 HEAD 是否记录该 ID，而非形成时间；语义门槛对已提交和未提交记录同样适用。调用方直接执行领域命令，只响应实际提示，无需自行预检 Git。

### 删除

`discard` 删除完整、结构合法且最终集合中无剩余引用的 candidate、active 或 archived 记录。`evolve --discard <id>` 可把删除与演进原子组合：被删 ID 与所选后继互斥，最终关系也须移除该 ID，并继续满足普通演进的形状与闭合规则。

已进入 HEAD 的删除对象，首次未带 `--delete-recorded-decision` 调用在其余条件通过后零写入暂停；取得覆盖删除目标与影响的明确授权后按提示重试。该参数选择本次删除，但不绕过同次 evolve 对其他前序的历史确认。非 Git 工作树、unborn HEAD 或 ID 未进入 HEAD 时正常删除；无确认参数且 HEAD 无法读取时，保持零写入。成功时报告实际删除对象和最终关系。

### 身份更正

`rename` 统一改写目标 frontmatter ID、所有受管 candidate/established relation target、sourcePath 和完整索引；保留状态、alignment、createdAt、正文、relation type 与 summary，不自动暂存。

- source 按普通 selector 解析。target 为标准 ID 时直接使用，其他合法 kebab-case 值作为 name。
- 标准 source 保留原日期；legacy established 记录用 createdAt 的 UTC 日；legacy candidate 需要显式完整 dated target ID，name-only target 返回 `date-required`。
- ID、name 与目标路径须无冲突；同生命周期优先 `<name>.md`，其次 `<id>.md`，两者均占用时零写入。
- `--preflight` 只读完成相同检查。目标已进入 HEAD 时，正式执行须按提示明确 `--rename-recorded-decision`；此确认只作用于当前工作树。

## 派生索引与查询

Markdown 是权威来源，索引保存已建立记录的定位、状态、非空 alignment、摘要、tags 和直接关系。记录内容、身份或位置变化需要同步索引；candidate 通过独立来源入口读取。常规查询使用结构有效的持久索引，不逐次扫描整个集合。索引异常或陈旧时，以满足当前契约的权威 Markdown 验证和重建，保留来源事实。

### 查找与结果解释

- `list` 默认查 active、全部 alignment，展示筛选概览和最近记录；按需筛选、翻页或用 `--detail` 展开摘要，完整正文用 `show`。
- status、alignment、重复 tags 和时间条件取交集；重复 tags 为 AND，时间范围包含端点。空页只说明当前筛选与窗口无结果。
- `--related-to` 指定的目标先独立解析，再按相对目标的 predecessors、successors 或 both 筛选直接邻居；方向必须与目标同用。
- relation type 单独使用时匹配任一该类型直接边；与目标同用时，两者须命中同一条边。结构条件先于排序、分页和文本匹配。
- `show` 由索引定位并确认目标 ID 后读取 Markdown；`trace` 从同一次受检索引快照派生默认终端关系图，使用 `--json` 时返回同一份 trace 查询成功结果的稳定 JSON 关系切片。后续操作继续使用完整 ID。

关系条件的查询结果另以可选 `filterRelations` 返回**导致该记录命中的完整边集合**。只有传入 `--related-to` 或 `--relation-type` 时才出现；它从本次筛选使用的同一来源快照投影，按 `(sourceId, type, target)` 去重并以 UTF-16 code-unit 词法序排列。前驱边由 anchor 指向结果，后继边由结果指向 anchor，both 取并集；type-only 选择结果来源的指定类型出边，组合条件必须命中同一条边。记录集合、排序、total 与分页不因该投影改变。该字段属于 Decision 内部 list/search 查询记录，不进入索引、Schema 或公开导出边界。

搜索的文本证据与 `filterRelations` 分开：`matchedFields`、`matchedRelations` 只报告实际文本命中，`matchedRelations: none` 不否定关系筛选命中。CLI 默认每条预览最多三条命中边，`list --detail` 展开当前页全部命中边；领域查询结果保留完整集合。需要完整正文或完整直接关系时，继续用 `show` 读取来源记录。

`trace` 默认 `direction=both`、`depth=5`、`maxRecords=50`。有限深度可为非负安全整数，`--depth all` 不设深度限制；记录预算必须是正安全整数。默认终端图稳定显示 header、`L0/L1/...` trace 图层、关系或事件组、`* trace` 与 `~ context`；它不是旧的平铺文本或 Mermaid。不完整时在图尾显示 frontier 和 blockedEvent。`--json` 才输出同一份 trace 查询成功结果的稳定 JSON envelope，回显 `anchorId`、实际 direction 与 limits；无限深度在 `limits.depth` 中表示为 `"all"`。输出的 `traceIds` 是递归遍历成员，`contextIds` 只闭合一次已跨越的完整拆分、纯归并或重划事件；二者互斥，且并集与 `entries` 的键相同。entry 的 `relations` 永远是索引中的完整直接关系，切片外 target 仍是原始事实；存在的 `summary` 原样投影，缺失时省略，trace 不推断摘要。终端图只展开两端都在切片内的边；已读取但缺少摘要显示 `[无摘要]`，摘要按 JSON 转义的完整单行文本显示。主体块承接其 source 边；复杂事件中 source 仅为 context 时，事件按边显示完整 source、type、target 与摘要，不能以匿名摘要代替。context 成员不递归扩展，且它与 trace 成员的边归属不改变 `coverage`、成员选择或 JSON。

`coverage.complete` 只在请求方向未受深度或记录预算限制、且已接纳事件完整时为真。`stoppedBy` 与 `frontier` 说明尚未跨越的直接邻居；以 frontier 的 `fromId`、direction 和 `nextIds` 发起新查询，不能将它视为 cursor。记录预算阻断一个多记录事件时，`blockedEvent` 给出完整成员与最小 `requiredMaxRecords`；该事件没有部分接纳。普通单记录接纳受预算阻断时只形成 `max-records` frontier，不产生 `blockedEvent`。

| 搜索范围 | 依据与适用边界 |
| --- | --- |
| 默认 content | 搜索索引选中的权威 Markdown，并由同一快照把路径映射回 ID。索引缺失、损坏或陈旧时，须完整验证来源后才能用一次内存投影只读降级，并报告 warning。 |
| metadata | 只搜索已发布索引中的 ID、name、title、三项摘要、tags 与来源关系 summary。反映该快照而非未同步来源；读取失败时诊断并显式恢复索引。 |

两种范围都先应用结构筛选。`all` 要求全部词，`any` 要求任一词，`phrase` 要求连续短语；统一 NFKC、忽略大小写并按空白处理。content 以物理行为匹配段，metadata 以单个字段、tag 或 summary 为段；all/any 可跨同一记录的段，phrase 限于单段。关系筛选不是文本命中证据，metadata 只报告实际命中的字段或来源摘要。

搜索降级只服务本次查询，不修复持久索引。截断 warning 表示输出受限；收紧筛选或继续读取已返回 ID，不能据未显示或无结果断言不存在匹配。

### 同步与待提交快照

手工修改已建立 Markdown、怀疑索引陈旧或准备维护时先严格 `check`，确认合法变化后同步。领域 definition 升级后，只有全部已建立 Markdown 已满足当前契约时才以无 selector 的 `sync-index --write` 全量重建；不能信任旧 definition 的索引，也不能把该升级作为 selected 同步。`sync-index` 无 selector 时全量重建；selected 模式仍完整验证来源，按以下条件接纳：

1. baseline 索引可信，集合 metadata 与其 revision 不变。
2. selector 从 baseline 与待发布投影的 name 映射并集解析；标准 ID 仍只精确匹配。
3. 全部 entry/revision 变化的 ID 都已选中；新增选新 ID，删除选旧 ID，身份更正同时选旧/新 ID。
4. 默认只检查，添加 `--write` 才发布完整索引投影。未选择变化、未知 ID 或坏 baseline 均零写入，先补充选择或显式改用全量同步。

`stage` 在同一 HEAD/工作区 staging 快照中按标准 ID 或唯一 name 选择记录，构造完整 Git pending 决策快照。它不改变生命周期，也不替代同步。位置变化仍选同一 ID；身份变更须由相应事务完整处理。写前 revision、pending 或所选来源漂移时拒绝写入。

## 验证与异常交付

严格 `check` 验证 Markdown、ID、tags、状态与位置、关系、索引结构和新鲜度，并区分合法 scaffold 与 body-ready candidate。候选留在索引外本身不是错误；首次候选集合按[恢复手册的状态分流](maintenance-recovery.md#状态分流)验证。

Agent 另行核对记录门槛、摘要与正文、tags 依据、真实直接前序、后继语义承接，以及完整当前事实是否支持 alignment。

CLI 诊断说明本次命令的 code、对象、原因和下一步；有可靠系统证据时才补充原因类别与净化细节。mutation 失败的 `scope` 与 `outcome` 只说明声明范围：

| outcome | 可确认状态 |
| --- | --- |
| `no-change` | 声明范围未改变。 |
| `rolled-back` | 失败后已恢复完整旧范围。 |
| `partial-or-unknown` | 无法证明范围完整恢复，须先对账。 |
| `committed-cleanup-pending` | 已越过领域提交点，尚有清理残留。 |

成功信息在 stdout，失败、暂停和 warning 在 stderr；这些是即时诊断，不保存为日志、遥测或 receipt。普通查询、检查与参数错误不附会 mutation 结果。按 warning 核对受影响事实，恢复操作、权限、锁与重试边界统一执行[维护恢复](maintenance-recovery.md)。
