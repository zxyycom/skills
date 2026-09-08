# 决策记录规则

本规则是 Decision Records 的写入、结构审阅和维护不变量 owner。写入候选、修改 tags、改变生命周期或关系、构造 `pending` 决策快照前必须完整读取。Agent 行为流程由 [SKILL.md](../SKILL.md) 承接；索引精确机器结构由 [decision-index.schema.json](decision-index.schema.json) 承接。

## 模型与权威

| 对象 | 含义 | 权威来源 |
| --- | --- | --- |
| Decision ID | 不含扩展名的稳定领域身份；新记录为 `YYMMDD-<name>`，目录或 basename 移动不自动改变它 | Markdown frontmatter `id` |
| name | 标准 ID 的日期后缀；legacy ID 的完整值 | 由 frontmatter `id` 投影 |
| tags | 非空、唯一、有序的记录级分类 token 集合 | Markdown frontmatter |
| status | `candidate`、`active` 或 `archived` 的生命周期事实 | Markdown frontmatter |
| sourcePath | 相对决策根的当前 POSIX 路径，只负责定位 | 文件系统；已建立记录由索引投影 |
| relation target | 指向直接前序的 Decision ID | 后继 Markdown frontmatter |
| decision index | 以 Decision ID 为键，投影已建立记录的 sourcePath、状态、tags、摘要和关系 | 从完整合法 Markdown 派生 |

新建 Decision ID 必须为 calendar-valid `YYMMDD-<name>`，其中 `name` 与 ID 的 kebab-case grammar 相同；日期来自 candidate 创建时的 UTC 日且不可关闭。无日期的旧 ID 继续是可读、可迁移的 legacy identity，其 name 是完整旧 ID。tag 必须符合 `^[a-z0-9]+(?:-[a-z0-9]+)*$`。同一集合内 ID 与 `sourcePath` 分别唯一，且每份受管 Markdown 的 frontmatter `id` 必须与其关系、索引 key 和单项回读一致。索引和 `sourcePath` 不能反向补造或改写身份、生命周期、tags、正文或关系。

## 布局、状态与 frontmatter

决策根目录的稳定布局是：

```text
docs/decisions/
├── decision-index.json
├── <name-or-decision-id>.md # candidate 或 active
└── archive/
    └── <name-or-decision-id>.md # archived
```

这里的 basename 是由 writer 选择的 ID 或语义 name；name 不写入 frontmatter，但会由 ID 投影为索引 key，并可作为普通 selector。文件位置仍以完整 `sourcePath` 独占。

1. 根目录直属 Markdown 只能是 `candidate` 或 `active`；`archive/` 直属 Markdown 只能是 `archived`。状态和位置不一致、嵌套目录或跨位置同 ID 都是集合错误。
2. candidate 不进入正式索引；active 与 archived 由一个统一索引覆盖。archive 不建立第二索引。
3. `sourcePath` 是相对决策根的实际 Markdown 位置；根目录使用 `<name-or-decision-id>.md`，archive 使用 `archive/<name-or-decision-id>.md`。basename 可等于 ID 或使用语义文件名，但不定义身份。生命周期只改变目录位置并保留 basename；它不是关系或查询身份输入。
4. `tags` 是当前分类提示，不表示 status、alignment、关系类型、当前事实或历史演进。分类维护不代替语义审阅。

新候选使用下列顺序；`tags` 位于 `decision` 之后、`relations` 之前：

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

1. tags 至少一个，按 locale 无关的字符串词法升序排列，且同一记录内不得重复。
2. 标题和三项摘要是 4 至 100 个 Unicode 码点的单行文本；摘要不得引入正文没有表达的独立含义。
3. 正文只使用依次排列的“目的”“背景”“决策”二级章节，不重复一级标题、摘要或关系。决策至少包含一个非空“采用”。
4. 已建立记录只能直接进行不改变目的、范围、关键背景、采用方向或核心理由的编辑性修正。语义变化通过新记录和真实演进关系表达。
5. candidate scaffold 必须具有合法身份、位置、frontmatter、tags、关系语法和依次排列的三个固定章节；三个章节内容可以暂为空。`bodyReady` 仅在三个章节均有非空内容且“决策”含非空“采用”时成立。CLI 不保存“已审核”或“可建立”状态，也不以机械正文条件替代语义审核与建立授权。

