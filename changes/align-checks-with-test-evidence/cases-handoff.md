# Case 整合交接

## Owner 与结果

- 本 owner 只修改本 Change 的 `docs/test-evidence/cases/*.md`、本交接和授权后的公共派生索引；未修改测试、产品、wrapper、长期 docs、其它 Change，没有 stage-index、Git stage、commit 或 push。
- 实际差异：**114 个既有 Case 修改、47 个新增、2 个删除**。11 个他会话新 Case 与开始时逐字节相等；公共索引完整同步包含它们，但它们不在本方下列 CaseID 选择集合中。根代理提交时需继续区分公共 working 索引与所选 Git pending 投影。
- 真实稳定快照：`.log/vibe-check/case-integration/entities-final-gate-followup.json`，complete / **1691 entities**；projectId=`skills-workspace`、scopeId=`repository-native-tests-v1`、revision=`c22da2066eb1fc04bd4cddaf60ebf3008ac610c1f816aa5379688ef5470c923d`。该快照在 TG filename/source 表达优化及最后 Gate 迁移/拆分后重新采集。

## 人工意图决定

1. 共同事务10对重复证明在现有10个共同 Case 内合并为一个 shared 实体，保留原 CaseID；3个phase verification与plan/text-snapshot/source读保护、DR真实worker大发现、Node生成协议和RC1短命令移动保持意图连续。两域 adapter、真实mode/umask、Git、worker、锁、硬预算/规模入口均保留。
2. 只删除 `DR-INDEX-PAYLOAD-PHASE-COUNT-001` 与 `IR-INDEX-PAYLOAD-PHASE-001`：旧 Proves 仅锁5/4总batch进程组织，不承接独立行为。其所需安全事实继续由独立 W、完整 P oid/mode/member/deletion、required payload两阶段失败、fresh/parse复用/changed bytes/BOM、锁与readback入口承接，没有用最低次数继续锁私有组织。
3. DR旧9合1索引测试按真实意图归属：原CaseID承接规范重建/definition与原parser sibling，另7个Case分别承接purpose、合法unaligned、非法alignment零写、坏当前body的发布查询、title长度、发布关系漂移与显式title同步。5个固定UTCDate实体共同承接独立UTC日历Case，不从系统时钟或产品formatter产生预期。
4. 原activation CaseID延续发布身份，另4Case承接既有动作拒绝、缺索引对齐恢复、归档再启用身份、归档discard。旧lease ID延续renew/expiry，其余6意图新Case；core-stage复用现有意图Case分别接新独立节点，不机械新建重复Case。
5. TG原distribution ID只承接API/version；SDK、metadata、schema独立；SDK声明证明真实tsgo consumer与私有API不泄漏，不锁私有文件名单。error JSON与8000 lineage独立；8000不冒称公开容量/真实Node栈验收。portable只声明不同checkout路径字节可复现。
6. publish分别承接candidate/index保护、资源inode拒绝、同inode资源bytes接受；formalDrift纠正为未选依赖当前正文更新可成功发布的正向契约。graph仅保留真实provider访问、引用/快照隔离、完整结果与邻接约束，不再锁Map/Array/relations.map私有算法计数。
7. Gate新12实体各有独立Case；旧输入矩阵按runtime/test与真实consumer收窄，完整catalog数字69/66/58同步，secret只证明项目固定limits与3个小选集smoke，不称实际超容量截断。type-aware lint为保守订阅而非trace证明。
8. validate孤儿2节点、publisher失败重试、显示耗尽后cancellation各有独立Case。F updater四项规则降层只声明源码API拒绝，不称真实CLI目录零写；auto-push未改原Case，不补造CAS冲突命中。D cache inode Case只称文件未替换；MCPShell受控同步seam不泛化真实SSH任意交错；LJ image credential/fetch与Novel BOM/真实重建集合按外层观察准确表述。

## 最终入口归属

- 完整保留入口映射（1691实体，每实体带真实name/locators/CaseID）在 ignored `.log/vibe-check/case-integration/final-entity-case-ownership.json`；本轮当前改动测试leaf对应553实体在同目录`changed-leaf-ownership.json`。它们只从最终人工Case集合反查归属，不生成Contract/Proves，不是长期索引。
- 最终Tests均来自本次真实快照、词法排序、无悬空；所有实体均至少一Case。一个Case按同一意图可列多个Tests，同一实体支持多个现有不同Case并未机械删除。
- 完整本方Case路径与CaseIDs另在ignored `own-case-paths.txt` / `own-case-ids.txt`；下列集合含两删除ID，供根代理核对选择性stage-index，不包含他方11Case。

