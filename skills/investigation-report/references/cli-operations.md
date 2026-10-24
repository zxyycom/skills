# 调查报告 CLI 操作契约

本文件服务调用者：解释操作前提、影响范围、结果与失败边界。查询先读来源表，再按所用命令补读搜索或追溯小节；写入先读“操作前提”，再读本次操作章节及其链接的领域规则。精确参数和默认值查 `help <command>`；报告内容与质量由 [SKILL.md](../SKILL.md)及[固定契约](investigation-report-contract.md)承接。

## 定位与选择

在目标工作区根目录调用脚本绝对路径，或使用项目提供的维护入口。从其他目录调用时，在 command 前显式传 `--root <workspace-root>`。`--investigations-dir` 是工作区内相对集合路径，默认 `docs/investigations`；同一任务始终使用同一集合根。

selector 移除一次大小写不敏感的末尾 `.md` 后，标准日期 ID 只精确匹配完整 ID，其余输入精确查 name。零项失败，多项报告歧义，一项收敛为完整 ID。路径只进入明确的定位参数；后续操作使用返回的完整 ID。

`help [command]` 与 `<command> --help` 只显示帮助，不读取集合状态；省略 command 显示顶层帮助并以参数错误结束。

## 查询与结果解释

先按[定位与选择](#定位与选择)确认集合。普通查询不要求先同步；结果按下表解释。

| 目的与入口 | 来源与边界 |
| --- | --- |
| `list`、`trace`、`search --in metadata` | 结构合法的最后发布索引快照，不核对当前 Markdown；索引缺失、损坏或 definition 不符时失败并显式恢复。 |
| `show` | 索引定位一个普通非符号链接文件并核对 frontmatter ID，返回当前正文；与发布指纹不同则 warning。只证明所选报告。 |
| 默认 content `search` | 发布索引选定范围内的当前文件文本；读取时核对 ID。未同步新增和筛选变化在同步后进入范围；索引不可用时明确恢复。 |
| `candidates`、`show-candidate` | 未索引候选及其 readiness。局部读取不证明正式全集健康；单条非法候选可 warning 后跳过，显式目标非法或集合安全错误仍失败。 |

无关系条件的 list、metadata、show 和 content 只验严格索引结构、字段、definition 及实际读取的来源/直接依赖；完整关系图与资源 owner 全图不作前置。使用关系条件或 trace 时验证完整发布图，同一投影只准备和证明一次。普通发现成功不声明当前全集健康，全集体检由全量 check／sync-index 承担。

show 通过安全 FileHandle 对同 inode、同一读取字节核对 frontmatter ID，并严格解码 UTF-8；越界、路径替换或非法 UTF-8 失败。返回完整正文，不受搜索/preview 预算限制。

`list` 与 `search` 只查正式报告。按需筛选和展开列表窗口；空页只说明本次条件和窗口无结果。重复 tags 为 AND，形成时间边界包含端点。关系条件和其他筛选取交集；`--related-to` 的方向相对目标解释，type 与 target 同用时须命中同一条边。

### 搜索

- content 匹配当前文件的物理行；metadata 匹配发布快照的 ID、name、title、question、tags 与来源关系 summary。`all`/`any` 可跨同一报告的段，`phrase` 限于单段；匹配统一 NFKC、忽略大小写并按空白处理。
- 关系条件返回的 `filterRelations` 是导致记录命中的边；文本证据单独报告。`matchedRelations: none` 只表示没有摘要文本命中，不否定关系筛选命中。普通预览最多展示三条命中边，`list --detail` 展开当前页全部命中边；完整正文与关系用 `show`。
- 先读六行 `Query`、`Filters`、`Source`、`Limits`、`Counts`、`Coverage`，确认本次条件、来源、命中数及三类覆盖。content 的 source 为 `published-index+current-text / unchecked / false`：范围来自发布投影，文本是本次读取，未验证全集来源新鲜度，也不承诺跨文件原子快照。

| 覆盖 | 含义 |
| --- | --- |
| `scanComplete` | 待匹配记录是否全部检查；未完成时 `matched` 为下界。 |
| `resultsComplete` | 是否已完整扫描且返回全部命中；扫描完整仍可能因 limit 少返回记录。 |
| `previewsComplete` | 已返回记录的命中片段是否完整；metadata 不适用。仅预览受限不代表记录发现不完整。 |

发布范围或扫描未完成时，不能对当前全集作“没有相关报告”的结论。预算 warning 区分结果与预览限制；索引缺失、损坏或不兼容时显式恢复。需要更多命中时收紧筛选或调整允许的 limit，完整内容通过 `show` 读取；search 不提供 offset 分页。外部展示还可能截断 stdout。

### 追溯演进

`trace` 默认显示关系图，`--json` 返回同一查询切片。默认双向、深度 5、最多 50 条记录；用 `--depth all` 或 `--max-records` 按需扩展。

- `* trace` 是实际遍历成员；`~ context` 只为闭合拆分或纯归并事件补入，不递归扩展。
- entry 保留完整直接关系，target 可以在切片外；终端图只展开两端都在切片内的边。切片外边不是缺失证明。
- 先检查 `coverage`、`frontier` 和可选 `blockedEvent`。frontier 提供后续查询的 anchor 与方向，不是 cursor；多记录事件预算不足时整体停止，提高到 `requiredMaxRecords` 后重查。
- 已读取但没有摘要的边显示 `[无摘要]`；工具不推断或补写摘要。判断报告今天是否适用，仍回到当前事实来源。

## 操作前提

1. 按[定位与选择](#定位与选择)确认工作区、集合与完整 ID。读取固定契约中本次涉及的[身份](investigation-report-contract.md#身份与集合)、[关系](investigation-report-contract.md#认识演进关系)或[资源](investigation-report-contract.md#资源引用与归属)规则。
2. 确认当前任务授权了哪些对象和影响。agent 自行完成语义审核；删除等高风险操作须有覆盖精确目标与范围的授权。CLI 的历史确认参数不代替授权。
3. 工作区写入共用集合锁并在写前复核可变来源；Git pending 由 `stage` 独立维护。普通 publish／set-relations 严格验证发布索引、所选来源与必要依赖及最终领域图；无关正文手改问题由显式 check／sync 发现。已知手改先同步；删除、身份更正保持完整来源验收。
4. `--preflight` 只预演本次完整输入，不保存执行凭据；正式执行先完成参数与集合路径等轻量入口检查，取得集合锁后完整准备一次，再独立 fresh；不会自动先执行锁外完整预演。锁忙可以先于深层报告、资源或历史诊断返回。所有预检均不取得独占写锁，不写持久领域文件、索引、资源或 pending；锁忙不是预检的前置门槛。
5. 按[结果与恢复](#结果与恢复)判断实际写入，局部成功只证明声明范围。需要当前全集健康结论时在批次验收运行全量 `check`；起草与只读任务按实际覆盖交付。内容语义、写入授权与机械验证分别判断。

## 候选创建与发布

创建前读[报告正文与候选准备](investigation-report-contract.md#报告正文与候选准备)，带资源或关系时补读对应规则。

### 创建与继续候选

`new` 从显式 title、question、tags、完整直接关系和可选 formedAt 原子、不覆盖地创建 candidate。

- 当前发生的调查传不含日期前缀的 name，省略 `--formed-at`，工具取一次当前 UTC 时间并派生完整 ID。已知形成时间或补录历史调查时显式提供；完整 ID 日期必须等于 formedAt 的 UTC 日。
- 同日同名冲突零写入；同名 legacy ID 冲突按 `migration-required` 显式处理。位置可用时优先 name basename，否则用完整 ID。
- 创建核对输入、可见身份冲突、集合安全和不覆盖条件；成功回显完整 ID、路径及 readiness，随后继续编辑该候选。readiness 未就绪不撤销创建；全局身份与关系冲突由正式发布门禁确认。
- `show-candidate` 始终分别报告 `scaffoldValid`、`bodyReady`、`resourceReady`。结构合法但正文或资源未就绪仍可成功读取，语义审核和建立授权另外判断。

`new` 的完整关系 target ID 只验领域 ID 语法，目标可以后创建；target name 在候选与发布正式身份（无索引时为可见正式 header 身份）中必须唯一，零项或歧义失败。关系摘要 target 使用同一集合。自身 ID 与 formedAt 日期、同日同名、legacy、目标安全及不覆盖门槛不变。

正式身份/位置优先来自合法发布索引；只有索引真正缺失时才作安全 header 身份发现。已有坏或不兼容索引必须显式恢复，具体范围和失败条件见[候选身份发现与索引状态](maintenance-recovery.md#候选身份发现与索引状态)。

`show-candidate` 只选择候选；同名正式项不参与该 selector。列表中单份候选内容或结构错误 warning 后跳过，显式目标错误失败；合法 ID 即使正文坏也参与冲突检测。不安全路径、非普通成员、可见重复 ID、集合冲突和必要直接依赖失败仍拒绝。结构合法而正文或资源未就绪保留 readiness，不撤销创建。

创建已完成而集合锁释放失败时，CLI/SDK 返回失败、非零，并保留真实 candidate、完整 ID、path 与 `changed: true`。这与 readiness 未就绪分别判断；按[结果与恢复](#结果与恢复)核对候选及锁，不直接重试 `new`。

### 发布

1. 完成候选正文、直接关系与资源，独立审核内容可信、关系真实及资源必要安全。
2. 读取结构与领域图合法的发布基线，核对所选候选、必要前序与资源 owner 依赖；已有合法空索引时以其为基线，正式报告和索引都不存在时可首次建立。已知手工变化或索引异常按“检查与同步”处理。
3. 需要写前审阅预计影响时，用 `publish <selector...> --preflight` 预演显式候选最终集合。关系 target 来自正式基线或同批选中候选，未选候选不参与闭合。核对完整 `relationReview` 和当前 publish 授权。
4. 正式 publish 在锁内重读并验证，以不覆盖改名建立报告，再发布完整索引。未选候选和其他工作不变。

同一工作批次中已就绪且获准发布的候选优先一次 `publish <selector...>`，共同验证最终关系并只发布一次完整索引。批次不跨越需要独立验收的工作边界；各次调用仍自行读取和验证当前来源。

资源已在最终 owner 路径，发布不移动、改写或暂存资源。发布前复核路径、引用、普通文件身份与版本控制可见性；必要条件漂移时停止，单纯资源字节变化不阻断发布或使索引陈旧。

提交点、写后验收与失败后的实际状态统一按[结果与恢复](#结果与恢复)解释。

## 完整替换关系

先读[认识演进关系](investigation-report-contract.md#认识演进关系)。`set-relations` 要求当前索引，全部来源与 target 解析为正式 ID；多个来源共同预演最终图，可在一次事务中完成闭合拆分。

- 每个 `--source` 开始一个组，直到下一个 source。每组提供完整最终 `--relation` 集合，或用 `--clear-relations` 明确清空。
- `--relation-summary <selector=summary>` 绑定本组唯一 target，按首个 `=` 分隔；后续 `=` 属于摘要。摘要可在组内关系前后出现。
- 完整替换不合并旧关系；未提供 summary 的边移除旧摘要。重复 source/target、空组、只含摘要、clear 混用或绑定失配按实际参数或领域诊断处理。
- 需要写前审阅完整结果时用 `--preflight`；正式事务只改所选关系及索引，其他 metadata、正文、资源与 pending 不变。全部关系与现值相同时零改写。

`publish` 与 `set-relations` 的预检及正式成功都返回 `relationReview`：每个 source 的完整 `before`、`after` 和 `action`，空集合为 `[]`。候选建立为 `establish`，正式记录为 `replace` 或 `unchanged`；只有 `phase=committed` 证明正式成功，`preflight` 是预计结果，失败不附成功 review。

## 删除与身份更正

### 删除报告或候选

`discard` 按稳定 ID 区分一个候选或正式报告；同名歧义使用完整 ID。删除前读[资源归属](investigation-report-contract.md#资源引用与归属)及[关系闭合](investigation-report-contract.md#认识演进关系)，确认：

1. 正式目标无剩余关系引用，移除后完整图仍合法；正式集合、资源与当前索引有效。
2. 有自有资源时，显式使用 `--delete-owned-resources` 选择范围；其他报告或候选仍引用时先迁移 owner 或更新引用。
3. owner 树只含安全、可见、非符号链接的普通受管成员。ignored、非法、无法完整检查的成员或漂移都会阻断删除。
4. HEAD 已记录目标或任一将删资源时，须在精确授权内确认 `--delete-recorded`；非 Git 工作区或 unborn HEAD 无此门禁，检查异常仍零写入停止。

删除不在同一调用中修改关系或转移资源 owner。候选删除保持正式索引不变；正式删除同步索引，删除最后一份正式报告保留合法空索引。pending 不变。对象已退出集合而仍有清理残留时，先按[结果与恢复](#结果与恢复)对账，不重做删除。

### 更正身份

`rename` 统一维护目标 ID、受管 relation target、资源链接、owner 前缀、位置与正式索引；保留其他 metadata、正文判断与关系摘要。

- target 的标准 ID 日期须等于 formedAt 的 UTC 日，name-only target 自动使用该日。身份、name 与目标位置须无冲突。
- 可用时优先 name 位置，其次完整 ID；同 ID、同位置的真正 no-op 完成所选身份、安全和冲突确认后零写入，不规范化正文、不改索引或 mode，也不要求历史变更确认。实际身份、位置或 owner 变化仍按严格全集规则执行。
- `--preflight` 预演同一计划。HEAD 已记录目标或 owner 资源时，正式执行按诊断确认 `--rename-recorded-report` 或 `--rename-recorded-candidate`。
- 移动与恢复保护已有路径，遇到并发或类型、权限、字节漂移时保留现场并报告实际范围。正式记录更名成功自行更新索引，暂存与 commit 另行选择。

候选更名维护该动作所需的身份、引用、资源与位置，不创建或改写正式索引。

## 检查与同步

[领域验证含义](investigation-report-contract.md#检查与同步)适用于以下操作：

| 操作 | 范围与前提 |
| --- | --- |
| 默认 `check` | 完整正式报告、关系图、资源与索引；合法候选只做成员安全、身份冲突及准备诊断。 |
| `check --id` | 所选报告与直接资源；必要时扩大身份发现，仍不证明完整图、拆分闭合、未引用资源集合或索引新鲜度。 |
| 全量 `sync-index` | 完整验证来源后重建索引，接纳手工正式变化；可恢复缺失、损坏或陈旧索引，合法候选留在集合外。 |
| `sync-index --select ...` | 可信发布基线上的局部更新：验收所选已知路径与必要依赖的当前来源，未选条目沿用发布事实；仍验完整组合图并发布完整索引，不证明未选正文当前。 |

一批手工编辑可先共同完成，期间局部检查；在关系事务、正式删除、全量验收或暂存所选新来源前统一同步。已知合法变化先同步；任务要求当前全集结论或正在恢复集合时再全量检查。未解释异常先区分来源和索引问题，来源非法或成员安全问题先恢复来源。

selected 同步先要求合法、canonical、当前 definition 的发布 baseline；缺失、损坏或不兼容时显式全量同步，不能当空基线。集合 metadata/revision 不变，name 只从 baseline 解析。只读取所选 baseline 已知路径、前后直接关系邻居、完整拆分/归并事件及所需资源 owner；必要未选依赖必须仍匹配发布投影和来源 revision，变化时显式补选或全量同步。

已知路径缺失按所选删除处理，完整组合关系与 owner 声明仍须合法；它不能区分真实删除和移动到未知位置。已知路径内身份更正必须显式同选旧、新 ID，并在本次读取中证明唯一；没有已读 locator 证明的新 ID 要求全量同步。不扫描未知位置，不保证发现未同步新增、移动、重复身份或新引用；full sync/check 承担这部分全集审计。未选条目与 revision 沿用发布事实，不要求无关当前正文完全未变。

选择性删除或已读同路径改 ID 还核对旧 owner 的已知路径：任何残留（含空树、不安全类型或大小写变体）均拒绝索引更新；不代删资源，应恢复来源或显式治理资源后全量同步，full sync 不会自动清除孤立树。初次准备与独立 fresh 均重新核对此范围，不扫描其他 owner。

写前独立重读本次来源、必要依赖与实际 baseline，未变化也须通过；原生 baseline/metadata/选择保护、完整组合索引验收和发布后 readback 保持。selected 成功的 `coverage` 保存 `source: published-index+selected-current-sources`、`currentness: selected-and-dependencies`、排序后的 `checkedIds`：包括所选身份标签（含缺失删除及同路径更正的旧、新 ID）和实际读取的必要依赖，不保证每个标签当前存在，不表示未知位置发现完整；未选来源当前性未检查。CLI 同时说明这一边界。

全量只读 `check` 用首次采集的成员身份、同份源字节、解析结果及资源事实验证完整预期索引；采集中仍拒绝不安全替换，但不结束重读全集，不承诺结束新鲜度或跨文件原子快照。`check --id` 保持局部 scope；sync 与写事务仍独立 fresh。

`sync-index` 默认写入，`--preflight` 对同一验证与漂移保护零持久写入预演。分别解释“可重建但未发布”“索引已 current”和“实际已写入”；严格 `check` 仍拒绝未恢复的索引。

有直接前序且 Git HEAD 可用时，全量检查会提示尚未被 HEAD 记录的前序，供复核独立保留价值；warning 不阻断写入，已提交前序仍需同样语义审核。无 Git、unborn HEAD 或历史不可用时不据此推断前序价值。

## 待提交快照

先读[快照的领域边界](investigation-report-contract.md#待提交快照)。`stage <selector...> --scope ...` 显式选择即用当前完整版本刷新所选对象，未选 pending 保持；已有部分暂存会被该对象在指定 scope 内的完整版本取代。

从 HEAD、工作区发布投影及必要 pending 身份解析 ID／name；候选不参与。sourcePath 改变选同一 ID，删除选旧 ID，rename 同选旧、新 ID。领域 scope 识别仅 pending 存在的来源，并清理上次暂存留下的旧位置。

| scope | 写入与验证范围 |
| --- | --- |
| `all`（默认） | 原子刷新所选发布投影、正式 Markdown 与完整 owner 树，未选条目沿用 pending；验证所选来源、直接资源、必要 owner 依赖及合成图。 |
| `index` | 只刷新所选发布投影及来源 revision；payload 验收限于本次消费或修改的索引文件，不读取工作区正文。调用方负责配套领域暂存与正文验证。 |
| `domain` | 只刷新所选正式 Markdown 与完整 owner 树，保留 pending 索引原字节（即使损坏）或缺失状态；来源验证同 all，但不证明索引已配套。 |

HEAD 与工作区发布索引须通过字段、关系与资源 owner 声明验证；index／all 还验证 pending 索引，并要求存在的三方索引具有相同集合 metadata、sourceRevision.metadata 与 definition。HEAD 与 pending 都无索引时从空基底组合；已有 HEAD 索引却将 pending 索引删除时，index／all 提示先恢复该删除。损坏或不兼容走显式恢复。

`all`／`domain` 的所选现存来源须符合工作区发布投影，合法手改先同步。owner 树取 HEAD、pending 与工作区的所选 owner 路径并集，包含未引用成员与待删除旧成员。引用资源须存在，全部相关路径分量须安全；空资源树仍检查根和 owner，文件表示尊重 Git `core.fileMode`。

必要报告和其他 owner 资源只参与验证；若最终待提交集合还缺依赖，提示显式补选，不自动暂存其他 owner。stage 不重建全部 HEAD 正文或重新发现全部未同步工作区身份；完整索引、图及 pending 保护仍有集合级成本。

准备阶段取得 scope 所需来源、成员、工作区索引、HEAD 与完整受管 pending 身份；写前独立重取可变事实，锁内执行 HEAD 与 pending 的比较并交换（CAS），写后验证目标并保护范围外状态。各阶段按 scope 验收 payload：`index` 只验收所需索引内容，其余 pending 成员以完整路径、文件模式与对象 ID 保护身份；`all`／`domain` 验收完整受管 pending 的实际 payload。所需读取失败或保护范围漂移时停止，未变化结果也须通过保护检查。

原子更新保留未选领域文件的字节、表示及 staged 删除。`index` 的非索引保证限于身份保持，正文及资源的内容验证由调用方配套完成；它不证明这些 payload 即时可读或指纹有效。可连续暂存不同对象，再重复选择以刷新某一对象。索引 JSON 可规范化序列化，未选条目含义保持。

结果说明写入路径、保留的 pending 和调用方责任；成功只证明 scope，stage 不提交或推送。

## 结果与恢复

成功输出在 stdout，warning 与失败诊断在 stderr。退出码：0 成功，1 检查、操作或删除确认失败，2 参数错误。warning 提示需核对事实，本身不改变状态。

| mutation outcome | 可确认状态与下一步 |
| --- | --- |
| `no-change` | 声明范围未改变，处理前置条件后重新观察。 |
| `rolled-back` | 提交前失败且完整旧范围已恢复，复核后再决定重试。 |
| `partial-or-unknown` | 无法证明完整恢复，或已提交但写后验收失败／未知；保留已知提交和实际路径，停止后续 mutation 并对账。 |
| `committed-cleanup-pending` | 已提交且验收通过，仅清理或解锁未完成；先对账完成变化与精确残留。 |

非 stage 的正式事务以实际索引发布为提交点；候选创建以安全独占建立为提交点，更名以目标写集建立且旧位置退出为提交点，删除以对象退出受管集合为提交点。正常成功还须独立验收实际 bytes、identity、mode 及相关来源、成员；writer 返回不等于验收通过。stage 的 pending 提交与保护按[待提交快照](#待提交快照)执行。

越过提交点后不自动回滚。清理或解锁失败返回非零，保留真实 mutation、ID 和 sourcePath；候选已创建不能报告为未创建。验收与清理同时失败时分别诊断，以验收失败/未知为主要事实，不附成功 review。先对账，不直接重做领域操作。

scope/outcome 只说明声明范围。普通查询、检查、readiness、预检及参数错误不附会 mutation 结果；无写入而解锁失败仍非零，但不虚构 committed。权限、锁、中断及 CAS 恢复按[维护恢复](maintenance-recovery.md#中断写入)执行。
