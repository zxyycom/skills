# Design

本设计以报告作为唯一调查记录单位，用 tags 解开分类与身份，用显式有向无环关系图替代主题内隐式线性演进，并通过专用关系事务降低既有报告关系维护压力。

## Context

- 本 Change 的 artifacts 使用同一消费契约：proposal 拥有 Outcome、范围和成功标准；本 design 拥有已经确认的目标模型、领域边界与取舍；tasks 拥有实施顺序和验证出口。当前代码、旧格式和既有决策是迁移基线，不会覆盖本 design 的目标状态；实施发现目标必须改变时，先同步修订三个 artifacts，再继续任务。
- 当前固定契约把 `docs/investigations/<category-id>/<semantic-slug>.md` 作为 topic ID；每个 topic 保存一个核心问题、继续调查状态、最新报告时间和一组按形成时间追加的 H3 报告，派生索引 definition 5 也以 topic 为 entry。
- 2026-08-28 的审计基线包含 12 个 topic Markdown、33 份合法 H3 报告和 5 个版本控制可见资源。[`migration-manifest.json`](migration-manifest.json) 已保存逐报告与逐资源映射、内容指纹和当前 source revision；实施写入前只需先比较 revision，发生漂移时重新审阅受影响行。
- [`maintain-topic-level-investigation-index`](../../docs/decisions/maintain-topic-level-investigation-index.md) 明确选择 topic 级身份与索引；[`use-fixed-investigation-record-core`](../../docs/decisions/use-fixed-investigation-record-core.md) 同时拥有仍需保留的四段固定核心和将被取消的主题追加模型。资源 owner、索引 revision、未引用资源诊断与选择性暂存也分别由现行决策承接。
- 调查报告记录形成时认识，不自动成为当前事实、长期采用方向或实施授权。Decision Records 的 archive 用来区分当前约束与历史决定；调查报告没有这个区分需要，推翻关系也不应让历史报告退出正常发现路径。
- 当前 Decision Records 已实现边索引、双向 trace 与环检测，但相关代码也绑定 Decision ID、archived 目标、关系形状和生命周期事务。共享算法可以抽取，领域关系类型和生命周期不能整体复用。
- 调查资源当前以 topic path 为 owner 前缀，资源字节不进入主题索引 revision，被引用资源严格校验，完全未引用的可见资源只产生 warning。这些责任继续成立，但 owner 和引用投影必须改为报告级。
- 已归档的 Decision Records 标签化 Change 已明确不建立跨资源全局文件名规则。Investigation ID 只需在 Investigation Report 集合内唯一；本 Change 不依赖 Test Evidence 标签化 Change，也不创建跨资源统一 CRUD 或全局 ID namespace。

## Goals / Non-Goals

目标：

- 让每份报告拥有稳定、可直接查询和建立关系的独立身份，不再受主题容器或 category 路径限制。
- 让一份报告通过多个 tags 表达分类，并通过直接前序关系表达补充、复查、修正、推翻、归并和拆分。
- 保留形成时背景、调查目的、调查范围与依据、调查结果与边界四项固定核心，以及资源证据的可定位复核能力。
- 让所有正式报告永久位于同一正常集合；关系变化不产生归档、隐藏或隐式当前状态。
- 提供受控的关系完整替换命令，使日常调整不依赖手工编辑加全量同步，同时保持 Markdown 为关系事实源、索引为可重建投影。
- 复用领域无关关系图算法，并用领域测试证明 Investigation Report 与 Decision Records 各自约束完整。
- 以一次可对账的不兼容迁移删除旧 topic/category/status/report-index 模型和兼容负担。

非目标：

