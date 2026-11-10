# 旧领域结果信息粒度的兼容验收清单

本文保留原生 version 2 与旧领域结果的信息粒度核对清单，不是兼容性通过证明，也不定义领域规则。当前调用与序列化边界见[机器协议](protocol.md)，实际结果及差异以验证为准。旧 TypeScript 引用均相对于固定历史基线 [a88af9bc 的仓库树](https://github.com/zxyycom/skills/tree/a88af9bc029a1539c3abe57f69d752e4d39a868e)，不是现行工作树入口；现行实现从 [Record CLI 源码导航](README.md#源码导航)进入。

## 程序化结果到 JSON 的映射

以下是对旧领域结果所需信息粒度的兼容验收清单，不是宣称当前实现已逐字段实现。以[机器协议](protocol.md)所列原生 DTO 和输出分支为现行实现定位，以历史领域源码结果和行为契约为独立预期；对应关系和语义需要逐命令、成功及失败分支验证。version 2 移除不再产生事实的 `verification`、`outcome` 恢复状态、`recoveryBackups`、`recoveryDirectories` 和 `cleanupErrors`；下表其他业务信息仍须保留，不能通过恒空兼容壳虚构事实。字段缺失不得由其他字段的相似名称推定等价；只有有证据的分支才输出恢复事实，不能将不存在的值虚构为 null 或成功。

| 命令 | 待核对的业务信息及原生映射 |
| --- | --- |
| candidates/new/show-candidate | IR `candidate(s)`：`id,path,markdown,errors,warnings,readiness.{scaffoldValid,bodyReady,resourceReady}`；create 的 `status,changed`。DR `records/record`：`decisionId,sourcePath,projection,tags,status,alignment,createdAt,scaffoldValid,bodyReady`，show 的 `body`；new 附真实创建身份、路径和 readiness。 |
| check | IR `availableReportCount,selectedReportCount,indexChecked,indexPath,errors,warnings`；DR `summary.{activeCount,activationCandidateCount,bodyReadyCandidateCount,alignedCount,archivedCount,decisionCount,scaffoldCandidateCount,unalignedCount}`。 |
| list | IR `entries[].{id,state,filterRelations},indexPath,limit,offset,total,errors`；DR `records`（包括 `decisionId,sourcePath,projection,tags,status,alignment,createdAt,filterRelations`）、`source,appliedFilters,facets,limit,offset,total,warnings`。 |
| show | IR `status,id,indexPath,markdown,state,errors`；DR 完整正文、record、warning 与来源/revision 差异；不裁剪。 |
| search | 两域 `records`/`entries` 逐条保留完整记录、`filterRelations`，content `previews[].{line,column,preview,ranges[].{start,end}}`（IR column 可 null；即使文本不显示也保留），metadata `matchedFields,matchedRelations`；保留 `searchInfo.query.{text,in,match,filters,limits.{maxRecords,resources,preview}}`、`source.{kind,currentness,fallback}`、`counts.{matched.{value,precision},returned}`、`coverage.{scanComplete,resultsComplete,previewsComplete,reasons}`；DR content 另保留 `truncation`。IR 还保留 `status,indexPath,errors,warnings,failureKind`。 |
| trace | DR 保留 `status,source,anchorId,direction,limits,coverage,traceIds,contextIds,frontier,blockedEvent?,entries`；IR 保留原成功结果，**不补 source**。`limits.{depth,maxRecords}`、`coverage.{complete,stoppedBy}`、frontier 的 `fromId,direction,reason,nextIds`、blockedEvent 的 `kind,recordIds,requiredMaxRecords` 及 entries 全字段按各自结果类型原样输出；DR entries 多 status/alignment/purpose/background/decision，IR 为 title/formedAt/question/tags/relations。数组次序、可选字段省略及预算保持原实现。IR 实际成功输出须包含其运行时结果中的 `warnings`（声明类型并非唯一来源），warning 同时走 stderr。 |
| publish/set-relations | IR `changed,errors,indexPath,preflight,relationReview`；publish 另 `ids,warnings`，set-relations 另 `sourceIds`。review 包含 `phase,sources[].{sourceId,action,before,after}`；DR 对应的完整关系、生命周期、受影响对象和 review 一并保留。 |
| discard | IR `changed,deletedResourceIds,errors,id,requiresRecordedDeletionConfirmation`；正式对象另 `indexPath`。DR 保留选中身份、结果、确认/引用与 mutation 事实。 |
| rename | 两域核对 `oldId,newId,oldName,newName,oldSourcePath,newSourcePath,affectedCandidateRelationCount,affectedEstablishedRelationCount`；IR 另核对 `affectedResourceReferenceCount`。`affectedCountsScope: "selected-and-rewritten"` 限于所选及实际改写来源，IR 资源计数为字面引用，不为计数读取或改写未选候选。预检或失败时计划可映射至 `plannedIdentity`，IR 资源移动计划用 `plannedResourceOwnerMove`，实际结果用 `resourceOwnerMoved`。实际事务按可证明分支保留 `status,diagnostics,errors,changed,committed,writtenPaths,unknownPaths,warnings`；diagnostic 核对有据的 `code,reason,recovery,target,causeCategory,operation,detail,scope`，不以计划代替实际 mutation。原生映射见 [DR 身份输出](src/cli/decision_identity.rs)、[IR 身份输出](src/cli/investigation_identity.rs) 及[机器协议](protocol.md#命令结果和信息归属)。 |
| sync-index | IR `coverage.{source,currentness,checkedIds}`（选择性）、`changed,changedIds,diagnostics[].{code,reason,recovery,target},errors,indexPath,reportCount,scope,selectedIds,state,warnings`；DR 保留相应 coverage、状态与 diagnostics；多 selector 的目标、原因和恢复按输入顺序保留，IR `reportCount` 只在可信基线验证后提供。 |
| stage | IR `diagnostics[].{code,message,path,stateId},indexPath,namespace,selectedIds,status,state,changed`，成功加 `callerOwnedPaths,preservedPendingPaths,scope,writtenPaths`，失败时保留有据的 scope、步骤、路径及未知的 `changed:null`；DR 成功的 `command,indexRelativePath,pendingFileCount,callerOwnedPaths,preservedPendingPaths,scope,selectedIds,status,writtenPaths` 及失败诊断不得裁剪；多 selector 诊断保留可证明的目标、原因、恢复及类型细节，不伪造底层 I/O 原文。 |
| archive/evolve/mark-aligned/reactivate | 保留变更对象 ID、原/新生命周期与 alignment、实际关系 review、写入/预检状态和 mutation/recovery 事实；不以单个成功布尔替代。 |

搜索预算补充：DR content 的 `contextLines=1,maxFiles=20,maxMatchesPerFile=3,maxPreviewCharacters=12000`，未自定义资源限制时共同默认 `maxCandidateFiles=10000,maxFileBytes=2097152,maxTotalBytes=20971520`；IR content 分别为 `contextLines=1,maxFiles=limit,maxMatchesPerFile=3,maxPreviewCharacters=24000,maxCandidateFiles=2000,maxFileBytes=2097152,maxTotalBytes=20971520`。预算计算和超限语义仍以源码为准。

## Investigation 来源配置兼容

原有仅含内联来源对象的数组配置继续有效；直接定位的单源调用保持原结果形状。按 key 选择的结果采用[来源结果协议](protocol.md#investigation-多来源查询)，逐源保留上表所列业务信息。配置定义与展开规则见[来源配置契约](../../skills/investigation-report/references/source-selection.md)。

## 参数边界与 DR 写结果的精确承接

本节 `.ts` 路径、类型和结果名称均指上述历史基线；同名 `src/` 根据 DR 或 IR 上下文分别位于 `tools/decision-records/` 或 `tools/investigation-report/`。它们用于复核原有语义，不是当前实现位置。

- 两域 list/search 的 `--direction` 显式出现须同时有 `--related-to`；trace 不受此约束。list limit 为 1..1000 的安全整数，offset 为非负安全整数；trace depth 为非负安全整数或 `all`，max-records 为正安全整数。DR 时间筛选须带时区及秒的 RFC3339；时间区间顺序及 IR 时间、tag、ID 格式由 `tools/investigation-report/src/query/query-options.ts` 与 `src/cli/cli-parser.ts` 边界验证，不能将失败视为空集。DR 参数解析在 `src/cli/arguments/cli-option-parsers.ts`、`cli-command-arguments.ts`、`cli-new-arguments.ts`、`cli-search-arguments.ts`、`cli-relation-groups.ts`；IR 各命令白名单和 cardinality 在 `src/cli/commands/` 和 `src/cli/cli-parser.ts`。重复 singleton、重复 selector/tag/target、无效摘要及组合不得静默覆盖。
- DR `new` 的 `NewDecisionCandidateResult`（`src/candidates/decision-candidate-service.ts`）：`status,created,decisionId,sourcePath,warnings,changed,committed`；失败同时映射下述 failure。新建 `create_new` 不覆盖已有目标，但初始化失败可能留下部分新文件；按实际或未知结果提供 `changed`、`writtenPaths`、`unknownPaths` 和写入诊断，不得把失败简化为未创建或伪称回滚。
- DR `publish/evolve/reactivate/archive/mark-aligned/discard/set-relations` 走 `src/cli/commands/cli-maintenance-execution.ts` 的 `DecisionLifecyclePreparation` 与 `src/transactions/decision-transaction.ts` 的 `DecisionTransactionResult`；兼容验收应保留 `status,changed,committed,sourcePaths,diagnostics,errors,scope`（只在有据分支输出），准备的 `message` 和可选 `relationReview` 不代替实际结果。review 的 source 包含 `sourceId,action,before,after`，relation 的 `type,target,summary?` 保持输入；preflight 是预计，不能伪造写后验证或无依据的 committed review。请求 ID、发布/归档/删除的真实选集及可见写集从同次准备映射，不能从成功文案反推。
- DR failure/attention（`src/application-result.ts`）映射 `status,exitCode,diagnostics,errors` 或 `warnings`，failure 另 `presentation`；diagnostic 保留 `code,reason,recovery,target` 和可选 `causes,source,causeCategory,detail,scope`。`source`/`causes` 按 `tools/record-operations/src/history-index.ts` 原类型保留。实际结果没有的字段不伪造；失败结果只报告实际可证明的已完成和未知事实。
- DR `sync-index` 额外按 `DecisionQueryResult` 映射 `changedIds,indexRelativePath,scope,selectedIds,selectors,state:current|unchanged|previewed|written,unactivatedPaths,warnings,coverage?`；stage 成功字段及 rename 分支见上表。对不经 TS SDK 的 CLI 领域动作，JSON 是原生 CLI 的公开承接，不声称旧版提供同形结果。
