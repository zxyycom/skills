# 两域候选 CLI 能力映射（Readiness 0.1）

本文件是迁移调查与候选接口输入，不改变现行契约，也不是实现或验收证据。行为权威分别是 [DR CLI](../../skills/decision-records/references/cli-operations.md)、[IR CLI](../../skills/investigation-report/references/cli-operations.md)、[共同事务模型](../../tools/record-operations/model.md)、各自 stage 契约和工具 README。下表所有行均须连同共同规则阅读；领域语义、资源与恢复不由此表替代。

## 共同输入、边界和输出

- 两域 `--root` 默认 cwd；DR `--decisions-dir` 默认 `docs/decisions`，IR `--investigations-dir` 默认 `docs/investigations`，均为工作区相对路径。`help [command]`、`<command> --help` 只读帮助。以下 `S` 为 selector：去一个末尾 `.md`（忽略大小写），标准日期 ID 精确匹配，其余 name 须唯一；候选选择限候选。`S+` 为至少一个，`*` 为可重复。
- `R` 是 `--related-to S --direction both|predecessors|successors --relation-type T`，可各自省略；方向默认 both，方向相对 anchor；目标和类型同用必须命中同一边。`T`：DR `修订|替代|判定无效|归并|拆分|重划`；IR `补充|复查|修正|推翻|归并|拆分`。`--tag` 重复 AND。其他筛选交集。`--direction` 的合法依赖和数值边界以实际参数解析为准。
- `G` 是一个或多个 `--source S` 开始的关系完整替换组，组内重复 `--relation T=S`、`--relation-summary S=文本` 或单独 `--clear-relations`；摘要按首个等号拆分，组内匹配唯一 target；不合并旧值，不提供摘要即删除旧摘要。空组、重复或混合清空、未匹配摘要失败。
- 所有只读查询无 mutation 授权；写入须授权精确对象和影响，删除/已记录身份更正另须精确授权；CLI 确认不替代授权。非 stage 写入不碰 Git pending；stage 只刷新所选 pending，不 commit/push。预检不写、不持独占写锁且不保存凭据；正式调用锁内重新准备，独立 fresh，提交后独立验收。局部操作不能证明未选正文健康。
- 当前文本模式 stdout 成功、stderr warning/错误；0 成功（包括未就绪候选）、1 领域/检查/操作失败或确认暂停、2 参数错误。候选新增 JSON 模式：stdout 单个机器对象（包括可判读的领域失败），stderr 诊断；exit 保持 0/1/2。既有成功 trace JSON 原样继承，不能增加统一包装。其他 JSON 使用下述字段映射，字段结构仍须实现前冻结 schema 和 null/省略规则；不能声称现有 CLI 已提供这些 JSON。
- 共同错误：参数非法、选择器缺失/歧义、无效索引、路径逃逸/符号链接/非普通文件、非法 UTF-8、身份或 revision 不符、锁忙、Git/IO/CAS 失败均不能伪装为空结果。必须保留 diagnostic 与 recovery；写入结果区分 `no-change`、`rolled-back`、`partial-or-unknown`、`committed-cleanup-pending`，提交后失败不得自动回滚或报告零写。具体提交点和锁释放失败依据领域 owner。

## 命令、选择与语义

