---
title: "调查索引暂存回退的分阶段归因"
id: "261022-ir-index-stage-regression-cause"
formedAt: "2026-10-22T05:43:55Z"
question: "一万条单选 index 暂存为何从1.57秒回退至5.11秒，哪些新增工作与重复成本占主导？"
tags:
  - "investigation-report"
  - "performance"
  - "root-cause-analysis"
  - "version-control"
relations:
  - type: "补充"
    target: "261022-record-tools-local-contracts-1w"
    summary: "为既有暂存成本回退增加分阶段与受控干预归因"
---

## 形成时背景

**本轮确认：完整调查领域 pending（下文 P）payload 范围扩大、对象扇出与体量经过五轮处理，是 index 暂存回退的主因；准备阶段重复获取及额外索引解析／工作区索引复核是次因，关系图不是主导瓶颈。** 本轮仅调查，没有修复实现或放宽当前保证。

[前序成本调查](record-tools-local-contracts-1w.md)在一万条存量、常数单选下观察到 index stage wall 中位数 1.57→5.11s，但未分阶段取证。前序回答总成本与保证变化；本轮另行回答回退的因果机制，以“补充”增加受控干预与阶段证据，不改写前序样本、资源或结论。

本文“当前”均指取证版本 `af4015ab`，操作保证与后续建议按该版本解释。下文 H 表示固定 HEAD 基线，W 表示工作区，P 表示调查领域的 Git pending。初始候选解释包括：完整 P 校验范围扩大、准备与复核轮次重复、三方索引解析与图校验增多、意外读取工作区正文。静态调用链发现旧 index 使用 generic stage 的单索引 CAS，新 index 进入领域流程；动态调查据此区分必要新增保证与可避免重复，不能把新连续暂存保证和基本单选场景混为一谈。

## 调查目的

在与前序同字节的一万条代表负载中重新复现旧／新公开 CLI 成本，量化完整 P、索引解析、图及写前复核，判断主要解释和最小后续优化接点。范围限于基本单选 index 暂存；诊断变体用于识别成本与保证的关系，产品实现及当前契约保持不变。

当前保证保持明确：以 P 为底，未选保持、选中刷新；index 不读工作区正文；完整 P payload 按共享 Git blob 边界校验、三方 metadata 兼容、必要图与 owner 声明、独立写前漂移保护、锁内 CAS 与写后保护均有责任。通用 index-runtime 其他消费者的默认行为不在本轮修改范围。

## 调查范围与依据

### 输入与恢复

2026-10-22 在同一宿主新写方法，旧版由 Git `0a85d4139309657c1b2d0e985d40f0c57f7f71e7` 独立 archive，当前为 `af4015ab` 的实际源码与公开分发字节副本。没有执行或修补历史方法。输入逐文件指纹、环境、fixture 与分组边界见随附 `context.json`。

每次使用真实 Node 26.8.2 公开 CLI，`NODE_OPTIONS=''`、默认 heap 2,248,146,944B，4 CPU 配额、6GiB cgroup，不强制清 OS 缓存。fixture HEAD tree 精确等于前序 `e234306131070fe7762852346d249d0468eb7497`：10,000 正式报告、9,000 分组边、2 ready 候选、全域 5×96B 资源，索引 5,893,454B。每十条的九叶指向组根，无跨组边。

基本单选 P=HEAD，没有 A 或旧 B pending。准备阶段修改 B（`261001-perf-00007`）正文并重建工作区发布索引，增加 B 的 96B 未引用 owner 成员，保留域外 pending 修改和 staged 删除；每次仅把 pending index 恢复为 HEAD，其他相同准备字节不变。被测动作只有一次 `stage B --scope index`，完整 argv 随原观测保存。

### 样本、计时与独立效果

共 **31 次观察**，不是31份同条件性能样本：旧／当前原生各3次（6），三种无插桩诊断变体各3次（9），初始 probe 各1次（2），重新串行的 clean probe 各3次（6），current／merge交替3对（6），merge／narrow各1次计数 probe（2）。逐次顺序与分组见 `observations.jsonl`、`context.json`；clean 原始阶段事件见 `phases.json`。

