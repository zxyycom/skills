# 安全读取队列实现与验证

## 实现边界

- `reader-batch.ts`：一次读取阶段一个worker；不足1000项沿async，1000是已有微基准最小受益规模，不是最优阈值。三个入口分别取得text、file snapshot和root/path绑定的text snapshot。
- `reader-worker.ts`：只执行主线程给定路径，串行同步读取；最多64路径，累计8MiB后回传，或在首个文件失败后立即回传。consumer消费完才发送下一批。单文件不截断，8MiB是软背压目标，不是精确RSS上限。
- `reader-sync.ts`：sync I/O保持原异步采集顺序、NOFOLLOW、canonical/父链/leaf验收、同handle前后证明及finally close；纯组件和修订规则与`source.ts`/`transaction-snapshot.ts`共用。
- `reader-protocol.ts`：严格验证协议；保留文件Error的name/message/stack与可用code、errno、syscall、path、dest，恢复原生TypeError/RangeError。线程、启动和协议故障直接使批次失败，不重试或伪造空结果。
- consumer异常和abort均排队close并等待worker exit；同步读取不被线程强杀中断。同phase之外不保留worker、图或文件事实。正常worker不覆盖`execArgv`，保留Node原生执行约束继承与进程参数过滤；Node权限模型启用或父进程带`--input-type`时，在读取前选择当前进程原async，不创建worker，不承诺worker加速。

## 接入与领域语义

DR普通scan从已知sourceFiles有序填入原sourceText/failed槽，strict preparation填入原root-bound捕获，source revision/fresh从本阶段重新读取。IR按原layout规则过滤实际需要读取的root entries，strict同阶段保存强快照，再由原入口解析与诊断。没有扩大selected/候选的成员范围。

`RecordVerificationPhase.verifyMany`只批量guards；实际写入列表仍按原顺序验证权限、duplicate path与写前/写后actual。重叠guard与实际已采集事实完整等价时复用，内部不保留expected的可变bytes引用；新phase重新取得actual。writer/readback、CAS和恢复写入不进入worker。

DR source discovery的小集合保持原先regular→safe-read→parse顺序；大集合worker acquisition失败直接抛原错误，不能再由后发lstat覆盖。成功结果仍保留额外regular验收。大集合symlink/目录拒绝的同义公共安全文案允许不同，不改变code、拒绝类别或no-write；未引入新flag。身份解析和登记共用一个领域函数。

worker协议type从worker入口显式导入，使现AST源码闭包纳入worker与sync依赖；此机制须经两域真实生成和隔离安装Node执行验证，不能只据静态推断宣布分发通过。

## 执行约束审计

最初显式转传`process.execArgv`在真实Node test runner中包含进程专属flags，被Worker拒绝。清空execArgv虽可运行，但独立只读probe证明会丢失父Node权限模型：父进程对禁止路径的stat返回ERR_ACCESS_DENIED，空参数worker却允许stat且没有process.permission。该中间实现未接纳。

