# Design

本实施计划以窄的共同记录操作 owner 收口两域编排，以显式领域适配保留差异，并把已确认产品保证、分批退役与有限 1W 验证绑定。

## Context

事实接点阅读于 `ce3272c557c5f7cd85d3968e5528e8687d87fd58`；后续实施须重核 owner 与输入，
Plan 的 `baseCommit` 以 CLI 实际记录为准。DR、IR 的 Markdown 是事实源，索引是派生发布投影。
当前方向依据[局部/全集边界](../../docs/decisions/separate-record-local-operations-from-collection-audits.md)、
[共同候选动作](../../docs/decisions/260922-unify-record-candidate-lifecycle-actions.md)与
[Index Runtime](../../tools/index-runtime/README.md)，不是以当前代码复制关系推定共同契约。

关键事实与源码入口如下；已有定向观察用于确定方案，实施验收另行取得：

| 责任 | 关键发现与稳定接点 | 证据性质与边界 |
| --- | --- | --- |
| 结果完整性 | IR [trace](../../tools/investigation-report/src/query-trace.ts)在缺失 target 的结构合法索引上静默跳过 entry，破坏[集合不变量](../../tools/investigation-report/README.md#关系筛选与-trace)；[candidate-create](../../tools/investigation-report/src/candidate-create.ts)未接回锁释放错误携带的完成结果 | 两项已有小 fixture 定向复现；不是所有 CLI/故障组合已验证 |
| 同阶段索引与来源 | DR [decision-query-sync](../../tools/decision-records/src/decision-query-sync.ts)未交接已验 scan；两域 selected selector 与 sync 重复严格 baseline 准备；IR [publish 准备](../../tools/investigation-report/src/publish-preparation-formal.ts)未持续交接 baseline | 现有 1W 侦察支持读取量；无优化后配对收益证明 |
| 查询准备 | [严格 load](../../tools/index-runtime/src/storage-load.ts)与 [reader](../../tools/index-runtime/src/reader.ts)重复提取 queryValues；DR [snapshot](../../tools/decision-records/src/decision-index-snapshot.ts)建 reader 后只消费 index；IR [content](../../tools/investigation-report/src/query-search.ts)另建上下文，[metadata](../../tools/investigation-report/src/query-search-metadata.ts)为全部命中保留 DTO | 静态链路；不是重复 JSON/state parse；content 无关系条件时并不构第二张图 |
| 普通/严格事务 | DR [普通事务](../../tools/decision-records/src/decision-maintenance-transaction.ts)与 IR [关系发布](../../tools/investigation-report/src/relation-transaction-publication.ts)的 fresh/写后保证不同；[DR 恢复](../../tools/decision-records/src/decision-transaction-files.ts)及 [IR 恢复](../../tools/investigation-report/src/rename-recovery.ts)仍有未按当前写集归属保护的路径 | 静态恢复风险，未复现并发丢失；不据此报告秒数或已发生损坏 |
| 候选/路径 | 两域候选 name 选择集合不同；[DR query context](../../tools/decision-records/src/decision-query-context.ts)与 [IR path](../../tools/investigation-report/src/report-path.ts)的 canonical 边界不同 | 同名无索引 fixture、内部查询 API 的集合 symlink 有定向观察；不是 CLI 全排列或路径竞态证明 |

已提交的[历史全操作调查](../../docs/investigations/record-tools-all-operations-100k.md)仅作成本背景：
其 revision、100K 负载和 CLI 计时口径不同，不与当前 1W 源码 API 侦察拼表计算加速。
未来 baseline 重新取得同口径证据。

当前有效的[关系输入决策](../../docs/decisions/maintain-formal-record-relations-with-shared-input-contract.md)
明确不提取跨工具运行时组件。本计划扩大实现 owner，接入前须按决策流程显式修订该限制，
不能声称现有独立编排违反该决策。
[payload 决策](../../docs/decisions/scope-record-index-payload-validation.md)的 fresh 等价复用限定 stage，
不是普通事务已经采用的保证。

## Goals / Non-Goals

目标：共同操作单一维护实现；领域差异显式；同阶段事实可靠交接；共同产品保证可审阅；
分批退出旧实现且每批都有匹配证据。共同结果语义相同不要求两个公开 DTO 或导出集合完全同形。

非目标：合并两个 skill/CLI/领域模型，改变持久索引格式，扩大公开 SDK，改写其他 Index Runtime
消费者默认行为，新增跨调用/持久缓存、守护进程、候选索引、插件/provider 框架、通用事务 DSL、
receipt 或遥测。无关默认 limit、搜索预算与命令命名不为整齐而统一；不重开 stage 设计。

## Decisions

### Intended Change

共同操作单一维护实现、显式保留领域差异，以及下述五组产品保证均为已确认方案。
本文件定义实施目标，现行稳定 owner 在相应批次同步；确认方案不等于产品已经实现或验收。

#### 共同 owner 与领域边界

依赖方向为 `DR / IR -> tools/record-operations/ -> index-runtime / shared`。
`record-operations` 拥有共同命令操作的可见顺序、阶段证据交接、共同拒绝门槛与事务结果事实；
用直接函数/结构化事务脚本表达现有两消费者，不先建立注册、插件、策略树或可配置流水线。
领域 CLI 解析外部输入、调用共同操作，再映射既有 DTO、诊断和退出状态，不重拼相同阶段。

| 责任 | 实施 owner | 显式保留的领域责任 |
| --- | --- | --- |
| 正式查询、selector、元数据收集、trace/搜索协调、安全正文读取 | record-operations，复用 index-runtime/shared 的既有算法 | 字段/DTO、领域关系合法性与图事件、过滤字段；不同 limit/预算按领域参数传入 |
| check/sync、候选创建/读取/readiness、批发布与关系替换的共同流程 | record-operations；索引严格 load/build/sync 原语仍属 index-runtime | definition、ID/name 规则、解析/投影、实际直接依赖、领域 readiness 与最终合法性 |
| 锁、准备、独立 fresh、写集执行、写后验收、提交/清理/恢复事实 | record-operations；低层安全 I/O/版本管理仍属 shared | 所需来源/资源/成员证据、位置和写集；DR lifecycle/alignment/archive/重划闭合，IR formedAt/认识关系/资源 owner |
| stage | 现有 [record-staging](../../tools/index-runtime/src/record-staging.ts)，保持当前调用 | 两域当前 stage 适配，不因新增 owner 搬迁或重写 |

Index Runtime 不承接候选、Markdown 或领域事务；shared 不反向依赖 index-runtime。
真正独有动作（如 DR evolve、mark-aligned、archive、reactivate）保留领域命令，
只把实际共同的受保护写集执行交给共同机制，不强凑 IR 同名接口。
领域适配在所属阶段可取得已声明的来源、资源或成员事实，并提供定义、解析、投影、依赖、写集及合法性。
这些必要领域 I/O 保留在领域；load、准备、fresh、write 与 recover 的顺序及准入条件由共同 owner 决定。
适配器自行重排共同阶段、恢复顺序或重做已有严格准备，均不算完成接入。

同阶段准备对象绑定 definition identity、原始字节/来源身份与已完成的严格证明；
查询字段物化、解析目标、图 context 与候选 ID→source 映射沿数据流传递。
native build 成功证明与领域图证明分开表达，不再把内部 native 结果送入 raw query 重做准备；
对外 raw 查询仍独立严格校验。跨准备/fresh 阶段只交接比较依据，不沿用可变事实；
同阶段证明不构成跨阶段缓存或 fresh 豁免。

候选比较：全局记录平台会引入无消费者扩展点并吞入领域语义；仅抽 helpers 仍保留两套共同流程；
把全部编排放进 index-runtime 会混淆派生索引与来源事务。故选窄的独立操作 owner，
只随已接入切面增加当前需要的能力；目录名不成为先造大框架的理由。

#### 产品保证

G1–G5 是已确认的产品边界。实施证据区分三类：纠错恢复明确承诺；机械复用保留接受/拒绝、
错误优先级与保证；产品改变包含强化、收窄与重新定义，须同步 owner 并单列成本。
这一区分用于行为和成本报告，不要求新建 DTO、异常类型或通用结果框架。

##### G1 查询按实际依赖验收

- 无关系条件的 `list`、metadata 搜索、`show` 和 content 搜索严格验证索引结构、字段和 definition；
  实际读取的来源、正文与直接资源保持安全及身份核对。全域关系图或资源 owner 图审计不是前置。
  `show` 只验所选来源；content 按发布范围读取当前正文，不把未读取来源描述为已验。
- 使用关系筛选或 `trace` 时，对该发布投影完整验证领域图；按需惰性建立图，每投影只证明、物化一次，
  同调用内筛选、trace 与上下文共用。领域完整性含该动作依赖的资源 owner 约束，不能只验证命中子图。
- IR trace 成功时，trace/context 互斥且并集精确等于 entries；缺 target 等非法图必须失败，
  不能以跳过成员返回不闭合成功。该项是结果纠错。
- 全量体检由 `check`/`sync-index` 承担；普通发现成功不声明全集健康。
  正式索引缺失、损坏或不兼容仍失败并显式恢复，不退回来源或空集合。
- 元数据搜索仍完整扫描以精确计数，但只保留返回窗口 DTO；保留排序、证据、coverage、各域默认 limit。
  安全 `show` 返回完整正文的要求见 G5；搜索预算不移植到 show。

##### G2 全量只读 check 验首次采集

两域全量只读 `check` 验证本轮首次采集的成员身份、源字节、资源事实与由此形成的完整预期索引，
不在结束时重新读取全集。成功不保证检查结束时仍新鲜，也不保证跨文件原子快照。
采集过程的安全 FileHandle/身份核对仍保留，不以取消结束重读为由接受读取中替换。
IR 单项 `check --id` 继续按其自身 scope，不由全量规则扩大或削弱。

`sync-index`、普通写入和严格写入仍在各自阶段独立 fresh。
selected sync 继续验证完整来源、可信 baseline、未选变化和最终 fresh，发布完整索引；
不能把首次采集 check 或 stage 的 fresh 等价复用规则用来删除这些义务。

##### G3 候选允许未完成，但不放松安全与正式闭合

`new` 接受尚未完整的正文/readiness；关系输入的完整 target ID 只验领域 ID 语法，目标可以以后创建。
name 必须在该动作声明的集合内唯一解析，零项或歧义失败；除本次明确收窄的 `show-candidate` 外，
各动作保留既有选择集合并在 help/契约写明，不为统一形状把候选与正式集合全部混查。
`show-candidate` 只选择候选，不能因同名正式项而选错对象。
`new` 保留自身日期/formedAt、输入语法、目标安全、不覆盖、同日同名和 legacy 冲突门槛。
全局关系和身份闭合在 publish 严格验收；readiness 不等于采用授权。

候选列表中，单份候选内容或结构错误 warning 后跳过；显式选中该文件则失败。
结构合法但正文/资源未就绪按 readiness 报告，不撤销创建、不误报 body-ready。
不安全路径、非普通成员、可见重复身份/集合冲突及动作必要依赖失败仍拒绝；
从坏候选仍能明确读出的合法 ID 必须参加冲突检测，不能因其正文坏而隐藏冲突。

**候选身份发现和无索引恢复规则**（落实到两域操作与维护恢复 owner）：

1. 成员边界与身份来源沿现有[DR 身份规则](../../skills/decision-records/references/decision-record-rules.md#记录身份与集合)
   和 [IR 身份规则](../../skills/investigation-report/references/investigation-report-contract.md#身份与集合)：
   DR 根直属 Markdown 以 frontmatter status 区分 candidate/active，archive 只容 archived；
   IR `_candidate.*` 是候选 locator，根直属正式 Markdown 与 `_resources/` 分开。
   ID 仅来自同一安全读取字节的唯一合法 frontmatter `id`，name 从 ID 派生，不从 basename 或旧索引补造。
2. 合法现行索引可提供正式身份/位置投影；候选仍直接从来源发现，并核对实际选中来源。
   已存在但损坏或 definition 不兼容的索引明确失败，提示按各域恢复手册修复来源并全量同步；
   不捕获索引错误退成 null/空集合，也不自动切换来源 fallback。
3. 索引真正缺失时，允许候选动作单独进入**无索引候选身份发现**：检查领域允许的成员及路径安全，
   安全读取所需 frontmatter 以确定候选与可见正式身份，检查可见重复 ID、位置、同日/legacy 冲突；这只提供身份/路径证据，不当作正式发布事实；
   不验证无关正式正文、全图或资源 owner 全图。该扫描不是完整来源验收，也不建立查询索引。
   缺索引状态明确报告；只有合法候选时沿现有首次候选恢复路径使用 candidates/show-candidate。
   如有正式来源，候选操作不证明正式健康，正式查询与 publish 仍要求先显式恢复合法索引。
4. 候选 locator 已确定、但其 ID/内容结构不合法时按“列表 warning/明确目标失败”处理；
   DR 来源无法可信区分 candidate/established、header 存在身份歧义、成员非法或读取不安全时 fail-close，
   不把无法分类成员隐去。必要的直接依赖按动作读取；无有效发布基线而依赖必须正式解析时失败，
   不凭缺失索引宣布该依赖不存在。
5. 首次 publish 仍独立确认正式来源为空且所选候选闭合；有正式来源而无合法索引必须恢复。
   所有 publish 严格检查正式基线、同批选中候选、必要依赖、全局身份及最终关系/资源 owner 图，
   未选候选不替代同批选择。候选发现的宽容规则不外溢到发布门禁。

候选发现不建立候选索引，不执行隐式正式恢复或全域 readiness 回读。

##### G4 事务阶段与真实结果

预检零写入、不持独占写锁、不保存执行凭据；实际执行在集合写锁内重新准备，再独立 fresh 后执行。
无写锁预检不再以合作写锁 busy 优先拒绝是已接受的兼容变化；机械复用的其他错误优先级保持。
准备、fresh、写后验收分别拥有各阶段义务；传递同阶段证明不能删除后续重取。
`unchanged` 也须完成适用来源/成员/index 保护，但不扩大为全集体检；
真正 rename no-op 按 G5 的必要安全范围判定。

会发布正式索引的正式事务以正式索引成功发布为持久提交点；正常成功还必须验收实际目标字节、身份、mode
及该操作相关来源/成员，writer 返回不是验收证明。

不发布正式索引的候选 create/rename/discard 保留领域动作实际提交点，不为统一而创建或改写正式索引：
create 是候选安全独占建立；rename 是动作要求的目标身份/位置及引用/资源写集建立、旧位置退出；
discard 是对象退出受管集合（可仍有已声明 tombstone/cleanup 残留）。具体写集沿两域
[身份更正与删除](../../skills/decision-records/references/cli-operations.md#身份更正与删除)、
[IR 操作](../../skills/investigation-report/references/cli-operations.md#更正身份)及
[事务与诊断](../../tools/investigation-report/README.md#事务与诊断)边界落实。
这些动作同样保留真实 mutation、独立 fresh、写后证明、非零收尾失败及 G5 冲突恢复；
其提交后验收失败/未知与仅清理未完遵循以下结果原则，不能因没有索引发布而报零变化。
结果沿现有 CLI/SDK 边界表达，不要求两域 DTO 同形。以下“已提交”均指越过上述对应动作的提交点：

1. **预检或执行未写入**：不虚构 mutation；只有实际执行无写入才可报 no-change。
   预检成功不是提交成功，修正原因后仍须重新观察、显式执行。
2. **提交前已写入**：完整恢复并验收后报 `rolled-back`、非零，声明恢复范围和原错误，复核后决定是否重试。
   无法证明完整恢复则报 `partial-or-unknown`、非零，保留实际写集与未知事实，停止 mutation 并人工对账。
3. **已提交、验收及收尾完成**：报告实际 scope/mutation，才可附适用于该动作的成功 review。
4. **已提交、验收失败或未知**：非零；保留 committed 事实，以既有 `partial-or-unknown` 配合
   verification failed/unknown 表达实际已知 mutation。保留现场并对账来源/索引，不得仅称 cleanup pending，不鼓励直接重试。
5. **已提交、验收通过、仅收尾未完**：报 `committed-cleanup-pending`、非零，保留真实 mutation
   与精确残留/锁事实，不附成功 review。对账后处理残留，不重做领域写入。

候选创建始终保留实际 ID、sourcePath、created/changed，不以 ID 代替路径。
仅 readiness 未就绪按原候选成功规则报告；后续清理/解锁失败返回非零，不能报未创建或诱导重复 new。

提交后验收与清理可以同时失败：分别保留两种诊断，以验收失败/未知为主要事实，不合并为单一清理状态。
无 mutation 而解锁失败同样返回非零，但不得虚构 committed。
越过相应动作提交点后不再自动回滚已提交领域结果；需要恢复时先对账并取得对应授权。

##### G5 安全、零写与有归属的恢复

- workspace 与 collection 都核对 canonical 包含边界，覆盖 CLI 与既有公开 API。
  外部 symlink、父组件越界及读取中的路径替换拒绝；不能只做字符串前缀或仅 lstat 后 readFile。
- `show` 使用安全 FileHandle，核对同 inode、所读同一字节的 frontmatter ID，并严格 UTF-8 解码。
  返回完整正文，不套 content 搜索的 2MiB/preview 预算；非法 UTF-8 的新增拒绝属于已接受安全强化。
- 同 ID、同 sourcePath 的 rename 完成必要目标身份、安全与冲突核对后真零写入，不要求变更历史确认，
  不借机规范正文/索引或改 mode。实际改变身份/位置的严格事务仍保留全集来源、必要历史确认及资源 owner 验收。
- 删除最后一条正式记录后保留合法空索引，后续查询与 publish 仍有有效基线。
- 恢复只处理本事务**实际发生写入**的写集，不恢复尚未写入的预演成员。
  撤销覆盖/新建仅当当前位置仍匹配本事务 written bytes、identity 与 mode；恢复被删/搬走的旧路径仅在缺失时独占创建。
  索引同样 CAS，不能无条件把旧索引写回。恢复步骤也不覆盖后来创建的目标。
  完整旧范围与受保护未选状态均得到证明后才报 `rolled-back`；任一归属、恢复或后验不成立则保护后来修改、
  保留现场并报 `partial-or-unknown`。冲突转人工对账是已接受取舍，不承诺任意故障自动恢复。

### Resulting Impacts

#### 分批替换与退出顺序

按 0→6 推进。[tasks](tasks.md)拥有工作与验收进度；下表拥有切面依赖和退出约束。
每批完成替换、退役删除、直接文档/声明/生成/版本/Case 同步及受影响的有限验证再退出。
基线仅用于配对，不保留持久双轨、旧流程 fallback 或功能开关；恢复安全随对应事务批次交付。

| 批次 | 交付切面 | 可验收退出 |
| --- | --- | --- |
| 0 | 核对 owner/依赖与五组保证，冻结可重复同口径 baseline | 基线 fixture/命令/计量可恢复；产品改变与机械复用分开 |
| 1 | 两项结果纠错；按实际接入建立最窄共同 owner，收口 sync/source snapshot 与 selected baseline | 两错误定向证明；selected 保留全来源/未选保护/最终 fresh；对应重复准备旧路径删除 |
| 2 | 查询、selector、安全 show、字段窗口收集与惰性图 context | G1/G5 门槛；同投影所需图至多一份、目标一次解析；完整正文/计数/coverage；旧查询编排退出 |
| 3 | 候选 new/readiness/candidates/show-candidate | G3 的选择集合、无索引身份发现、warning/失败边界；同阶段来源映射复用；旧候选流程退出 |
| 4 | publish/set-relations；DR 独有生命周期接入共同安全写集 | G4/G5 普通事务、批发布、完整 replacement/review 与最终领域图；独立 fresh、实际 readback 和 CAS 恢复；旧普通事务退出 |
| 5 | 严格 rename/discard/带删除 evolve 与恢复 | 全集来源、历史与资源 owner 义务；G5 no-op/末条/CAS 与 G4 结果；旧严格执行/恢复退出 |
| 6 | 全命令及直接调用盘点、全量 check、独立分发与集成 | G2 生效；无共同流程绕过 owner/死 helper/重叠测试；stage/其他 runtime 消费者无回退；完整门禁通过 |

恢复机制随第 4 批普通事务建立并验证，第 5 批扩展到严格流程。
严格事务的锁前预演、锁内准备、写前 fresh、写后验收属于不同阶段，
不能因它们都读全集而整体删除；只消除同阶段无责任差别的重复取得。

#### 文档、决策与分发影响

相应实现前/同批同步两域行为规则、操作与恢复契约、README、help 和公开声明，不扩大公开导出集合。
[关系输入决策](../../docs/decisions/maintain-formal-record-relations-with-shared-input-contract.md)的
“不提取跨工具运行时组件”限制须在共同 owner 接入前显式修订；
[选择发布决策](../../docs/decisions/publish-investigation-candidates-selectively.md)的“全部正式 Markdown 新鲜”
须与局部发布和独立 fresh 的准确范围协调；
[DR 查询快照决策](../../docs/decisions/publish-decision-index-query-snapshots.md)随 G1 修订。
其他 G2–G5 长期取舍按既有 Decision Records 流程判断原记录修订或新记录，不由计划覆盖当前有效记录。
help 按[帮助投影决策](../../docs/decisions/project-record-discovery-semantics-into-cli-help.md)
校正过时 fallback/全集验证表述；[维护工作流](../../docs/record-maintenance-workflow.md)的验收投影与完整门禁一致。

构建沿现有 DR/IR adapter 各自生成依赖闭包；可分发副本不是第二份维护源。
每批同步受影响产物、声明和各 skill 独立版本，证明安装其中一个不依赖另一个 skill 或仓库路径。
共同契约测试只维护一份并分别对两域适配器执行，领域图/生命周期/资源及公开 CLI/SDK 集成独立保留。
新增、修改、删除测试时按[测试证据 owner](../../skills/test-evidence-review/SKILL.md)
维护保留的最小原生入口、单 Case 文件及派生索引，退役入口同步移除，不先创建空 Case。

#### 1W 验证与时间预算

每域 **10,000 条既有正式记录 + 固定 1 条或常数小批操作**，不是执行一万次命令。
固定正文规模、9,000 条稀疏关系、常数候选（代表场景 2 条）和 IR 常数资源/owner；资源不随 N 增长。
必要历史确认用具有完整 HEAD 的 fixture，不修改真实记录测量。
不重跑 100K，不做全命令×全参数×全故障矩阵；稠密图与大附件不在性能结论内。

- 同公开入口、同保证、同输入与计时封套前后配对；API/CLI 分开报告。
  新进程启动/import/渲染是否计入、预热和 OS 缓存口径一致；未清缓存不称冷缓存。
- 第 0 批冻结有限场景：sync full/selected 单改、查询小窗口/关系/content、候选 new/单项 readiness、
  普通事务单候选 publish/关系替换、严格事务单对象 rename/discard，以及全量 check 代表。
  主热点各 3 次，其余代表 1 次；每批只运行受影响项并复用有效证据，不逐批重复全矩阵。
- 记录 wall、user/system CPU、最大 RSS 与输出字节；read/parse/build/graph 次数分离采样，
  不把插桩混入正常计时；输入冻结、reset 与独立后验均在计时外。
- 串行运行，不与 Gate 或其他性能采样并发。发生不一致先保留精确现场并停止对应场景，
  修复后才补样本；错误输入/异常退出不计作成功收益。
- 独立后验核对精确来源/资源字节与 mode delta、entry/revision、完整未选状态、身份、返回/计数/coverage。
  selected 仍验全来源；只选一条不降低来源门槛。
- 小 fixture 覆盖坏图、无/坏索引、重复身份、非法 UTF-8、symlink/路径替换、源/index/成员漂移、
  清理/解锁、写后失败、当前写集 CAS、no-op/末条与批发布；比对文本/JSON、错误顺序、退出及恢复归属。
  这不是 1W 故障矩阵，也不把小 fixture 性能外推为大集合收益。
- 同保证机械替换不得稳定回退，噪声或回退须复核，不能只报最快值。
  G1–G5 保证变化单列接受拒绝与成本，不与机械节省相抵后隐去，不预设 3 倍收益。

各批按影响运行原生测试与相应 sync/check；完整变更验收运行 `bun run check:changed` 或 CI 全量门禁，
quick `bun run check` 不替代。性能、测试、门禁和计划结构检查分别报告；未来验证任务未完成前不宣称通过。

## Risks / Trade-offs

- G1 不再顺带发现无关坏图，G2 不保证结束新鲜，G3 起草允许未来 target；
  这些已接受收窄与安全/写后/恢复强化成本分别呈现，不包装成全保证等价。
- 合作锁不能排斥外部编辑；CAS/readback 不是跨文件原子快照，也不承诺恶意并发隔离。
  无法证明归属就保护后来修改并人工对账，不以方便重试为由隐去已发生写入。
- 独立 skill 携带共享副本是分发所需，不是安装耦合；新增消费者不自动扩张本 owner。
  完整索引/图与严格事务仍有全集成本，1W 常数小操作不证明成本仅随所选数量增长。

## Open Questions

无。五组产品保证、实现边界和有限验证口径均已确认；实际实施新发现若改变这些边界，
先更新本计划并按授权处理。