`os.wait4` 记录 CLI 至退出的 wall、user+system CPU 和 maxrss，包含 Node 与其 Git 子进程，不含准备／后验／Bun wrapper。函数 timer 用 `performance.now` 与 `process.cpuUsage`，**阶段 CPU 仅 Node，不含 Git；计时是 inclusive，父子阶段不能相加**。原生无插桩组用于端到端倍数；插桩只用于工作量和阶段定位，不要求其总时与另一组精确相等。

每次独立核对全部工作区来源／资源 SHA 不变、pending 只允许 index 改变，并从已知 fixture 的 HEAD 加 B 当前投影及 revision 计算完整预期 JSON；未选条目、pending 路径／OID／表示和域外 staged 删除均保持。31次全部通过，没有用被测 CLI check 代替后验。

计时窗口内其他代理不运行重测／构建，仍非整机隔离。初始 current probe 与本轮临时 variant 副本准备短暂重叠，保留真实指标与输出，但排除 clean 归因；随后等待准备结束重新串行取得各3次 clean probe。最后配对样本存在明显宿主波动，未取得特定外部原因证据。

## 调查结果与边界

### 1. 原生复现与受控干预

下表均为各3次中位数；本轮 **1.674→5.482s** 与前序 **1.57→5.11s** 是两组独立样本，不能混算。

| 组 | wall（s） | CPU，含Git（s） | RSS（MiB） |
| --- | ---: | ---: | ---: |
| 旧基线 | 1.674 | 2.379 | 317.5 |
| 当前 | 5.482 | 8.257 | 411.4 |
| merge：合并准备 P 获取 | 4.715 | 7.010 | 408.7 |
| narrow：每轮仅验证 index payload | 2.677 | 3.530 | 384.4 |
| merge+narrow | 2.630 | 3.456 | 378.1 |

narrow 保留全 P 成员与 OID CAS、原有五轮 P、全部索引解析／图／serialize，但每轮仅读 index payload，**失去非 index 对象缺失、读取失败、传输截断等完整 payload 读取验收，不满足当前契约**。其端到端减少约2.8s，为范围扩大是主因提供受控证据；采用该方向需要先明确收窄非 index payload 验收的产品责任，不能直接作为保持当前保证的修复。

该干预同时降低对象数和 payload 字节，本轮未分离每对象开销与每字节开销，不能给二者精确贡献。组合组还说明范围成本与重复轮次存在交互，不能把两项单独收益相加。

### 2. 主因：完整 P 范围经过多轮实际读取与校验

旧版 Git blob 获取共3批，每批仅1个索引对象、5,893,454B。当前为1批 H 索引，加 **5批完整领域 P**；每批 P 实际验证 **10,004个唯一对象、13,524,459B**。contentPaths 只控制保留字节，不缩小实际 payload 验证范围。

这里的完整 payload 校验指 Git blob 的读取／传输完整性及实际内容指纹保护，不是解析未选 P Markdown 的领域语义，不证明全集正文健康；本轮也没有证明独立重算所有 Git 对象的加密 SHA／OID 一致性。narrow 移除的是非 index 对象在这些读取边界上的验收，不能泛化为所有损坏类型均被当前实现独立识别。

五轮分别为 `readDomainPending`、initial phase、独立写前 phase、锁内 CAS、写后验证。相关 owner 位于 [暂存准备](../../tools/investigation-report/src/staging/staging-pending.ts)、[领域阶段编排](../../tools/investigation-report/src/staging/domain/staging-domain.ts)、[成员获取](../../tools/investigation-report/src/staging/domain/staging-domain-membership.ts)及[共享 pending snapshot／patch](../../tools/shared/src/version-control/pending-snapshot.ts)；blob 选择与完整读取由 [pending 内容](../../tools/shared/src/version-control/git/pending/git-pending-snapshot-content.ts)和 [batch reader](../../tools/shared/src/version-control/git/git-blob-batch.ts)承接。

clean probe 三次累计 wall 中位：`readGitBlobSelections` **49→2503ms**，其 Node CPU **47→1910ms**。当前三处 `readPendingSnapshot` 的各自三次 wall 中位数约为523／545／520ms；锁内 prepare约566ms、写后约536ms，后两项含各自 blob 获取，不能再把内层时间加进去。

完整 P 范围扩大及其多轮处理的合成成本，与 narrow 干预共同闭合主因。只把回退解释为“多一次JSON”或“多一次图”不符合这些证据；也不能把全部增长宣称为新增保证不可避免，因为准备阶段存在重复。