## 生命周期与对齐

| 状态 | 含义 |
| --- | --- |
| `candidate + alignment: null + createdAt: null` | 结构合法 scaffold 或 body-ready candidate，尚未建立；不进入正式索引。 |
| `active + aligned` | 已确认并进入当前集合，完整方向已成为当前事实并通过核对。 |
| `active + unaligned` | 已确认并进入当前集合，作为未来方向约束相关选择；这是正常状态，不表示失败、待办或实施授权。 |
| `archived + aligned/unaligned` | 不再作为当前依据，保留最后对齐状态与演进历史。 |
| 历史 `archived + alignment: null` | 只表示归档前事实关系未知。 |

1. `activate` 是审核与建立边界：首次建立只接受 body-ready candidate，把它改为 active，选择非空 alignment 并写入不可变 createdAt。建立前 agent 仍须完成语义审核和当前授权判断。Git 提交、暂存或历史不参与建立状态。
2. alignment 始终作用于整条决策。只有完整方向成为当前事实并完成核对后才能从 unaligned 标记为 aligned；不得添加部分对齐状态。
3. 可分别修订、归档或对齐的部分说明原记录过粗，必须以闭合拆分建立自包含后继。不可独立演进的局部落地不改变整条记录的 unaligned 状态。
4. 已对齐记录后来与当前事实偏离时报告一致性问题，不改回 unaligned。新的未来目标使用新记录。
5. archive 保留最后一个非空 alignment；重新激活保留原 createdAt 和关系，并由本次参数建立当前 alignment。
6. `candidate` 不承接已经确认但尚未执行的方向；后者是 `active + unaligned`。Git pending 也不属于生命周期。

## 演进关系与事务

关系从新记录指向真实直接前序：

```yaml
relations:
  - type: 修订
    target: direct-predecessor
    summary: 保留前序方向并调整索引边界
```

每条 relation 还可有可选 `summary`，从 source 记录视角说明这条直接边。输入先 trim；空白规范化为省略，非空值必须是单行且最多 40 个 Unicode 码点，绝不截断。它只说明已有边，不参与 target 身份、去重、排序、时间方向、关系形状或环验证；相同 target 不能因摘要不同而重复。旧关系可继续省略，不要求回填或迁移。

1. `修订` 保留主体方向并改变一部分；`替代` 以完整新判断取代前序；`判定无效` 表明前序依据不成立；`归并` 整合多个前序；`拆分` 把过粗前序重建为多个可独立使用的后继；`重划` 把多个直接前序的长期含义按新的 owner 边界重新分配给多个自包含后继。
2. 每个 target 是合法 Decision ID，只出现一次，不自环、不成环。关系只保存语义演进，不作为分类、引用列表、任务依赖或实施映射。
3. 候选关系做类型、ID、重复、自环和目标可解析性前瞻检查，但在建立前不进入正式图，也不要求活动前序提前归档。scaffold 可以继续编辑或 discard；只有 body-ready candidate 能成为 activate/evolve 的后继。
4. **CLI summary 绑定矩阵：** `--relation-summary <decision-selector=summary>` 只按第一个 `=` 分隔，后续 `=` 属于 summary；selector 收敛后必须唯一绑定同次完整 `--relation` set 中的 target。它不是单边 patch，summary-only、重复、未命中 target 及与 `--clear-relations` 的组合均无效。
   - `new`：summary 必须与同次至少一个 `--relation` 同现，并绑定该 candidate 的完整 relation set。
   - 首次 `activate` candidate：未传 relation 或 summary 时保留 candidate 的完整 relation 与 summary；传入 `--relation` 时完整替换，未提供 summary 的边省略该字段。重新激活 archived 记录拒绝 relation 与 summary override。
   - `evolve`：未传 relation 或 summary 时，每个 successor 保留自身 relation 与 summary；传入 `--relation` 时，同一个完整 set 及其 summary override 复制给全部 selected successors。需要不同 successor summary 时，先写入各 candidate，再省略统一 override。
   `evolve` 通过重复 `--successor <alignment=decision-id>` 显式选择完整后继集合。推荐由每个候选在自身 `relations` 中声明来源边，尤其适用于后继来源不同的稀疏重划。调用方也可用重复 `--relation <type=decision-id>` 完整替换每个所选后继的关系，或以 `--clear-relations` 表达显式空集合；三种意图不追加、不合并、不互相推断。`--relation` 不因选择重划自动无效，但它对所有所选后继给出同一完整关系集合，最终图仍必须满足本节的策略规则。