## 验证与首次失败

- 第一次公共 snapshot 因新增index9参数化注册静态定位found0而失败，没有伪造空快照；原records owner将index9/Date5改显式字面注册。后续F record-staging ternary同类阻断由原owner定向修复。未扩大collector或改产品。
- 公共`bun run snapshot:test-evidence -- --output <new ignored file>`成功采集1688实体；最后再刷新得到上述stable revision。
- 首次`bun run sync:test-evidence-catalog`被一份ID替换后未重新排序的Tests拒绝，未发布索引；只对本方最终Tests集合词法排序后第二次同步 **ok**。
- 最后`bun run check:test-evidence-catalog` **exit0 / test evidence project check passed (1688 entities)**；项目入口独立计算当前expected source并检查Case/index、引用、完整覆盖和结束漂移，不以抄snapshot source自证。日志：`.log/vibe-check/case-integration/catalog-check.log`。
- `git diff --check -- docs/test-evidence/cases docs/test-evidence/test-evidence-index.json`通过；11个排除Case逐字节不变断言通过。本owner没有执行测试产品逻辑，目标测试执行证据仍分别由5份测试owner handoff承接；未运行全Gate、安装、真实服务、Windows或release。
- 修改目录范围的最终`bun run check:changed`及隔离提交snapshot的验证由root集中完成；本处引用/覆盖通过不代替测试通过或完整Change验收。

## 最后 Gate 定向修复后的 Case 跟进

- native-selection 的两项 policy 与 profiles 的三项 CLI 性能节点同名迁入 native-policy / cli-performance；5个真实实体ID只按本次公共快照更新，全部CaseID、Contract与Proves连续。其中报告写失败Case是本方新增触及的第114个既有Case。
- `GATE-RECORD-OPERATIONS-INPUTS-001` 现在只承接原名节点保留的共同runtime传播；原三条责任中的 helper隔离与domain输入矩阵改由新增 `GATE-QUERY-ADAPTER-HELPER-OWNER-001` 与 `GATE-DOMAIN-TEST-INPUT-OWNER-001` 承接，不把原广Proves重复到每个子节点。
- 聚合run目录归属新增 `GATE-DOMAIN-AGGREGATE-OWNER-001`，只声明两域run代表路径保持closed/incremental、两catalog consumer执行、矩阵指定领域检查复用；不声称读取全部未来任意run。
- 新公共snapshot实际 **1691实体（净+3）**，新revision见开头；工作区完整sync **ok**，`bun run check:test-evidence-catalog` **exit0 / test evidence project check passed (1691 entities)**。日志 `.log/vibe-check/case-integration/catalog-check-gate-followup.log`。
- 本轮9份Case写入（5迁移Case、1拆分原Case、3新Case），累计选择集合 **163 CaseIDs = 114修改 + 47新增 + 2删除**。完整`own-case-ids.txt` / `own-case-paths.txt`已整体刷新，不是仅本轮增量。完整反查映射也已刷新为1691实体。
- 仍未stage-index、Git stage或修改Gitindex，11个他方Case与开始字节一致。1691仍是混合工作区证据；最终隔离staged snapshot须由root重验，不能以本次通过替代其验收。

## 删除 ID 的选择性 stage 支持（只读复核）

- 支持。`tools/test-evidence/src/core-references.ts#stageTestEvidenceIndex` 只验证非空/唯一/合法 CaseID，然后委托 runtime；`tools/index-runtime/src/staging-operation.ts` 仅当 ID 在 baseline 与 workspace 两份索引都缺失时拒绝。
- `tools/index-runtime/src/staging-selection.ts#selectTargetSnapshot` 对所选ID采用 workspace，workspace已删条目即跳过；未选ID采用baseline。因此两删除ID只要仍在HEAD基线中，就能显式选中将其从pending索引删除，不要求当前Case Markdown存在。
- `tools/test-evidence/tests/core-stage.test.ts` 的 `stage removes all selected Cases from the Git index when the catalog becomes empty` 是对应保留原生证据；本owner此次只读代码/测试，未执行任何stage。
- 本轮1688通过只证明**暂停他会话后的混合工作区**。根代理排除他方产品与11Case后，需要对隔离提交snapshot重新采集/引用/覆盖/Gate验收，不能沿用混合sourceRevision作该提交证据。

## 本方完整 CaseID 集合

