---
title: "记录工具局部操作契约一万条前后成本验证"
id: "261022-record-tools-local-contracts-1w"
formedAt: "2026-10-22T05:08:54Z"
question: "发布基线与选中刷新契约在一万条存量、小输入下改变了哪些成本和实际保证？"
tags:
  - "decision-records"
  - "investigation-report"
  - "performance"
  - "scale-testing"
  - "version-control"
relations:
  - type: "复查"
    target: "261021-record-tools-all-operations-100k"
    summary: "在批准的新契约与一万条代表负载下独立验证成本和保证变化"
---

## 形成时背景

[前序十万条调查](record-tools-all-operations-100k.md)发现小输入仍承担明显的全集来源准备和事务成本。本轮在局部操作契约调整后，以**一万条正式存量、每调用一个对象或一组小关系**验证成本和实际效果；这是新契约、新代表负载下的一轮独立对照；前序材料提供问题背景，本轮结果仅适用于下述负载。

改前固定 Git `0a85d4139309657c1b2d0e985d40f0c57f7f71e7`（Decision 86、Investigation 75）；改后为本轮已同步、集成验证后的**未提交源码及公开分发输入快照**（87／76），不以当时 HEAD 冒充改后实现。两版源码与生成物的实际字节由[输入指纹](./_resources/261022-record-tools-local-contracts-1w/input-fingerprints.json)定位。

## 调查目的

覆盖 S1 起草／候选读取、S2 普通维护、S3 小范围 content 及实际触及原生上限的拒绝、S5 三种暂存 scope，并单列 S4 默认维护封套的命令数与组件成本。确认实际索引、来源、资源、pending 和输出，而非只比较耗时。删除、身份更正、高风险组合和大输入不在本轮覆盖范围。

## 调查范围与依据

### 固定存量与小操作

每域是自有、无 remote、停用 hook 的独立 Git 仓库；改前／改后初始 Git 树及文件字节相同。每域 **10,000 正式对象、9,000 条关系、2 ready 候选**；每十个正式对象为一组，九叶指向组根，无跨组边。Investigation 初始资源固定为 **5×96B**，不随存量增长。正式数在发布后允许 N+1，下一次恢复 N。Decision 组根及一叶归档，另有一条 unaligned；content 关系筛选得到 8 个 active 文件，Investigation 得到 9 个文件。

基线的源文件尺寸、索引字节和固定树见[fixture 清单](./_resources/261022-record-tools-local-contracts-1w/fixtures.json)。stage 单次选择 B；另设“已有 A pending”和“B 已有旧 pending”两类准备状态，以核对连续选择与重选刷新的组合结果。预先放置常数份工作区／pending 差异和受保护域外修改、staged 删除；Investigation 为所选 owner 加一个 96B 未引用成员，验证完整资源树 scope。准备不计时。

### 采集与独立核对

- Node **26.8.2**，默认 heap limit **2,248,146,944B**，`NODE_OPTIONS` 明确为空；4 CPU 配额、6GiB cgroup。兼容依赖两版复用且不安装，版本见[环境记录](./_resources/261022-record-tools-local-contracts-1w/environment.json)。
- 直接启动实际 Node 公开分发 CLI，`os.wait4` 记录 **wall、user＋system CPU、maxrss**；含启动和渲染至退出，不含准备、后验或 Bun wrapper。RSS 为 Linux KiB 转 MiB，不等于 JS heap；CPU 可因线程而超过 wall。
- **每版每场景三次，每次恢复各自同字节基线**，同序串行、Node 进程不复用；无主动清 OS 缓存，不是冷缓存测试。测量窗口排除了其他重测试／构建，仍有轻量编辑或静态读取，不是整机隔离。
- 后验独立核对完整工作区来源／资源 SHA 清单、预定受影响索引 ID 与 revision ID 集、状态／关系／路径、所选完整 pending 表示、未选 pending 字节身份和域外 staged 删除、退出码及实际 source／诊断。被测 CLI `check` 不代替这些证据；预期由已知 fixture 与各版契约计算。

[234 次主观测](./_resources/261022-record-tools-local-contracts-1w/observations.jsonl)保留逐次指标及后验，[468 份输出流](./_resources/261022-record-tools-local-contracts-1w/streams.jsonl)保留全文与摘要（按 SHA-256 去重为 54 份正文，468 个流引用，未节选）；[完整性记录](./_resources/261022-record-tools-local-contracts-1w/integrity.json)核对样本、来源声明及初始树一致。[形成时方法](./_resources/261022-record-tools-local-contracts-1w/methods.txt)是本轮实际新写方法的阅读证据，不是长期维护工具、测试入口或独立可运行包。

## 调查结果与边界

### 主要结论

