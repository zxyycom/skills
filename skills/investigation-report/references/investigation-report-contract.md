# 调查报告固定契约

本文件承接 Investigation Report 的身份、正文、关系、资源与维护不变量。创建、publish、调整关系、剔除或结构审阅前完整读取。报告形成与证据质量由 [SKILL.md](../SKILL.md) 承接，索引机器结构见 [Schema](investigation-index.schema.json)，精确命令参数与输出查 `help <command>`，异常操作路径见[维护恢复](maintenance-recovery.md)。

## 身份与集合

每份正式 Markdown 保存一轮完整认识，是该报告身份、形成时间、问题、分类、关系、正文及资源引用的权威来源。candidate 保存尚未建立的同形内容；索引从全部正式报告派生，用于发现和追溯。

| 对象 | 定义 |
| --- | --- |
| Investigation ID | frontmatter `id` 声明的稳定身份，不含路径或扩展名。新 ID 为有效日历日期组成的 `YYMMDD-<name>`，日期等于 formedAt 的 UTC 日。 |
| name | 标准 ID 的日期后缀，使用 kebab-case；无日期 legacy ID 使用完整旧 ID。由 ID 派生为查询键，无需另存 frontmatter。 |
| sourcePath | 相对调查根的正式报告位置，basename 可以是 ID 或语义文件名；移动或改 basename 不改变身份。 |
| candidate locator | `_candidate.<name-or-investigation-id>` 文件名，文件内仍声明完整 ID；候选处于正式集合和索引之外。 |
| resource ID | `_resources/` 下的 `<investigation-id>/<resource-subpath>`，首段明确资源 owner。 |
| 工作区索引与 pending | 分别是工作树内的派生索引与 Git 暂存区内容，按各自维护动作更新。 |

```text
docs/investigations/
├── investigation-index.json
├── <name-or-investigation-id>.md
├── _candidate.<name-or-investigation-id>
└── _resources/                              # 可选
    └── <investigation-id>/<resource-subpath>
```

调查根只接受上述成员，正式报告均根目录直属。ID 与 sourcePath 各自唯一，candidate 与正式报告也不能同 ID；未知保留文件、符号链接和非普通文件属于集合安全错误。资源池中的 Markdown 作为材料管理，不参与正式报告发现。

`--investigations-dir` 可选择工作区内其他调查根；同一集合始终使用同一根。无日期 legacy ID 继续可读，身份更正通过 `rename` 完成。

### 选择记录

普通 selector 先移除一次大小写不敏感的末尾 `.md`，再判断：

- 有效标准 ID 只精确匹配该 ID，未命中即失败。
- 其他输入按完整文本精确查 name；零项报告不存在，一项收敛为完整 ID，多项报告歧义。

路径只进入明确的定位参数。关系、资源 owner、索引 entry 和后续操作使用完整 ID。单项读取由结构合法的发布索引定位 sourcePath，并确认文件仍声明同一 ID。

### 建立边界

正式根目录中的完整报告一旦写入即已建立。正常路径是候选经审核后 publish；手工正式来源变化由 `sync-index` 显式接纳。

首次 publish 可从“无正式报告且无索引”建立首批报告和索引。删除最后一份正式报告后，合法空索引保留已建立空集合，可继续检查与查询；它与尚未初始化的空目录是不同状态。

## 报告边界与有效演进

一份报告承接一个调查问题及其可共同解释的背景、证据条件和结果边界。“一轮”由这些内容决定，不由任务次数、编辑次数或 Git 提交划分。先判断是否需要独立报告，再判断是否真实承接前序。

### 原地完善还是独立成篇

- **完善原报告**：补证、纠正推断、解释遗漏和结果收敛仍在回答原问题，且中间版本无需单独复核时，继续编辑原报告或 candidate；已经提交或形成新认识不改变这一判断。
- **建立独立报告**：新问题需要单独回答，或新条件下的证据与结果需要和旧轮次分别复核时，独立成篇。承接旧认识时须指出保留旧轮次要比较或解释的具体内容；合并会混淆这些条件与结论，才有分别保留的依据。
- **恢复准确记录**：原报告误述其实际依据或认识时原地纠错；真实且仍需独立复核的历史结论继续保留，不以纠错名义覆盖。

同轮完善保留稳定 ID；formedAt 表达所记录轮次的形成时点，不随提交或每次编辑重置。新增材料在范围与依据中标明实际来源和时点，不能回填成原先已经取得的证据。原身份或时间字段本身有误时，按身份与时间契约更正。

### 是否建立演进边

在独立成篇成立后，说明新报告对哪份直接前序具体增加、复核或改变了什么，再选择关系类型。只有背景相关或参考过旧报告时，保留空关系，按需要普通引用。关系类型用于描述已经成立的承接，不用于倒推分篇。