5. CLI 对最终关系图执行以下形状与集合闭合检查：
   - 非拆分、非重划的有效最终关系只允许一个所选后继；全部为归并时至少含两个不同前序。
   - 拆分必须显式选择至少两个后继。每个后继恰有一条指向同一前序的拆分关系，且选择集等于该前序的完整直接拆分后继集合。
   - 重划必须显式选择至少两个后继和至少两个不同直接前序。每个后继至少有一条重划关系且不得混用其他关系，所有直接前序至少被承接一次，前序与后继角色集合在同一事件中互斥，稀疏二部图必须连通，且选择集等于最终图中该重划连通分量的完整后继集合。互不连通的重划必须作为独立事务；后续重划早先后继是另一事件，不与历史分量合并。
6. 这些机器可验证的不变量不代替语义审阅：agent 仍须确认每个拆分或重划后继覆盖其直接前序继续有效的长期含义，并明确处理被放弃、改写或判定无效的含义。
7. 关系、生命周期和丢弃变更使用 CLI 事务；它尽可能保证 Markdown 与索引组合的原子性。普通诊断无法恢复的失败按维护恢复处理。
8. 已建立记录的关系只能由完整关系事务修订。新候选可由 `activate` 的单后继便捷入口进入相同事务；重新激活 archived 记录不借激活修订关系。

## 维护不变量

1. 当前指令明确授权起草候选，或足以确认长期判断和维护范围时，才在相应边界内写入；新增记录或改变状态前告知用户将改变的判断和集合。
2. 新候选优先使用 `new` 的显式 metadata 创建；它在集合锁内以原子不覆盖方式发布，不改变正式索引或生命周期。candidate 正文和 tags 可直接修改权威 Markdown；生命周期、对齐、归档和丢弃使用 CLI。已建立 Markdown 的手工修改后同步索引，并在维护或验收前运行严格 check。
3. Git `HEAD` 只用于在保留独立决策历史前要求再次确认，以及删除已记录决策的机械门禁；不参与候选、建立、生效、对齐或索引成员判断。在 Git 工作树中，尚无首次提交的 unborn `HEAD` 按空 Git `HEAD` 基线处理。可用 Git `HEAD` 基线中，单独 `archive` 的目标，以及本次关系事务中所选后继完整最终关系集里的每个已建立直接前序（relation target），只要尚未进入 Git `HEAD`，CLI 就暂停且不写入；无论前序是 active 还是 archived，调用方都必须以 `--keep-unrecorded-history` 显式确认后才可继续。该判断不使用形成时间。在 Git 工作树外没有这个确认门；但 stage 仍需要其自身的版本控制前提。
4. `discard` 删除完整、结构有效且在删除后的最终集合中无剩余引用的 candidate、active 或 archived 决策。它既可直接运行，也可通过 `evolve --discard <decision-id>` 与后继建立、最终关系修改和索引重建处于同一事务；被删除 ID 不能同时作为后继，所选后继的最终关系也不得保留该 ID。`evolve` 仍遵循普通演进的关系形状、闭包和最终图验证，不增加只适用于删除的后继数量、状态、前序或显式空关系限制。删除的 Decision ID 已进入 Git `HEAD` 时，未带 `--delete-recorded-decision` 的调用在其余删除条件和演进最终图都已通过后 attention 且零写入；带该参数即为明确的机械删除选择，不会为 discard 自身重复读取 Git `HEAD`，但不绕过同次 `evolve` 最终关系的独立 `--keep-unrecorded-history` 预检。非 Git 工作树、unborn `HEAD` 或 ID 未进入 `HEAD` 时正常删除；无参数且 `HEAD` 不可读取时 fail closed。调用方不主动预检 Git，只响应 CLI 实际提示。
5. `stage` 只是 Git pending 状态转换，不改变决策生命周期。`sourcePath` 变化是位置变化，stage 选择一次对应 ID 即可；显式改变 frontmatter ID 才是身份变更，必须同时维护关系与索引。生命周期移动、关系维护和 stage 都应在写前拒绝 revision、pending 或所选来源漂移。

