# 调查报告 CLI 操作契约

本文件服务调用者：解释操作前提、影响范围、结果与失败边界。查询先读“查询与结果解释”的来源表，再按所用命令补读多来源配置、搜索或追溯小节；写入先读“操作前提”，再读本次操作章节及其链接的领域规则。精确参数和默认值查 `help <command>`；报告内容与质量由 [SKILL.md](../SKILL.md)及[固定契约](investigation-report-contract.md)承接。

## 定位与选择

调用原生程序绝对路径，或使用项目提供的维护入口。单集合操作默认以调用时当前目录为工作区，调查目录为 `docs/investigations`；从其他目录调用时，在 command 前显式传 `--root <workspace-root>`。`--investigations-dir` 指定工作区内相对集合路径，同一任务使用明确的集合根。`list`、`search` 另支持下方[多来源配置](#多来源配置)。

selector 移除一次大小写不敏感的末尾 `.md` 后，标准日期 ID 只精确匹配完整 ID，其余输入精确查 name。零项失败，多项报告歧义，一项收敛为完整 ID。路径只进入明确的定位参数；后续操作优先使用返回的完整日期 ID。

legacy ID 的字面值也是 name 查询键，与日期 ID 同名时，`foo` 和 `foo.md` 都可能歧义。只读时可从索引列表取得实际 sourcePath 后读取已知 Markdown；需要工具修改时，另在授权下恢复无歧义身份并显式同步。旧来源仍兼容，新建不以迁移旧来源为前置。

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

show 安全读取来源，核对读取内容的 frontmatter ID 与所选身份，并严格解码 UTF-8；越界、路径替换或非法 UTF-8 失败。返回完整正文，不受搜索/preview 预算限制。

`list` 与 `search` 只查正式报告。按需筛选和展开列表窗口；空页只说明本次条件和窗口无结果。重复 tags 为 AND，形成时间边界包含端点。关系条件和其他筛选取交集；`--related-to` 的方向相对目标解释，type 与 target 同用时须命中同一条边。

### 多来源配置

仅 `list`、`search` 读取来源组配置：选定 key 后，按其来源数组顺序分别执行现有单源查询，再按来源分组返回原结果。其他查询及写命令不读取配置。

#### 配置发现与选择

默认配置为**调用时当前目录**下的 `.local/.investigation-report.local.json`，不向上查找，也不随 `--root` 改变。`--config PATH` 可显式选择配置文件，相对路径以调用目录为基准；`--key KEY` 选择来源组，省略时使用 `defaultKey`。

```json
{
  "defaultKey": "related",
  "sources": {
    "related": [
      {"root": "..", "investigationsDir": "research/reports"},
      {"root": "../../shared-lib", "investigationsDir": "notes/investigations"}
    ]
  }
}
```

每个 `sources[key]` 是非空有序来源数组，每源都明确提供 `root` 与 `investigationsDir`：

- `root` 可为绝对路径；相对路径以**配置文件所在目录**为基准。因此上述默认配置中的 `"root": ".."` 指调用时当前目录。
- `investigationsDir` 是该源 root 内的安全相对路径，可使用项目自己的调查目录。

配置与原单源定位按以下规则选择：

| 调用状态 | 行为 |
| --- | --- |
| 显式传 `--root` 或 `--investigations-dir` | 使用原单源查询，不读取配置；与 `--key`、`--config` 互斥。 |
| 默认配置不存在，且未传 `--key` 或 `--config` | 使用原单源查询。 |
| 显式请求的配置缺失、已有配置非法、`defaultKey` 无效或选中 key 未知 | 明确失败。 |
| help / version | 不读取配置。 |

#### 逐源结果与回读

各源独立应用筛选、`limit`、适用的 `offset` 和预算，保留单源顺序与覆盖；不跨来源排序、去重、分页或汇总覆盖。search 仍不提供 offset 分页。

结果按 `sources` 分组保留各源 `root`、`investigationsDir`、`ok` 和原结果。逐源解释上方来源表；搜索还须分别检查各源的 `searchInfo.coverage`，不能以某源的覆盖推断其他源。

任一来源失败后继续查询其余来源，整体退出码为 1。`--json` 失败 envelope 的 `result` 仍包含全部来源结果和错误；普通失败按既有协议在 stderr 给出错误及部分结果。

读取命中报告时，用其所属来源的定位参数和完整 ID：`show <id> --root <root> --investigations-dir <investigationsDir>`。`show` 不接受 `--key` 或 `--config`。

### 搜索

普通成功输出为格式化 JSON 的结果对象；`--json` 返回紧凑 version 2 envelope，从 `result` 读取相同结果。机器消费还须检查退出码与诊断；失败输出的处理见[结果与恢复](#结果与恢复)。

- content 匹配当前文件的物理行；metadata 匹配发布快照的 ID、name、title、question、tags 与来源关系 summary。`all`/`any` 可跨同一报告的段，`phrase` 限于单段；匹配统一 NFKC、忽略大小写并按空白处理。
- 关系条件返回的 `filterRelations` 是导致记录命中的边；metadata 的 `matchedRelations` 是独立的文本命中证据，空数组不否定关系筛选命中。完整正文与关系用 `show`。
- content 先校验全部显式来源路径的格式，按顺序安全打开并读取实际访问的文件，核对普通文件、路径与身份。返回上限已满后继续扫描到第一个额外命中；之后未访问的来源不作存在性、安全或内容证明，实际访问时的权限、替换、符号链接及解码错误仍失败。
- 先读 `searchInfo` 中的 `query`、`source`、`counts` 和 `coverage`，确认本次条件、限制、来源、命中数及三类覆盖。content 的 source 为 `published-index+current-text / unchecked / false`：范围来自发布投影，文本是本次读取，未验证全集来源新鲜度，也不承诺跨文件原子快照。

| 覆盖 | 含义 |
| --- | --- |
| `scanComplete` | 是否已对筛选范围内全部记录完成匹配检查；content 指来源已实际读取并匹配。未完成时 `matched` 为下界。 |
| `resultsComplete` | 是否已完整扫描且返回全部命中；扫描完整仍可能因 limit 少返回记录。 |
| `previewsComplete` | 已返回记录的命中片段是否完整；metadata 不适用。仅预览受限不代表记录发现不完整。 |

发布范围或扫描未完成时，不能对当前全集作“没有相关报告”的结论。预算 warning 区分结果与预览限制；索引缺失、损坏或不兼容时显式恢复。需要更多命中时收紧筛选或调整允许的 limit，完整内容通过 `show` 读取；search 不提供 offset 分页。外部展示还可能截断 stdout。

### 追溯演进

`trace` 返回关系查询切片。默认双向、深度 5、最多 50 条记录；用 `--depth all` 或 `--max-records` 按需扩展。普通成功输出为格式化 JSON，`--json` 返回紧凑 JSON；成功 trace 使用其自身结果形状，不套通用 envelope。

- `traceIds` 为实际遍历成员；`contextIds` 只为闭合拆分或纯归并事件补入，不递归扩展。
- entry 保留完整直接关系，target 可以在切片外；切片外边不是缺失证明。
- 先检查 `coverage`、`frontier` 和可选 `blockedEvent`。frontier 提供后续查询的 anchor 与方向，不是 cursor；多记录事件预算不足时整体停止，提高到 `requiredMaxRecords` 后重查。
- 已读取的边可没有摘要；工具不推断或补写摘要。判断报告今天是否适用，仍回到当前事实来源。

## 操作前提

1. 按[定位与选择](#定位与选择)确认工作区、集合与完整 ID。读取固定契约中本次涉及的[身份](investigation-report-contract.md#身份与集合)、[关系](investigation-report-contract.md#认识演进关系)或[资源](investigation-report-contract.md#资源引用与归属)规则。
2. 确认当前任务授权了哪些对象和影响。agent 自行完成语义审核；删除等高风险操作须有覆盖精确目标与范围的授权。CLI 的历史确认参数不代替授权。
3. 按合作型本地单用户顺序操作；正式执行读取并准备一次，完成领域校验。已知正式来源手改先同步，关系、生命周期和身份等通过 CLI 维护。
4. `--preflight` 只预演本次输入，不保存执行凭据或写入领域文件；正式执行重新读取和准备。预检不保证执行时状态不变。
5. 按[结果与恢复](#结果与恢复)判断实际写入，局部成功只证明声明范围。需要当前全集健康结论时在批次验收运行全量 `check`；起草与只读任务按实际覆盖交付。内容语义、写入授权与机械验证分别判断。

## 候选创建与发布

创建前读[报告正文与候选准备](investigation-report-contract.md#报告正文与候选准备)，带资源或关系时补读对应规则。

### 创建与继续候选

`new` 从显式 title、question、tags、完整直接关系和可选 formedAt 以独占创建方式、不覆盖已有目标地创建 candidate。

- 当前发生的调查传不含日期前缀的 name，省略 `--formed-at`，工具取一次当前 UTC 时间并派生完整 ID。已知形成时间或补录历史调查时显式提供；完整 ID 日期必须等于 formedAt 的 UTC 日。
- 同日同名的完整 ID 或目标路径冲突零覆盖失败；跨日和 legacy 同名可以并存，不要求先迁移。新建固定使用 `_candidate.<完整 ID>`，发布保留该 ID 并使用对应正式 basename；以返回的真实路径继续操作。
- 创建核对输入、可见身份冲突、集合安全和不覆盖条件；成功回显完整 ID、路径及 readiness，随后继续编辑该候选。readiness 未就绪不撤销创建；全局身份与关系冲突由正式发布门禁确认。
- `show-candidate` 始终分别报告 `scaffoldValid`、`bodyReady`、`resourceReady`。结构合法但正文或资源未就绪仍可成功读取，语义审核和建立授权另外判断。

`new` 的完整关系 target ID 只验领域 ID 语法，目标可以后创建；target name 在候选与可见正式身份中必须唯一，零项或歧义失败。关系摘要 target 使用同一选择集合。

正式身份/位置只来自合法发布索引；候选可有限枚举自身来源以兼容既有 locator。索引真正缺失且没有正式成员时可继续首次候选操作；已有正式成员、坏或不兼容索引必须显式恢复，具体范围和失败条件见[候选身份发现与索引状态](maintenance-recovery.md#候选身份发现与索引状态)。

`show-candidate` 只选择候选；同名正式项不参与该 selector。列表中单份候选内容或结构错误 warning 后跳过，显式目标错误失败；合法 ID 即使正文坏也参与冲突检测。不安全路径、非普通成员、可见重复 ID、集合冲突和必要直接依赖失败仍拒绝。结构合法而正文或资源未就绪保留 readiness，不撤销创建。

创建失败仍可能已改变目标；先检查结果和现场，不直接重试 `new`。

### 发布

1. 完成候选正文、直接关系与资源，独立审核内容可信、关系真实及资源必要安全。
2. 读取结构与领域图合法的发布基线，核对所选候选及其直接资源，前序与正式资源 owner 声明使用发布索引；已有合法空索引时以其为基线，正式报告和索引都不存在时可首次建立。已知手工变化或索引异常按“检查与同步”处理。
3. 需要写前审阅预计影响时，用 `publish <selector...> --preflight` 预演显式候选最终集合。关系 target 来自正式基线或同批选中候选，未选候选不参与闭合。核对完整 `relationReview` 和当前 publish 授权。
4. 正式 publish 重新准备并建立报告，再更新索引；多个文件顺序写入，失败可能部分完成。

同一工作批次中已就绪且获准发布的候选优先一次 `publish <selector...>`，共同验证最终关系并只发布一次完整索引。批次不跨越需要独立验收的工作边界；各次调用仍自行读取和验证当前来源。

资源已在最终 owner 路径，发布不移动、改写或暂存资源。发布前复核路径、引用、普通文件身份与版本控制可见性；必要条件漂移时停止，单纯资源字节变化不阻断发布或使索引陈旧。

提交点和失败后的实际状态统一按[结果与恢复](#结果与恢复)解释。

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

1. 正式目标无索引可见的剩余关系引用，移除后组合发布图仍合法；当前索引、所选目标与明确 owner 树有效。
2. 有自有资源时，显式使用 `--delete-owned-resources` 选择范围；索引中其他正式报告仍引用时先迁移 owner 或更新引用。未选候选的关系或资源引用不自动检查、阻断或修复；未来发布时按当时基线诊断。
3. owner 树只含安全、可见、非符号链接的普通受管成员。ignored、非法、无法完整检查的成员或漂移都会阻断删除。
4. HEAD 已记录目标或任一将删资源时，须在精确授权内确认 `--delete-recorded`；非 Git 工作区或 unborn HEAD 无此门禁，检查异常仍零写入停止。

删除不在同一调用中修改关系或转移资源 owner。候选删除保持正式索引不变；正式删除同步索引，删除最后一份正式报告保留合法空索引。pending 不变。对象已退出集合而仍有清理残留时，先按[结果与恢复](#结果与恢复)对账，不重做删除。

### 更正身份

`rename` 统一维护目标 ID、索引可见正式引用者的 relation target 与资源链接、目标 owner 前缀、位置与正式索引；保留其他 metadata、正文判断与关系摘要。

- target 的标准 ID 日期须等于 formedAt 的 UTC 日，name-only target 自动使用该日。完整 ID 与目标位置须无冲突；name 可重复，日期对象可用完整日期 ID 消歧。
- 可用时优先 name 位置，其次完整 ID；同 ID、同位置的真正 no-op 完成所选身份、安全和冲突确认后零写入，不规范化正文、不改索引或 mode，也不要求历史变更确认。实际更正从索引发现正式影响范围，仅实际改写者读取正文并验证 revision。未选候选不自动改写，需共同维护时显式选择所需候选批次完成关系或发布事务。
- `--preflight` 预演同一计划。HEAD 已记录目标或 owner 资源时，正式执行按诊断确认 `--rename-recorded-report` 或 `--rename-recorded-candidate`。
- 资源目录经冲突预检后移动并顺序更新引用；失败可能部分完成，应检查现场与实际范围。正式记录更名成功自行更新索引，暂存与 commit 另行选择。

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

### 选择性同步

`sync-index --select` 在可信发布基线上接纳局部当前来源，仍发布完整索引。需要发现未知位置变化或取得当前全集来源结论时，使用全量 sync/check。

| 环节 | 范围与要求 |
| --- | --- |
| 基线 | 合法、canonical、当前 definition 的发布 baseline；缺失、损坏或不兼容时显式全量恢复，不当空基线。集合 metadata/revision 不变，name 从 baseline 解析。 |
| 来源与依赖 | 读取所选已知路径、前后直接关系邻居、完整拆分/归并事件及所需资源 owner。必要未选依赖须匹配发布投影与来源 revision，否则显式补选或全量同步。 |
| 已知路径缺失 | 按所选删除处理，完整组合关系与 owner 声明仍须合法；旧位置缺失不能区分真实删除和未知位置移动。 |
| 同路径改 ID | 显式同选旧、新 ID，以本次已读 locator 证明唯一；没有已读位置证明的新 ID 要求全量同步。 |
| 未读范围 | 未选条目与 revision 沿用发布事实，无关正文可以已有未同步变化。未知位置的新增、移动、重复身份或新引用由全量 sync/check 发现。 |
| 发布范围 | 验证完整组合索引及领域图；正式执行重新读取准备，按实际结果判断写入。预检不构成后续执行凭据。 |

**旧 owner 约束**：选择性删除或同路径改 ID 时，准备时核对旧 owner 的已知路径缺失。任何残留（包括空树、不安全类型或大小写变体）均拒绝更新；应恢复来源或显式治理资源后全量同步。同步不会代删资源或自动清除孤立树，也不为此扫描其他 owner。

成功 `coverage` 显式报告：

- `source: published-index+selected-current-sources`；
- `currentness: selected-and-dependencies`，未选来源当前性未检查；
- 排序后的 `checkedIds`：所选身份标签及实际读取的必要依赖，包括缺失删除和同路径改 ID 的旧、新 ID。标签不保证当前存在，也不表示未知位置发现完整。

CLI 同时说明上述覆盖边界。

### 全量检查与同步结果

全量只读 `check` 用安全取得的成员身份、来源内容及资源事实验证完整预期索引；读取中拒绝不安全替换，成功不承诺结束新鲜度或跨文件原子快照。`check --id` 保持局部 scope；sync 与写事务另行核对当前事实。

`sync-index` 默认写入，`--preflight` 对同一输入作零持久写入预演。分别解释“可重建但未发布”“索引已 current”和“实际已写入”；严格 `check` 仍拒绝未恢复的索引。

有直接前序且 Git HEAD 可用时，全量检查会提示尚未被 HEAD 记录的前序，供复核独立保留价值；warning 不阻断写入，已提交前序仍需同样语义审核。无 Git、unborn HEAD 或历史不可用时不据此推断前序价值。

## 待提交快照

`stage <selector...> --scope ...` 构造 Git pending，不提交或推送；显式选择会以当前完整版本刷新所选对象的相应 scope，未选 pending 保持，所选已有部分暂存会被完整版本取代。

| scope | 作用与责任 |
| --- | --- |
| `all`（默认） | 刷新所选发布投影、正式 Markdown 和完整 owner 资源树。 |
| `index` | 只刷新所选投影及来源 revision；调用方配套暂存和验证领域内容。 |
| `domain` | 只刷新所选正式 Markdown 与完整 owner 资源树，保留 pending 索引，不证明二者配套。 |

位置变化选同一 ID，删除选旧 ID，身份更正同选旧、新 ID。操作基于 HEAD、工作区和 pending 的可信身份与路径；实际范围与失败恢复见[待提交快照操作契约](stage-snapshot.md)，执行前须完整读取。

## 结果与恢复

退出码 0 表示成功，1 表示领域或系统失败，2 表示参数错误；warning 可同时出现在结果和 stderr。`--json` 通常返回 version 2 envelope，成功 `trace` 例外；具体字段按实际命令结果解释。

预检只表示计划。失败不表示零写入：按存在的 `changed`、`committed`、`writtenPaths`、`unknownPaths` 和诊断检查现场；未知不等于未变化。新建独占目标但初始化失败可留下部分内容；已有文件替换保护旧内容，但多个文件不保证原子提交、CAS 或自动回滚。先保留现场与可信版本，按[维护恢复](maintenance-recovery.md#中断写入)对账，不直接重做操作。stage 使用 Git 的一次 index 更新保留未选 pending，不是工作区备份或并发隔离。