```text
CHANGE-PLAN-LIFECYCLE-REFRESH-001
DECISION-ACTIVATION-ARCHIVE-001
DECISION-CANDIDATE-ACTIVATION-INDEX-001
DECISION-CLI-NODE-SMOKE-001
DECISION-DATE-UTC-CALENDAR-001
DECISION-FILTER-EVIDENCE-LINEAR-001
DECISION-INDEX-ALIGNMENT-WRITE-GUARD-001
DECISION-INDEX-MAINTENANCE-001
DECISION-INDEX-PUBLISHED-INVALID-BODY-001
DECISION-INDEX-PUBLISHED-RELATION-DRIFT-001
DECISION-INDEX-PURPOSE-001
DECISION-INDEX-TITLE-LENGTH-001
DECISION-INDEX-TITLE-SYNC-001
DECISION-INDEX-UNALIGNED-001
DECISION-LAZY-GRAPH-CONTENT-001
DECISION-LAZY-GRAPH-CONTEXT-001
DECISION-LAZY-GRAPH-FAILURES-001
DECISION-LAZY-GRAPH-ISOLATION-001
DECISION-LIFECYCLE-ALIGNMENT-RECOVERY-001
DECISION-LIFECYCLE-ARCHIVE-RECOVERY-001
DECISION-LIFECYCLE-ARCHIVED-DISCARD-001
DECISION-LIFECYCLE-EXISTING-GUARD-001
DECISION-STAGE-INPUT-001
DR-INDEX-PAYLOAD-PHASE-COUNT-001
ENV-CHECK-READONLY-001
ENV-METRICS-PREREQUISITES-001
FILE-TEXT-SEARCH-MODES-001
GATE-CATALOG-LEAF-OWNER-001
GATE-CLI-PERFORMANCE-BOUNDARY-001
GATE-CLI-PERFORMANCE-WRITE-FAILURE-001
GATE-DECISION-ACQUISITION-CLI-CLOSURE-001
GATE-DEFINITION-CATALOG-001
GATE-DOMAIN-AGGREGATE-OWNER-001
GATE-DOMAIN-TEST-INPUT-OWNER-001
GATE-ENVIRONMENT-CHECK-001
GATE-ENVIRONMENT-VALIDATOR-OWNER-001
GATE-FUNCTION-LIMIT-POLICY-001
GATE-GENERATED-TYPE-INPUTS-001
GATE-GENERATION-PRECONDITION-001
GATE-INCREMENTAL-ACTIVATION-001
GATE-INVESTIGATION-CLI-OWNER-001
GATE-NATIVE-DURATION-BUDGET-001
GATE-QUERY-ADAPTER-HELPER-OWNER-001
GATE-QUICK-RECEIPT-ISOLATION-001
GATE-RECORD-OPERATIONS-INPUTS-001
GATE-RELEASE-FULL-EXECUTION-001
GATE-SCHEMA-BINDING-POLICY-001
GATE-SECRET-CAPACITY-001
GATE-SEMANTIC-IMPORT-SYNTAX-001
GATE-SHARED-CONTRACT-OWNER-001
GATE-TEST-EVIDENCE-ADAPTER-OWNER-001
GATE-TOOL-CAPABILITY-ROUTING-001
GATE-VIDEO-INPUT-CLOSURE-001
INDEX-PREPARED-READER-001
INDEX-RUNTIME-EMPTY-RECORD-001
INDEX-RUNTIME-KEY-VALUE-001
INDEX-RUNTIME-READER-LOAD-001
INVESTIGATION-CANDIDATE-PUBLISH-003
INVESTIGATION-CANDIDATE-PUBLISH-005
INVESTIGATION-CLI-SINGLE-OPTIONS-001
INVESTIGATION-DISCARD-IDENTIFICATION-001
INVESTIGATION-LAZY-EVIDENCE-001
INVESTIGATION-LAZY-QUERY-001
INVESTIGATION-LAZY-SCOPE-001
INVESTIGATION-LAZY-SELECTOR-001
INVESTIGATION-LAZY-SNAPSHOT-001
INVESTIGATION-PUBLISH-CURRENT-DEPENDENCY-001
INVESTIGATION-PUBLISH-RESOURCE-BYTE-UPDATE-001
INVESTIGATION-PUBLISH-RESOURCE-IDENTITY-001
INVESTIGATION-RELATION-FILTER-EVIDENCE-001
INVESTIGATION-RELATION-TRANSACTION-ATOMIC-001
INVESTIGATION-RENAME-SHARED-FRESH-001
INVESTIGATION-STAGE-OWNER-PENDING-DEPENDENCY-001
INVESTIGATION-STAGE-SCOPE-ALL-001
INVESTIGATION-STRICT-PREPARATION-FACTS-001
IR-INDEX-PAYLOAD-PHASE-001
LIGHTWEIGHT-JUDGMENT-ADAPTER-005
LIGHTWEIGHT-JUDGMENT-ADAPTER-014
LIGHTWEIGHT-JUDGMENT-ADAPTER-015
LIGHTWEIGHT-JUDGMENT-ADAPTER-016
LIGHTWEIGHT-JUDGMENT-CLI-003
LIGHTWEIGHT-JUDGMENT-STATS-GROUP-DIAGNOSTICS-001
MCPSHELL-BRIDGE-FILE-001
MCPSHELL-BRIDGE-FILE-003
MCPSHELL-BRIDGE-FILE-005
MCPSHELL-BRIDGE-INIT-002
MCPSHELL-BRIDGE-PATCH-002
NOVEL-CARDS-BOM-PRESERVATION-032
NOVEL-CARDS-CHAPTER-IDENTITY-020
NOVEL-CARDS-STALE-INDEX-006
RECORD-NATIVE-CREATION-HANDLE-PROOF-001
RECORD-PHASE-TEXT-SAFETY-001
RECORD-READER-FIRST-FAILURE-001
RECORD-SEARCH-DISPLAY-CANCELLATION-001
RECORD-SEARCH-FAILURE-001
RECORD-SEARCH-OUTPUT-001
RECORD-SOURCE-CANONICAL-OBSERVATIONS-001
RECORD-SOURCE-PARENT-AND-BYTE-DRIFT-001
RECORD-STAGE-TARGET-EQUIVALENCE-001
RECORD-TRANSACTION-ACTUAL-RECOVERY-001
RECORD-TRANSACTION-CANDIDATE-COMMIT-001
RECORD-TRANSACTION-COMMITTED-VERIFICATION-001
RECORD-TRANSACTION-HANDLE-OWNERSHIP-001
RECORD-TRANSACTION-OLD-PATH-WINNER-001
RECORD-TRANSACTION-PHASE-VERIFICATION-001
RECORD-TRANSACTION-PLAN-NORMALIZATION-001
RECORD-TRANSACTION-PREFLIGHT-FRESH-001
RECORD-TRANSACTION-READBACK-001
RECORD-TRANSACTION-REJECTED-WRITER-001
RECORD-TRANSACTION-WINNER-PROTECTION-001
REPO-FORMAT-SCRIPTS-001
REPO-SHORT-CLI-001
REPO-VALIDATION-LINK-SCOPE-001
REPO-VALIDATION-SKILL-STRUCTURE-001
SKILL-RELEASE-UPLOAD-FAILURE-001
SKILL-UPDATER-CANONICAL-PATH-001
SKILL-UPDATER-MANIFEST-VERSION-001
SKILL-UPDATER-REMOTE-OWNER-001
SKILL-UPDATER-UNVERSIONED-001
TASK-GRAPH-ACTIVE-RECOVERY-001
TASK-GRAPH-ANCESTOR-LINEAGE-001
TASK-GRAPH-CLI-CLEANUP-001
TASK-GRAPH-CLI-PATH-001
TASK-GRAPH-DISTRIBUTION-001
TASK-GRAPH-DISTRIBUTION-004
TASK-GRAPH-DISTRIBUTION-IMPORT-001
TASK-GRAPH-DISTRIBUTION-PACKAGE-001
TASK-GRAPH-ERROR-JSON-DETAILS-001
TASK-GRAPH-LEASE-001
TASK-GRAPH-LEASE-DURATION-001
TASK-GRAPH-LEASE-RECOVERY-001
TASK-GRAPH-LEASE-RELEASE-001
TASK-GRAPH-LEASE-UUID-001
TASK-GRAPH-MUTATION-PRECONDITIONS-001
TASK-GRAPH-RUNTIME-METADATA-001
TASK-GRAPH-SCHEMA-001
TASK-GRAPH-SCHEMA-CONSUMER-001
TASK-GRAPH-SDK-PUBLIC-TYPES-001
TASK-GRAPH-STAGE-WATERMARK-CONFLICT-001
TASK-GRAPH-TOPOLOGY-001
TEST-EVIDENCE-CASE-FILENAME-001
TEST-EVIDENCE-CASE-UTF8-001
TEST-EVIDENCE-CORE-DUPLICATE-001
TEST-EVIDENCE-CORE-SHOW-001
TEST-EVIDENCE-DISTRIBUTED-CLI-001
TEST-EVIDENCE-LEDGER-API-OPTIONS-001
TEST-EVIDENCE-LEDGER-API-SHOW-001
TEST-EVIDENCE-LEDGER-CLI-ARGS-001
TEST-EVIDENCE-LEDGER-CLI-NODE-SMOKE-001
TEST-EVIDENCE-LEDGER-ENTITY-SCHEMA-001
TEST-EVIDENCE-LEDGER-SCHEMA-STRICT-001
TEST-EVIDENCE-PROJECT-COVERAGE-001
TEST-EVIDENCE-ROOT-MEMBERSHIP-001
TEST-EVIDENCE-SNAPSHOT-INPUTS-001
TEST-EVIDENCE-STAGE-BOOTSTRAP-001
TEST-EVIDENCE-STAGE-CONFLICT-001
TEST-EVIDENCE-STAGE-EMPTY-001
TEST-EVIDENCE-STAGE-INPUT-001
TEST-EVIDENCE-STAGE-MISSING-001
TEST-EVIDENCE-STAGE-REPOSITORY-001
TEST-EVIDENCE-STAGE-UNCHANGED-001
VERSION-CONTROL-PENDING-WRITE-FAILURE-001
VERSION-CONTROL-REVISION-PREFIX-CONTENT-001
```