| 命令（DR 18 / IR 14） | 参数与默认；作用、前提及成功事实 |
| --- | --- |
| candidates | 无；直接发现候选，单份可分类坏候选 warning 并跳过；不安全成员、重复 ID 等失败。返回候选身份、位置与 readiness。 |
| check | DR 无参数，全量；IR `--id ID`* 可选局部，否则全量。检查来源、图、索引及 IR 资源；局部不证明全集。失败 exit 1，警告非失败。 |
| discard | `S`；`--delete-recorded` 默认 false；IR 另 `--delete-owned-resources` 默认 false。选一个候选或正式对象；拒绝正式引用、未授权资源、HEAD 确认不足，正式删除同步索引。报告真实删除范围、残留和恢复。 |
| list | `--tag`*、R、`--limit 10`（最大 1000）、`--offset 0`、`--detail`；DR 另 `--status active\|archived\|all` 默认 active、`--alignment aligned\|unaligned\|all` 默认 all、`--created-from/--created-to`、`--full-time`；IR `--formed-from/--formed-to`。时间含端点。发布索引选集、分页和 facets；不证明正文当前。 |
| new | `S --title 文本 --tag`* `--relation T=S`* `--relation-summary S=文本`*；DR 另必填 `--purpose`、`--background`、`--decision`、`--preflight-alignment aligned\|unaligned`（只辅助 readiness，不写入）；IR 必填 `--question` 和至少一个 `--tag`，另 `--formed-at RFC3339`（默认一次当前 UTC）。不覆盖创建单个 candidate，完整 ID 日期与形成时间匹配；未就绪不撤销创建，报告实际 ID/path/readiness。 |
| publish | DR `S --alignment aligned\|unaligned [--keep-unrecorded-history] [--preflight]`；IR `S+ [--preflight]`。DR 单候选并归档活动前序，IR 多候选同事务闭合最终图；执行前 body/resource readiness、授权、图和历史门禁；预检关系审阅不是提交。 |
| rename | `source target [--preflight]`；DR `--rename-recorded-decision`，IR `--rename-recorded-report` / `--rename-recorded-candidate`。确认身份、位置、冲突、历史和实际引用写集；保持日期语义，修复受管引用；IR 包括资源链接及 owner。真正 no-op 仍安全验证。报告计划及真实结果。 |
| search | `text --in content\|metadata` 默认 content，`--match all\|any\|phrase` 默认 all，`--tag`*、R；DR `--status` 默认 active、`--alignment` 默认 all，metadata `--limit 100` 最大 1000（content 固定 20、不接受 limit）；IR `--formed-from/--formed-to`、`--limit 50` 最大 1000。匹配 NFKC、大小写无关；content 当前文本按物理行，metadata 发布快照。返回完整搜索信息、计数及预算；不是全集当前性证明。 |
| set-relations | `G [--preflight]`；只选正式记录并完整替换关系，同事务验证最终图及同步索引。关系 review 明确 preflight/committed 和每源 before/after/action，失败不得伪造成功 review。 |
| show | `S`；索引定位安全读取所选当前完整 Markdown、严格 UTF-8 和 ID，revision 不同 warning；不受预览预算限制。 |
| show-candidate | `S`；只选候选，返回完整正文和独立 readiness；不证明正式全集健康。 |
| stage | `S+ --scope all\|index\|domain` 默认 all；DR stage 校验 ID 语法并随后解析选择；Git HEAD/worktree/pending 保护，完整刷新所选 scope，保留未选 pending。IR domain 包含完整 owner 资源树。报告实际写集、保留与 caller-owned 路径、pending 恢复事实。 |
| sync-index | `--select S`*（不选全量）`[--preflight]`；全量验当前来源并重建，选择性依赖可信发布基线、所选路径及必要依赖，仍验证完整组合图。报告 coverage/checkedIds 和 selected、状态、变更与恢复；不声称未选来源当前。 |
| trace | `S --direction both\|predecessors\|successors` 默认 both；`--depth n\|all` 默认 5；`--max-records n` 默认 50；`--json`。发布图完整验证，受预算约束，frontier 非 cursor，事件须整体纳入；不查当前正文。 |
| DR archive | `S+ [--keep-unrecorded-history]`；active → archived，保留 alignment/关系；HEAD 未记录历史需显式确认，报告实际变更。 |
| DR evolve | `--successor alignment=S`* 完整后继集合，`--discard S` 可选、`--delete-recorded`、`--keep-unrecorded-history`、`--preflight`；关系可 G，或未分组 `--relation`/`--relation-summary`/`--clear-relations` 统一替换，二者互斥。候选建立、活动前序归档及可选删除同事务，验证拆分/重划闭合和历史门禁。 |
| DR mark-aligned | `S`；仅 active unaligned，在完整方向已成为事实并经审核后标 aligned。 |
| DR reactivate | `S --alignment aligned\|unaligned [--preflight]`；archived → active，保留 createdAt 和关系，不接受覆盖。 |

## 程序化结果到 JSON 的映射

