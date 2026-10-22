# 决策记录 CLI 操作契约

本文件服务调用者：解释操作前提、影响范围、结果与失败边界。查询先读来源表，再按所用命令补读搜索或追溯小节；写入先读“操作前提”，再读本次操作章节及其链接的领域规则。精确参数和默认值查 `help <command>`；长期判断与内容规则由 [SKILL.md](../SKILL.md)及[决策记录规则](decision-record-rules.md)承接。

## 定位与选择

在目标工作区根目录调用脚本绝对路径，或使用项目提供的维护入口。从其他目录调用时，在 command 前显式传 `--root <workspace-root>`。`--decisions-dir` 是工作区内相对集合路径，默认 `docs/decisions`；集合整体不存在时视为尚未初始化。

selector 移除一次大小写不敏感的末尾 `.md` 后，标准日期 ID 只精确匹配完整 ID，其余输入精确查 name。零项失败，多项报告歧义，一项收敛为完整 ID。路径只进入明确的定位参数，后续操作使用完整 ID。

`help [command]` 与 `<command> --help` 只显示帮助，不读取集合状态；省略 command 显示顶层帮助并以参数错误结束。

## 查询与结果解释

先按[定位与选择](#定位与选择)确认集合。普通查询不要求先同步；结果按下表解释。

| 目的与入口 | 来源与边界 |
| --- | --- |
| `list`、`trace`、`search --in metadata` | 结构合法的最后发布索引快照，不核对当前 Markdown；索引缺失、损坏或 definition 不符时失败并显式恢复。 |
| `show` | 索引定位并确认当前文件仍声明目标 ID，返回当前正文；与发布 revision 不同则 warning。只证明所选记录。 |
| 默认 content `search` | 发布索引选定范围内的当前文件文本；读取时核对 ID。未同步新增和筛选变化在同步后进入范围；索引不可用时明确恢复。 |
| `candidates`、`show-candidate` | 从来源读取候选，分别报告结构与正文 readiness。单条非法来源可 warning 后跳过，显式目标非法或集合成员、索引前提错误仍失败。 |

`list` 与 `search` 默认查 active、全部 alignment；查历史时显式筛选。状态、alignment、tags、时间和关系条件取交集，重复 tags 为 AND，时间边界包含端点。空页只说明本次筛选与窗口无结果。`--related-to` 的方向相对目标解释，type 与 target 同用时须命中同一条边。

### 搜索

- content 匹配文件物理行；metadata 匹配发布快照的 ID、name、title、三项摘要、tags 与来源关系 summary。`all`/`any` 可跨同一记录的段，`phrase` 限于单段；匹配统一 NFKC、忽略大小写并按空白处理。
- metadata 默认返回前 100 条，`--limit 1..1000` 调整返回窗口；始终扫描全部筛选记录并给出精确命中数。content 返回上限保持 20，不接受 `--limit`。
- 关系条件返回的 `filterRelations` 是导致记录命中的边；文本证据单独报告。`matchedRelations: none` 不否定关系筛选命中。普通预览最多显示三条命中边，`list --detail` 展开当前页全部命中边；完整正文与关系用 `show`。
- 先读六行 `Query`、`Filters`、`Source`、`Limits`、`Counts`、`Coverage`，确认实际条件、来源、计数和三类覆盖。content 的 source 为 `published-index+current-text / unchecked / false`：范围来自发布投影，文本是本次读取，未验证全集来源新鲜度，也不承诺跨文件原子快照。

| 覆盖 | 含义 |
| --- | --- |
| `scanComplete` | 待匹配记录是否全部检查；未完成时 `matched` 为下界。 |
| `resultsComplete` | 是否完整扫描并返回全部命中；metadata 超过返回窗口时为 false，精确命中数仍完整。 |
| `previewsComplete` | 已返回记录的命中片段是否完整；metadata 不适用。仅预览受限不表示记录发现不完整。 |

发布范围或扫描未完成时，不能对当前全集作“没有相关决策”的结论。预算 warning 区分结果与预览限制；索引缺失、损坏或不兼容时显式恢复。需要更多命中时收紧筛选，或用 metadata `--limit` 扩大窗口；完整内容用 `show`，外部展示仍可能截断 stdout。

### 追溯演进

`trace` 默认显示关系图，`--json` 返回同一查询切片。默认双向、深度 5、最多 50 条记录；用 `--depth all` 或 `--max-records` 按需扩展。

- `* trace` 为实际遍历成员；`~ context` 只为闭合拆分、纯归并或重划事件补入，不递归扩展。
- entry 保留完整直接关系，target 可以在切片外；终端图只展开切片内部边。切片外关系不是缺失证明。
- 先检查 `coverage`、`frontier` 和可选 `blockedEvent`。frontier 提供后续查询的 anchor 与方向，不是 cursor；多记录事件预算不足时整体停止，提高到 `requiredMaxRecords` 后重查。
- 已读取但没有摘要的边显示 `[无摘要]`；工具不推断摘要。查询成功只证明所读快照，当前适用性仍须核对事实来源。

## 操作前提

1. 按[定位与选择](#定位与选择)确认集合和完整 ID，读取本次涉及的[身份与正文](decision-record-rules.md#记录身份与集合)、[生命周期](decision-record-rules.md#生命周期与对齐)及[演进关系](decision-record-rules.md#演进关系)。
2. 确认当前授权包含对象及影响；一般语义审核由 agent 自行完成，高风险删除仍需精确授权。readiness、预检和历史确认参数均不代替语义审核或授权。
3. 工作区 mutation 共用集合锁，写前核对来源与相关版本。已建立记录的生命周期、alignment、关系、删除和身份通过 CLI 事务维护；正文与 tags 的编辑性修正按领域规则直接编辑后同步。
4. `--preflight` 只预演本次完整输入，不保存执行凭据；正式执行重新提供参数、读取和验证。同步预检可使用短暂集合锁，但不写持久领域文件、索引或 pending。
5. 普通 publish、无删除的 evolve、mark-aligned、archive、reactivate 和 set-relations 严格验证发布索引、所选来源与必要依赖及最终领域图；未读取来源的手改问题交给显式 check／sync 发现。已知正式手改先同步，删除、身份更正及其组合保持完整来源验收。
6. 按[结果与恢复](#结果与恢复)判断实际写入，局部成功只证明声明范围。需要当前全集健康结论时在批次验收运行严格 `check`；起草与只读任务按实际覆盖交付。首次候选集合按恢复手册处理；非法 alignment 按[原位字段恢复](maintenance-recovery.md#已建立-alignment-无效)修复。

### Git 历史确认

CLI 自行检查 Git 门禁，调用方直接执行操作并响应实际诊断：

- 单独 archive 的目标，或关系事务所选后继最终关系中的任一已建立前序尚未进入 HEAD 时，先零写入暂停。自行复核独立回放价值和当前授权后，可显式选择 `--keep-unrecorded-history`；关键判断仍缺失时再询问。
- 前序 active 或 archived 均适用；已提交记录也须接受相同语义审查。unborn HEAD 视为空基线，非 Git 工作区没有此门禁。
- 已记录对象的删除与身份更正使用各自专用确认，不能用保留历史参数替代。

## 创建与继续候选

创建前读[正文与候选准备](decision-record-rules.md#正文与候选准备)。`new` 从显式 metadata 原子、不覆盖地创建候选：name 自动加本次 UTC 日期，完整 ID 的日期须同日；同日同名冲突零写入，同名 legacy ID 冲突按 `migration-required` 显式处理。

候选、active 与 archive 位置均可用时优先 name basename，否则用完整 ID。创建成功回显完整 ID、路径及 scaffold/body readiness；随后继续编辑该候选。创建只核对自身输入、安全路径和不覆盖条件，readiness 未就绪不撤销创建；全局身份与关系冲突由正式发布门禁确认。

`show-candidate` 核对所选候选与必要直接依赖，不证明正式全集健康。候选结构、正文、语义审核和建立授权各自成立后，再进入生命周期操作。

## 建立与生命周期

先读[生命周期与对齐](decision-record-rules.md#生命周期与对齐)，有演进时读[关系与语义闭合](decision-record-rules.md#演进关系)。

| 操作 | 前提与效果 |
| --- | --- |
| `publish` | 只建立单个 body-ready candidate，按其 Markdown 关系写入非空 alignment、不可变 createdAt，并归档活动前序。 |
| `evolve` | 显式选择完整后继集合，统一处理各自最终关系、候选建立、活动前序归档及可选删除；拆分与重划须闭合。 |
| `mark-aligned` | 完整未来方向已成为当前事实并经核对后，将 active unaligned 标为 aligned。 |
| `archive` | 退出当前依据，保留最后 alignment 与历史；按实际 Git 门禁复核回放价值。 |
| `reactivate` | archived → active，由参数显式确认 alignment，保留 createdAt 和既有关系，不接受关系覆盖。 |

已有合法空索引时以其为基线；首次 publish 无索引时须确认正式集合为空。已有正式来源却无有效索引时先显式恢复与同步。需要写前审阅预计关系时运行 `publish`/`evolve --preflight`，正式执行仍重新验证。需要不同后继关系、替换摘要或清空时继续读下一节；只修正式关系且生命周期不变时用 `set-relations`。

## 关系输入与核对

先读[演进关系与闭合](decision-record-rules.md#演进关系)。`evolve` 用重复 `--successor` 选择完整事件成员，每个成员可以有不同最终关系。

| 输入意图 | 最终关系 |
| --- | --- |
| `publish`，或 evolve 省略全部覆盖选项 | 保留每个后继 Markdown 的完整 relations 与 summary；候选首次建立优先使用此路径。 |
| evolve 无分组的 `--relation` 与可选 `--relation-summary` | 同一完整 replacement 应用于所有已选后继。 |
| evolve 无分组的 `--clear-relations` | 所有已选后继使用空集合。 |
| `--source <selector>` 分组 | 该组提供所属 source 的完整 replacement；未分组的 evolve 后继保留原值。 |

分组从 `--source` 到下一个 source 或命令结束；只有 relation、summary、clear 随组归属，其他选项作用于整个事务。统一覆盖与分组互斥。每个组必须唯一指向已选后继，提供全部最终关系或明确清空。

`--relation-summary <selector=summary>` 按首个 `=` 分隔并绑定同组唯一 target，后续 `=` 属于摘要；可在组内关系前后出现。完整替换不合并旧关系，未提供摘要的边移除旧摘要。重复 source/target、空组、只含摘要、clear 混用和失配按实际参数或领域诊断处理。

### 正式关系原地维护

`set-relations` 用 `--source` 分组完整替换一个或多个已建立记录的关系，并同步派生索引。候选关系仍在候选正文中编辑。

该操作只改变正式 relations 和索引，保留 status、alignment、createdAt、其他 metadata、正文及 pending；不建立候选或归档前序。最终 target 必须已归档并满足图约束；需要指向活动前序、建立后继或组合删除时用 `evolve`。多个 source 在同一事务中验证和写入，失败按实际恢复范围报告。

### 核对结果

`publish`、`evolve` 和 `set-relations` 的预检及正式成功都返回完整 `relationReview`：

- 每个 source 给出准备阶段的完整 `before`、规范化完整 `after` 和 `action`，空集合为 `[]`；覆盖全部所选成员，包括未分组和关系未变者。
- 新候选为 `establish`，正式记录为 `replace` 或 `unchanged`；分别核对关系新增、移除及摘要变化。
- `phase=preflight` 只表示预计结果，`phase=committed` 才证明正式成功；失败不附成功 review。reactivate 保留关系，不进入该核对。

## 身份更正与删除

### 更正身份

`rename` 同一事务改写目标 ID、全部受管 candidate/established relation target、sourcePath 和完整索引，保留状态、alignment、createdAt、正文、关系类型与摘要，不自动暂存。

- source 按普通 selector；target 是标准 ID 或合法 kebab-case name。
- 标准 source 保留原日期；legacy established 用 createdAt 的 UTC 日；legacy candidate 需显式完整 dated target，name-only 返回 `date-required`。
- ID、name 和目标位置须无冲突；同生命周期优先 name basename，其次完整 ID，两者占用则零写入。
- `--preflight` 预演同一检查；目标已进入 HEAD 时，正式执行按诊断确认 `--rename-recorded-decision`，范围只限当前工作树。

### 删除

`discard` 删除完整、结构合法且最终集合中无剩余引用的 candidate、active 或 archived。`evolve --discard <id>` 可原子组合演进与删除；被删 ID 与所选后继互斥，最终关系移除该 ID，并满足普通闭合规则。

HEAD 已记录目标时，首次不带 `--delete-recorded` 的调用在其他条件通过后零写入暂停。取得覆盖目标与影响的授权后按提示重试；该参数不绕过同次 evolve 的其他历史确认。非 Git、unborn HEAD 或未被 HEAD 记录的 ID 无此门禁；没有确认参数且 HEAD 不可读时仍零写入停止。成功交付为实际删除，而非归档。

## 检查与同步

严格 `check` 验证 Markdown、身份、tags、状态位置、关系、索引结构与新鲜度，区分 scaffold 与 body-ready candidate。首次仅有候选的集合按[恢复手册](maintenance-recovery.md#状态分流)检查，不提前同步索引。

已知合法正式来源变化先 `sync-index`；任务要求当前全集结论或正在恢复集合时再严格检查。未解释异常先检查诊断。来源合法而索引缺失、损坏、陈旧或 definition 过期时全量重建；非法来源先恢复，索引和默认值不能补造 alignment。

`sync-index` 默认写入并发布完整索引，`--preflight` 对同一验证与漂移保护零持久写入预演。成功区分可重建但未发布、索引已 current 和实际已写入。

同一工作批次的正文或 tags 编辑可共同完成，再统一 `sync-index`，按任务的全集验收要求安排严格 `check`；进入依赖发布投影的事务前先同步。关系与生命周期变化使用 `evolve` 或 `set-relations` 的多对象输入，减少重复准备。预检和正式执行各自重新验证，批次边界由调用方明确选择。

选择性同步同样完整验证，适用于可信 baseline 上的已知合法变化：

1. 集合 metadata 与其 revision 不变；definition 升级使用全量同步。
2. selector 从 baseline 与待发布投影的 name 映射并集解析。
3. 全部变化 ID 都选中：新增选新 ID，删除选旧 ID，身份更正同选旧、新 ID。
4. 仍发布完整投影；未选变化、未知 ID 或坏 baseline 零写入停止，补充选择或显式全量同步。

## 待提交快照

`stage <selector...> --scope ...` 只构造 Git pending，不改变生命周期或代替同步。显式选择即用当前完整版本刷新所选对象，未选 pending 保持；已有部分暂存会被该对象在指定 scope 内的完整版本取代。

从 HEAD、工作区发布投影与必要 pending 身份解析 ID／name；位置变化选同一 ID，删除选旧 ID，身份更正同选旧、新 ID。领域 scope 还识别仅 pending 存在的来源，并清理上次暂存留下的旧位置。

| scope | 写入与保留 |
| --- | --- |
| `all`（默认） | 原子组合所选发布投影与正式 Markdown；未选条目沿用 pending，而非 HEAD。 |
| `index` | 只刷新所选发布投影及来源 revision；payload 验收限于本次消费或修改的索引文件，不读取工作区正文。调用方负责配套领域暂存与正文验证。 |
| `domain` | 只刷新所选正式 Markdown，保留 pending 索引原字节（即使损坏）或缺失状态。 |

HEAD 与工作区发布索引必须合法；index／all 还验证 pending 索引，并要求存在的三方索引具有相同集合 metadata、sourceRevision.metadata 与 definition。HEAD 与 pending 都无索引时从空发布基底组合；已有 HEAD 索引而 pending 将其删除时，index／all 提示先恢复该删除。坏基线走显式恢复，不隐式重建全部 HEAD 正文。

`all`／`domain` 的所选现存正文须符合工作区发布投影；合法手改先同步。index／all 的最终合成图必须合法，必要依赖缺失时提示补选，不自动夹带未选对象。domain 只证明领域文件范围，不证明 pending 索引与正文已配套。stage 核对所选已知受管位置，未知位置的未同步身份重现由显式 check／sync 发现。

准备阶段取得 scope 所需来源、成员、工作区索引、HEAD 与完整受管 pending 身份；写前独立重取可变事实，锁内执行 HEAD 与 pending 的比较并交换（CAS），写后验证目标并保护范围外状态。各阶段按 scope 验收 payload：`index` 只验收所需索引内容，其余 pending 成员以完整路径、文件模式与对象 ID 保护身份；`all`／`domain` 验收完整受管 pending 的实际 payload。所需读取失败或保护范围漂移时停止，未变化结果也须通过保护检查。

原子更新保留未选领域文件的字节、表示及 staged 删除。`index` 的非索引保证限于身份保持，不证明这些 payload 即时可读或指纹有效，正文内容验证由调用方配套完成。可连续 stage A、stage B，再修改 A 并重选 A；B 始终保留原 pending。索引 JSON 可规范化序列化，未选条目含义保持。

结果报告实际写入路径、保留范围及调用方责任。成功只证明 scope，stage 不提交或推送。

## 结果与恢复

成功输出在 stdout，失败、暂停和 warning 在 stderr。退出码：0 成功，1 生命周期选择暂停、阻断验证或操作失败，2 参数错误。创建成功但 readiness 未就绪仍是候选已创建的事实。

| mutation outcome | 可确认状态与下一步 |
| --- | --- |
| `no-change` | 声明范围未改变，处理前置条件后重新观察。 |
| `rolled-back` | 旧范围已完整恢复，复核后再决定重试。 |
| `partial-or-unknown` | 无法证明完整恢复，停止后续 mutation 并对账。 |
| `committed-cleanup-pending` | 已越过提交点，先对账完成变化与清理残留。 |

scope/outcome 只说明声明范围。普通查询、检查或参数错误不附会写入结果。权限、锁、中断与非法来源恢复统一按[维护恢复](maintenance-recovery.md)执行。
