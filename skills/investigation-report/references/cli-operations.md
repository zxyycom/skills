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
| 默认 content `search` | 当前正式 Markdown；索引不可用或陈旧时，完整验证正式来源与资源后可用内存投影只读降级并 warning，持久索引仍待显式恢复。 |
| `candidates`、`show-candidate` | 未索引候选及其 readiness。局部读取不证明正式全集健康；单条非法候选可 warning 后跳过，显式目标非法或集合安全错误仍失败。 |

`list` 与 `search` 只查正式报告。按需筛选和展开列表窗口；空页只说明本次条件和窗口无结果。重复 tags 为 AND，形成时间边界包含端点。关系条件和其他筛选取交集；`--related-to` 的方向相对目标解释，type 与 target 同用时须命中同一条边。

### 搜索

- content 匹配当前文件的物理行；metadata 匹配发布快照的 ID、name、title、question、tags 与来源关系 summary。`all`/`any` 可跨同一报告的段，`phrase` 限于单段；匹配统一 NFKC、忽略大小写并按空白处理。
- 关系条件返回的 `filterRelations` 是导致记录命中的边；文本证据单独报告。`matchedRelations: none` 只表示没有摘要文本命中，不否定关系筛选命中。普通预览最多展示三条命中边，`list --detail` 展开当前页全部命中边；完整正文与关系用 `show`。
- 先读六行 `Query`、`Filters`、`Source`、`Limits`、`Counts`、`Coverage`，确认本次实际条件、来源、命中数及三类覆盖。`source.currentness=unchecked` 表示正常发布快照边界；`current` 只表示本次已验证，不承诺锁或跨文件原子快照。

| 覆盖 | 含义 |
| --- | --- |
| `scanComplete` | 待匹配记录是否全部检查；未完成时 `matched` 为下界。 |
| `resultsComplete` | 是否已完整扫描且返回全部命中；扫描完整仍可能因 limit 少返回记录。 |
| `previewsComplete` | 已返回记录的命中片段是否完整；metadata 不适用。仅预览受限不代表记录发现不完整。 |

来源为发布快照或扫描未完成时，不能对当前全集作“没有相关报告”的结论。预算 warning 按实际限制区分结果、预览或来源降级；只有来源降级需要恢复索引。需要更多命中时收紧筛选或调整允许的 limit，完整内容通过 `show` 读取；search 不提供 offset 分页。外部展示还可能截断 stdout。

### 追溯演进

`trace` 默认显示关系图，`--json` 返回同一查询切片。默认双向、深度 5、最多 50 条记录；用 `--depth all` 或 `--max-records` 按需扩展。

- `* trace` 是实际遍历成员；`~ context` 只为闭合拆分或纯归并事件补入，不递归扩展。
- entry 保留完整直接关系，target 可以在切片外；终端图只展开两端都在切片内的边。切片外边不是缺失证明。
- 先检查 `coverage`、`frontier` 和可选 `blockedEvent`。frontier 提供后续查询的 anchor 与方向，不是 cursor；多记录事件预算不足时整体停止，提高到 `requiredMaxRecords` 后重查。
- 已读取但没有摘要的边显示 `[无摘要]`；工具不推断或补写摘要。判断报告今天是否适用，仍回到当前事实来源。

## 操作前提