- 不建立候选、活动、归档、对齐、暂停或结束等报告生命周期。
- 不把最新叶节点、最新时间或某种关系自动解释为当前事实、综合结论或继续调查任务。
- 不建立 tag catalog、层级、别名、OR、NOT 或权重，也不从正文自动推断 tags。
- 不从时间相邻、相同 tags、普通 Markdown 链接或旧主题同文件关系自动推断演进边。
- 不让关系图代替证据引用、任务依赖、决策演进或实施映射。
- 不在本 Change 中改造 Test Evidence 的布局、标签或身份，也不建立跨资源全局文件名门禁。
- 不提供作为当前产品能力或分发内容的旧格式 reader、双写、重定向、迁移命令或升级脚本；Change 内用于清单、对账和确定性文件移动的一次性辅助物只服务本仓库迁移，并在归档前退出当前维护入口。

## Decisions

### Intended Change

目标模型可以先恢复为下表，再按后续章节读取精确约束：

| 责任 | 唯一 owner | 目标规则 |
| --- | --- | --- |
| 身份与定位 | Investigation ID | ID 是根目录直属 basename，也是唯一相对路径；不再投影 `sourcePath`。 |
| 分类 | 报告 frontmatter `tags` | 非空多值分类，不表达状态或关系。 |
| 演进 | 报告 frontmatter `relations` | 后继指向直接前序，完整集合构成有向无环图。 |
| 内容 | 单份报告 Markdown | 一份文件只保存一份形成时认识和可选资源引用。 |
| 查询 | 可重建派生索引 | 按 ID 投影 tags、时间、问题、关系和资源引用，不拥有独立事实。 |
| 生命周期 | 无 | 正式报告始终留在正常集合，推翻也不归档前序。 |

#### 报告身份、位置与格式

1. Investigation ID 是符合 `^[a-z0-9]+(?:-[a-z0-9]+)*\.md$` 的稳定 basename，在 Investigation Report 集合内唯一。报告只直属调查根目录，因此 ID 同时是唯一相对路径，索引不再保存 `sourcePath`；改 basename 是身份变化，改标题、问题、tags、关系或正文不改变 ID。
2. 正式布局只有 `investigation-index.json`、可选 `_resources/` 和根目录直属报告 Markdown。所有报告永久位于根目录，不建立 `archive/`、candidate 或其他生命周期目录；未知根成员和嵌套报告目录按目标契约拒绝。
3. 每个文件只保存一份报告。frontmatter 按 `title`、`formedAt`、`question`、`tags`、`relations` 的固定顺序提供唯一机器事实；`title` 与 `question` 都是非空单行语义文本。正文不重复 H1，前四个 H2 依次是非空的`形成时背景`、`调查目的`、`调查范围与依据`、`调查结果与边界`。
4. 规范 frontmatter 从文件首行开始并使用以下 YAML 形状；所有 scalar 都解析为 string，禁止重复或未知 key。规范 writer 对 scalar 使用 JSON 兼容的双引号与转义，空关系固定写为 `relations: []`，非空 relation 对象的 key 顺序固定为 `type`、`target`：

   ```yaml
   ---
   title: "重新检查索引来源"
   formedAt: "2026-08-28T12:00:00+00:00"
   question: "资源字节是否应影响报告索引来源版本？"
   tags:
     - "investigation-report"
   relations:
     - type: "复查"
       target: "exclude-resources-from-index-revision.md"
   ---
   ```

5. 报告声明资源时，第五个 H2 固定为只出现一次且非空的`随附资源`。章节内容是至少一个无序列表项，每项只含一个无 title 的本地 Markdown inline link；展示文字投影非空，目标原文逐字为 `./_resources/<resource-id>`，不能携带查询、片段、百分号编码、反斜杠或链接外文字。同一报告内 resource ID 唯一并按 locale 无关词法升序排列。其他可选语义 H2 只能放在固定核心和可选资源章节之后；没有资源时不创建空章节。
6. `formedAt` 使用带显式时区、无小数秒的 RFC 3339 时间戳。`question` 表达本轮直接调查的问题，不再充当跨报告稳定核心问题或身份。
7. 完整报告写入集合即建立。草稿留在当前任务或其他草稿 owner；新证据或实质认识变化创建新报告，只有当时认识未被准确保存、格式或链接错误时才原地修正文档。领域不提供 delete 命令；删除已建立报告必须由当前任务明确授权，并在同步前修复指向它的关系和受影响资源 owner。