### `rename`

`rename <source-selector> <target-name-or-id> [--preflight] [--rename-recorded-decision]` 是唯一的单条身份迁移入口。source 先按标准 dated ID exact 解析，失败才按 unique name；target 标准 ID 直接定义目标，其他合法 kebab-case 值作为 name。标准 source 保留原 ID 日期，legacy established 记录使用 `createdAt` UTC 日，legacy candidate 的 name target 返回 `date-required`，但允许调用方明确提供完整 dated target ID。目标 ID、name 与新路径均须在完整集合内无冲突；同生命周期 `<name>.md` 可用时优先，否则使用 `<id>.md`，两者都冲突时零写入。

事务在 collection lock 内重读来源与索引，改写 source frontmatter ID、所有 candidate/established 结构化 relation target、sourcePath 与完整派生索引；它不改变状态、alignment、createdAt、正文、relation type 或 relation summary，也不自动 stage。`--preflight` 完成相同扫描、日期、关系、路径、索引与 Git HEAD 检查但绝不写入。目标已进入 Git HEAD 时，正式执行必须显式使用 `--rename-recorded-decision`；该确认只授权当前工作树 rename，不重写历史。移动、写入、索引发布或回读失败按领域事务恢复，结果只能报告 no-change、rolled-back、partial-or-unknown 或 committed-cleanup-pending。
6. 普通单对象 selector 先只移除一个大小写不敏感的末尾 `.md`，再尝试 calendar-valid 标准 ID。标准 ID 解析成功时只精确查该 ID，未命中不得退回 name；解析失败时将完整剩余文本按 exact name 查询。零项是 not-found，一项收敛为完整 ID，多项按 ID 排序报 ambiguous，不按状态、日期或路径猜测。持久 Markdown、关系、索引 entry key、资源 owner 和结构化输出只保存完整 ID；真实路径只能进入明确的 path/locator 参数。

## 派生索引与查询

