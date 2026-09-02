# Design

本 design 以根目录保留候选文件保持正式资源链接字节稳定，并把候选 authoring、机械 readiness、只读批次 preflight、选择性 publish 和全量 sync 分成不互相冒充的责任边界。

## Context

- 当前调查根目录只接受 `investigation-index.json`、可选 `_resources/` 和根目录直属正式报告；规范 Investigation ID 同时是正式报告 basename 与唯一位置，完整报告写入根目录即建立。
- `sync-index` 从全部正式 Markdown 验证关系、资源并重建唯一索引；`set-relations` 与正式 `discard` 要求当前索引并事务化同步，`stage-index` 只组合选中索引 entry 到 Git pending。
- 正式资源链接固定为 `./_resources/<resource-id>`，资源 ID 首段声明唯一 owner 报告；其他报告可以共享引用。资源字节不进入索引 source revision，但路径安全、存在、版本控制可见性和引用仍属于全量验证。
- 把候选放入子目录会使正式资源相对链接解析到错误位置，或要求 publish 改写正文/搬迁资源。根目录保留文件名可以让候选与正式报告共用相同链接字节，同时通过不匹配 Investigation ID 的名称排除正式发现。
- `separate-maintenance-diagnostics-from-mutation-outcomes` 已建立：Investigation transaction 只为自己拥有的工作区范围声明 outcome，普通查询/readiness 不附会 mutation 字段。
- `model-investigation-evolution-as-direct-relations` 禁止把关系变成报告生命周期；`maintain-report-level-investigation-index` 让索引从完整正式报告集合可重建。本 Change 只增加 authoring workspace 与正常发布事务，不改变这些核心边界。

## Goals / Non-Goals

目标：

- 让维护者先创建和编辑不会进入正式报告集合的规范候选。
- 保持候选与正式报告的资源链接字节一致，不在 publish 中改写正文或搬迁资源。
- 让编辑后的一个或多个候选可以重复只读预演最终正式集合，再由普通 publish 独立复核和建立。
- 只发布显式选择的候选，拒绝未选择候选和未显式接纳的正式来源漂移。
- 为候选废弃、首次空集合、资源、关系闭包和发布恢复提供完整可验证路径。

非目标：

- 不给调查候选增加 status、active/archived、形成时间之外的生命周期、候选索引或 archive 目录。
- 不自动生成调查正文、证据、关系语义、资源内容或 formedAt。
- 不让 `new`、候选查询、`publish --preflight` 写正式报告、索引、资源或 Git pending。
- 不让普通 publish 接纳未选择的正式 Markdown 漂移；全量手工接纳继续属于 `sync-index`。
- 不改变 `stage-index` 的 index-only pending 责任，不自动暂存报告、候选或资源。
- 不保存 preflight receipt、确认、日志或自动重试状态，也不新增 JSON CLI 输出协议。

## Decisions

### Intended Change

#### 候选布局与身份

调查根目录扩展为：

```text
docs/investigations/
├── investigation-index.json
├── _resources/
│   └── <investigation-id-stem>/...
├── _candidate.<investigation-id>   # authoring candidate，例如 _candidate.foo.md
└── <investigation-id>              # 正式报告，例如 foo.md
```

保留候选 basename 固定为 `_candidate.` 加规范 Investigation ID。它本身不匹配 Investigation ID pattern，不是正式报告身份；candidate ID 由去除保留前缀后的规范 ID 唯一恢复。符号链接、非普通文件、未知保留前缀、同一 ID 的多个候选或 candidate/formal 同 ID 都是成员安全错误。

候选使用与正式报告相同的 frontmatter 字段、排序、四个固定正文节和可选 `随附资源` 语法，但固定正文可以暂时为空。CLI 只返回：

| 维度 | 含义 | 不证明 |
| --- | --- | --- |
| `scaffoldValid` | 候选身份、文件、frontmatter、tags、relations 和章节形状合法 | 正文或证据完整 |
| `bodyReady` | 固定正文满足机器非空要求 | 调查结果可靠或已经审核 |
| `resourceReady` | 当前候选引用在当时的资源 snapshot 中合法、存在且 owner 可解释 | 资源可信、稍后不漂移或应当发布 |
| `preflight` | 显式选择在当前正式基线下的最终图/index/Git warning 结果 | 后续状态、receipt 或发布授权 |