#### Tags

1. `tags` 是至少一个 kebab-case token 的 YAML sequence；每个 token 符合 `^[a-z0-9]+(?:-[a-z0-9]+)*$`，同一报告内唯一并按 locale 无关字符串词法升序排列。
2. tags 只表达当前分类提示，不表达状态、有效性、关系、当前事实或历史演进。分类维护不改变 ID，仍需同步对应索引 entry。
3. `list` 接受可重复 `--tag`，重复条件使用 AND。当前契约不提供 tag catalog、OR、NOT、层级、别名或权重。
4. 旧 category 只作为迁移时的初始 tag 输入；额外 tags 必须有报告内容依据。迁移后不保留 category 目录、字段、key、参数或分类双写。

#### 调查演进关系

关系从新报告指向真实直接前序，使用以下封闭类型集：

| 类型 | 语义 |
| --- | --- |
| `补充` | 增加新的证据、范围、视角或更细认识，并且不否定前序核心结果；同时覆盖纵向深入和横向扩展。 |
| `复查` | 在新的时间、版本、环境、样本或约束下重新检查同一问题；关系本身不预设结果相同或不同。 |
| `修正` | 新报告纠正前序的部分事实解释、方法或结论，但没有认定其关键依据整体不足。 |
| `推翻` | 新报告确认前序的关键依据、方法或假设不足以支持其主要结果；前序仍是正式历史记录。 |
| `归并` | 综合多个直接前序形成新的完整认识。 |
| `拆分` | 将一个过粗的前序问题建立为多个可以独立调查和演进的直接后继。 |

1. 每个 target 使用 Investigation ID，必须存在、不得重复、不得自环；全图必须无环，且 target 的 `formedAt` 不得晚于 source。
2. 独立报告使用 `relations: []`。普通`补充`、`复查`、`修正`或`推翻`报告只指向一个直接前序；综合多个前序时使用纯`归并`关系集合且至少包含两个 target。
3. 每个`拆分`后继只包含一条指向同一前序的`拆分`关系且没有其他关系；被拆分前序在完整集合中至少拥有两个直接拆分后继。
4. 关系只记录认识演进。相同 tags、时间先后、普通链接、资源共享和同一旧主题不建立隐式边；间接祖先通过 trace 恢复，不重复写入每个后继。
5. `推翻`、`修正`和其他关系都不写回前序、不改变前序位置或默认可见性。反向关系由索引图按需计算，不成为前序 Markdown 的第二事实。
6. `relations` 不表达人工优先级，权威 Markdown 和索引都按上表中的类型顺序、再按 target 的 locale 无关词法顺序规范化；相同 target 不得以不同类型重复出现。

#### 关系维护命令

1. 新增公共命令：

   ```text
   set-relations \
     --source <investigation-id> \
       (--relation <type=target-id>... | --clear-relations) \
     [--source <investigation-id> ...]
   ```

2. 每个 `--source` 开始一个完整替换组，直到下一个 `--source`；组内重复 `--relation` 构成该报告的全部最终关系，`--clear-relations` 表示显式空集合。每组必须二选一，同一 source 不能重复出现，命令也不追加或推断现有关系。
3. 命令至少接受一个组，并且所有 source 都必须是已建立 Investigation ID。一次调用中的全部组共同形成一个关系图预览，因此两个或更多拆分后继可以在同一事务中建立，不需要先产生单后继拆分的非法中间状态。
4. 命令要求工作区索引结构有效且对报告源新鲜，读取完整关系图并同时套用全部替换组，验证关系类型、目标、形成时间、归并/拆分形状和无环性；无效预演不写文件。
5. 成功路径以 revision 门禁保护全部目标报告、索引和完整关系预览，在受信工作区中事务化改写所选 Markdown frontmatter 与工作区派生索引。写前来源或索引漂移必须失败；中断或发布失败必须恢复全部旧组合或返回明确恢复诊断。
6. 命令不修改 Git pending、不暂存报告或索引，也不修改 title、formedAt、question、tags、正文或资源。`stage-index` 继续单独选择派生 entry。
7. 事务按 source ID 词法顺序发布和恢复，命令行分组顺序不改变结果。全部目标关系已经与现值相同时成功返回 `changed: false`，不改写任何 Markdown 或索引字节；至少一组改变时返回 `changed: true` 和规范 source ID 列表。
8. 新报告可以在首次建立时直接声明合法关系；已建立报告的关系调整使用 `set-relations`。严格 `check` 和 `sync-index` 仍能验证并从 Markdown 恢复索引，但不再是日常关系调整的唯一公共路径。