1. 按[定位与选择](#定位与选择)确认工作区、集合与完整 ID。读取固定契约中本次涉及的[身份](investigation-report-contract.md#身份与集合)、[关系](investigation-report-contract.md#认识演进关系)或[资源](investigation-report-contract.md#资源引用与归属)规则。
2. 确认当前任务授权了哪些对象和影响。agent 自行完成语义审核；删除等高风险操作须有覆盖精确目标与范围的授权。CLI 的历史确认参数不代替授权。
3. 工作区写入共用集合锁并在写前复核可变来源；Git pending 由 `stage` 独立维护。手工正式编辑先按“检查与同步”发布投影，再进入要求新鲜索引的操作。
4. `--preflight` 只预演本次完整输入，不保存执行凭据；正式执行重新读取与验证。同步预检可能使用短暂集合锁，但不写持久领域文件、索引、资源或 pending。
5. 失败按[结果与恢复](#结果与恢复)判断实际写入范围。写入后运行默认全量 `check`，再完成内容语义审核；查询和预检成功不代替正式写入或授权。

## 候选创建与发布

创建前读[报告正文与候选准备](investigation-report-contract.md#报告正文与候选准备)，带资源或关系时补读对应规则。

### 创建与继续候选

`new` 从显式 title、question、tags、完整直接关系和可选 formedAt 原子、不覆盖地创建 candidate。

- 当前发生的调查传不含日期前缀的 name，省略 `--formed-at`，工具取一次当前 UTC 时间并派生完整 ID。已知形成时间或补录历史调查时显式提供；完整 ID 日期必须等于 formedAt 的 UTC 日。
- 同日同名冲突零写入；同名 legacy ID 冲突按 `migration-required` 显式处理。位置可用时优先 name basename，否则用完整 ID。
- 创建成功回显完整 ID、路径及 readiness；随后继续编辑该候选。正文或辅助预检未就绪不撤销创建，也不表示报告已经建立。
- `show-candidate` 始终分别报告 `scaffoldValid`、`bodyReady`、`resourceReady`。结构合法但正文或资源未就绪仍可成功读取，语义审核和建立授权另外判断。

### 发布

1. 完成候选正文、直接关系与资源，独立审核内容可信、关系真实及资源必要安全。
2. 正式报告非空时，持久索引须对全部正式 Markdown 有效且新鲜；已有空索引时须是合法当前空基线；正式报告和索引都不存在时可首次建立。手工来源变化或索引异常先按“检查与同步”处理。
3. 用 `publish <selector...> --preflight` 预演显式候选最终集合。关系 target 来自正式基线或同批选中候选，未选候选不参与闭合。核对完整 `relationReview` 和当前 publish 授权。
4. 正式 publish 在锁内重读并验证，以不覆盖改名建立报告，再发布完整索引。未选候选和其他工作不变。

同一工作批次中已就绪且获准发布的候选优先一次 `publish <selector...>`，共同验证最终关系并只发布一次完整索引。批次不跨越需要独立验收的工作边界；各次调用仍自行读取和验证当前来源。

资源已在最终 owner 路径，发布不移动、改写或暂存资源。发布前复核路径、引用、普通文件身份与版本控制可见性；必要条件漂移时停止，单纯资源字节变化不阻断发布或使索引陈旧。

索引发布是领域提交点：之前失败恢复候选和旧索引，无法完整恢复时报告 `partial-or-unknown`；之后失败按已提交状态对账清理残留。

## 完整替换关系

先读[认识演进关系](investigation-report-contract.md#认识演进关系)。`set-relations` 要求当前索引，全部来源与 target 解析为正式 ID；多个来源共同预演最终图，可在一次事务中完成闭合拆分。

- 每个 `--source` 开始一个组，直到下一个 source。每组提供完整最终 `--relation` 集合，或用 `--clear-relations` 明确清空。
- `--relation-summary <selector=summary>` 绑定本组唯一 target，按首个 `=` 分隔；后续 `=` 属于摘要。摘要可在组内关系前后出现。
- 完整替换不合并旧关系；未提供 summary 的边移除旧摘要。重复 source/target、空组、只含摘要、clear 混用或绑定失配按实际参数或领域诊断处理。
- 用 `--preflight` 先看完整结果；正式事务只改所选关系及索引，其他 metadata、正文、资源与 pending 不变。全部关系与现值相同时零改写。

`publish` 与 `set-relations` 的预检及正式成功都返回 `relationReview`：每个 source 的完整 `before`、`after` 和 `action`，空集合为 `[]`。候选建立为 `establish`，正式记录为 `replace` 或 `unchanged`；只有 `phase=committed` 证明正式成功，`preflight` 是预计结果，失败不附成功 review。

## 删除与身份更正

### 删除报告或候选

`discard` 按稳定 ID 区分一个候选或正式报告；同名歧义使用完整 ID。删除前读[资源归属](investigation-report-contract.md#资源引用与归属)及[关系闭合](investigation-report-contract.md#认识演进关系)，确认：

1. 正式目标无剩余关系引用，移除后完整图仍合法；正式集合、资源与当前索引有效。
2. 有自有资源时，显式使用 `--delete-owned-resources` 选择范围；其他报告或候选仍引用时先迁移 owner 或更新引用。
3. owner 树只含安全、可见、非符号链接的普通受管成员。ignored、非法、无法完整检查的成员或漂移都会阻断删除。
4. HEAD 已记录目标或任一将删资源时，须在精确授权内确认 `--delete-recorded`；非 Git 工作区或 unborn HEAD 无此门禁，检查异常仍零写入停止。

删除不在同一调用中修改关系或转移资源 owner。候选删除保持正式索引不变；正式删除同步索引，删除最后一份正式报告保留合法空索引。pending 不变。`committed-cleanup-pending` 表示对象已退出集合但仍有残留，应先对账，不能当作尚未删除重做。

### 更正身份

`rename` 统一维护目标 ID、受管 relation target、资源链接、owner 前缀、位置与正式索引；保留其他 metadata、正文判断与关系摘要。

- target 的标准 ID 日期须等于 formedAt 的 UTC 日，name-only target 自动使用该日。身份、name 与目标位置须无冲突。
- 可用时优先 name 位置，其次完整 ID；身份、位置和 owner 都未改变时零写入返回。
- `--preflight` 预演同一计划。HEAD 已记录目标或 owner 资源时，正式执行按诊断确认 `--rename-recorded-report` 或 `--rename-recorded-candidate`。
- 移动与恢复保护已有路径，遇到并发或类型、权限、字节漂移时保留现场并报告实际范围。成功自行更新索引，暂存与 commit 另行选择。

## 检查与同步

[领域验证含义](investigation-report-contract.md#检查与同步)适用于以下操作：

| 操作 | 范围与前提 |
| --- | --- |
| 默认 `check` | 完整正式报告、关系图、资源与索引；合法候选只做成员安全、身份冲突及准备诊断。 |
| `check --id` | 所选报告与直接资源；必要时扩大身份发现，仍不证明完整图、拆分闭合、未引用资源集合或索引新鲜度。 |
| 全量 `sync-index` | 完整验证来源后重建索引，接纳手工正式变化；可恢复缺失、损坏或陈旧索引，合法候选留在集合外。 |
| `sync-index --select ...` | 同样完整验证，只接纳所选 ID 的已知合法变化，仍发布完整索引；要求可信 baseline 和未变的集合 metadata/revision。 |

一批手工编辑可先共同完成，期间局部检查；在关系事务、正式删除、全量验收或暂存所选新来源前统一同步。已知合法变化先同步后全量检查；未解释异常先检查区分来源和索引问题。来源非法或成员安全问题先恢复来源。

selected 同步从 baseline 与待发布投影的 name 映射并集解析 selector。全部变化 ID 必须被选择：新增选新 ID，删除选旧 ID，身份更正同选旧、新 ID。未选变化、未知 ID 或坏 baseline 零写入停止，补充选择或显式全量同步。

`sync-index` 默认写入，`--preflight` 对同一验证与漂移保护零持久写入预演。分别解释“可重建但未发布”“索引已 current”和“实际已写入”；严格 `check` 仍拒绝未恢复的索引。

有直接前序且 Git HEAD 可用时，全量检查会提示尚未被 HEAD 记录的前序，供复核独立保留价值；warning 不阻断写入，已提交前序仍需同样语义审核。无 Git、unborn HEAD 或历史不可用时不据此推断前序价值。

## 待提交快照

先读[快照的领域边界](investigation-report-contract.md#待提交快照)。`stage <selector...> --scope ...` 在当前正式集合与固定 HEAD 基线 ID 并集中选择对象；候选不参与。sourcePath 改变仍选同一 ID，删除选旧 ID，rename 显式同选旧、新 ID。

所有 scope 都严格验证发布索引及 HEAD 基线的完整 metadata、关系与资源 owner 声明；索引缺失或无效时零写入停止。`all`/`domain` 的所选新来源须先同步，`index` 只使用已发布投影。

| scope | 写入与验证范围 |
| --- | --- |
| `all`（默认） | 原子写入所选索引投影、正式 Markdown 与完整 owner 资源树；验证所选正文、直接资源、必要 owner 依赖与最终索引投影。 |
| `index` | 只写所选索引投影；要求 pending 索引与 HEAD 基线一致。只证明索引暂存，不读取或证明当前正文与资源健康。 |
| `domain` | 只写所选正式 Markdown 与完整 owner 资源树；所选来源与必要依赖验证同 all，pending 索引保持原字节。 |

完整 owner 树取工作区与固定 HEAD 路径并集，包含未引用成员和已删除的基线资源。引用资源必须存在；缺失未引用基线成员可以表示删除。所有相关路径分量都须安全，空资源树也要检查根和 owner。所选常规文件保留尊重 Git `core.fileMode` 的有效执行位。

依赖报告和其他 owner 的共享资源只参与验证，不因此进入写入目标；无关非法或已删除正文不阻断局部暂存。基线-only 删除为排除同 ID 在别处重现，可能扩大身份发现。完整索引、关系图与 pending 保护仍有集合级成本。

写前重新核对可变来源、成员、发布索引、HEAD 与完整 pending；漂移或读取失败保留现场。结果说明实际写入路径、保留的无关 pending 及调用方负责范围，`index` 成功不能外推为领域文件已暂存。stage 不提交或推送。

## 结果与恢复

成功输出在 stdout，warning 与失败诊断在 stderr。退出码：0 成功，1 检查、操作或删除确认失败，2 参数错误。warning 提示需核对事实，本身不改变状态。

| mutation outcome | 可确认状态与下一步 |
| --- | --- |
| `no-change` | 声明范围未改变，处理前置条件后重新观察。 |
| `rolled-back` | 提交前失败且完整旧范围已恢复，复核后再决定重试。 |
| `partial-or-unknown` | 无法证明完整恢复，停止后续 mutation 并对账。 |
| `committed-cleanup-pending` | 已越过提交点，先对账已完成变化和清理残留。 |

scope/outcome 只说明声明范围。普通查询、检查、readiness、预检及参数错误不附会 mutation 结果。权限、锁与中断处理统一按[维护恢复](maintenance-recovery.md)执行。