| 对照场景 | 记录与关系 |
| --- | --- |
| 同一排查中修正先前猜测，或为已提交报告补上漏看的依据 | 完善原报告，准确交代证据；不为中间纠正新建后继。 |
| 已完成且有独立复核价值的调查，后来在新条件下开展独立复查 | 新报告；确实复核前序问题与结果时声明复查关系。 |
| 新材料支持另一独立问题，与旧报告只是背景相关 | 可独立成篇，关系为空；需要时普通引用旧材料。 |

已误建的重复报告或错误关系，在相应授权内直接收敛内容、修正关系或清理多余记录，不追加“修正报告”。删除、资源共享与历史完整性仍按维护契约处理。agent 自行审查并说明上述选择依据；Git 状态和图校验只证明各自机械条件。

## 报告正文与候选准备

frontmatter 从首行开始，按 title、id、formedAt、question、tags、relations 排列。scalar 均为字符串，key 唯一且只使用规定字段；规范 writer 使用 JSON 兼容双引号与转义。

```yaml
---
title: "重新检查索引来源"
id: "260828-review-index-source"
formedAt: "2026-08-28T12:00:00+00:00"
question: "资源字节是否应影响报告索引来源版本？"
tags:
  - "investigation-report"
relations:
  - type: "复查"
    target: "260827-check-index-source"
    summary: "单独改变资源字节，复核索引来源版本边界"
---
```

| 字段或正文位置 | 合法内容 |
| --- | --- |
| title、question | 非空单行语义文本。 |
| formedAt | `createInvestigationCandidate` API 或 CLI `new` 缺省时，由工具取一次当前 UTC 时间；已知形成时间或补录历史调查时可显式提供。使用有时区、无小数秒的 RFC 3339；新 ID 日期与其 UTC 日一致。 |
| tags | 至少一个符合 `^[a-z0-9]+(?:-[a-z0-9]+)*$` 的 token，唯一并按与 locale 无关的词法升序排列，表达有依据的分类。 |
| relations | 完整直接前序集合；独立报告用 `[]`，非空集合遵循下节的字段与图规则。 |
| 前四个 H2 | 依次且唯一为“形成时背景、调查目的、调查范围与依据、调查结果与边界”，正式报告每节非空。 |
| 可选第五个 H2 | 声明资源时为非空“随附资源”；没有资源时省去该节。 |
| 其他语义 H2 | 位于固定核心之后；声明资源时位于“随附资源”之后。 |

frontmatter 后直接进入 H2，省去重复 H1。核心正文应独立承接形成时认识，质量判断按 skill 入口完成。

候选沿用相同字段与章节形状，四项核心可暂时为空。机械准备分别报告：

- `scaffoldValid`：身份、普通文件、frontmatter、分类、关系语法与章节形状合法。
- `bodyReady`：四项固定正文满足正式报告非空要求。
- `resourceReady`：直接资源引用可安全解析，owner 可解释。

这三项与语义审阅、资源价值及 publish 授权分别判断。候选通过 `new` 创建、编辑后 publish；手工改名不能作为已完成 publish 验证的证据。

## 认识演进关系