对尚无 JSON 的命令，以下为拟议字段投影，保持原值、数组顺序和状态，不只输出 text renderer 所显示的子集；完整具体类型以链接源码为待验证的字段清单。每个对象还保留 errors/warnings/diagnostics 和足以执行恢复的事实；不存在的不虚构为 null 或成功。字段形状、失败类别、协议版本在 0.3 冻结。

| 命令 | 旧结果 → JSON 字段（同名直映，除明确注明） |
| --- | --- |
| candidates/new/show-candidate | IR `candidate(s)`：`id,path,markdown,errors,warnings,readiness.{scaffoldValid,bodyReady,resourceReady}`；create 的 `status,changed`。DR `records/record`：`decisionId,sourcePath,projection,tags,status,alignment,createdAt,scaffoldValid,bodyReady`，show 的 `body`；new 附真实创建身份、路径和 readiness。 |
| check | IR `availableReportCount,selectedReportCount,indexChecked,indexPath,errors,warnings`；DR `summary.{activeCount,activationCandidateCount,bodyReadyCandidateCount,alignedCount,archivedCount,decisionCount,scaffoldCandidateCount,unalignedCount}`。 |
| list | IR `entries[].{id,state,filterRelations},indexPath,limit,offset,total,errors`；DR `records`（包括 `decisionId,sourcePath,projection,tags,status,alignment,createdAt,filterRelations`）、`source,appliedFilters,facets,limit,offset,total,warnings`。 |
| show | IR `status,id,indexPath,markdown,state,errors`；DR 完整正文、record、warning 与来源/revision 差异；不裁剪。 |
| search | 两域 `records`/`entries` 逐条保留完整记录、`filterRelations`，content `previews[].{line,column,preview,ranges[].{start,end}}`（IR column 可 null；即使文本不显示也保留），metadata `matchedFields,matchedRelations`；保留 `searchInfo.query.{text,in,match,filters,limits.{maxRecords,resources,preview}}`、`source.{kind,currentness,fallback}`、`counts.{matched.{value,precision},returned}`、`coverage.{scanComplete,resultsComplete,previewsComplete,reasons}`；DR content 另保留 `truncation`。IR 还保留 `status,indexPath,errors,warnings,failureKind`。 |
| trace | DR 保留 `status,source,anchorId,direction,limits,coverage,traceIds,contextIds,frontier,blockedEvent?,entries`；IR 保留原成功结果，**不补 source**。`limits.{depth,maxRecords}`、`coverage.{complete,stoppedBy}`、frontier 的 `fromId,direction,reason,nextIds`、blockedEvent 的 `kind,recordIds,requiredMaxRecords` 及 entries 全字段按各自结果类型原样输出；DR entries 多 status/alignment/purpose/background/decision，IR 为 title/formedAt/question/tags/relations。数组次序、可选字段省略及预算保持原实现。IR 实际成功输出须包含其运行时结果中的 `warnings`（声明类型并非唯一来源），warning 同时走 stderr。 |
| publish/set-relations | IR `changed,errors,indexPath,preflight,relationReview`；publish 另 `ids,warnings`，set-relations 另 `sourceIds`。review 包含 `phase,sources[].{sourceId,action,before,after}`；DR 对应的完整关系、生命周期、受影响对象和 review 一并保留。 |
| discard | IR `changed,deletedResourceIds,errors,id,requiresRecordedDeletionConfirmation`；正式对象另 `indexPath`。DR 保留选中身份、结果、确认/引用与 mutation 事实。 |
| rename | IR `changed,errors,indexPath,status,plan`，plan 包含 `affectedCandidateRelationCount,affectedEstablishedRelationCount,affectedResourceReferenceCount,newId,newName,newSourcePath,oldId,oldName,oldSourcePath,outcome,resourceOwnerMoved`；DR plan 为 `affectedCandidateRelationCount,affectedEstablishedRelationCount,newId,newName,newSourcePath,oldId,oldName,oldSourcePath,outcome`；结果保留 `status,plan,diagnostics,errors,exitCode,presentation,changed,committed,verification,outcome,warnings` 各分支实际存在字段。diagnostic 的 `code,reason,recovery,target,causeCategory,detail,outcome,scope` 不丢弃。 |
| sync-index | IR `coverage.{source,currentness,checkedIds}`（选择性）、`changed,changedIds,diagnostics[].{code,reason,recovery,target},errors,indexPath,reportCount,scope,selectedIds,state,warnings`；DR 保留相应 coverage、状态与 diagnostics。 |
| stage | IR `diagnostics[].{code,message,path,stateId},indexPath,namespace,selectedIds,status,state,changed`，成功加 `callerOwnedPaths,preservedPendingPaths,scope,writtenPaths`，恢复失败保留 `pending.{outcome,scope}` 与 `changed:null`；DR 成功的 `command,indexRelativePath,pendingFileCount,callerOwnedPaths,preservedPendingPaths,scope,selectedIds,status,writtenPaths` 及失败诊断不得裁剪。 |
| archive/evolve/mark-aligned/reactivate | 保留变更对象 ID、原/新生命周期与 alignment、实际关系 review、写入/预检状态和 mutation/recovery 事实；不以单个成功布尔替代。 |

