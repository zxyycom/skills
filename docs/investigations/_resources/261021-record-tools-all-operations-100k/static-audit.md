# 固定版本静态成本线索

来源：Git 94f792e09efa39700005ace7e05be2bc14fb9579。以下为调用结构事实与下一轮候选，不是CPU/heap profile，也不是已闭合的OOM根因。没有修改生产实现。

## 决策事务

- tools/decision-records/src/decision-rename.ts:125：正式rename先scan全集，仅用initial.indexPath取得集合锁；锁内重新prepare、validate并scan。可调查由既有位置resolver取得锁路径，保留锁内正式校验。
- tools/decision-records/src/decision-transaction.ts:78–155：完整originalScan跨写入、同步和末次验证保留以供恢复。DecisionScan包含完整索引对象/字节以及所有已解析正文。可将rollback责任收敛为旧索引与确实改动的来源/路径，避免恢复一条时持续保留全集旧解析图。
- 同文件:117、196、219：写后candidateScan、独立sync(write)、末次scan→validateDecisionScan依次发生。index.ts:67–75的validateDecisionScan仍独立sync(check)；末次事务没有使用loadDecisionValidationContext→checkScannedDecisionIndex的同轮复用路径。可先接入已验证快照复用，再评估write路径复用，保留独立来源revision漂移检查、完整索引比较及错误优先级。
- decision-stage-service.ts:50–79先读全体revision作freshness gate；decision-stage-target.ts先读HEAD基线、再discover工作树；decision-stage-sources.ts:164–195验证所选来源又discover工作树全集。局部stage仍有完整基线与多轮发现成本。优化需保持身份重现、未知成员、完整pending和漂移保护，不能直接删掉验证。

## 决策发现与content

- decision-query-candidates.ts:59–80用scanDecisionRecords发现仅两份候选，show-candidate也使用该上下文。可调查只为候选读取完整正文、正式集仅取必要身份/安全证据的阶段分工；须保持同ID冲突和集合安全诊断。
- decision-query-search-content.ts:170起：loadDecisionIndex→loadCurrentDecisionIndexSnapshot→独立sync(check)，然后才select/searchRecordText。默认cap和关系小集合都先承担该准备。可尝试复用本轮验证证据；若将cap提前到当前来源验证之前，会改变错误优先级，属于需要owner明确的行为变化，而非纯常数优化。

## 调查rename

- tools/investigation-report/src/rename.ts:55–98：prepareRename在锁外及锁内分别发生。两轮prepared含sources/originalSources/投影等完整数据。
- rename-publication.ts:49–69：publication持有prepared与原文快照，在publishSources→资源移动→publishIndex后再verifyCommittedRename。rename-recovery.ts:16–25按originalSources捕获回滚快照。
- 可调查缩短锁外prepared存活时间、仅保留必要写入/回滚材料及复用已验证投影，同时保持正式锁内重读、写前漂移验证、资源owner移动与末次验证。

## 索引查询与metadata

- 小窗口/精确ID仍严格加载完整发布索引并建立查询结构；本轮不把list/show/trace时间相减当作构图或排序阶段时长。
- tools/investigation-report/src/query-search-metadata.ts:148–167：当前先为全部命中push DTO，最后slice(limit)。这是高命中负载下的静态空间候选，本轮只测少命中，不能从本轮数据声称已测得高命中收益。

## 归因限制

V8 fatal heap诊断和末尾GC日志证明受测进程触及heap边界；失败后的文件/完整索引对账只证明可见状态。没有分配profile/heap快照，不能断言具体保留集大小、精确崩溃语句或内存泄漏。优先级依据是本轮真实CLI耗时/容量失败与上述可审查调用结构，而非猜测的阶段百分比。