候选不是报告 lifecycle。Agent 在 publish 前仍按 Investigation Report skill 判断内容质量、资源保存价值、关系真实性和当前写入授权。

#### `new`、查询与默认检查

`new` 接收一个规范 Investigation ID、title、formedAt、question、至少一个 tag 和零个或多个直接 relation。formedAt 必须由调用方显式提供，不能以 scaffold 创建时间冒充认识形成时间；实现不从正文、文件时间、Git 或自然语言猜测 metadata。

输入与目标安全失败分别按既有 `1/2` 退出且不创建文件。创建在集合 mutation lock 内重读正式/候选身份，以完整临时内容执行原子不覆盖发布。成功后退出 `0` 并分别输出 creation、body/resource readiness 与单候选辅助 preflight；后两者的 incomplete、selection-incomplete、unavailable 或本应阻断 publish 的 finding 在 `new` 中渲染为非阻断 warning，不改变创建成功，也不要求重跑 `new`。

`candidates` 按规范 ID 排序发现候选；`show-candidate <id>` 返回原文和机械 readiness。正式 `list/show/trace` 只读取持久正式索引，完全忽略候选。索引 state/source revision 只覆盖正式报告。

默认全量 `check` 允许规范候选文件存在：候选路径安全、身份唯一和 candidate/formal 冲突属于集合阻断；候选正文、关系闭包或资源尚未 ready 作为候选诊断，不使无关正式集合失败。候选 owner 资源不再被误报为无 owner 的正式错误，但正式资源规则继续报告其安全问题；显式候选查询和 publish 对目标资源 fail closed。

#### 资源位置与 authoring ownership

候选中的链接始终使用正式语法 `./_resources/<resource-id>`。候选自己的资源直接写入最终 `_resources/<candidate-id-stem>/...`；候选也可以引用既有正式 owner 的共享资源。候选文件与正式报告共址，因此本地链接在创建、编辑和发布后解析到同一字节。

Authoring ownership 只帮助候选检查解释“正式 owner 尚未建立”的资源，不改变正式报告或资源 lifecycle，不进入索引，也不使候选资源自动发布。候选自己的每个资源必须由该候选直接引用；其他候选可以共享引用，但 owner 仍由资源 ID 首段决定。

Publish 不写、移动、暂存或改名资源。Preflight 和普通 publish 都读取选中候选及其全部直接引用，记录候选 owner 资源成员、共享资源目标、普通文件身份和版本控制可见性，并在报告/索引写入前复核；这些事实或必要引用漂移时零写入失败。单纯资源字节变化不阻断 publish，继续遵守“资源字节不属于索引 revision”的现有边界。

#### 选择性 publish 与只读 preflight

`publish <investigation-id...> [--preflight]` 至少选择一个规范且不重复的候选 ID。`--preflight` 接受与真实 publish 相同的选择，执行完整准备并按门禁退出，但不获取 mutation 授权、不改名报告、不写索引或资源，也不保存 receipt。

正式基线规则固定为：

1. 正式报告非空时，持久索引必须结构有效并对全部正式 Markdown 新鲜；否则要求先显式 `sync-index`。
2. 正式报告为空且索引存在时，索引必须是当前合法空基线；损坏或不兼容时先 `sync-index`。
3. 正式报告为空且索引不存在时，视为首次集合；允许从选中候选建立第一批报告和索引。
4. 候选不参与正式基线 revision。正式根目录存在未索引、已删除或已修改来源时，publish 拒绝，不把它们与选中候选混合接纳。

准备服务把选中候选的完整 report view 加入正式基线，验证 formedAt、tags、正文、直接关系、时间方向、归并/拆分闭包、无环图、资源和最终规范索引。关系 target 必须来自正式基线或同一选择，未选择候选不能补齐闭包。Git `HEAD` 中未记录前序和 history unavailable 继续使用 Investigation 现有非阻断 warning 语义。

普通 publish 在集合 mutation lock 内重新读取候选、正式来源、索引和资源 snapshot，并重做准备。全部通过后，以不覆盖改名把每个 `_candidate.<id>` 发布为 `<id>`，再原子发布包含全部正式报告的索引；索引发布是领域提交点。索引发布前失败恢复全部已改名候选和旧索引；无法完整恢复时返回 `partial-or-unknown`。索引发布成功后正式报告和索引已经提交，未选择候选及其他文件始终不变。

#### 候选清理、全量同步与相邻命令

