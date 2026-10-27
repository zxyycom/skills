# 决策记录 CLI 操作契约

本文件服务调用者：解释操作前提、影响范围、结果与失败边界。查询先读来源表，再按所用命令补读搜索或追溯小节；写入先读“操作前提”，再读本次操作章节及其链接的领域规则。精确参数和默认值查 `help <command>`；长期判断与内容规则由 [SKILL.md](../SKILL.md)及[决策记录规则](decision-record-rules.md)承接。

## 定位与选择

在目标工作区根目录调用脚本绝对路径，或使用项目提供的维护入口。从其他目录调用时，在 command 前显式传 `--root <workspace-root>`。`--decisions-dir` 是工作区内相对集合路径，默认 `docs/decisions`；集合整体不存在时视为尚未初始化。

selector 移除一次大小写不敏感的末尾 `.md` 后，标准日期 ID 只精确匹配完整 ID，其余输入精确查 name。零项失败，多项报告歧义，一项收敛为完整 ID。路径只进入明确的定位参数，后续操作使用已解析 ID。

legacy ID 的字面值也是 name 查询键，与日期 ID 同名时可能歧义，追加 `.md` 也不消歧。只读时可从 list／索引取得 sourcePath 后读取已知文件；需要 mutation 时，另按授权处理身份或定位。旧来源仍兼容，新建不以迁移旧来源为前置。

`help [command]` 与 `<command> --help` 只显示帮助，不读取集合状态；省略 command 显示顶层帮助并以参数错误结束。

## 查询与结果解释