[Node 26.8.2官方权限说明](https://nodejs.org/download/release/v26.8.2/docs/api/permissions.html)说明worker不继承权限模型；最小实际probe亦确认默认参数的file-backed worker在父`--input-type=module`消费者中拒绝启动。最终实现不覆盖execArgv，只在这两个已明确的运行约束下预先沿本进程async。真实权限回归保留ERR_ACCESS_DENIED、FileSystemRead等原Error字段；allow-worker有或无均不创建worker。eval入口也在预先选定的async上成功，不以启动失败后重试作为实现。

## 生命周期与质量门槛整理

`RecordReadWorker`专门持有一个批次的worker、pending reply、failure和graceful close/exit，不是跨调用pool。`reader-worker.ts`区分单文件安全读取与有界chunk；`verifyMany`由同phase guard调度与actual比较组成；IR来源inspection自己执行读/不读选项。没有降低安全条件或改动事务顺序。

`function-metrics.json`保存最终18份产品/测试源码的SHA-256和已安装Vibe analyzer结果：200个函数，按项目product/test阈值0项违规。另通过公共duplicateDetection对同一reader owner切面做minimumTokens=150、blocking扫描，0 findings。两者都是定向诊断，不是完整仓库Gate，也不代替根代理的最终验收。

## 实际验证

以下均已实际完成，不是待执行计划：

- 当前源码定向Oxfmt，`bun run typecheck`及reader相关产品/测试定向`oxlint --type-aware`通过。
- `node --test tools/record-operations/tests/reader-batch.test.ts tools/record-operations/tests/reader-snapshot.test.ts tools/record-operations/tests/reader-worker-runtime.test.ts`：拆分后完整15/15通过（Node 26.8.2）。
- `bun test tools/record-operations/tests/reader-batch.test.ts tools/record-operations/tests/reader-snapshot.test.ts tools/record-operations/tests/reader-worker-runtime.test.ts`：拆分后完整15/15通过（Bun 1.4.2）。
- DR acquisition-safety、transaction-strict-preparation、record-shared-transactions、source-discovery四文件定向28/28通过；IR strict-preparation、transaction-domain-boundaries、transaction-boundaries、transaction-sync四文件定向22/22通过。
- 两skill独立生成安装测试分别复制生成scripts、显式复用兼容依赖并以file-backed Node消费者调用安装内worker，验证各自1000项强快照及正常退出，不依赖另一skill或仓库源码路径。
- 15个最小native入口和15份`record-reader-*.md` Case已由本切面维护，DR run.ts注册该测试文件。统一索引、1478实体覆盖、两域公开sync和生成check、全仓typecheck/lint/format:check由主实现执行并报告通过；这些操作不由本切面冒称亲自执行。

native覆盖1000个不同真实root/archive路径、有序正文与完整快照、text与snapshot两合同坏路径/缺失/strictUTF8、真实bytes/mode/leaf/父链漂移、超过软块目标的大单文件、首失败不被晚到探测覆盖、consumer异常与abort、phase独立及expected可变引用防护、Node启动throw/无请求退出/等待请求退出/空闲退出/非法回复，以及真实生产worker的64项同步open/close与退出时0未关handle。

测试只在各自`record-reader-test-*`临时目录复制闭包和fixture，并在finally删除，不留临时安装。没有提交、push或结项；本报告与指标随当前Change退出。

## 未验证边界

本切面不运行完整Gate或最终CLI before/after计时，交根代理协调。当前真实运行环境是Linux、Node 26.8.2和Bun 1.4.2；未另跑最低Node 24.18或其他平台。有限竞态探针不穷举全部外部编辑时序；graceful close不承诺在文件系统syscall永不返回时有取消期限。每文件与同阶段证明不宣称跨文件原子快照，也不宣称固定端到端提速。

## Gate后测试文件收敛

根代理首轮完整Gate中，reader产品函数和重复检测通过，但单个reader测试文件646代码行触发360行上限。本切面未改产品功能、未降低门槛或压行：按批量观察/phase、同步snapshot漂移、真实Node runtime/lifecycle分别拆为5、3、7个native入口，共用fixture建立与收尾。15个原测试名和断言保留，15个Case身份不变，只更新Tests中的实际文件实体；DR run直接注册三个叶子，semantic checks分组与统一索引交主实现。

拆分后实际重跑Node和Bun各15/15、typecheck及相关测试Oxlint/Oxfmt通过。以file-backed原生Node入口运行公共fileMetrics、functionMetrics和duplicateDetection，对4份测试/fixture文件应用项目阈值，三项均0finding passed；这是本切面实际局部Checks，不代替完整Gate。最初eval方式的functionMetrics因其分析worker继承input-type而analysis-failed，已改为file-backed验证，没有改包或放宽阈值。

本轮最初局部duplicateDetection的默认cache生成了唯一的`.cache/vibe-check/quality-scan-cache-v3/a248bf79b30c55eeba9d89b96dc387469638fa3f1c89a1c6620631ee5ae633e3.json`：记录jscpd5.1.2、150token、精确15来源文件和04:26:39时间，与本切面调用完全对应。按根代理明确授权，确认目录只该文件后仅unlink此文件并rmdir空祖先；未改ignore、未删除其他来源。后续局部duplicateDetection明确关闭cache，临时file-backed验证脚本在自身临时目录finally清理。