`discard-candidate <id> [--delete-owned-resources] [--delete-recorded-candidate]` 只接受一个候选。存在该 ID stem 的 owner 资源时必须显式选择删除；任一正式报告或其他候选仍引用这些资源时拒绝。候选或将删资源已进入 Git `HEAD` 时先零写入要求 recorded-deletion confirmation。事务使用集合锁和精确 tombstone，不读取或更新正式索引；提交后 cleanup 残留使用现有 `committed-cleanup-pending` 语义。

正式 `discard` 仍只删除正式报告并同步索引；它不接受候选 ID。`set-relations` 只修改正式报告。`stage-index` 只读取正式工作区索引。三者在需要检查根目录安全时识别候选文件，但不发布、修改或删除候选。

`sync-index` 继续忽略全部规范候选，从当前正式根目录报告完整重建索引。它服务索引恢复、契约升级、批量手工正式修正和显式接纳正式来源变化；因此 publish 是正常候选发布入口，但不是形式上的唯一建立机制。`sync-index` 只因候选路径/身份安全错误阻断，不因合法候选正文 incomplete 吸收或失败。

### Resulting Impacts

#### 长期判断与文档

实现并验证后建立 successor Decisions：其一澄清根目录保留候选文件是 authoring workspace 而不是报告 lifecycle，不改变直接关系语义；其二修订报告级索引维护方向，增加选择性正常 publish，同时保留正式根目录与 `sync-index` 的全量恢复/接纳模型。建立后同步决策索引并归档被替代判断。

#### 领域实现与诊断

报告 path/source discovery、resource owner、validation、query、CLI options/types 和 collection lock 需要识别候选文件。Publish preparation 应成为 `--preflight` 与真实 transaction 的共享只读核心；mutation transaction 只添加锁内漂移复核、候选改名、索引发布与恢复。

`new` 创建失败、publish 和 discard-candidate 的 mutation 失败使用当前 Investigation diagnostics。创建成功后的 readiness/preflight、普通候选查询和 read-only publish preflight 不附会 mutation scope/outcome；warnings 保持 stderr 且不改变成功命令的退出状态，真实阻断只在门禁命令中返回失败。

#### 分发与验证

新命令、公开类型和结果从 `tools/investigation-report/` 生成分发 CLI、source map、Schema 与声明，并提升独立 skill 版本。每个新增或修改的最小原生测试入口维护一个 Test Evidence case；Decision、Investigation 与 Test Evidence 索引分别由其 owner 同步。

## Risks / Trade-offs

| 风险或取舍 | 控制 |
| --- | --- |
| 根目录出现非正式 Markdown 容易被误认为报告 | 使用不匹配 ID 的唯一保留前缀，正式发现和索引明确忽略，并由成员检查拒绝其他形式 |
| 候选资源提前位于正式资源池 | Candidate-aware owner diagnostics；不进入索引，publish/cleanup 按引用与 Git 门禁处理 |
| `new` 成功但辅助预检有 attention | 分区输出并提供 `publish --preflight`；普通 publish 仍重新 fail closed |
| 选择性 publish 比全量 sync 复杂 | 只支持新增候选、要求可靠正式基线、复用完整集合验证与既有可恢复发布边界 |
| Publish 不移动资源，提交时可能发生资源成员或身份漂移 | 写入前复核成员、普通文件身份、引用和版本控制可见性；单纯字节变化不作为漂移 |
| sync-index 仍能接纳手工正式报告，publish 不是唯一建立机制 | 明确 normal 与 recovery/explicit acceptance 两条入口，不声称独占 |
| 候选删除带来新的破坏性事务 | 单 ID、显式 owner-resource/recorded confirmation、引用闭包和精确 tombstone |

## Open Questions

无。

## Plan Use Contract

- 实施者先从 proposal 恢复 authoring candidate、正式报告、publish normal path 与 sync full acceptance 的边界，再按 tasks 顺序推进。
- `_candidate.<id>` 是已确认布局；不得在实现时改回 `_candidates/` 子目录并引入资源链接改写，除非先修订本 Plan。
- 已归档维护诊断 Change 是当前事实前置；本 Change 只消费当前分类、renderer 和 mutation outcome，不建立临时协议。
- 本 Plan 不授权建立 successor Decisions、修改 skill 或执行发布；后续实施授权、checkbox 和验证证据分别判断。