搜索预算补充：DR content 的 `contextLines=1,maxFiles=20,maxMatchesPerFile=3,maxPreviewCharacters=12000`，未自定义资源限制时共同默认 `maxCandidateFiles=10000,maxFileBytes=2097152,maxTotalBytes=20971520`；IR content 分别为 `contextLines=1,maxFiles=limit,maxMatchesPerFile=3,maxPreviewCharacters=24000,maxCandidateFiles=2000,maxFileBytes=2097152,maxTotalBytes=20971520`。预算计算和超限语义仍以源码为准。

## 参数边界与 DR 写结果的精确承接

- 两域 list/search 的 `--direction` 显式出现须同时有 `--related-to`；trace 不受此约束。list limit 为 1..1000 的安全整数，offset 为非负安全整数；trace depth 为非负安全整数或 `all`，max-records 为正安全整数。DR 时间筛选须带时区及秒的 RFC3339；时间区间顺序及 IR 时间、tag、ID 格式由 `tools/investigation-report/src/query/query-options.ts` 与 `src/cli/cli-parser.ts` 边界验证，不能将失败视为空集。DR 参数解析在 `src/cli/arguments/cli-option-parsers.ts`、`cli-command-arguments.ts`、`cli-new-arguments.ts`、`cli-search-arguments.ts`、`cli-relation-groups.ts`；IR 各命令白名单和 cardinality 在 `src/cli/commands/` 和 `src/cli/cli-parser.ts`。重复 singleton、重复 selector/tag/target、无效摘要及组合不得静默覆盖。
- DR `new` 的 `NewDecisionCandidateResult`（`src/candidates/decision-candidate-service.ts`）：`status,created,decisionId,sourcePath,warnings,changed,committed,verification`；失败同时映射下述 failure。`created:true` 可与失败并存（创建后解锁或验收失败），不得简化为失败即未创建。
- DR `publish/evolve/reactivate/archive/mark-aligned/discard/set-relations` 走 `src/cli/commands/cli-maintenance-execution.ts` 的 `DecisionLifecyclePreparation` 与 `src/transactions/decision-transaction.ts` 的 `DecisionTransactionResult`；候选 JSON 组合为 `status,changed,committed,verification,sourcePaths,diagnostics,errors,outcome,scope`（只在原分支存在时输出），成功准备另保留 `message` 和可选 `relationReview`。review 精确为 `phase:preflight|committed`、`sources[].{sourceId,action:establish|replace|unchanged,before,after}`，relation 的 `type,target,summary?` 保持输入。preflight 是预计，提交前失败不得给 committed review；操作事实以已通过验收的真实结果为准。请求 ID、发布/归档/删除的真实选集及可见写集从同次准备映射，不能从成功文案反推。
- DR failure/attention（`src/application-result.ts`）映射 `status,exitCode,diagnostics,errors` 或 `warnings`，failure 另 `presentation`；diagnostic 保留 `code,reason,recovery,target` 和可选 `causes,source,causeCategory,detail,outcome,scope`。`source`/`causes` 按 `tools/record-operations/src/history-index.ts` 原类型保留。实际结果没有的字段不伪造；注意 `partial-or-unknown` 不代表已回滚。
- DR `sync-index` 额外按 `DecisionQueryResult` 映射 `changedIds,indexRelativePath,scope,selectedIds,selectors,state:current|unchanged|previewed|written,unactivatedPaths,warnings,coverage?`；stage 成功字段及 rename 分支见上表。对不经 TS SDK 的 CLI 领域动作，JSON 是此候选的新公开承接，不声称旧版提供同形结果。