先按[定位与选择](#定位与选择)确认集合。普通查询不要求先同步；结果按下表解释。

| 目的与入口 | 来源与边界 |
| --- | --- |
| `list`、`trace`、`search --in metadata` | 结构合法的最后发布索引快照，不核对当前 Markdown；索引缺失、损坏或 definition 不符时失败并显式恢复。 |
| `show` | 索引定位并确认当前文件仍声明目标 ID，返回当前正文；与发布 revision 不同则 warning。只证明所选记录。 |
| 默认 content `search` | 发布索引选定范围内的当前文件文本；读取时核对 ID。未同步新增和筛选变化在同步后进入范围；索引不可用时明确恢复。 |
| `candidates`、`show-candidate` | 从来源读取候选，分别报告结构与正文 readiness。单条非法来源可 warning 后跳过，显式目标非法或集合成员、索引前提错误仍失败。 |

无关系条件的 list、metadata、show 和 content 只验严格索引结构、字段、definition 及实际读取的来源/直接依赖；完整关系图不作前置。使用关系条件或 trace 时验证完整发布图，同一投影只准备和证明一次。普通发现成功不声明当前全集健康，全集体检由全量 check／sync-index 承担。

show 安全读取来源，核对读取内容的 frontmatter ID 与所选身份，并严格解码 UTF-8；越界、路径替换或非法 UTF-8 失败。返回完整正文，不受搜索/preview 预算限制。

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
4. `--preflight` 只预演本次完整输入，不保存执行凭据；正式执行重新提供参数、读取和验证。领域事务预检不持有写锁，即使合作锁忙也先按本次输入验证；预检不写入文件、索引、pending 或执行凭据。正式执行在写锁内重新准备，并独立核对写前所选来源、实际写集与索引；`unchanged` 也不能跳过其适用范围的保护。
5. 普通创建、候选读取、publish、evolve、mark-aligned、archive、reactivate、set-relations、discard 和 rename 使用合法发布索引与本次所选、实际改写的正文。关系、状态和正式引用者发现由索引提供，纯索引依赖不另读正文；活动前序归档和正式引用改写的来源须独立验收。未选正文的手改或损坏不代表本次局部操作失败；已知所选正式手改先同步。
6. 按[结果与恢复](#结果与恢复)判断实际写入，局部成功只证明声明范围。需要当前全集健康结论时在批次验收运行严格 `check`；起草与只读任务按实际覆盖交付。首次候选集合按恢复手册处理；非法 alignment 按[原位字段恢复](maintenance-recovery.md#已建立-alignment-无效)修复。

### Git 历史确认

CLI 自行检查 Git 门禁，调用方直接执行操作并响应实际诊断：

- 单独 archive 的目标，或关系事务所选后继最终关系中的任一已建立前序尚未进入 HEAD 时，先零写入暂停。自行复核独立回放价值和当前授权后，可显式选择 `--keep-unrecorded-history`；关键判断仍缺失时再询问。
- 前序 active 或 archived 均适用；已提交记录也须接受相同语义审查。unborn HEAD 视为空基线，非 Git 工作区没有此门禁。
- 已记录对象的删除与身份更正使用各自专用确认，不能用保留历史参数替代。
- 历史身份由合法 HEAD 索引定位，仅读取本次历史门禁所需对象；所选候选不在正式索引时可核对其已知来源位置。HEAD 有来源却缺少合法索引时明确恢复，不能全集读取 Git blob 兜底为未记录。

## 创建与继续候选

创建前读[正文与候选准备](decision-record-rules.md#正文与候选准备)。`new` 从显式 metadata 原子、不覆盖地创建候选：name 自动加本次 UTC 日期，完整 ID 的日期须同日；完整 ID 冲突零覆盖失败；跨日或 legacy 同名可继续新建，不要求先迁移。name 只是可能歧义的选择键。

新建使用完整 ID 的 `<decision-id>.md` basename，目标已占用时不覆盖。旧任意合法 basename 仍通过索引或候选发现定位，不批量迁移。创建成功回显完整 ID、路径及 scaffold/body readiness；随后继续编辑该候选。创建核对输入、可见身份冲突、集合安全与不覆盖条件，readiness 未就绪不撤销创建；正式发布保留候选 ID，在发布索引和本次所选来源上验证身份与最终关系图，不替未选正文证明当前性。

`new` 的关系完整 target ID 只验领域 ID 语法，允许以后创建；target name 在候选与可见正式身份的集合中必须唯一，零项或歧义失败。此规则也适用于关系摘要的 target。

正式身份/位置优先来自合法发布索引；只有索引真正缺失时才作安全 header 身份发现。已有坏或不兼容索引必须显式恢复，具体范围和失败条件见[候选身份发现与索引状态](maintenance-recovery.md#候选身份发现与索引状态)。

`show-candidate` 只在候选中选择，不因同名正式项产生歧义；核对所选候选自身，已发布关系目标只使用合法索引事实，不读取其当前正文；不证明正式全集健康。完整 ID 优先定位 canonical 候选，旧任意 basename 或 name 选择按必要候选身份发现处理，不扩展为正式正文扫描。候选列表对单份可分类候选的非法内容或结构 warning 后跳过，显式选中则失败；坏正文中仍能确定的合法 ID 继续参与冲突检测。不安全路径、非普通成员、可见重复 ID、集合位置冲突和必要依赖失败不能降为 warning。候选结构、正文、语义审核和建立授权各自成立后，再进入生命周期操作。

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

`rename` 同一事务改写所选目标 ID、索引可见的正式 relation target、sourcePath 和完整索引，保留状态、alignment、createdAt、正文、关系类型与摘要，不自动暂存。

- source 按普通 selector；target 是标准 ID 或合法 kebab-case name。
- 标准 source 保留原日期；legacy established 用 createdAt 的 UTC 日；legacy candidate 需显式完整 dated target，name-only 返回 `date-required`。
- 完整 ID 和目标位置须无冲突，允许不同日期或 legacy 同名；同生命周期优先 name basename，其次完整 ID，两者占用则零写入。
- `--preflight` 预演同一检查；目标已进入 HEAD 时，正式执行按诊断确认 `--rename-recorded-decision`，范围只限当前工作树。

同 ID、同 sourcePath 的真正 no-op 完成必要身份、安全及可见冲突核对后零写入，不规范化正文、索引或 mode，也不要求历史更名确认。实际 rename 从发布索引发现正式引用者，只读取所选来源和真正改写者，并进行适用的历史验收；未选候选不自动改写。

### 删除

`discard` 删除完整、结构合法且最终发布图中无剩余引用的 candidate、active 或 archived。`evolve --discard <id>` 可原子组合演进与删除；被删 ID 与所选后继互斥，最终关系移除该 ID，并满足普通闭合规则。

HEAD 已记录目标时，首次不带 `--delete-recorded` 的调用在其他条件通过后零写入暂停。取得覆盖目标与影响的授权后按提示重试；该参数不绕过同次 evolve 的其他历史确认。非 Git、unborn HEAD 或未被 HEAD 记录的 ID 无此门禁；没有确认参数且 HEAD 不可读时仍零写入停止。成功交付为实际删除，而非归档。

删除或更名只检查正式发布图及同次事务显式选择的候选。未选候选的关系不自动检查或改写，其过期引用在未来 publish 时诊断；需共同修改时使用现有 evolve 后继／source 分组可表达的完整输入，不暗示独立 rename/discard 支持批量候选修复。

候选 rename/discard 不创建或改写正式索引；删除最后一条正式记录保留合法空索引，供后续查询与 publish 使用。

## 检查与同步

严格 `check` 验证 Markdown、身份、tags、状态位置、关系、索引结构与新鲜度，区分 scaffold 与 body-ready candidate。首次仅有候选的集合按[恢复手册](maintenance-recovery.md#状态分流)检查，不提前同步索引。

全量只读 `check` 比较安全取得的成员身份与来源内容和完整预期索引；成功只证明本次取得的事实，不保证结束新鲜度或跨文件原子快照。读取中的路径或身份替换仍拒绝；sync 与写事务另行核对当前事实。

已知合法正式来源变化先 `sync-index`；任务要求当前全集结论或正在恢复集合时再严格检查。未解释异常先检查诊断。来源合法而索引缺失、损坏、陈旧或 definition 过期时全量重建；非法来源先恢复，索引和默认值不能补造 alignment。

`sync-index` 默认写入并发布完整索引，`--preflight` 对同一验证与漂移保护零持久写入预演。成功区分可重建但未发布、索引已 current 和实际已写入。

同一工作批次的正文或 tags 编辑可共同完成，再统一 `sync-index`，按任务的全集验收要求安排严格 `check`；进入依赖发布投影的事务前先同步。关系与生命周期变化使用 `evolve` 或 `set-relations` 的多对象输入，减少重复准备。预检和正式执行各自重新验证，批次边界由调用方明确选择。

### 选择性同步

`sync-index --select` 在可信发布基线上接纳局部当前来源，仍发布完整索引。需要发现未知位置变化或取得当前全集来源结论时，使用全量 sync/check。

| 环节 | 范围与要求 |
| --- | --- |
| 基线 | 严格加载合法、canonical、当前 definition 的 baseline；缺失、损坏或不兼容时显式全量恢复，不当空基线。集合 metadata 及其 revision 保持不变。 |
| 选择与依赖 | name 从 baseline 解析；标准完整 ID 可作为已知路径内身份更正的待证身份。读取所选 baseline 已知 sourcePath、前后直接关系邻居及完整演进事件所需依赖。必要未选依赖须匹配发布投影与来源 revision，否则显式补选或全量同步。 |
| 已知路径缺失 | 按所选删除处理，完整组合图仍须合法；旧位置缺失不能区分实际删除与未知位置移动。 |
| 同路径改 ID | 显式同选旧、新 ID，以本次已读 locator 证明新身份与位置唯一；没有已读位置证明的新 ID 要求全量同步。 |
| 未读范围 | 未选条目与 revision 沿用发布事实。未知位置的新增、移动、重复身份或未同步新引用由全量 sync/check 发现；无关未选正文变化不一定阻断本次同步。 |
| 发布保护 | 验收完整组合索引与关系图，以及原生 baseline、metadata 和选择保护；写前独立重读本次来源、必要依赖及实际 baseline，unchanged 也须通过。写入发布完整索引并 readback。 |

成功 `coverage` 显式报告：

- `source: published-index+selected-current-sources`；
- `currentness: selected-and-dependencies`，未选来源当前性未检查；
- 排序后的 `checkedIds`：所选身份标签及实际读取的必要依赖，包括缺失删除和同路径改 ID 的旧、新 ID。标签不保证当前存在，也不表示未知位置发现完整。

CLI 同时说明上述覆盖边界。

## 待提交快照

`stage <selector...> --scope ...` 构造 Git pending，不提交或推送；显式选择会以当前完整版本刷新所选对象的相应 scope，未选 pending 保持，所选已有部分暂存会被完整版本取代。

| scope | 作用与责任 |
| --- | --- |
| `all`（默认） | 原子刷新所选发布投影与正式 Markdown。 |
| `index` | 只刷新所选投影及来源 revision；调用方配套暂存和验证领域内容。 |
| `domain` | 只刷新所选正式 Markdown，保留 pending 索引，不证明二者配套。 |

位置变化选同一 ID，删除选旧 ID，身份更正同选旧、新 ID。操作基于 HEAD、工作区和 pending 的可信身份与路径；写前独立核对当前事实，写后验收实际目标并保护未选 pending。精确定位、scope 保护、失败和恢复条件见[待提交快照操作契约](stage-snapshot.md)，执行前须完整读取。

## 结果与恢复

成功输出在 stdout，失败、暂停和 warning 在 stderr。退出码：0 成功，1 生命周期选择暂停、阻断验证或操作失败，2 参数错误。创建成功但 readiness 未就绪仍是候选已创建的事实。

| mutation outcome | 可确认状态与下一步 |
| --- | --- |
| `no-change` | 声明范围未改变，处理前置条件后重新观察。 |
| `rolled-back` | 提交前失败且旧范围已完整恢复，复核后再决定重试。 |
| `partial-or-unknown` | 无法证明完整恢复，或已提交但写后验收失败/未知；保留已知提交和实际路径，停止后续 mutation 并对账。 |
| `committed-cleanup-pending` | 已提交且验收通过，仅清理或解锁未完成；先对账完成变化与精确残留。 |

非 stage 的正式事务以实际索引发布为提交点；候选创建以安全独占建立为提交点，更名以目标写集建立且旧位置退出为提交点，删除以对象退出受管集合为提交点。正常成功还须独立验收实际 bytes、identity、mode 及相关来源、成员；writer 返回不等于验收通过。stage 的 pending 提交与保护按[待提交快照](#待提交快照)执行。

越过提交点后不自动回滚。清理或解锁失败返回非零，保留真实 mutation、ID 和 sourcePath；候选已创建不能报告为未创建或建议直接重做 new。验收与清理同时失败时分别诊断，以验收失败/未知为主要事实，不附成功 review。

scope/outcome 只说明声明范围。普通查询、检查、readiness、预检和参数错误不附会写入结果；无写入而解锁失败仍非零，但不虚构 committed。权限、锁、中断及 CAS 恢复按[维护恢复](maintenance-recovery.md#中断写入)执行。
