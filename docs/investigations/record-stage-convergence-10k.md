---
title: "记录暂存共同协调机制一万条独立验收"
id: "261022-record-stage-convergence-10k"
formedAt: "2026-10-22T17:15:41Z"
question: "两域共同暂存机制在一万条存量单选下的成本、工作量与后验是否满足收敛目标？"
tags:
  - "decision-records"
  - "investigation-report"
  - "performance"
  - "scale-testing"
  - "version-control"
relations:
  - type: "复查"
    target: "261022-record-tools-local-contracts-1w"
    summary: "共同协调机制新快照下独立复核单选暂存成本与效果"
---

## 形成时背景

**最终匹配组通过本轮性能与独立效果验收：Decision Records（DR）index wall 中位数降低 65.11%，Investigation Report（IR）降低 15.05%。** 首轮候选因稳定回退被拒绝；修复后 v2 通过性能验收；后续结构整理改变了运行时源码，因此再次冻结 v3 并完整重测相同有限矩阵。主结论只使用最终 v3 匹配组，v1 失败组与 v2 中间组独立保留。

[前序调查](record-tools-local-contracts-1w.md)保留了局部契约调整时的成本与保证；[后续归因](ir-index-stage-regression-cause.md)识别了 pending 范围及重复准备成本。本轮在共同协调机制的新源码条件下独立复查单选 stage，保留旧轮次以区分契约、版本、fixture 与入口的变化。**本轮测量公开源码 stage API，不含 CLI 解析与渲染**，不能与旧报告的分发 CLI 耗时直接拼表。

## 调查目的

在两域各 10,000 条正式存量、每次固定选中 1 条下，对照共同 stage 机制与固定 baseline，检查成本、实际工作量以及 selected 刷新／unselected 保持。index 各版 3 次主样本通过后，各域 all/domain 各取 1 对代表样本；资源用 Investigation 一个共享 owner 场景代表。连续 A→B 与修改后重选 A 使用 100 条小 fixture；本轮仅覆盖这些有限场景。

## 调查范围与依据

### 源码、输入与有限场景

baseline 固定为 Git `4043171705d7fd667b135e9898c6f66f3221161d`。候选是实施后未提交源码的独立副本，以工具树聚合 SHA-256 定位：首轮为 `9354aa4a93b66390a6a3dc0c358c7dbf0b3b821afbf85657e44609b979a2a367`，中间 v2 为 `8429ed3a00eb326071d69e8cddd0da55284a50cc4637550accac541eaa6964a0`，最终 v3 为 `da02d787b3926d96f8a0331b4332b51ea927e72b80f469e1f66e410ba60142a1`。逐文件 SHA、采集时点、共享 manifest／锁文件摘要分别见原输入指纹与新增 v3 输入指纹。各组使用同一兼容依赖，原 v1/v2 资源未覆盖。

隔离 Git 仓库同时包含两域，各 10,000 正式对象、9,000 条分组链式关系；每十条为一组且无跨组边。Decision 为 9,000 archived＋1,000 active；Investigation 为 10,000 报告。Decision 正文 4,262,016 B、工作区索引 6,682,273 B；Investigation 正文 4,128,210 B、索引 5,472,408 B。正文、关系与资源规模固定，生成方法及完整性摘要见资源。

下文 H 为固定 HEAD，W 为工作区，P 为 Git pending。固定选择 `261001-perf-00000`；未选对象 `00031` 保留部分 pending 内容与 `100755` 模式，`00032` 保留 staged 删除，另有外域 pending 修改／staged 删除和不同工作区字节。工作区已同步 selected 及未选来源变化，初始 pending 索引保留 HEAD 投影。所选 Investigation 直接引用未选 `00003` owner 的共享资源，自有 owner 树还包含更新、增加、删除和可执行模式变化，用于核对完整树刷新（含未引用成员）。每次复制隔离 Git index 恢复相同 P，H 与 W 固定；初始化、sync、恢复、后验均不计入 stage。

### 计量与后验