1. **两版各 117 个正式样本，全部通过各自契约的独立后验**：每版 Decision 21 场景×3、Investigation 18 场景×3。改前 90 成功、24 旧暂存契约拒绝、3 原生搜索预算拒绝；改后 114 成功、3 原生预算拒绝。未观察到 CLI 超时或 OOM。
2. **普通维护显著下降，但并非全部入口或指标都下降**：Decision publish 的 wall 中位数 60.58→6.38s、set-relations 46.54→1.50s；Investigation new 6.46→1.09s、publish 10.12→4.91s。Decision 起草仍有约 8s，不能声称集合成本消失。
3. **Investigation 基础单选 stage 出现成本回退**：index 1.57→5.11s（CPU 2.22→7.70s、RSS 316.9→414.5MiB），domain 3.89→4.82s，all 4.30→5.42s。Decision stage wall 明显下降，但三个 scope 的 RSS 均上升；Investigation publish RSS 也略升。此次未做分阶段 profile，不把总量变化归因为某一内部函数，也不把新保证包装成免费提速。
4. **健康结果一致与保证变化分别成立**：共同健康场景的领域结果通过独立后验；S3 搜索来源及 S5 暂存组合按各版契约核对，不能统称保证完全相同。新 content 明确来自 `published-index+current-text / unchecked / false`，旧样本为 `validated-source / current / false`。新普通维护沿用发布图和必要来源，不再证明未读全集当前健康；需要该结论仍须显式全量检查／同步。该变化是已批准契约，不是同等全集健康保证下的纯性能优化。

### 普通入口与基础单选 stage

表中均为三次**中位数**；箭头为改前→改后，wall／CPU 单位秒，RSS 单位 MiB。完整三次值和全部连续／刷新场景见[汇总](./_resources/261022-record-tools-local-contracts-1w/summary.json)。

| 域 | 场景 | wall | CPU | RSS |
| --- | --- | ---: | ---: | ---: |
| Decision | `new` | 11.68→8.15 | 12.90→9.13 | 346.6→272.2 |
| Decision | `candidates` | 8.25→3.56 | 9.67→4.29 | 267.1→261.9 |
| Decision | `show-candidate` | 7.15→4.01 | 8.39→4.66 | 257.3→263.8 |
| Decision | `content-related` | 12.45→0.80 | 13.29→1.19 | 313.5→220.2 |
| Decision | `publish` | 60.58→6.38 | 61.61→7.78 | 818.6→390.4 |
| Decision | `evolve` | 61.26→6.48 | 62.40→7.91 | 842.1→385.4 |
| Decision | `mark-aligned` | 41.10→1.61 | 42.19→2.23 | 662.0→351.1 |
| Decision | `archive` | 49.31→3.29 | 51.02→4.62 | 730.2→384.5 |
| Decision | `reactivate` | 38.63→1.46 | 40.44→2.02 | 603.5→349.1 |
| Decision | `set-relations` | 46.54→1.50 | 48.77→2.07 | 873.3→348.7 |
| Decision | `stage-index` | 15.30→7.71 | 17.18→11.25 | 371.0→442.1 |
| Decision | `stage-domain` | 13.33→5.09 | 15.78→7.87 | 341.0→357.8 |
| Decision | `stage-all` | 15.73→7.09 | 18.47→10.27 | 445.9→460.5 |
| Investigation | `new` | 6.46→1.09 | 6.88→1.50 | 322.8→226.3 |
| Investigation | `candidates` | 0.72→0.73 | 1.03→1.05 | 211.0→212.8 |
| Investigation | `show-candidate` | 0.72→0.73 | 1.05→1.03 | 211.8→211.9 |
| Investigation | `content-related` | 1.90→0.74 | 2.33→1.16 | 219.9→215.2 |
| Investigation | `content-cap` | 1.89→0.74 | 2.32→1.12 | 219.5→215.1 |
| Investigation | `publish` | 10.12→4.91 | 11.78→6.66 | 428.6→440.2 |
| Investigation | `set-relations` | 6.60→1.10 | 7.16→1.58 | 353.8→267.8 |
| Investigation | `stage-index` | 1.57→5.11 | 2.22→7.70 | 316.9→414.5 |
| Investigation | `stage-domain` | 3.89→4.82 | 5.89→7.30 | 366.3→354.9 |
| Investigation | `stage-all` | 4.30→5.42 | 6.47→7.97 | 368.9→417.6 |

`content-cap` 是 Investigation 在 10,000 候选文件超过原生 2,000 上限时的**拒绝成本**，不是成功扫描全文；Decision 一万条没有超过原生 10,000 上限，本轮不制造该拒绝场景。`evolve` 无删除。候选读取的局部 readiness 不等于正式全集健康。

### S5：选中刷新与未选保留的结果对照

每个 scope 均另测了 A 已 pending 后暂存 B，以及重选 B 刷新其旧 pending；每个场景各三次。A/B 都只是常数份变化；A 与旧 B 的 pending 由准备阶段按已知来源／投影用 Git 构造，主测只执行一次 B 的公开 CLI，不将准备包装成多条连续 CLI 的性能样本。

| 域／scope | 改前实际效果 | 改后实际效果 |
| --- | --- | --- |
| Decision index／domain／all | 已有领域 pending 时拒绝，零变化 | 成功刷新 B，保留未选 A |
| Investigation index | 已有 pending index 时拒绝，零变化 | 成功刷新 B，保留 A 的发布投影与 revision |
| Investigation domain | 成功刷新 B，保留 pending index 及未选文件 | 同时核对新契约，所选完整来源／owner 树刷新，未选保持 |
| Investigation all | 成功，但未选 A 的 pending revision 回到 HEAD | 成功，A 的 pending revision 保留 |