### 3. 次因：准备重复、额外解析与 W 索引复核

| clean阶段累计 | 旧→当前次数 | wall中位（ms） | Node CPU中位（ms） |
| --- | ---: | ---: | ---: |
| parseStateIndex | 2→4 | 828→1407 | 1177→1843 |
| stage graph | 3→4 | 96→133 | 142→220 |
| serializeStateIndex | 1→3 | 70→164 | 87→193 |

旧 parse 是 H、W；当前为 W、H、P、独立复读 W。当前 stage graph 是 W、H、P、target，独立复读 W 仅用基础索引校验。graph 的观测增量为数十毫秒，不是数秒回退的主导；它嵌套于 parse／build，不能与父层重复计入。

[verifyDomainIndex](../../tools/investigation-report/src/staging/domain/staging-domain-context.ts) 重新取得 W 索引并与准备快照规范化比较，clean wall约433ms、Node CPU约501ms，包含一次 parse及两次serialize。额外 P 解析、W独立复核和三方／合成图校验承担当前保证；不能直接删除。当前 index 分支跳过工作区正文与资源来源读取，未发现意外扩大到 W 全文的路径。

merge 复用初次 P 作为准备事实。额外计数 probe 确认完整 P **5→4**、readPendingSnapshot **3→2**；parse仍4、stage graph仍4、serialize仍3，独立 W 复核、锁内 CAS、写后验证各1保持。准确干预还省去 initial phase 的纯集合构造、同快照比较和无消费者的所选 P 字节保留，**不是严格纯单函数收益**。

原生 merge 组比当前减少约0.77s，但交替3对的 wall差为0.672／0.294／1.585s，中位0.672s，不能承诺固定收益或统计上界。其异常时序、错误优先级、漂移诊断等价尚未验证；该候选不是已证明安全的修复。即使采用同等合并，诊断结果仍约4.7s，不能承诺回到1.57s。

### 4. 形成时的后续选择与交付边界

本轮交付原因调查与临时反事实；产品实现与当前操作保证未改变，前序报告及其资源保持原样。后续按责任与证据依次选择：

1. **先验证保持现有保证的准备合并**：评估 index 准备阶段复用 P，核对非 index 对象缺失／读取失败、准备漂移、unchanged 路径及异常诊断等价，保留独立写前、锁内与写后保护。merge 的实测收益不代表安全等价已经成立。
2. **按产品取舍讨论较大的验收范围收益**：narrow 保留全 P 成员／OID CAS，但收窄非 index payload 读取验收。它可作为明确改变责任的方案输入；须先决定接受何种保证，再设计和验证，不能直接当作当前契约的安全修复。
3. **再测其他低复杂度重复**：W 索引规范化序列化等重复工作可作为候选，本轮尚未单独干预或证明收益。现有证据不要求引入持久缓存或新增状态体系。

结论限于本轮一万条、短正文、稀疏分组关系、常数资源与基本单选 index。没有证明 p95、冷缓存、大附件、复杂图、其他scope或十万条容量；没有独立量化每对象／每字节、hash／Git读取／JS framing、GC或RSS各自贡献。不以其他操作提速抵消本回退，也不因有重复候选就默认要求立即实施。

随附材料保留31次原观测及62个输出流全文；输出仅按SHA去重，阶段与最小diff合并，方法作为阅读证据而非执行入口。没有归档大fixture、源码副本或依赖；来源revision及字节指纹支持进一步复核。机械候选readiness不代替上述语义、因果和修复安全边界。

## 随附资源

- [环境、fixture、输入指纹与异常说明](./_resources/261022-ir-index-stage-regression-cause/context.json)
- [诊断变体完整最小差异](./_resources/261022-ir-index-stage-regression-cause/interventions.txt)
- [本轮新写方法阅读证据](./_resources/261022-ir-index-stage-regression-cause/methods.txt)
- [31次原始观测与独立效果](./_resources/261022-ir-index-stage-regression-cause/observations.jsonl)
- [clean及其他探针的原始阶段事件](./_resources/261022-ir-index-stage-regression-cause/phases.json)
- [62个原输出流引用及去重全文](./_resources/261022-ir-index-stage-regression-cause/streams.json)
- [原生、阶段、配对与计数汇总](./_resources/261022-ir-index-stage-regression-cause/summary.json)