环境为 Node 26.8.2、Git 2.53.0、Linux、4 CPU 配额、6 GiB cgroup，`NODE_OPTIONS` 置空。每次启动 Node 新进程，直接 import 公开 `stageDecisionRecords` 或 `stageInvestigationReports`。计量口径如下：

| 指标 | 实际覆盖 |
| --- | --- |
| wall | 从 fork 前到 wait4 结束，包含进程启动与 API 调用。 |
| CPU | `ru_utime+ru_stime`，含 Node 及其已等待 Git 子进程。 |
| RSS | Linux wait4 `ru_maxrss`（KiB），继承式最大进程峰值，非子树同一时刻 RSS 之和或 JS heap。 |

每域每版每 scope 预热 1 次。index 正式 3 对按 baseline→candidate、candidate→baseline、baseline→candidate 交替；all/domain 各 1 对。三轮均在冻结代码并停止其他测试／同步后串行采集；不主动清 OS 缓存，仍非整机隔离。预先约定主组极差／中位数超过 10% 标为噪声，回退判断另看全部样本、实测组内波动与配对方向。全部 80 次 1W 观测分组保留：首轮 12 正式＋4 预热；v2、v3 各为主组 12 正式、scope 代表 8 次、预热 12 次。原资源保存前 48 次，新增 v3 资源单独保存 32 次，不拼接不同候选或旧 baseline 样本。正式中位数不含预热。

每次结束后独立读取 Git pending 与 JSON，不调用被测 stage 的投影／检查逻辑：完整预期由原 P 所有 entry／revision 仅替换 selected 当前 W 投影形成，并独立 SHA-256 重算 selected 来源 revision。核对所有未选 entry／revision、全 pending 路径／OID／mode 与删除、selected 文件及 owner 树字节／mode／删除、scope 外保持和全 W 来源／资源 SHA 清单不变。domain 保持原 pending 索引，index 保持领域文件；Git 内部对象新增不属于 W 来源变化。100 条连续序列另核对先前已选对象与 revision 不被后选覆盖。

独立探针仅在隔离源码副本临时插桩，记录 P 捕获、batch 对象／payload 字节、固定 H 读取、W 字节、parse/build/graph、枚举及物理 index 复制；工作量调用单列，不混入正式计时或增加产品遥测。调用次数不等于阶段耗时或各函数独立贡献。

## 调查结果与边界

### 1. 首轮真实回退被拒绝

首轮 IR index baseline wall 为 2.461530／2.459229／2.437561s，候选为 3.159944／3.189719／3.225558s；中位 +29.70%，自身极差约 0.98%／2.06%。CPU 中位 3.307634→4.231159s，RSS 387,044→494,872 KiB，均上升约 28%。DR 同时 wall 中位 6.786981→3.628033s，但 RSS 457,920→516,160 KiB。所有效果后验通过不抵消性能回退，因此当场停止 all/domain，不验收首轮候选。

IR 独立工作量显示 H／P 读取、W 字节、枚举与物理复制未扩大，但 parse 4→5、target build 1→2、graph 4→7。这将问题缩到新增重复计算，而非 payload 范围；调用次数不能推导精确耗时占比。修复后冻结独立 v2，并重测完整同轮 baseline 三次。v2 的 DR／IR index wall 中位数分别为 6.741977→2.338189s（−65.32%）、2.481653→2.129019s（−14.21%），通过当时的性能与效果验收。

后续按实际 owner 收敛阶段准备／冻结证据比较、领域适配与结果映射，源码结构发生变化；因此不能用 v2 样本代表最终运行时。重新复制独立 v3，并以同一 fixture 完整重测两域 index 三对及 all/domain 各一对。v2 只作为结构整理前的中间证据，不纳入下方最终表。

### 2. 最终 v3 index 完整匹配组

下表列出三次全部值；时间单位秒，RSS 单位 KiB，按组内序号排列，真实交替执行顺序见 v3 原始观测。