#### 索引、查询与暂存

1. 每个 Investigation ID 产生一个 entry。state 投影 `title`、`formedAt`、`question`、`tags`、`relations` 和按规范 ID 排序的 `resourceIds`，不保存可由 ID 计算的 sourcePath、正文、反向关系副本、当前结论或资源内容摘要。
2. keys 使用 exact `tag`、range `formed-at`、exact `relation-type` 和 text `text`；text 只聚合 title 与 question。删除 category、status、latest-report-at、reportCount、reportTitles 和 reportIndex。
3. metadata 保持严格空对象。source revision 以 Investigation ID 为键，只指纹化 ID 和完整报告 Markdown；资源成员、名称与字节继续不参与索引 revision。
4. `list` 默认查询全部正式报告，按 Investigation ID 的 locale 无关词法顺序排序，再应用 offset 和 limit；支持可重复 tag AND、包含端点的形成时间范围、一个精确关系类型和 title/question 文本查询。被推翻或具有任意后继的报告不被默认隐藏。
5. `show <investigation-id>` 由调查根目录和 ID 计算目标路径后读取完整报告；`trace <investigation-id>` 支持 predecessors、successors、both 和非负 max-depth，深度 0 只返回起点。trace 节点按 ID、边按 source/类型表顺序/target 确定性排序，并从同一索引计算正反向关系子图。
6. `stage-index <investigation-id...>` 继续只构造所选报告 entry 的 pending 索引，不自动选择报告或资源；ID 改名与增加、删除选择继续服从通用 selected-entry staging 契约。
7. `check` 验证报告、完整关系图、资源与索引；scoped check 只提供局部反馈，不能证明完整图、拆分闭合、未引用资源集合或索引新鲜度。`sync-index` 对完整报告源、关系图和资源执行不要求旧索引新鲜的全量校验，再从同一份已验证 Markdown snapshot 重建工作区索引。

#### 资源 owner

1. 资源 ID 改为 `<investigation-id-without-md>/<resource-subpath>`，映射唯一 owner 报告。报告使用 `./_resources/<resource-id>` 本地链接；资源名安全、普通文件、版本控制可见性和精确大小写规则保持不变。
2. 被引用资源的 owner 报告必须存在并引用该资源；其他报告可以共享引用，不改变 owner。共享资源迁移时选择实际引入或最适合长期维护该形成时材料的报告作为 owner，不能从旧主题顺序自动决定。
3. 报告 state 直接保存该报告声明的 `resourceIds`，不再使用 reportIndex。资源链接变化改变对应报告 source revision；资源文件字节变化仍不改变查询索引 revision。
4. 被引用资源继续严格校验；完全未引用的版本控制可见资源继续 warning；ignore 排除的未跟踪资源仍不进入可见集合。

#### 不兼容迁移与长期 owner

