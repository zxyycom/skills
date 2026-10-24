---
title: "记录身份更正的共同计划与阶段验收差异"
id: "261024-align-record-rename-verification"
formedAt: "2026-10-24T05:55:23Z"
question: "为什么同等来源规模的 IR rename 承受额外串行验收，如何在不减弱事务安全的条件下对齐共同操作？"
tags:
  - "investigation-report"
  - "performance"
  - "record-operations"
relations: []
---

## 形成时背景

2026-10-24 在共同记录事务 owner 已建立的条件下，对 DR/IR 的 rename 与 discard 进行同输入复查。基线为 `66cf190967fd9ea7a0654412c29c955801951923`，skill 版本 DR 91 / IR 80。目标是解释为何同等规模的 IR rename 承受明显额外开销，并在不削弱来源、权限、提交和恢复保护的条件下真正对齐共同动作，而不只作局部批读补丁。

首个源码检查点发现：IR rename 的 original guards 已保护全部来源，renamedSourceWrites 又把未变来源列为 writes；DR 仅为实际变化生成 writes。待区分的解释是“IR 全量重写”“共同验收被不同计划表示分流”和“IR 另有领域读取”。安全、新鲜度和资源生命周期跨 owner、阶段与持久化边界，因此本轮同时需要因果解释和独立验证，不能只比较总耗时。

## 调查目的

本轮回答三个问题：额外成本由什么机制产生；哪些文件计划、阶段编排和安全读取可以由 `tools/record-operations/` 共同承担；修复后的正确性、性能与仍未合并成本可以证明到什么范围。停止条件是共同义务进入同一 owner、独立安全与回归证据闭合，并以同输入分阶段测量支持而非猜测性能归因。不统一两个领域的图、生命周期、公开 CLI/SDK 或独立分发。

## 调查范围与依据

### 代码与修复身份

实际检查 `tools/record-operations/src/transaction.ts`、`transaction-plan.ts`、`transaction-verification.ts`、`transaction-journal.ts`，DR 的 `decision-rename-planning.ts`、`decision-transaction-plan.ts`，以及 IR 的 rename/discard preparation、publication、verification 与 resource proof。当前事实由三处工具 README 和源码承接。修复版本为 DR 92 / IR 81；12 个产品文件清单 SHA-256 为 `77e215d0465a2ddad8f3ede33a787c7e938a5c05c6723579cb0f9aea2241412f`，测量冻结的 1,281 文件源码集合 SHA-256 见随附数据。

`RecordWriteJournal` 在写入前跳过 unchanged，排除“10,003 个提案等于 10,003 次物理写入”的解释。基线 shared verifyPlan/verifyWritten 对 writes 逐项 await，只有 guards 使用批量路径；IR beforePublish 之后另逐源读文本，再进入共同验收。这给出可区分的机制：相同文件义务因计划表示不同落入串行路径，且同一写前阶段重复采集。

### 实验与覆盖

独立测量使用 Linux x64、Node 26.8.2、同一冻结依赖与 ext4。每域 10,000 formal、9,000 条有向关系、2 candidates；选择的末条正式记录无入边、无自有资源，有一条出边；完整 fixture 含一个未选 IR 资源。每版本四场景各 normal 两次、instrumented 一次，共 24 个正式公开分发 Node CLI 样本；另 16 个 1k 自证样本。所有样本通过独立后验，配对 normal/instrumented 的完整输出文件及 stdout/stderr 精确相同，来源、依赖和 Node 测后未漂移。fixture 与 after 源码恢复均已按完整 manifest 验证。

正式实测 UTC 窗口为 before `2026-10-24T06:01:50.234452+00:00` 至 `2026-10-24T06:08:04.391617+00:00`，after `2026-10-24T06:36:03.191456+00:00` 至 `2026-10-24T06:39:29.626335+00:00`；窗口包含批次间的 reset/hash/后验，不是单个 CLI wall。

每次全新 Node 进程，wall 包含启动、import、worker startup、CLI 与退出；reset、hash 和后验在计时外。不是冷缓存或随机交错试验；外部工作区负载不可完全控制，仅两次 normal，不给置信区间。instrumented 不参与 normal 统计，差值不当作纯仪器开销。包容区间不能与其子阶段相加；跨版本以 domain fresh + shared preverify 联合比较，避免把职责移动误判为减少验证。

正确性依据包括两域回归（DR 385、最终 IR 374 个入口通过）、真实 Node 目标 36/36、独立 8 个文件系统故障 probes 与 4 个资源恢复原生节点、测试证据账本引用与覆盖检查，以及实施冻结时的完整 changed Gate。真实大 changed 领域计划已验证两共同阶段的批量接线；将旧逐项 preverify 置于隔离副本后，规模节点因 `[0,1003]` 而非 `[1003,1003]` 的队列断言失败。actual written facts 来自独立安全读取，不从 plan.next 捏造身份；少量真实 journal、提交和恢复由相邻集成覆盖。