| 域／版本 | wall 三次 | CPU 三次 | RSS 三次 |
| --- | --- | --- | --- |
| Decision baseline-v3 | 6.712542 / 6.803557 / 6.663011 | 9.929110 / 10.074182 / 9.871118 | 455624 / 461752 / 453356 |
| Decision candidate-v3 | 2.342072 / 2.319708 / 2.345526 | 3.291347 / 3.201247 / 3.298223 | 409944 / 390580 / 421536 |
| Investigation baseline-v3 | 2.500237 / 2.533028 / 2.529476 | 3.339778 / 3.362869 / 3.346990 | 383256 / 382068 / 381844 |
| Investigation candidate-v3 | 2.148688 / 2.146668 / 2.168040 | 2.932101 / 2.905331 / 2.974909 | 349944 / 371452 / 351256 |

Decision 中位 wall **6.712542→2.342072s（−65.11%）**，CPU 9.929110→3.291347s（−66.85%），RSS 455,624→409,944 KiB（−10.03%）。Investigation 中位 wall **2.529476→2.148688s（−15.05%）**，CPU 3.346990→2.932101s（−12.40%），RSS 382,068→351,256 KiB（−8.06%）。最终四个 wall 组极差／中位数约 2.09%、1.10%、1.30%、0.99%；每对 IR 候选均低于 baseline，未见稳定回退。三次只支持本机本负载观察，不提供统计总体置信区间或生产延迟承诺。

### 3. 有限 all/domain 代表

各格为同轮 baseline-v3→candidate-v3，**每版仅 1 次正式样本，不作稳定提升或统计回归结论**。

| 域／scope | wall秒 | CPU秒 | RSS KiB |
| --- | ---: | ---: | ---: |
| Decision all | 6.759666→5.165071 | 10.072017→8.034054 | 478148→410032 |
| Decision domain | 4.775152→3.110779 | 7.620774→5.086583 | 353824→322376 |
| Investigation all | 5.073495→4.605491 | 7.713191→7.127008 | 413184→364808 |
| Investigation domain | 4.145258→3.866727 | 6.568825→6.231437 | 359504→318232 |

代表样本均通过 selected／unselected 与 scope 后验。IR all 同时覆盖必要共享 owner 和完整自有资源树；domain 证明不覆盖索引。v2 的 IR all baseline 预热 6.932616s 与正式 5.087321s 差距明显，原值继续保留在 v2 资源；最终 v3 对应预热为 5.131722s、正式为 5.073495s。预热与正式、不同候选组均分别解释。

### 4. 实际工作量与剩余成本

v3 另取两域 index 与 IR all 各一对独立探针，工作量计数、完整 payload／W 来源字节、成员枚举及物理复制与 v2 相同；下表使用最终 v3 观察，不以结构调整前的探针替代最终验证。

| index 工作量 | Decision baseline→v3 | Investigation baseline→v3 |
| --- | ---: | ---: |
| parseStateIndex | 6→3 | 4→3 |
| target build | 2→1 | 1→1 |
| graph build | 8→4 | 4→4 |
| 显式P capture | 4→2 | 2→2 |
| P成员枚举（含锁内／写后） | 6→4 | 4→4 |
| H索引blob批 | 2→1 | 1→1 |
| P payload批（含锁内／写后） | 6→4 | 4→4 |
| W索引读取 | 2→2 | 2→2 |
| 物理Git index复制 | 1→1 | 1→1 |

DR baseline 每 P 批读取 10,000 唯一对象、约 10,943,823 B（写后 10,943,831 B），v3 每批只读 1 个索引对象 6,682,257 B（写后 6,682,265 B）。这是**payload 验收范围收窄与重复准备／解析减少的合成收益**，不是维持全部非 index payload 读取保证的纯加速；完整成员身份和 OID 比较仍存在。IR baseline 本来已按 index 收窄，前后每 P 批均为 1 个索引对象 5,472,392 B（写后 5,472,400 B），减少的是重复解析；首轮候选多出的 target build 与 graph 已消除。

两域 W 均保持独立读取两次：DR 每次 6,682,273 B，IR 每次 5,472,408 B；index 不读 W Markdown／资源。每次仍需 1 次完整物理 index 复制 2,152,679 B，包含两域与外域成员，逻辑 scope 不消除 Git 物理集合成本。

