# Findings 处置与验证

本文件追踪本Change的已确认发现、实施处置及验收。实施、独立正确性/范围复核与本地变更验收已闭合：本方精确快照Case1680、test:check、changed及quick通过。混合工作区1691只作维护证据；同tree Linux冷release69/69通过，最终revision远端/Windows与交付尚未完成。

原始静态材料位于 `.log/vibe-check/audits/test-design-census-20261024-wx9KzT/` 的 A–F report/tests/checks、summary、review-checks、review-tests；它们只供本 Change 回查。下表保留来源键；精确 old/new 最小入口、命令、首次失败与未覆盖范围由各 handoff 保存，不在这里复制第二份。

## 证据入口

| 简称 | 交接与证明边界 |
| --- | --- |
| G | [Gate](gate-handoff.md)；实施者运行结果，不冒充本文编辑者重新执行。 |
| R | [记录](records-tests-handoff.md)；实施者运行结果，不冒充本文编辑者重新执行。 |
| A | [仓库/共享](repository-tests-handoff.md)；实施者运行结果，不冒充本文编辑者重新执行。 |
| D | [图/账本](graph-evidence-tests-handoff.md)；实施者运行结果，不冒充本文编辑者重新执行。 |
| E | [Skill 工具](skill-tools-handoff.md)；实施者运行结果，不冒充本文编辑者重新执行。 |

独立静态复核：[Gate/仓库](review-gate-repository.md)（原 G1–G3 修后均闭合）、[记录/图](review-record-graph.md)、[Skill 工具](review-skill-tools.md)。它们均无剩余正确性阻断，未重跑完整测试或跨平台验收。

## Check 接入、责任与输入