1. 索引从全部已建立 Markdown 完整生成，definition、metadata 与字段精确结构以 Schema 为准。metadata 是严格空对象，不保存分类注册表。
2. entry 与 source revision 以 Decision ID 为键。state 保存由 ID 投影的 name、sourcePath、tags、status、alignment、createdAt、摘要和关系；source revision 覆盖规范 ID、sourcePath 与规范 Markdown 内容。
3. 索引 keys 为 exact `name`、多值 exact `tag`、exact `status` 和 exact `alignment`；relation projection 保留存在的可选 summary，供 show、trace 和直接关系结构筛选读取，但不改变图或 key 语义。当前查询不推断分类，也不提供 OR、NOT、层级、别名或权重。
4. `list` 只加载一次当前索引，并在筛选和分页前从同一完整 entries snapshot 查询时聚合全局 facets：记录总数、status、alignment、每记录只计一次的 tag、createdAt instant 的 UTC 月份，以及规范 UTC 最早/最晚边界。空集合固定使用零计数、空列表和 null 时间边界；facets 不写入 metadata，不改变 Schema、definition version 或 source revision。
   - 默认 status 是 active；alignment 默认 all；重复 tags 使用 AND；`--created-from/--created-to` 是包含端点的 RFC 3339 instant 范围。结构条件在排序与分页前相交，合法空集合和 offset 越界都成功返回带全局 facets 与窗口上下文的空页。
   - 匹配结果按 createdAt instant 倒序，再按 Decision ID 的 locale 无关词法升序稳定排序；默认 limit 10，最大 1000，offset 默认 0。
   - 默认文本先显示完整低基数字段、按 count 倒序且 tag 升序 tie-break 的最多 30 个 tags，以及按月份倒序的最近 10 个 UTC 月份；省略部分只报告剩余 distinct 值数量。随后以单行显示窗口内完整 ID、时间、status/alignment、全部 tags 和 title，不截断所选字段。
   - `--detail` 保持相同筛选、排序、limit 与 offset，展开完整 tag/月目录和原有多行 sourcePath、tags、title、purpose；它不恢复无界列表。完整权威 Markdown 仍由 `show` 读取。
5. `show` 先把普通 selector 收敛为 ID，再由索引定位并只读取目标 Markdown 正文。`trace`、关系、生命周期和 stage 的普通输入也先解析为 ID；输出显示完整 ID、sourcePath 与 tags。
6. `list` 与 `search <text>` 都可增加一个 `relatedTo` 普通 selector、可选 `direction` 与可选 `relationType` 的直接关系条件：
   - `relatedTo` 按本规则的普通 selector 收敛：先移除一次末尾 `.md`，再精确解析 calendar-valid 标准 ID；只有标准 ID 解析失败时才按唯一 name 查找。目标不受最终 status、alignment、tag 或文本条件限制。
   - 方向始终相对该目标解释：`predecessors` 返回目标自身 relations 的 target，`successors` 返回 relation target 等于目标的来源记录，`both` 合并两者并按 ID 去重。省略方向等于 `both`；未提供目标时提供方向是输入失败。
   - relation type 单独出现时匹配记录的任意直接边；与目标共同出现时，目标和类型必须由同一个 relation 对象满足。
   - 先把关系结果转为 ID 条件，再与 status、alignment 和重复 tags 的 AND 相交；该交集发生在排序、分页或文本匹配之前。合法空集合成功返回空结果。
7. content search 的范围和 snapshot 固定如下：
   - 同一当前可信索引 snapshot 依次完成目标解析、关系和其他结构筛选、显式 `sourcePath` 列表与唯一 `sourcePath → ID` 映射；只在选中的权威 Markdown 中全文匹配。命中 `sourcePath` 只能由该 snapshot 反查完整 Decision ID，不得从 basename 推断身份。
   - `all` 要求规范化查询中的每个去重词至少命中一次，`any` 要求任一词；二者的词可分布在不同物理行。`phrase` 只匹配同一物理行中的连续短语。三种模式统一 NFKC、默认忽略大小写并按空白处理查询。
   - 索引缺失、损坏或不新鲜时，只有完整验证权威 Markdown 后才可从同一次只读内存投影完成目标解析、关系筛选、路径选择和 ID 反查并给出 warning；不得写入索引或混用陈旧持久索引。候选和索引 JSON 永不进入正式搜索范围。
   - 结果文件、每文件命中和预览字符受固定资源上限约束；截断必须 warning，不得将未显示的内容或无结果称为完整集合结论。