IR all 的 baseline-v3/candidate-v3 均为 1 批 H＋5 批完整 P，P 每批约 10,003 对象、9,600,302 B（写后 9,600,285 B）。两阶段均读取 selected 报告、必要 owner 报告与 3 份 W 资源，合计 12 次 readFile／10,946,948 B、6 次 readdir、166 次 lstat；独立来源、资源成员与表示复核保持。parse 4→3，target build 与 graph 分别保持 1 和 4。两版某一 P 批的**保留**字节不同，但完整 payload 读取字节相同，`retainedBytes` 不代表实际 I/O。

这些集合规模成本仍存在，短正文与常数资源不能外推大型附件或复杂关系图。没有逐函数计时干预，因此只能说明观察到哪些工作减少以及与总量结果一致，不能把各项收益独立相加。

### 5. 完整性与未覆盖边界

80 次 1W 观测及 14 次独立工作量调用全部通过各自 scope 的独立后验；三轮候选各有两域 100 条 A→B→修改后重选 A 的 6 步检查，共 18 步，全部通过。v3 新增 32 次观测与 6 次探针，前两轮 48 次观测与 8 次探针保留原资源，未覆盖或混组。输出保存完整字节 SHA；冗长 `preservedPendingPaths` 只节选首尾并保留数组总数／规范 JSON SHA，其余输出字段及 stderr 保真，具体处理见 streams 资源。

本轮未覆盖异常／竞态全集、symlink 故障、跨平台 runner、十万条容量、冷缓存、p95、内存子树同时峰值或公开 CLI／分发开销。产品功能测试、生成接线与项目 Gate 由实施 owner 另行验收；本文只报告本轮实测。随附资源供复核形成时证据，不是长期测试入口或可维护基准工具。

## 随附资源

- [运行环境与Git配置](./_resources/261022-record-stage-convergence-10k/context.json)
- [fixture规模、资源表示与输入完整性摘要](./_resources/261022-record-stage-convergence-10k/fixture-integrity.json)
- [最终v3源码逐文件输入指纹](./_resources/261022-record-stage-convergence-10k/input-fingerprints-v3.json)
- [两轮候选与固定baseline逐文件输入指纹](./_resources/261022-record-stage-convergence-10k/input-fingerprints.json)
- [最终v3实际方法与独立驱动](./_resources/261022-record-stage-convergence-10k/methods-v3.txt)
- [本轮实际方法与执行驱动](./_resources/261022-record-stage-convergence-10k/methods.txt)
- [最终v3独立32次观测与后验](./_resources/261022-record-stage-convergence-10k/observations-v3.jsonl)
- [前两轮48次1W样本与逐次独立后验](./_resources/261022-record-stage-convergence-10k/observations.jsonl)
- [最终v3原始工作量事件](./_resources/261022-record-stage-convergence-10k/probe-events-v3.json)
- [两轮原始工作量事件](./_resources/261022-record-stage-convergence-10k/probe-events.json)
- [首轮被拒绝IR工作量摘要](./_resources/261022-record-stage-convergence-10k/probe-summary-v1.json)
- [中间v2两域index与IR资源代表工作量](./_resources/261022-record-stage-convergence-10k/probe-summary-v2.json)
- [最终v3两域index与IR资源工作量](./_resources/261022-record-stage-convergence-10k/probe-summary-v3.json)
- [首轮小fixture连续序列效果](./_resources/261022-record-stage-convergence-10k/sequence-effects-v1.json)
- [中间v2小fixture连续序列效果](./_resources/261022-record-stage-convergence-10k/sequence-effects-v2.json)
- [最终v3小fixture连续序列效果](./_resources/261022-record-stage-convergence-10k/sequence-effects-v3.json)
- [最终v3输出流与节选指纹](./_resources/261022-record-stage-convergence-10k/streams-v3.json)
- [输出流摘要、节选与全文指纹](./_resources/261022-record-stage-convergence-10k/streams.json)
- [最终v3分布与中位数](./_resources/261022-record-stage-convergence-10k/summary-v3.json)
- [前两轮各组的分布与中位数](./_resources/261022-record-stage-convergence-10k/summary.json)