| ID／来源 | 实际处置与边界 | 证据 |
| --- | --- | --- |
| RC1 / A1 | 采用：短命令真实生成 smoke 迁 CP public-distribution；environment 仅留源码/环境责任。 | G、A |
| RC2 / B-01 | 采用：共同 shared-contract 承接 reader/transaction/双域 worker，声明两域分发输入和统一 provider。 | G、R |
| RC3 / C1 | 采用：IR discovery-dependencies、candidate-operations、result-integrity 三叶归 cli-contract；窄 query/transaction 不再加载它们。 | G |
| RC4 / F-01 | 采用：typecheck 订阅 typescript-program，覆盖传递可达 skill TS/MTS/manifests；不扩大 formatter 或 quick。 | G |
| RC5 / F-02 | 采用：skill-validator 保留分发输入并补统一生成成功前置。 | G |
| RC6 / D-C2 | 采用：TE public-boundary 补统一 provider；其核心与项目 adapter 输入分别维护。 | G |
| RC7 / E-1 | 采用：LJ request-and-response 的生成 SQL 消费保留并补 provider；源码图片三叶归该责任。 | G、E |
| A/B/C/D/E/F 名称与归位 | 采用：新增共同协议与 DR source CLI 两项；显示名按实责校准。机器 ID 不因措辞变化改名；当前 69 total/66 base/58 receipt，quick 10。 | G |
| A gate-tests / RC限定 | 收窄：去未读 helper/fixture 字节，保留 leaf 字节及删除/可访问事实；现模型不能无损只表达身份，采用保守覆盖。 | G |
| B/C recordOperationInputs | 采用：运行时与测试能力分离，实际共同 reader/transaction 测试只影响其 consumer；两域 adapter 各自保留。 | G、R |
| D/E domainRuntimeInputs | 采用：移除通用 scripts/**，实际复制 scripts/build、scripts/lib 的 TG 保留该闭包；按值 import/动态调用补齐 helpers。 | G |
| lint 分发 TS / RC撤回1 | 已定保守方案：锁定 type-aware 后端无完整读取 trace，未证明不读分发 TS，故与 typecheck 共订阅程序输入；不是原生读取 trace 结论。 | G |
| formatter / RC撤回2 | 不实施扩 skills/MTS；独立字面范围预期已补，原格式范围不变。 | A |
| IR search-output / RC撤回3 | 不实施全域追加 renderer；仅实际成功 CLI search 的 lazy 分支订阅，静态 type-only 候选不作运行输入。 | G |
| sourceFiles / RC撤回4 | 不实施自动候选补全；AST 只辅助发现，实际值加载、动态调用及程序边界由人工闭合。 | G |
| DR query / RC撤回5 | 不添加生成 provider；真实生成 search-info/Node 协议留 public-distribution，source CLI 矩阵另归位。 | G、R |
| portable-build / RC撤回7 | 保留临时 checkout 自建产物，不给它加当前分发 provider；路径可复现证明仍在。 | D |
| canonical / RC范围澄清 | 保留 index info 现有成功范围，不新增 noncanonical 硬阻断。 | G、D |
| POSIX 工具 / RC限定 | 保留受信宿主工具边界；没有新增全 utility 散列、全仓环境资格或质量 Check。 | G、E |
| 新增 image/video / 当前 owner | 保留三项 video 与既有 Linux→同 revision Windows/同次 zip→publish 链；最终相关 revision 的本地/CI 证据待取得。 | G |
| G1 / 阶段复核 | 已修：test-evidence-project 只由 snapshot/reference-check/migration 三项订阅，覆盖 scripts/test-evidence/**。 | G |
| G2 / 阶段复核 | 已修 strict-preparation 值 import；另一会话新增 frontmatter leaf 仍在其原位，本方仅为实际 record consumer 补 CLI/query/maintenance/stage/search 闭包，无生成前置。 | G |
| G3 / 阶段复核 | 已修 environment 的 validator 源码闭包，无生成前置。 | G |
| 隔离 changed / 指标及人工入口 | 已修：独立政策/CLI 性能节点移两文件，ownership 按三意图拆分；两域 run 归精准 test-catalog 能力，仅真实 catalog 消费者订阅，域 leaf 复用。目标 27 通过、原生九文件指标零 finding；新Case已同步；隔离1680、完整test:check及base通过，见验证记录。 | G、[验证记录](verification.md) |

## 测试设计处置

| ID／来源 | 实际处置与边界 | 证据 |
| --- | --- | --- |
| A2 / R7 | 收窄并保留：当前无稳定 reservation seam；并发双 helper、恰一 push、remote revision 不是已命中同旧 ref CAS 碰撞。Case 不得扩大该证明。 | A |
| A3 / W3 | 收窄：删除 4097/5121 文件两轮上游容量复测；保留 5120 文件/1MiB/64MiB 独立政策及源/hooks/config 小型消费，安全上限不变。 | G |
| A4 / R6 | 采用：formatter 范围改用独立字面预期，保留错误接线拒绝。 | A |
| A逐节点环境／名称 | 采用：fake 安装器调用日志证明零安装；receipt/fallback/代表集/删除重建名称与观察一致，Schema/指标配置用独立预期。 | G、A |
| B-02 / C2 / 复核共同事务 | 采用：原 DR 15 项共同节点迁 transaction.test.ts，IR 十项重复注册删除；另两 source 节点归共同 owner，两域真实 adapter 保留。 | R |
| B-03 / R1 | 采用：以字面 extensionless ID 检查索引删除，继续核路径与其他成员。 | R |
| B-04 / W4 | 采用：两方向锁加局部事件 deadline/finally 释放结算；真实 umask child 加 20s timeout。未声称复现正常路径永久挂死。 | R |
| B-05 / R2 | 收窄：显式同步后 publish 不再称 activation reconcile；stage 非法参数只承诺实际拒绝边界。 | R |
| B-06 / C4 / F prepared / W3 | 收窄：删除 Map.keys/relations.map/Array iterator/Date.parse 内建探针和精确总 batch 数；保留图引用复用、旧新隔离、parser/validator 与独立 fresh/payload 观察。 | R、A |
| B-07 | 采用：保留 1001 条真实跨页，增加 alignment/tag/type/无邻接干扰，比较精确分页与未过滤 facets。 | R |
| B-08 | 采用：activation/archive 拆五意图，index-maintenance 拆九意图；显式字面注册支持既有实体采集。 | R |
| B-09 | 采用：五个固定 Date→UTC 字面日历预期；集成使用日初/日末观察允许午夜翻日，不用生产 helper 生成预期。 | R |
| C3 / R3 | 采用/收窄：source CLI 如实命名，stage 真实改 resource 并核 pending blob；成功写集不冒称完整 atomicity。 | R |
| C4 / R4 | 采用：content 增具体 current-text source/preview；index-only needle 与合法 source-group 有独立预期。 | R |
| C4 / R5 | 采用：恢复与资源漂移核完整 report/resource/index bytes/mode 和具体错误。 | R |
| C formalDrift / 独立闭合 | 采用更正：未选正式正文变化为正常 writer 发布成功；selected candidate/index、resource inode 拒绝与同 inode bytes 成功分别保留。 | R |
| C细项数据与状态观察 | 采用/收窄：stage bytes、rename formedAt/resource、cleanup 已提交 relation、无关全文保留均补外层观察；合法 ID 无法区分的排序仅承诺稳定 target 顺序。其余已足够的资源 warning/trace/关系边界保留，不机械增强。 | R |
| C复合／重复／阶段 | 采用/保留：publish 独立漂移意图拆分；phase 只承诺 fresh/source 观察；history CR 前缀是独立兼容证据，未按 duplicate 删除。 | R |
| D-T1 / R10 | 采用：删私有声明全名单与 export 拼写锁；保留公开 API/version、真实类型 consumer、声明引用/无泄漏、Schema、生成头四责任。 | D |
| D-T2 | 采用：task 字典逆序验证序列化；help/stderr/append/单故障/revision/import 名称收窄到实际观察。 | D |
| D-T3 / R11 | 采用：普通 extra usage 缩为两个参数，source CLI 承接矩阵、保留 Node 代表；8000 ancestor lineage 独立保留，不称公开容量。 | D |
| D逐节点拆分与产物边界 | 采用：schema 协议、lease、core stage、非法 Case 成员分意图；产物树明确检查禁止目录身份。 | D |
| D-T4 / R11 / W2 | 采用资源收束：native close Promise 提前监听，finally kill/await；TE 根立即登记并 afterEach 清理。撤回“旧顺序已证正常路径竞态”。 | D |
| D-T5 | 收窄：inode 仅证未替换，portable-build 仅证不同路径可复现；去无对照 optional peer fixture，不新增计数框架。 | D |
| E-R1 | 采用：验证 cwd/receive 完成后经既有 wc seam 同步 swap/move，外层核事件及 bytes/外部零目标；五轮受控命中不证明任意竞态概率。 | E |
| E-R2 | 采用：健康凭据 getter、精确 image input 诊断与 credential/fetch 零调用；撤回未观察的 assets 构造承诺。 | E |
| E-R3 | 采用：SSH calls 无条件记录且有正例，拒绝后完整日志为空。 | E |
| E-R4 | 采用：独立 crypto SHA、binary/empty bytes 与真实 put/get 输出。 | E |
| E-R5 | 采用：首次 apply 比完整 unrelated TOML 前缀，二次仍核幂等。 | E |
| E-R6 | 采用：第三 writer 故障标记在外层命中；完整 BOM Buffer 与成功 snapshot 保留。 | E |
| E-R7 / E-R8 | 收窄：new-id 只证一次可用；CP 正常 40hex 不存在 baseline 刷新成功，不声称从未查询距离。 | E |
| E fixture附加 | 采用：CP 共同 temp-root 隔离 GIT_*、配置/hooks/signing；initializer 默认不建仓；LJ child 局部 3s deadline/await close/server 收束。首次超时现场保留在短期交接。 | E |
| F-03 / R8 | 采用：跨行唯一 fixture；display 耗尽后第二文件实际取消；现存 member bytes drift；binary prefix 与坏压缩尾完整读取拒绝。 | A |
| F-04 / R9 | 采用轻量准备，纯 path/mock raw 不建仓；双向 representation/replacement 错误不同，均保留，不做无损性不足的合并。 | A |
| F逐节点名称／API | 采用/收窄：非法 source、空 revision、domain 跳过 projection、prewrite 如实命名；updater 保留真实类型 consumer，删除 export 写法锁。四规则下沉 source API，留 Node 失败代表。 | A |
| F orphan validate | 采用：健康基线后仅坏链接与仅坏结构拆为两节点，接现有 test:environment；源码 validation 输入由 G3 补齐。 | A、G |
| P1 updater --check | 采用：实际需更新时零 zip 请求、完整目录成员/bytes 不变；release/manifest 请求合法，不称系统调用层零写。 | A |
| P2 publisher | 采用：本地 gh 替身命中 zip upload 失败，后续 manifest/delete/edit 缺席，同 fixture 重试成功；无远端写入。 | A |
| P3 性能CLI | 采用：受控 native durations 验证具体 P90/mean/null/zero、quick 退出与其他 scope report-only；不靠 sleep 或真实 Gate 慢测。 | G |
| P4 catalog解析 | 采用：真实 AST import 识别及注释/惰性字符串负例，不建全仓依赖图。 | G |
| W1 recover callback | 不实施：外层 committed=true 已拒绝被 catch 的恢复分支；独立复核撤回，不泛化 formalDrift 结论。 | R |
| 保留规模与真实边界 | 保留 1000/1001、Node 深链、卡数/体积/深度、256MiB、权限/锁/安装、双向 mode/Git。阶段目标选择未全跑这些入口，最终完整 Gate 另取证。 | R、D、E、A |
| Case／snapshot / RC撤回6 | 已完成：混合维护1691已同步；本方163-ID选择后的隔离1680引用/覆盖及runner通过，证明范围分别记录。 | A、R、D |

## 原逐节点索引的处置路由

下列每个原数组位置均由上表对应发现及指定 handoff 的“证明责任/节点变更/实际验证”承接。相同文件的来源键合并一行；这是回查索引，当前实体 ID 仍以最终公开 snapshot 为准。保留项不因列在此表便声称本轮运行。

| 原切面与 tests 数组位置 | 原文件 | 处置证据 |
| --- | --- | --- |
| A-tests：2 | `scripts/auto-push.test.ts` | G、A |
| A-tests：7 | `scripts/environment-check.test.ts` | G、A |
| A-tests：11 | `scripts/environment-commands.test.ts` | G、A |
| A-tests：21 | `scripts/lib/vibe-gate/impact-failures.test.ts` | G、A |
| A-tests：55 | `scripts/lib/vibe-gate/impact-release.test.ts` | G、A |
| A-tests：56, 62 | `scripts/lib/vibe-gate/impact-routing.test.ts` | G、A |
| A-tests：70, 71, 74 | `scripts/validators/project-config.test.ts` | G、A |
| A-tests：94 | `scripts/vibe-check-native-selection.test.ts` | G、A |
| A-tests：110 | `scripts/vibe-check-semantic-catalog.test.ts` | G、A |
| B-tests：52, 53 | `tools/decision-records/tests/acquisition-safety.test.ts` | R、G |
| B-tests：70, 71 | `tools/decision-records/tests/lazy-relation-graph/context.test.ts` | R、G |
| B-tests：74, 75 | `tools/decision-records/tests/lazy-relation-graph/queries.test.ts` | R、G |
| B-tests：85 | `tools/decision-records/tests/index-maintenance/index-maintenance-01.test.ts` | R、G |
| B-tests：90 | `tools/decision-records/tests/query-loaded-snapshot.test.ts` | R、G |
| B-tests：107 | `tools/decision-records/tests/relation-filter-complexity.test.ts` | R、G |
| B-tests：135 | `tools/decision-records/tests/activation-archive.test.ts` | R、G |
| B-tests：150 | `tools/decision-records/tests/candidate-lifecycle/candidate-lifecycle-05.test.ts` | R、G |
| B-tests：182 | `tools/decision-records/tests/localize-record-operations/identity.test.ts` | R、G |
| B-tests：208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223 | `tools/decision-records/tests/record-shared-transactions.test.ts` | R、G |
| B-tests：254, 255 | `tools/decision-records/tests/transaction-recovery/transaction-recovery-03.test.ts` | R、G |
| B-tests：256 | `tools/decision-records/tests/transaction-creation-modes.test.ts` | R、G |
| B-tests：303 | `tools/record-operations/tests/reader-worker-runtime.test.ts` | R、G |
| B-tests：326 | `tools/decision-records/tests/stage/stage-03.test.ts` | R、G |
| B-tests：337, 338, 339 | `tools/decision-records/tests/stage-index-payload.test.ts` | R、G |
| B-tests：341 | `tools/decision-records/tests/stage/locator-index.test.ts` | R、G |
| C-tests：21 | `tools/investigation-report/tests/candidate-operations.test.ts` | R、G |
| C-tests：34 | `tools/investigation-report/tests/cli-boundaries.test.ts` | R、G |
| C-tests：42, 45 | `tools/investigation-report/tests/cli-generated.test.ts` | R、G |
| C-tests：65 | `tools/investigation-report/tests/cli-relation-input.test.ts` | R、G |
| C-tests：68 | `tools/investigation-report/tests/cli-search-defaults.test.ts` | R、G |
| C-tests：69 | `tools/investigation-report/tests/cli-search-summary.test.ts` | R、G |
| C-tests：101 | `tools/investigation-report/tests/index-relations.test.ts` | R、G |
| C-tests：125 | `tools/investigation-report/tests/relation-context.test.ts` | R、G |
| C-tests：130 | `tools/investigation-report/tests/relation-dedup.test.ts` | R、G |
| C-tests：139 | `tools/investigation-report/tests/relation-review.test.ts` | R、G |
| C-tests：151, 162 | `tools/investigation-report/tests/resources.test.ts` | R、G |
| C-tests：167 | `tools/investigation-report/tests/result-integrity.test.ts` | R、G |
| C-tests：218, 223 | `tools/investigation-report/tests/staging-domain.test.ts` | R、G |
| C-tests：225 | `tools/investigation-report/tests/staging-index-payload.test.ts` | R、G |
| C-tests：242 | `tools/investigation-report/tests/staging-pending-deletion.test.ts` | R、G |
| C-tests：293 | `tools/investigation-report/tests/discard-phase-verification.test.ts` | R、G |
| C-tests：297 | `tools/investigation-report/tests/discard-recovery.test.ts` | R、G |
| C-tests：305, 308, 309 | `tools/investigation-report/tests/discard.test.ts` | R、G |
| C-tests：312 | `tools/investigation-report/tests/execution-entry-contract.test.ts` | R、G |
| C-tests：321, 322 | `tools/investigation-report/tests/publish.test.ts` | R、G |
| C-tests：329 | `tools/investigation-report/tests/rename-phase-verification.test.ts` | R、G |
| C-tests：336 | `tools/investigation-report/tests/rename-validation.test.ts` | R、G |
| C-tests：342 | `tools/investigation-report/tests/rename.test.ts` | R、G |
| C-tests：346 | `tools/investigation-report/tests/strict-preparation.test.ts` | R、G |
| C-tests：350, 351, 352, 353, 354, 355, 356, 357, 359, 360 | `tools/investigation-report/tests/transaction-boundaries.test.ts` | R、G |
| C-tests：364 | `tools/investigation-report/tests/transaction-domain-boundaries.test.ts` | R、G |
| C-tests：371 | `tools/investigation-report/tests/transaction-file-writer.test.ts` | R、G |
| C-tests：378, 380 | `tools/investigation-report/tests/transaction-recovery.test.ts` | R、G |
| C-tests：383 | `tools/investigation-report/tests/transaction-sync.test.ts` | R、G |
| C-tests：390 | `tools/investigation-report/tests/history-prefix-contract.test.ts` | R、G |
| D-tests：1 | `tools/task-graph/tests/graph-projection.test.ts` | D |
| D-tests：7, 8 | `tools/task-graph/tests/schema-index.test.ts` | D |
| D-tests：17 | `tools/task-graph/tests/lifecycle-lease.test.ts` | D |
| D-tests：22 | `tools/task-graph/tests/task-removal.test.ts` | D |
| D-tests：33 | `tools/task-graph/tests/native-store.test.ts` | D |
| D-tests：38 | `tools/task-graph/tests/cli-help.test.ts` | D |
| D-tests：42 | `tools/task-graph/tests/cli-failures.test.ts` | D |
| D-tests：80 | `tools/task-graph/tests/staging-conflicts.test.ts` | D |
| D-tests：86 | `tools/task-graph/tests/generated-artifacts.test.ts` | D |
| D-tests：87 | `tools/task-graph/tests/generated-artifacts-distribution.test.ts` | D |
| D-tests：88 | `tools/task-graph/tests/portable-build.test.ts` | D |
| D-tests：95 | `tools/test-evidence/tests/core-stage.test.ts` | D |
| D-tests：97, 99 | `tools/test-evidence/tests/core-query.test.ts` | D |
| D-tests：111 | `tools/test-evidence/tests/core-cli-search.test.ts` | D |
| D-tests：119, 122 | `tools/test-evidence/tests/public-boundary.test.ts` | D |
| D-tests：140 | `scripts/test-evidence/check.test.ts` | D（inode 证明收窄）、G（项目输入） |
| E-tests：2 | `tools/mcpshell-workspace-bridge/tests/initializer.test.ts` | E |
| E-tests：13 | `tools/mcpshell-workspace-bridge/tests/runtime-containment.test.ts` | E |
| E-tests：22 | `tools/mcpshell-workspace-bridge/tests/runtime-transfer.test.ts` | E |
| E-tests：26 | `tools/mcpshell-workspace-bridge/tests/runtime-patch.test.ts` | E |
| E-tests：35 | `tools/mcpshell-workspace-bridge/tests/localhost-ssh-integration.test.ts` | E；manual-only 保留未运行 |
| E-tests：36 | `tools/mcpshell-workspace-bridge/tests/mcpshell-integration.test.ts` | E；manual-only 保留未运行 |
| E-tests：51 | `tools/novel-cards/tests/chapters.test.ts` | E |
| E-tests：66 | `tools/novel-cards/tests/transactions.test.ts` | E |
| E-tests：107 | `tools/change-plan/tests/lifecycle.test.ts` | E |
| E-tests：132 | `tools/lightweight-judgment/tests/adapter-images.test.ts` | E |
| F-tests：16, 17 | `tools/index-runtime/tests/protocol-query.test.ts` | A |
| F-tests：51 | `tools/index-runtime/tests/prepared.test.ts` | A |
| F-tests：66 | `tools/index-runtime/tests/reader-load.test.ts` | A |
| F-tests：81 | `tools/index-runtime/tests/record-staging.test.ts` | A |
| F-tests：93 | `tools/skill-updater/tests/public-contract.test.ts` | A |
| F-tests：105 | `tools/skill-updater/tests/source-distribution.test.ts` | A；必要规模/安装保留，阶段未运行 |
| F-tests：128, 129 | `tools/shared/tests/relation-graph.test.ts` | A；必要规模/安装保留，阶段未运行 |
| F-tests：144 | `tools/shared/tests/record-text-search.test.ts` | A |
| F-tests：151 | `tools/shared/tests/file-text-search-matching.test.ts` | A |
| F-tests：164 | `tools/shared/tests/version-control-representation.test.ts` | A |
| F-tests：172, 173 | `tools/shared/tests/version-control-pathspec-query.test.ts` | A |
| F-tests：195 | `tools/shared/tests/version-control-workspace.test.ts` | A |
| F-tests：203 | `tools/shared/tests/version-control-blob-framing.test.ts` | A；必要规模/安装保留，阶段未运行 |
| F-tests：209 | `tools/shared/tests/version-control-prefix-integrity.test.ts` | A |
| F-tests：222 | `tools/shared/tests/version-control-fingerprint-demand.test.ts` | A；必要规模/安装保留，阶段未运行 |
| F-tests：225 | `tools/shared/tests/version-control-pending.test.ts` | A |
| F-tests：239 | `tools/shared/tests/version-control-snapshot.test.ts` | A |
| F-tests：270 | `scripts/validate.test.ts` | A |

## 当前验收与剩余交付

[最终范围复核](review-final-commit-scope.md)确认本方163-ID选择、326改动路径及他方工作排除；[验证记录](verification.md)保存tree `0f06721a…` 的Case1680、test:check107通过/1预期skip、changed66通过/58receipt发布及重复复用、quick预算通过。全部145原来源键仍由上表及handoff回查，首次失败没有被最终通过覆盖。

同tree Linux冷release69/69、同snapshot版本授权与全部zip打包已通过；剩余为最终相关revision同次Windows zip/远端CI证据，以及最终交付。main无branch protection/ruleset的事实仍如实保留，不声称保护生效或擅配置远端。本轮文档状态增量不改变上述已受测实现/index；任务进度由`tasks.md`统一承接。