## 调查结果与边界

### 因果与共同收口

已确认核心问题不是全量改写，而是共同计划与验收责任未完整收口。修复统一 unchanged 提案与 guard 表达、writes/index/guards 有序调度和写前 phase 交接。IR rename 在 hook 后以真实事务根安全观察来源/index，保留原有有序错误聚合；IR discard 只把 transaction fresh 的安全来源采集交给本阶段 phase，解析、图与资源验证仍执行。已选资源的 prepare 采集及显式 fresh 文件保护亦进入共同队列，目录证明保留顺序。index 提交职责、candidate 的实际最后动作和写入顺序不变，changedPaths 不再排除未写来源的成员保护。

同阶段复用必须匹配 root、path、bytes、dev/ino、mode 和完整父链；领域取得 bytes 与父身份对象的独立副本，不能污染私有 actual。准备、写前、写后分别实际读取。canonical 缺失、NOFOLLOW、严格 UTF-8、权限/umask、实际写入 handle、CAS、owner、readback、恢复和清理失败事实均保持。结构/权限在 skip 前拒绝；仅内部非法计划与文件同时漂移的首错误优先级可能更早，未放宽拒绝条件。worker 阈值、受权限/input-type 约束时的 async 预选及生命周期未改变。

### 观察到的性能

以下为 normal wall 秒，逐值保留：

| 场景 | before 1 / 2 | after 1 / 2 |
| --- | ---: | ---: |
| DR rename | 10.380 / 8.071 | 7.836 / 7.722 |
| IR rename | 63.132 / 53.126 | 10.010 / 9.961 |
| DR discard | 9.520 / 8.616 | 8.836 / 8.666 |
| IR discard | 16.936 / 17.747 | 9.862 / 10.497 |

各版本单次 instrumented 的联合义务边界显示：IR rename 的 fresh + shared preverify 从 39.121s 到 1.813s，shared postverify 从 18.345s 到 0.671s，与上述统一调度、同阶段观察复用的机制相符。其 planned writes 从 10,003（其中 10,001 unchanged）到 2；最终始终只有旧/新两个正文路径 delta 与一个索引。after 的 20,003 个 guard 条目包含重叠保护，不是 unique 文件或 I/O 次数。

IR discard 的 fresh + shared preverify 从 7.941s 到 2.152s，有同阶段来源交接的代码机制支持。未改的 domain postverify 从 4.982s 到 1.807s，外部及未归因残差从 9.144s 到 5.213s；before instrumented 总计 24.242s，明显慢于两个 normal，因此不把这些下降归因于本轮，也不把总 wall 差逐项强行分配。DR 的低实际写集样本不足以把小幅变化解释为稳健提速。

### 保留成本、恢复与未覆盖

IR rename after 的 domain postverify 约 2.926s；IR discard 仍有较早 freshness 约 1.316s、domain postverify 约 1.807s。它们混合来源 I/O、成员、完整图/资源、索引和 retired identity 等证明，属于本轮未合并成本，不能统称固有必要 I/O，也不证明继续合并一定正确。未细分残差含启动/import/输出，不冒充纯 prepare。递归 resource owner 扫描亦未重构。

实际 handle/readback、资源复制/删除前的独立源证明、逐文件 CAS、恢复 winner 保护和精确 tombstone cleanup 不合并为旧 phase。commit 后不自动回滚；验收未知与仅 cleanup pending 仍有不同结果。部署回退需沿仓库版本控制恢复相应源码与生成闭包；已执行的数据变化按真实 mutation 与资源恢复 owner 对账，不靠代码回退覆盖后来编辑。本轮没有生产记录迁移或公开格式变更。

本性能输入不是大 fan-in / 大 changed-set，也未测所选资源移动性能；正确性测试不补成其性能结论。CPU/RSS 逐样本保留，但没有逐阶段 CPU/syscall 数据，未声称内存峰值改善或阈值最优。若在不同运行时、文件系统、资源树、权限约束或大量入边/changed 集合下出现新差异，应按实际义务重新测量与审查，不能外推本轮数值。

精简 JSON 汇总由本轮独立测量审计后的逐样本结果提炼，保留 24 个正式样本的 wall/CPU/RSS、instrumented 阶段、计划与最终 delta、环境和来源 hash；需要复核表中数值与取样边界时读取。完整 raw、fixture 模板、插桩 patch 与归档审计由同次修复的 Git 历史保存，不复制为长期大附件。

## 随附资源

- [精简样本、阶段、环境与来源身份](./_resources/261024-align-record-rename-verification/phase-summary.json)