8. metadata search 只读取持久索引，并在文本匹配前应用同一结构条件。关系结构命中不进入 `matchedFields` 或 `matchedRelations`；`matchedRelations` 仍只表示实际文本命中的非空来源 summary。
9. candidates 与 show-candidate 直接扫描根目录源码，显示 `scaffoldValid` 与 `bodyReady`：单条非法 Markdown 产生 warning 并跳过，显式目标自身非法则失败；根目录、成员边界或已建立集合的索引前提错误属于集合级错误。合法 scaffold 与 body-ready candidate 都排除于正式索引。
10. 索引缺失、损坏或陈旧时只能由权威 Markdown 重建，不能反向补造 Markdown 事实。常规查询读取结构有效的持久索引，不在每次查询前重扫整个集合。
11. `new` 接收标准 ID 或 name：标准 ID 日期必须等于本次 UTC 形成日，name 自动加该日期。同日同名 ID 已存在时零写入失败，不追加随机码或序号。writer 在 candidate、active 与 archive 三个目标位置均确认 name basename 可用时优先使用 name，否则使用完整 ID basename。若会与同名 legacy ID 冲突，`new` 零写入返回 `migration-required`、legacy ID、建议 dated ID 和 rename/preflight 指引；它不隐式 rename。`new`、`sync-index` 与关系、生命周期和丢弃事务共用集合 mutation lock；其余事务边界不变。
12. `sync-index [--select <name-or-id> ...] [--write]` 无 selector 时保留全量重建；selected scope 先严格读取持久索引 baseline，再完整建立和验证当前 candidate。selector 先移除一个末尾 `.md`、按 calendar-valid ID exact 或 baseline/current name 并集唯一解析为 ID；标准 ID 不存在不得退回 name。结果保留输入顺序的原始 `selectors`，并分别按规范顺序报告解析后的 `selectedIds` 与 `changedIds`。只有 metadata 与其 revision 不变，且全部 entry/revision 变化的 ID 都被选择时，`--write` 才原子发布完整 candidate；否则零写入并要求补充选择或运行 full sync。selected check 不写入且将允许的待发布变化报告为 stale。新增、删除和显式 ID rename 必须分别选择新 ID、旧 ID、或同时选择旧/新 ID。该同步不改变 Markdown、关系或 pending，也不能代替 `stage` 或领域 rename 事务。

## CLI 诊断与 mutation 恢复

CLI 成功信息写入 stdout；失败、暂停和 warning 立即写入 stderr，只描述本次命令，不写入
持久日志、遥测或 receipt。每条失败诊断固定给出 `code`、对象、原因和下一步；有可靠系统
证据时才补充 `causeCategory` 与经过净化的 `detail`。warning 仍应按其提示核对受影响事实，
但不能替代阻断失败或改变生命周期、关系和索引事实。

只有 mutation-capable 命令的失败诊断才包含 `scope` 与 `outcome`。四种 outcome 的含义固定为：
`no-change` 表示声明范围未改变；`rolled-back` 表示失败后已恢复完整旧范围；
`partial-or-unknown` 表示无法证明范围已完整恢复，必须先对账；
`committed-cleanup-pending` 表示领域提交点已经越过但清理未完成，先检查已提交状态和残留
再进行下一次 mutation。普通查询、检查和参数错误不得附会这些字段。

诊断要求的“重试”始终由操作者在处理原因并重新观察后显式发起。不得以 `sudo` 提权，
不得自动删除锁；busy 时先等待或确认活动进程，只有确认没有活动进程后才人工检查残留锁。
恢复不完整、原因未知或范围无法对账时停止并按[维护恢复](maintenance-recovery.md)处理。

## 验证

1. `check` 验证 Markdown、ID、tags、位置与状态、关系、索引结构、新鲜度、成员一致性及候选前瞻性结构，并分别计数合法 scaffold 与 body-ready candidate；合法 scaffold 留在索引外不构成错误。
2. Agent 另行检查记录门槛、tags 是否有正文依据、摘要与正文一致性、关系是否确属直接前序、拆分或重划后继是否覆盖前序继续有效的长期含义，以及对齐是否有完整当前事实证据。
3. 工具、索引或写入恢复出现普通诊断无法解释的故障时，停止猜测并读取 [维护恢复](maintenance-recovery.md)。