## 可核对来源与调用范围

- 命令和实际 help：`tools/decision-records/src/cli/arguments/cli-args.ts`、`tools/investigation-report/src/cli/cli-contract.ts`、两域 `src/cli.ts`。调查使用 Node 26.8.2 对各命令运行 `help`，未对真实集合执行 mutation。IR 实际 success trace 的 runtime `warnings` 要以 `tools/investigation-report/src/cli/commands/cli-query-commands.ts` 及结果实现为准；DR 映射见 `tools/decision-records/src/cli/output/trace/cli-output-trace.ts` 和 `src/query/decision-query-contract.ts`。
- 直接公开导出：DR wrapper 为 `runDecisionRecordsCli,renameDecisionRecord,scanDecisionRecords,validateDecisionRecords`；声明入口 `skills/decision-records/scripts/decision-records-sdk/cli.d.mts`。IR wrapper 为 `runInvestigationReportCheckCli,createInvestigationCandidate,createInvestigationCandidateFromCli,discardInvestigationRecord,listInvestigationCandidates,publishInvestigationCandidates,queryInvestigationIndex,renameInvestigationRecord,searchInvestigationReports,setInvestigationRelations,showInvestigationCandidate,showInvestigationReport,stageInvestigationReports,synchronizeInvestigationIndex,traceInvestigationReports,validateInvestigationReports`；声明 owner `tools/investigation-report/api/check-investigations.d.mts`。`createInvestigationCandidateFromCli` 是 wrapper 的额外直接导出，不因此自动设计新命令。DR scan/validate 的低层 SDK 不机械新增命令；保留现有用户依赖事实以 check 等能力承接。
- 可核实生产命令入口 `package.json` 的 `decision-records`、`investigation-report` 与 `check:decisions`、`check:investigations`；生成维护为 `scripts/build/decision-records.ts`、`scripts/build/investigation-report.ts`；`scripts/validators/project-config.ts` 校验 package 入口；`scripts/lib/vibe-gate/checks/semantic.ts` 与两域 tests 为维护/测试调用，不是新生产消费者。`docs/complex-bug-investigation.md` 实际规定 IR `check --id`、`sync-index`、`check`；`docs/record-maintenance/{decisions,investigations}.md` 分别使用两域 `check` 以获得全量基线；`docs/tooling-commands.md` 列出两命令入口。消费是退出状态、人类诊断与范围，不是程序化 JSON。`tools/investigation-report/src/cli/commands/cli-candidate-create.ts` 内部消费 `createInvestigationCandidateFromCli` 的 status、candidate.id/path/readiness、changed、diagnostics/errors/warnings；这是 CLI 内部而非外部 SDK 消费。`tools/decision-records/src/index.ts` 的 validate 内部调用 scan，构建器只消费 index schema。两个 SKILL 的 CLI 使用示例是公开使用契约，不等同证明外部执行。仓库内查询不覆盖外部安装及私有脚本，不能推断无人使用 SDK。

## 未闭合事项

已批准差异：首版 Rust 候选拒绝源文档和索引文本中的孤立 UTF-16 代理项，并返回结构化诊断；不替换为 U+FFFD。私有 fixture 已确认旧 IR 的 title、question、relation.summary 可通过 TS parse/sync/check 并保留此类 JSON 转义，此差异不应标为旧输入本就非法。普通文字、完整 emoji 及预览截断产生的原有 JSON 输出不受此决定影响；现行 TS 行为不变。

公开导出与生产、维护调用的核查限仓库源码、项目文档、package scripts；测试及生成副本单列，历史测量不是当前生产调用。外部私有样本可选，不作为阻塞；目前未提出需用户批准的兼容性差异。此映射规定信息保持与来源，字段的统一 envelope、各分支缺省/省略及 schema 权威源仍须 0.3 定稿，不能把本表当已运行的候选协议。Windows/Linux targets 与验证属于 0.2，不因本稿视为已证明。