通过[报告边界审查](#报告边界与有效演进)后，关系由后继报告指向真实直接前序；间接关系由 trace 恢复。

| 类型 | 认识如何变化 |
| --- | --- |
| `补充` | 保留前序核心结果，增加证据、范围、视角或更细认识。 |
| `复查` | 在新的时间、版本、环境、样本或约束下重新检查同一问题。 |
| `修正` | 纠正部分事实解释、方法或结论，前序关键依据尚未被整体否定。 |
| `推翻` | 确认前序关键依据、方法或假设不足以支持主要结果。 |
| `归并` | 综合多个直接前序形成完整新认识。 |
| `拆分` | 将过粗前序建立为多个可独立调查和演进的后继。 |

每条边的字段顺序为 type、target、可选 summary；集合按上表类型顺序、再按 target 的与 locale 无关词法顺序排列。summary 从来源报告视角解释该边，trim 后为空则省略，非空须单行且最多 40 个 Unicode 码点，超限拒绝。它只补充说明，边身份与拓扑仍由领域关系决定；读取、投影和身份更正保留已有摘要。

最终图同时满足：

1. target 为最终集合中存在的 Investigation ID，形成时间不晚于来源；同一来源的 target 唯一，完整图无自环、无环。
2. 补充、复查、修正、推翻各只指向一个前序；归并使用至少两个 target 的纯归并集合。
3. 每个拆分后继恰有一条指向同一前序的拆分边，且该前序在完整图中至少有两个直接拆分后继。
4. publish 的闭合目标来自正式基线或同批显式选中候选，未选候选不参与闭合。

关系保留前序的位置与默认可见性，不写回前序。所有已建立报告留在同一正式集合；剔除通过独立删除动作完成，关系和 candidate 都不承担生命周期。

默认全量 check 在 Git HEAD 可用时，检查每条直接前序是否已记录。未记录则 warning，提示复核是否值得作为独立演进保留；此提示不阻断写入，也不以 formedAt 间隔判断；已进入 HEAD 的前序仍须接受相同独立性审查。非 Git 工作区、unborn HEAD 或 HEAD 不可用时跳过该提示。

## 资源引用与归属

“随附资源”节使用无序列表，每项只含一个无 title 的本地 Markdown inline link：展示文本非空，目标逐字为 `./_resources/<resource-id>`，同一报告内 ID 唯一并按与 locale 无关的词法升序排列。链接不带查询、片段、百分号编码、反斜杠或链接外文字。

### 路径与文件要求

资源 ID 是相对 `_resources/` 的规范 POSIX 路径：首段为 owner 的 Investigation ID，后续至少包含文件名，可合法嵌套。每个路径段满足：

- 字符只使用常用汉字 `U+4E00..U+9FFF`、`〇`、ASCII 字母和数字，以及符号 `._-+@=()（）[]【】《》,!~'，。！、·：？`。
- 至少包含一个汉字、英文字母或数字，点不得位于段首或段尾；无空段、`.` 或 `..`。
- 排除 Windows 保留设备名 CON、PRN、AUX、NUL、COM1–9、LPT1–9 及其带扩展名形式，忽略大小写。
- ASCII 圆括号成对，允许空内容，嵌套最多 32 层。

被引用资源必须存在、大小写精确、位于调查根内，并是版本控制可见的普通文件；资源根、任一路径分量与文件本身均不得是符号链接。

Git 工作区发现 tracked、pending 及未被 ignore 的未跟踪资源；被 ignore 的未跟踪资源不可引用，也不产生未引用 warning。非 Git 工作区按文件系统发现。

### owner 与共享

resource ID 首段确定唯一 owner，而非报告 basename。owner 须直接引用自己负责的资源，其他报告可以共享：

| 引用场景 | owner 要求 |
| --- | --- |
| 正式报告引用资源 | 同 ID 正式 owner 存在并直接引用该资源。 |
| candidate 使用自有新资源 | 正式 owner 尚未建立时，同 ID candidate 可暂任 owner，并直接引用。 |
| candidate 共享资源 | 可共享既有正式 owner 或其他候选 owner 的资源；正式报告仍要求正式 owner，候选不能替代缺失的正式 owner。 |

完全未引用的可见资源及其 owner 或安全问题只产生 warning；正式报告一旦引用，相应问题成为 error。候选查询与 publish 对目标资源严格检查；合法 candidate 的正文或资源未就绪，不阻断无关正式集合的全量 check。

资源预置于最终 owner 路径。publish 保持其链接、名称、位置和字节，也不暂存资源；发布前会重新核对路径、引用、普通文件身份和版本控制可见性，必要条件漂移时零写入。资源字节变化本身不阻断 publish，也不使索引陈旧；改变正式报告资源链接则需要同步索引。

## 候选创建与发布

`createInvestigationCandidate` API 与 CLI `new` 从显式 title、question、tags、完整直接关系和可选 formedAt 原子、不覆盖地创建候选。省略 formedAt 时，创建入口在身份归一化前读取一次当前 UTC 时间作为有效值；显式值继续按既有格式与日期一致性规则校验，非法输入不会回退到默认值。name 输入自动使用有效 formedAt 的 UTC 日形成 ID，完整 ID 输入须同日；重复分类、关系或非法 metadata 拒绝。同日同名冲突时零写入，与同名 legacy ID 冲突时按 `migration-required` 提示显式处理。

writer 在候选和正式位置均可用时优先使用 name locator，否则使用完整 ID；发布保留相同 basename。创建成功即表示 candidate 已存在，readiness 或辅助预检 warning 提示继续编辑、查看候选或显式预检，不要求重跑 new。

`candidates` 与 `show-candidate` 从未索引候选定位身份并读取准备情况；同一阶段复用候选源字节、身份映射、引用与资源依据，正式共享 owner 按实际引用读取。没有可用索引或出现未知／移动 owner 时，身份发现可以扩大，但局部读取不证明正式全集健康。集合安全允许时，单条非法候选可 warning 后跳过；显式目标非法则失败。正式查询仍走正式集合。

### 发布前提与效果

`publish --preflight` 对显式选中候选只读预演最终集合；正式 publish 在集合锁内重新读取与验证，不依赖前次预检凭据。agent 按 [SKILL.md](../SKILL.md#自行审查与授权)完成语义审查和授权判断，再验证完整正文、资源与最终关系图并发布。

| 当前正式基线 | 发布前提 |
| --- | --- |
| 正式报告非空 | 持久索引结构有效且对全部正式 Markdown 新鲜。 |
| 正式报告为空、已有索引 | 索引是合法当前空基线。 |
| 正式报告与索引都不存在 | 可首次建立。 |
| 存在手工来源变化或索引异常 | 先显式 sync-index，publish 不混合接纳这些变化。 |

正式 publish 仅选择完整 ID 不重复的候选，验证最终正文、时间、分类、关系闭合、资源和索引，以不覆盖改名建立正式报告，再发布完整索引。未选候选和其他工作保持不变。索引发布是领域提交点；此前失败恢复候选与旧索引，无法完整恢复时报告 `partial-or-unknown`；此后只处理清理残留。

### 关系输入

`new` 提供候选完整直接关系，`set-relations` 完整替换已建立报告的关系。CLI 摘要使用 `--relation-summary <selector=summary>`：按首个 `=` 分隔，后续 `=` 属于正文；绑定同次完整关系集合中唯一 target。程序化 API 直接传完整 relation 对象及其可选 summary。

只提供摘要、重复绑定或未命中 target 均拒绝；未提供摘要的边省略该字段。`set-relations` 的分组和清空语义见下节。

## 正式维护与身份更正

工作区 mutation 共用集合锁，在写前核对相关来源、索引与成员状态，保护本次范围外工作。失败恢复只处理本次已确认范围；权限、竞争或成员漂移无法安全处理时，保留现场并按诊断对账。Git pending 由独立暂存操作维护。

### 完整替换关系

`set-relations` 的每个 `--source` 开始一个替换组，直到下一个 source；同一来源只出现一次。组内二选一：重复 `--relation` 给出全部最终关系，或 `--clear-relations` 明确清空。重复 source、组内重复 target、空分组、只含摘要、clear 混用与摘要失配按与 Decision Records `set-relations` 相同的错误分类处理：输入形态问题在 CLI 边界以参数错误拒绝，需要集合知识的解析与绑定结果属于领域失败。

摘要绑定最近的 source group，可与组内关系任意排序；与清空同组时拒绝。完整替换时，未提供摘要的边清除旧摘要。

`set-relations --preflight` 对同一完整输入只读预演，不写 Markdown、索引、pending 或资源；正式执行仍重新读取和验证。`publish --preflight` 同样只预演显式候选的最终集合。

两种适用的预检及正式成功结果以 `relationReview` 返回完整核对：

- review 按规范 source ID 排列。每个 source 给出 `action`、准备阶段读取的完整 `before` 和规范化完整 `after`；空集合为 `[]`。候选建立固定为 `establish`；正式来源的 before/after 相同为 `unchanged`，否则为 `replace`。
- 预检的 phase 是 `preflight`，正式成功的 phase 是 `committed`。失败不附成功 review，预检不构成提交凭据。
- 公开 `publish` 与 `set-relations` API 暴露同一结果，CLI 只格式化该 review 的最终集合与变化。

全部来源和 target 都解析为已建立 ID，各组共同形成最终图预演，允许同一事务完成拆分关系而无非法中间状态。命令要求新鲜索引，验证完整图及所选来源版本后，事务化更新关系和索引；其他 metadata、正文、资源和 pending 保持不变。全部关系与现值相同时零改写，否则报告实际变化。

### 删除报告或候选

| 操作 | 删除范围与确认 |
| --- | --- |
| `discard` | 一个候选或一个完整正式报告及明确选择的自有资源；按稳定 ID 自动识别目标种类，候选删除保持正式报告、关系和索引不变，正式报告删除要求正式集合、关系、资源和当前索引有效并更新正式索引。目标或其资源已被 HEAD 记录时须确认 `--delete-recorded`；同一语义名同时命中候选与正式报告时要求完整 ID。 |

删除同时满足以下条件：

1. 正式目标没有剩余关系引用，移除后完整图仍满足时间、无环、归并和拆分闭合规则。
2. 存在 owner 资源时，显式使用 `--delete-owned-resources` 选择该范围；其他报告或候选仍引用这些资源时，先迁移 owner 或更新引用。
3. owner 树只含安全、版本控制可见、非符号链接的普通受管成员。ignored、非法或无法完整检查的成员及写前漂移都阻断删除。
4. Git HEAD 记录了目标或任一将删资源时，首次调用零写入并请求对应确认；重试须有覆盖删除目标与影响的明确授权。非 Git 工作区或 unborn HEAD 无此门禁；Git 或成员检查异常保持零写入。

删除不在同一调用中修改关系或自动转移资源 owner。事务保护已预演成员，通过同文件系统 tombstone 保存恢复范围；正式删除以索引发布为提交点。提交前失败恢复完整旧组合，提交后只精确清理预演成员，不递归删除未知字节。候选删除按自身范围遵守相同安全边界。

`committed-cleanup-pending` 表示对象已退出相应集合，但仍有 tombstone 残留；此时先对账再维护。删除最后一份正式报告保留合法空索引，现有 pending 不受影响。

### 身份更正

`rename` 在同一恢复范围改写一个报告或候选的 ID、全部受管 relation target、资源链接、owner 前缀、sourcePath 和正式索引；其余 metadata、正文判断与关系摘要保持不变。

- source 按普通 selector 选择，target 标准 ID 的日期须等于 formedAt 的 UTC 日，name-only target 自动使用该日。
- ID、name 与目标位置须无冲突；正式报告优先 `<name>.md`，候选优先 `_candidate.<name>`，其次使用完整 ID。身份、位置和 owner 全部不变时零写入返回未改变。
- `--preflight` 只读完成相同计划。HEAD 已记录报告、候选或 owner 资源时，正式执行分别确认 `--rename-recorded-report` 或 `--rename-recorded-candidate`，只作用于当前工作树。
- 移动和恢复都保护已有路径。新目标独占创建，资源复制后核对类型、权限、大小与内容，旧成员只有再次确认未变才能逐个清理。
- 回滚仅撤销仍等于本事务快照的新内容，并只恢复仍缺失的旧路径。并发出现或发生类型、权限、字节漂移时保留现场，返回 `partial-or-unknown`，不递归清理或覆盖他人内容。

rename 自行完成索引更新，不把同步或暂存当作第二阶段；成功后的受管引用统一使用新身份与 owner。

## 索引与查询

索引以完整 Investigation ID 为键，投影报告 metadata、sourcePath、直接关系及 resourceIds。来源版本覆盖正式报告的身份、位置和完整 Markdown（CRLF 规范为 LF）；candidate、资源成员和资源字节不参与索引新鲜度。精确结构由相邻 Schema 维护。

### 查询结果能说明什么

`list` 提供全局筛选概览与近期窗口，`show` 读取完整正式报告，`trace` 从一次结构受检的发布索引快照返回面向 agent 的关系切片。重复 tags 为 AND，形成时间范围包含端点；关系条件与其他条件相交后再排序、翻页或匹配文本。参数默认值和窗口大小查 help，空页只说明本次筛选与窗口无结果。

#### trace 的输出与成员

`trace` 从同一成功查询结果渲染终端关系图或 JSON；两种 renderer 不重读索引、不重做选择，也不改变成员、coverage、frontier 或 blockedEvent。

| 表述 | 输出契约 |
| --- | --- |
| 默认终端图 | 向 stdout 输出 anchor、direction、depth、complete 与记录数，以 `L0/L1/...` 表示稳定图层。每个 trace 节点只出现为一个主体块；`* trace` 标记实际遍历成员，`~ context` 标记为事件闭合补入的成员。展示可用的 predecessors、successors、拆分／归并事件及 relation summary；不完整时输出 frontier 和 blockedEvent。 |
| `--json` | 单值开关，原样序列化同一查询成功结果的稳定 JSON envelope，回显 `anchorId`、实际 direction 与 limits；无限 depth 表示为 `"all"`。 |
| 参数 | 默认 `direction=both`、`depth=5`、`max-records=50`。有限 depth 为非负安全整数，`--depth all` 取消深度限制；max-records 为正安全整数。 |

成员和直接关系按以下边界解释：

- `traceIds` 是请求方向上实际到达、可继续扩展的成员；`contextIds` 只为完整拆分或纯归并事件闭合补入，不递归扩展。二者互斥，并集恰为 `entries` 的键。
- 每个 entry 只投影 title、formedAt、question、tags 和完整 relations。ID 由键承接；name、sourcePath、resourceIds 不进入结果。relation target 可以在切片外，这仍是发布索引事实，不是缺失证明。
- 终端图只展开两端都在切片内的边，主体或事件对端成员承接已展示边的方向与摘要。已读取但缺少摘要显示 `[无摘要]`；已有摘要按 JSON 转义的完整单行文本显示。JSON 中 summary 有值才出现，trace 不推断或补写。
- 完整直接关系从 entry 或来源正文读取；context 与切片外边均不扩大本次遍历或 coverage。

#### trace 的事件闭合与覆盖

完整事件按整体接纳：跨越拆分时接纳前序与全部直接拆分后继；跨越纯归并时接纳归并后继与全部直接前序。请求方向可直接到达的端点成为 trace member，其余成为 context；context 后续实际到达时提升为 trace member。

`coverage.complete` 仅在没有深度或预算截断时为 true；`coverage.stoppedBy`、`frontier` 与可选 `blockedEvent` 共同解释限制：

- frontier 的 fromId、direction、nextIds 是后续查询可用的事实，不是 cursor。
- 预算不足以整体接纳多记录事件时，blockedEvent 的 recordIds 保持事件完整，requiredMaxRecords 给出接纳所需最小预算；不接纳部分事件。
- 普通单记录接纳受阻时只形成 max-records frontier。

#### 筛选与文本证据

`--related-to` 先独立解析目标，再按相对目标的 predecessors、successors 或 both 选择直接邻居；方向须与目标同用。relation type 单独使用匹配任一该类型边，与目标同用则须命中同一条边。关系条件的 list/search entry 以可选 `filterRelations` 返回导致该记录命中的完整边集合：只在存在关系条件时出现，使用本次筛选的同一来源快照，按 `(sourceId, type, target)` 去重并以 UTF-16 code-unit 词法序排列；前驱边由 anchor 指向结果，后继边由结果指向 anchor，both 取并集，type-only 选择结果来源的指定类型出边。记录集合、排序、分页与搜索 limit 保持不变。该投影属于公开 Investigation list/search entry API；索引条目、Schema 与正式关系数据模型不因此扩大。

搜索的文本证据与 `filterRelations` 分开：metadata 的 `matchedFields`、`matchedRelations` 只报告实际文本命中，`matchedRelations: none` 不否定关系筛选命中。CLI 默认每条预览最多三条命中边，`list --detail` 展开当前页全部命中边；完整正文或完整直接关系继续通过 `show` 读取。

| 搜索范围 | 来源与适用边界 |
| --- | --- |
| 默认 content | 用同一当前快照筛选正式 Markdown，并把路径映射回 ID。索引缺失、损坏或陈旧时，须完整验证正式来源与资源后，才能以内存投影只读降级并 warning。 |
| metadata | 只读已发布索引中的 ID、name、title、question、tags 与来源关系 summary；不验证未同步来源。索引读取失败时诊断并显式恢复。 |

两种范围先结构筛选再匹配。all 要求全部词，any 要求任一词，phrase 要求连续短语；统一 NFKC、忽略大小写并按空白处理。content 的匹配段为物理行，metadata 为单个字段、tag 或 summary；all/any 可跨同一报告的段，phrase 限于单段。关系筛选不构成文本证据；metadata 只报告实际命中字段与来源摘要，不以 target 内容充当来源命中。

search 的 limit 只限制返回的命中报告，不提供 offset 分页；命中计数、来源与三种覆盖按下方搜索总览解释。降级只服务本次查询，持久索引仍须显式恢复。

`list`、metadata `search` 与 `trace` 只保证索引结构合法及按最后发布快照正确查询；不读取正式 Markdown 核对新鲜度，不自动同步，也不把“未核对”作为默认 warning。快照计数、筛选和关系事实不能证明当前全集无命中或仍保持相同关系。索引缺失、损坏或 definition 不符时查询失败，须显式恢复。

`show` 以发布索引定位一个普通非符号链接文件，确认当前 frontmatter ID，并返回当前正文；它用已读字节比较该 entry 的来源指纹，漂移时 warning 区分发布 metadata 与当前正文。该读取只证明所选报告。全量 `check`、发布、关系事务和正式删除按各自前提验证完整来源与索引；stage 按所选范围与必要依赖验证；mutation 前提不满足时零写入停止并给出恢复动作。

### 搜索总览与完整性

每次成功 `search`（含零命中）都以只读 `InvestigationSearchInfo` 返回同一即时查询的四组事实。公开 `InvestigationSearchResult` 由 `status` 判别：`ok` 时 `searchInfo` 完整，`error` 时为 `null`，失败不伪造命中数。索引和 Schema 继续只承接持久记录；记录字段、文本证据与关系筛选依据仍按上文读取。

| 分组 | 含义与读取方式 |
| --- | --- |
| `query` | 经校验、用于 matcher 的 `text`，实际 `in`、`match`，以及生效的 `filters` 与 `limits`。 |
| `source` | `kind` 表示发布索引或已验证来源，`currentness` 表示本次新鲜度证据，`fallback` 表示是否只读降级。 |
| `counts` | `matched.value` 按记录计数，含已发现但无法返回的命中；`precision` 为 `exact` 或 `lower-bound`。`returned` 是实际返回记录数。 |
| `coverage` | 分别说明扫描、记录返回与预览展示是否完整；`reasons` 去重并按 `max-records`、`match-previews`、`preview-characters` 顺序列出实际限制，未受限时为 `[]`。 |

#### 条件与预算

`filters` 保存规范化 `tags`（默认 `[]`）及已使用的 `formedAtFrom`、`formedAtTo`、`relationType`、`relatedTo`、`direction`；时间边界以等价 UTC 字符串回显。关系目标回显同一筛选快照解析出的完整 ID；有目标时 direction 默认 `both`，未使用的可选条件省略。

`limits` 回显本次生效预算：两种范围的 `maxRecords` 都是实际 limit（默认 50、最大 1000）。metadata 的 `resources`、`preview` 为 `null`，表示不适用；content 的 `resources` 为 `maxCandidateFiles=2,000`、`maxFileBytes=2 MiB`、`maxTotalBytes=20 MiB`，`preview` 为 `contextLines=1`、`maxMatchesPerFile=3`、`maxPreviewCharacters=24,000`（UTF-16 字符）。

#### 来源证据

| 本次依据 | `kind` | `currentness` | `fallback` |
| --- | --- | --- | --- |
| metadata：只读取结构合法的发布快照，不核对当前来源 | `published-index` | `unchecked` | `false` |
| content：当前来源验证成功，索引映射可用 | `validated-source` | `current` | `false` |
| content：索引不可用或陈旧，完整验证正式来源与资源后用只读内存投影降级 | `validated-source` | `current` | `true` |

`current` 只说明本次已有验证证据，不承诺查询期间锁或跨文件原子快照。metadata 的 `unchecked` 是正常的发布快照来源边界，不产生 warning；其计数与覆盖只代表该快照。content 的 fallback 产生来源 warning。

#### 计数与覆盖

- `scanComplete` 检查结构筛选后的全部待匹配记录：全部检查完为 `true`、计数 `exact`；提前停止为 `false`、计数 `lower-bound`。
- `resultsComplete` 要求扫描完整、计数精确且全部命中均已返回。metadata 保留切片前的精确命中数；limit 隐藏命中时，扫描完整但结果返回不完整。
- `previewsComplete` 只描述已返回记录的命中范围及上下文片段；metadata 为 `null`。预览预算仅限制展示，耗尽后继续在扫描资源与返回预算内识别命中，空 `previews` 仍保留身份。只有实际省略片段才标记预览受限，恰好用满预算或未返回记录均不影响该字段。
- content 返回预算满后，在首个无法返回的命中文件处停止，并将其计入 `matched`。还有未检查文件时计数为下界；若它是最后一个文件则计数精确、扫描完整，但两者都使结果返回不完整。
- 完整零命中为 `exact 0`、`returned=0`，扫描与结果均完整，content 预览也完整。metadata 必需索引读取、content 必需正文读取，以及资源错误或取消均保持失败，不作为成功的部分结果。

#### 输出与后续阅读

默认 CLI 在 stdout 先输出六行 `Query`、`Filters`、`Source`、`Limits`、`Counts`、`Coverage`，再输出记录或零命中提示；全部展示来自同一查询结果。字符串使用 JSON 转义，Filters 使用紧凑 JSON；Limits 只展开适用预算。下界显示 `matched>=N`，覆盖显示 `complete`、`limited` 或 `n/a`，未受限显示 `reasons=none`。

warning 保留领域前缀并写入 stderr，每类仅一次：

- 返回限制：`search results limited: max-records`。
- 预览限制：`search previews limited: match-previews,preview-characters`，只列实际原因。
- 来源状态：`search source: validated-source fallback`，附来源边界及 `sync-index` 恢复动作；普通预算限制不要求修复来源。

按来源和各项覆盖判断结论：仅预览受限不表示记录发现不完整；来源为发布快照或扫描不完整时，不能对当前全集作否定性结论。需要更多命中时收紧筛选，完整正文和直接关系用 `show` 读取。预览预算不是 stdout 总字节上限，外部展示仍可能截断。

### 检查与同步

| 操作 | 证明或更新范围 |
| --- | --- |
| 默认全量 `check` | 正式报告、完整关系图、资源和索引；合法 candidate 只做成员安全、身份冲突和准备诊断。 |
| `check --id` | 优先按发布索引定位并核对所选 ID；未索引或移动身份需要时做一次身份发现。复用已读字节验证所选报告及直接资源。结果只证明选定范围，完整图、拆分闭合、未引用资源集合和索引新鲜度由全量验证承接。 |
| 全量 `sync-index` | 完整验证正式来源后重建索引，接纳手工正式来源变化；合法候选留在集合外。 |
| selected `sync-index` | 同样完整验证，但只接纳明确选中 ID 的已知来源变化，默认写入并发布完整索引；`--preflight` 对同一验证零写入预演。 |

全量 `check` 只用本次首次采集的同一份身份、源字节、解析结果与资源事实，验证完整集合及其完整索引投影；每份报告正文读取一次，不承诺结束时来源仍未改变，也不承诺跨文件原子快照。`sync-index`（含预演）与发布等写操作仍在各自必要边界独立复核可变来源，拒绝期间漂移；单阶段复用不构成跨调用缓存。

一批手工正式编辑可先共同完成，期间用局部 check 或读取 Markdown；在已有关系事务、正式删除或全量验收需要当前集合前同步一次；暂存所选来源变化前发布相应索引投影。全量同步可恢复旧索引缺失、损坏或陈旧，来源或候选成员安全问题仍须先解决。`sync-index` 默认写入完整有效索引，`--preflight` 零写入执行同一准备与验证。已知合法来源变化的规范顺序是同步后全量 `check`；未解释的索引异常先 `check` 诊断，再同步或修复。

selected 同步须有可信 baseline，集合 metadata 及其 revision 保持不变，全部变化 ID 都被选择。selector 从 baseline 与待发布投影的 name 映射并集解析，标准 ID 只精确匹配。新增选新 ID，删除选旧 ID，身份更正同时选旧/新 ID；未选择变化、未知 ID 或坏 baseline 均零写入，先补充选择或显式全量同步。

### 待提交快照

`stage <investigation-id...> [--scope all|index|domain]` 按标准 ID 或唯一 name 预选正式报告，以发布 metadata 和相应局部来源构造 Git pending 调查快照。所有 scope 严格解析工作区发布索引与固定 `HEAD` 基线的完整 metadata、关系图及资源 owner 声明；`index`／`all` 还验证最终选择性索引投影。索引缺失或无效时零写入。`all`／`domain` 要暂存所选报告的新来源时，须先显式 `sync-index` 发布相应投影；`index` 只使用已有发布投影，不以当前正文新鲜度为前提。stage 本身不接纳未发布来源变化。

selector 在当前正式集合与 `HEAD` 基线索引的 ID 并集中解析。选择项须存在且无歧义，解析后 ID 不重复；sourcePath 变化仍选择同一 ID；基线-only 旧 ID 写入删除；重命名显式同时选择旧 ID 与新 ID，不从名称相似度推断。候选不进入 stage 范围。

scope 决定 pending 写入路径：

| scope | 写入内容 | 保留边界 |
| --- | --- | --- |
| `all`（默认） | 所选索引投影、正式报告 Markdown 及完整 owner 资源树，在一次原子替换中写入 | 未选报告、候选及其他 owner 的 pending 字节与文件表示保持不变 |
| `index` | 所选索引投影 | pending 索引须与 HEAD 基线一致，否则失败且保留原内容；其他 pending 保持不变 |
| `domain` | 所选正式报告 Markdown 与完整 owner 资源树 | pending 索引、未选报告、候选及其他 owner 的字节与文件表示保持不变 |

完整 owner 资源树的成员取工作区与固定 `HEAD` revision 的路径并集，包含未引用成员；已删除的基线资源进入删除目标。直接引用使用[资源路径与文件要求](#路径与文件要求)中的 ID 规则，未引用成员按安全普通文件路径校验，不额外套用引用 ID 的字符限制。准备与写前两阶段均须在取得资源字节前检查资源根、所选 owner 目录及每个目标的全部路径分量，零直接引用或空 owner 树也不能跳过根与 owner 安全检查。缺失根、目录或文件可表达未引用基线资源的合法删除；仍被直接引用的资源必须存在。只检查所选树及直接依赖路径，不遍历无关 owner 树。

所选来源必须是常规非符号链接文件，使用工作区字节和尊重 Git `core.fileMode` 的有效执行位；仅执行位变化也计入实际写入路径。不满足来源类型要求时停止并保留 pending。

stage 的读取与写入保护分为以下责任；“阶段”是本次命令的准备或写前复核，不是跨调用缓存：

1. `index` 不读取报告正文，只暂存合法的发布投影；不证明当前原文或资源健康。完整 metadata 图与最终投影的关系约束仍须满足。
2. `all`/`domain` 先从所选发布声明确定报告、直接资源及其正式 owner 依赖。准备与写前复核分别读取这些报告的字节，验证身份、完整投影和来源指纹；读取所选 owner 的完整资源树及直接共享资源，验证普通文件、可见性与资源 owner 引用。依赖报告与其他 owner 的资源不因此进入写入目标，无关非法或已删除正文不阻断局部暂存。
3. 两阶段重新取得可变工作区成员、字节、文件表示、发布索引及全 pending 快照，拒绝漂移；每阶段至多读取一次 `core.fileMode`，关闭时复用该阶段已取得的完整 pending 表示依据。固定 revision 的 HEAD 索引与所选资源成员事实可跨阶段复用，写入锁内仍核对当前 HEAD 指针及完整 pending 的路径、字节与表示。
4. 基线-only 删除需要额外身份发现，以拒绝相同 ID 在其他工作区位置重新出现；该条件性扫描可以扩大正文读取范围，不是普通已定位暂存的默认成本。

正常已定位 `all`/`domain` 的原文与资源访问随选中及必要 owner 依赖和局部资源成员增长；完整索引、关系图和完整 pending 仍是集合范围成本，不能据此宣称整个 stage 为局部线性或固定时延。

结果报告实际写入路径、保留的无关 pending 范围与调用方负责的路径。`domain`/`all` 的 `preservedPendingPaths` 是该调查 scope 中相对固定 HEAD 已改变且不属于写入目标的 pending 路径（包括 staged 删除），只由路径变化元数据取得，不为此读取全部 HEAD 正文；`index` 使用共享索引暂存结果的保留路径边界。`index` 的成功只证明索引暂存，来源验证另行完成。`stage` 只更新 pending，commit 与 push 由调用方按授权执行。

## 诊断与验收

CLI 的 code、对象、原因和下一步说明本次命令；有可靠系统证据时才补充原因类别、操作与净化细节。成功信息在 stdout，失败和 warning 在 stderr，均为即时输出，不保存日志、遥测或 receipt。退出码和精确输出查 help。

mutation 失败的 scope/outcome 只说明声明范围：

| outcome | 可确认状态 |
| --- | --- |
| `no-change` | 声明范围未改变。 |
| `rolled-back` | 提交点前失败，已恢复完整旧范围。 |
| `partial-or-unknown` | 无法证明完整恢复，须先对账。 |
| `committed-cleanup-pending` | 已越过领域提交点，尚有清理残留。 |

普通查询、检查、readiness、预检与参数错误不附会 mutation 结果。warning 提示需要核对的事实，本身不改变状态；发布、删除、同步和 pending 的结果各按其实际范围解释。权限、锁、重试与对账动作统一执行[维护恢复](maintenance-recovery.md)。

写入后运行默认全量 check，并由 agent 另行审查独立记录与真实演进门槛、章节语义、证据质量、资源必要性与可信度、敏感信息、历史修正正当性，以及关系是否真实直接。机械检查通过与报告内容可信分别交付。