所有新 scope 样本均核对域外 pending 修改和 staged 删除保护。domain 保持 pending 索引字节，index 不暂存领域文件，all 组合两者；重选会用完整工作区版本替换所选对象原 pending。旧拒绝或旧覆盖不被记成“新保证也通过”，也不以拒绝耗时除新成功耗时计算加速比。

### S4：独立组件的调用封套成本

从已有 ready、已完成语义审核与授权的候选开始，比较旧默认 `publish --preflight`＋`publish`＋`check` 与新普通局部交付 `publish`。共同的候选读取／语义工作不计入；要求全集健康时不能省掉新侧全量检查。

下表按同一次序号的**独立命令样本成本相加，再取三次中位数**；各组件均恢复同一 N 条 fixture，未执行一段连续发布后 N+1 条的工作流，故只表达组件封套对照。RSS 不相加。

| 域 | 命令数 | wall 合计 | CPU 合计 |
| --- | ---: | ---: | ---: |
| Decision | 3→1 | 78.13→6.38s | 80.78→7.78s |
| Investigation | 3→1 | 19.12→4.91s | 22.71→6.66s |

[封套逐次求和](./_resources/261022-record-tools-local-contracts-1w/workflow-costs.json)保存组件及三次值。这同时减少了默认外层调用、改变全集验收安排，不能把全部收益归给 CLI 内部优化；项目门禁不因此取消。

### 完整性、采集异常与适用边界

一次改前 Investigation 预算拒绝已正确退出且状态不变，但采集后验误要求诊断包含数字 `2000`，真实公开诊断仅说明候选文件上限超出。该尝试[保留现场](./_resources/261022-record-tools-local-contracts-1w/method-anomaly.json)，不纳入 234 正式样本；修正断言后从该场景重新取得完整三次结果，没有掩去产品失败或改变原生上限。

本轮没有证明 p95、线性伸缩、十万条容量、所有异常组合或生产延迟；短正文、稀疏分组关系和常数资源不能外推大附件或复杂图。三次小差异不能单独建立因果或稳定回归阈值；但 IR stage index 约三倍的观察回退应保留为后续取舍依据，而非由其他命令提速抵消。全索引、图与完整 pending 保护仍有集合成本；如需定位回退原因，应在明确授权的新调查中做分阶段证据采集。

### 后续最小优化候选（静态证据）

本轮只读复核定位到 Investigation stage 更新路径的五处完整领域 pending 获取／校验：[readDomainPending](../../tools/investigation-report/src/staging-pending.ts)、[初始与独立写前 phase](../../tools/investigation-report/src/staging-domain.ts)经 [acquireDomainPhase](../../tools/investigation-report/src/staging-domain-membership.ts)取得快照，以及[共享 pending 替换](../../tools/shared/src/version-control/pending-snapshot.ts)的锁内 CAS 与写后核对；unchanged 路径省去写后核对。这里的完整范围是调查领域 pending，不是整个仓库。前两次同属准备阶段，index scope 中间主要进行选择与投影，不读取工作区正文或资源，可优先评估合并这两次获取。

这是静态优化接点，不是回退归因：合并后的时序与诊断等价、payload 损坏、准备漂移和 unchanged 路径覆盖，以及可节省成本的比例均未验证；不能据此解释全部回退。本轮没有为该候选修改实现或重新测量。

本报告交付本轮测量、实际效果与保证边界。生产代码、分发与项目门禁由相应实施和交付记录承接；报告的机械 readiness 仅验证结构、正文和直接资源，不能替代测量后验或证明产品全集健康。

## 随附资源

- [运行环境、默认 heap 与依赖版本](./_resources/261022-record-tools-local-contracts-1w/environment.json)
- [两域固定 fixture、字节规模与初始树](./_resources/261022-record-tools-local-contracts-1w/fixtures.json)
- [改前 revision 与实际改后源码／分发输入指纹](./_resources/261022-record-tools-local-contracts-1w/input-fingerprints.json)
- [覆盖、输出、来源契约与同字节完整性核对](./_resources/261022-record-tools-local-contracts-1w/integrity.json)
- [预算诊断断言修正前的真实尝试](./_resources/261022-record-tools-local-contracts-1w/method-anomaly.json)
- [本轮实际新写的形成时测量方法](./_resources/261022-record-tools-local-contracts-1w/methods.txt)
- [234 次正式样本及逐次独立后验](./_resources/261022-record-tools-local-contracts-1w/observations.jsonl)
- [468 份 stdout／stderr 引用与去重全文及摘要](./_resources/261022-record-tools-local-contracts-1w/streams.jsonl)
- [全部场景三次中位数](./_resources/261022-record-tools-local-contracts-1w/summary.json)
- [S4 命令封套逐次求和与边界](./_resources/261022-record-tools-local-contracts-1w/workflow-costs.json)