1. 逐报告迁移清单由 [`migration-manifest.json`](migration-manifest.json) 承接，已经保存旧 topic path、旧 H3 序号与标题、目标 ID、title、formedAt、question、tags、relations、资源引用、资源 owner、正文指纹和源集合 revision。实施写入前先完成 revision 漂移门禁，迁移后用同一清单对账。
2. 单报告旧 topic 可以优先沿用有语义且无冲突的旧 basename；多报告 topic 依据各 H3 的真实认识建立语义 ID，不使用 report-1、report-2 等顺序名称。
3. 旧 topic 内相邻顺序只保留 formedAt 事实，不自动产生关系。每条目标关系都必须由报告正文和形成时条件支持；无法确认时使用空关系。
4. 删除状态前审阅`调查中`或`暂停`主题是否仍表达真实协调事项；仍需推进的工作交给当前任务、Task Graph、Change 或其他 owner，不把执行状态编码为 tags 或关系。
5. 目标 parser、Schema、CLI 与 Skill 只接受新格式。迁移清单可以作为本 Change 的审计附件，确定性移动可以使用只在实施任务内存在的一次性辅助物；它们都不是当前产品能力或分发输入，归档前不得残留为旧格式 reader、双写、redirect、symlink、迁移命令或升级入口。
6. 实施开始时先为与目标冲突的 active 决策建立最小自包含后继并通过合法 Decision Records 事务演进。仍成立的资源 revision、warning 与固定核心判断只做必要修订。

### Resulting Impacts

- **身份粒度改变全部消费面。** parser、类型、路径、索引、query、stage、CLI、Schema、source revision、测试 fixture 和项目链接都必须从 topic ID 与 reportIndex 改为 Investigation ID。
- **关系写入新增多文件一致性责任。** `set-relations` 同时修改权威 Markdown 和派生索引，需要 revision 预检、图预演、事务发布、失败恢复和并发漂移测试。
- **共享抽取可能影响 Decision Records。** 只抽取边索引、trace、缺失目标与环检测等通用原语；决策专属状态、关系形状和事务继续留在 Decision Records，并以回归测试证明无漂移。
- **物理平铺会改变链接和发现。** 根目录发现必须显式保留索引与 `_resources`，拒绝其他成员；当前维护链接和资源相对路径需要逐项更新。
- **主题执行状态需要退出或交接。** 删除状态前必须审阅仍有协调价值的调查线；交接后报告集合本身不再拥有执行状态。
- **数据迁移规模大于旧 Draft。** 当前是 33 份报告和 5 个资源，而非 12 个最终资源；ID、tags、关系和资源 owner 已逐项审阅并进入迁移清单，实施不能用旧 topic 数量替代逐报告对账。
- **既有决策必须闭合演进。** topic 级索引、主题资源 owner、主题追加和按主题暂存的 active 决策不能与新模型并存。
- **测试证据与分发需要同步。** 原生测试入口变化必须维护 Test Evidence；Skill、契约、Schema 和脚本改变需要提升版本并同步生成产物。

## Risks / Trade-offs

- 六种关系仍需要人工判断；工具只能验证结构，不能证明`补充`、`修正`或`推翻`的语义选择正确。
- 取消主题后没有累积当前口径。这是刻意边界：报告保存历史认识，当前事实、长期方向和任务分别由其 owner 承接。
- 取消状态会失去简单的“调查中”筛选；迁移审计与 owner 交接用于避免真实工作丢失，不通过叶节点重新制造隐式状态。
- 平铺大量文件降低目录浏览分组；tags、list、show 和 trace 承担发现，重新用目录分类会恢复身份与分类耦合。
- 专用关系命令引入事务与恢复成本；本 Change 接受该成本，并以完整替换、显式 source 组和不触碰 pending 收窄表面。批量 source 只用于需要同一图事务的关系调整，不扩张为通用报告编辑 API。
- 共享资源的 owner 迁移可能有歧义，需要人工选择；owner 只表达维护归属，不限制复用或证明内容可信。
- 一次性切换没有运行时退路；迁移清单、版本控制恢复和完整门禁承担回退边界。
- 并行工作可能使迁移清单过期；实施写入前必须重新盘点，并在 revision 漂移时停止。

## Open Questions

无。关系类型、无归档边界、报告级身份、非空 tags、关系事务、不兼容迁移和查询范围已经由本次讨论确认；具体 ID、tags、关系与资源 owner 映射已经由 [`migration-manifest.json`](migration-manifest.json) 固定并通过 [`readiness-audit.md`](readiness-audit.md) 审阅。