## 删除与新增路径

删除：
- `docs/test-evidence/cases/decision-index-payload-phase-count.md`
- `docs/test-evidence/cases/investigation-index-payload-phase-budget.md`

新增：
- `docs/test-evidence/cases/decision-date-utc-calendar.md`
- `docs/test-evidence/cases/decision-index-alignment-write-guard.md`
- `docs/test-evidence/cases/decision-index-published-invalid-body.md`
- `docs/test-evidence/cases/decision-index-published-relation-drift.md`
- `docs/test-evidence/cases/decision-index-purpose.md`
- `docs/test-evidence/cases/decision-index-title-length.md`
- `docs/test-evidence/cases/decision-index-title-sync.md`
- `docs/test-evidence/cases/decision-index-unaligned.md`
- `docs/test-evidence/cases/decision-lifecycle-alignment-recovery.md`
- `docs/test-evidence/cases/decision-lifecycle-archive-recovery.md`
- `docs/test-evidence/cases/decision-lifecycle-archived-discard.md`
- `docs/test-evidence/cases/decision-lifecycle-existing-guard.md`
- `docs/test-evidence/cases/gate-catalog-leaf-owner.md`
- `docs/test-evidence/cases/gate-decision-acquisition-cli-closure.md`
- `docs/test-evidence/cases/gate-environment-validator-owner.md`
- `docs/test-evidence/cases/gate-function-limit-policy.md`
- `docs/test-evidence/cases/gate-generated-type-inputs.md`
- `docs/test-evidence/cases/gate-generation-precondition.md`
- `docs/test-evidence/cases/gate-investigation-cli-owner.md`
- `docs/test-evidence/cases/gate-native-duration-budget.md`
- `docs/test-evidence/cases/gate-schema-binding-policy.md`
- `docs/test-evidence/cases/gate-semantic-import-syntax.md`
- `docs/test-evidence/cases/gate-shared-contract-owner.md`
- `docs/test-evidence/cases/gate-test-evidence-adapter-owner.md`
- `docs/test-evidence/cases/investigation-publish-current-dependency.md`
- `docs/test-evidence/cases/investigation-publish-resource-byte-update.md`
- `docs/test-evidence/cases/investigation-publish-resource-identity.md`
- `docs/test-evidence/cases/record-search-display-cancellation.md`
- `docs/test-evidence/cases/repo-validation-link-scope.md`
- `docs/test-evidence/cases/repo-validation-skill-structure.md`
- `docs/test-evidence/cases/skill-release-upload-failure.md`
- `docs/test-evidence/cases/task-graph-active-recovery.md`
- `docs/test-evidence/cases/task-graph-ancestor-lineage.md`
- `docs/test-evidence/cases/task-graph-error-json-details.md`
- `docs/test-evidence/cases/task-graph-lease-duration.md`
- `docs/test-evidence/cases/task-graph-lease-recovery.md`
- `docs/test-evidence/cases/task-graph-lease-release.md`
- `docs/test-evidence/cases/task-graph-lease-uuid.md`
- `docs/test-evidence/cases/task-graph-mutation-preconditions.md`
- `docs/test-evidence/cases/task-graph-runtime-metadata.md`
- `docs/test-evidence/cases/task-graph-schema-consumer.md`
- `docs/test-evidence/cases/task-graph-sdk-public-types.md`
- `docs/test-evidence/cases/test-evidence-case-filename.md`
- `docs/test-evidence/cases/test-evidence-case-utf8.md`

- `docs/test-evidence/cases/gate-query-adapter-helper-owner.md`
- `docs/test-evidence/cases/gate-domain-test-input-owner.md`
- `docs/test-evidence/cases/gate-domain-aggregate-owner.md`
