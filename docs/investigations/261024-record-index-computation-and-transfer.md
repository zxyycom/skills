---
title: "记录工具整索引计算与暂存传输成本调查"
id: "261024-record-index-computation-and-transfer"
formedAt: "2026-10-24T15:59:56Z"
question: "在保留当前索引格式与阶段保护的条件下，整索引解析、构建、序列化及Git传输还有哪些值得消除的重复成本？"
tags:
  - "decision-records"
  - "index-runtime"
  - "investigation-report"
  - "performance"
  - "version-control"
relations:
  - type: "补充"
    target: "261024-record-tools-entry-matrix-10k"
    summary: "分离整索引重复计算与暂存传输成本"
---

## 形成时背景

[一万条全入口横向复查](record-tools-entry-matrix-10k.md)显示，正文访问局部化之后，Decision Records（DR）与 Investigation Report（IR）的整索引计算和 Git 暂存仍有集合级成本。本轮在既有局部化与阶段证明复用之上，调查解析、复制、构建、序列化、关系图及 Git 大 payload，随后实施 envelope 原地冻结并补测落地版。

原型结果促使采用标准从“跨两域稳定加速”转为“在正确性成立后，以更小维护面消除重复工作，并明确端到端取舍”。因此，原型、实施验证和落地版复测分别保留版本、窗口和反向结果。

## 调查目的

区分可省的调用内纯计算与不同投影、阶段各自承担的安全验证；在保持索引格式、公开契约和 fresh／CAS／readback 的条件下，判断局部原地冻结是否值得采用，以及剩余集合工作的责任边界。

## 调查范围与依据

### 对象与输入

检查两域、共同记录操作、Index Runtime 和 shared 版本管理 owner。定量矩阵限定为两域 selected sync 与 stage index 四场景；全量 check／sync 的共享路径只用于静态机制判断。

每域 10,000 正式记录、9,000 稀疏关系和 2 个候选；DR 为 9,000 archived／1,000 active，IR 另有一个小 owner 资源。DR／IR 基线索引分别为 **6,303,257／5,193,312 B**。输入按保存的 recipe 重新生成并独立核对。

| 场景 | 操作与初态 |
| --- | --- |
| DR／IR selected sync | 修改一个正式记录 title 并真实写入；覆盖严格发布基线、所选及必要依赖、完整新投影／图、独立 fresh 与 readback。 |
| DR／IR stage index | 只暂存一个 ID 的索引投影；保留未选 pending 索引变化、已暂存未选正文及范围外 sentinel，覆盖 H/W/P 全索引与 pending 保护。 |

H、W、P 分别指固定 HEAD、工作区和 Git pending。该矩阵未测 stage all／domain 或全部公开入口。

### 证据阶段与计量

| 阶段 | 冻结来源、实际时点与覆盖 |
| --- | --- |
| 原型 | 2026-10-24，实际冻结 `ac40e50c`；受测五个工具目录及 DR／IR skill 与任务基线 `f381715c` 相同，DR 95／IR 85。四场景各 3 对，共 24 次正常、8 次阶段 probe、8 次闭包 smoke，另保存 3 次采集器自检。 |
| 实施验证 | 同日 16:48 UTC 起，基于 `a661d059` 工作树核对固定 schema 与 Valibot 1.4.2 的所有权，实施私有冻结，新增五个原生测试节点及定向变异。 |
| 落地版复测 | 同日 19:32:05–19:37:17 UTC 修正窗口，`ef809161`，DR 98／IR 87；四场景各 3 对，共 24 次正常、8 次闭包 smoke。仅撤回 envelope 原地冻结，DR 复用及其余闭包保持相同。 |

本文“落地版”固定指 `ef809161`。Node 26.8.2、Git 2.53.0、Bun 1.4.2，cgroup 配额 4 CPU／6 GiB；源码、生成文件、实际依赖及 optional `supports-color` 9.4.0 均在采样前冻结。新进程串行执行，恢复和后验在计时外，文件缓存已暖。每场景按撤回→启用、启用→撤回、撤回→启用执行；正常运行不插桩。

wall 覆盖新进程启动至退出，CPU 为 wait4 user+system，RSS 为该口径的高水位，而非同时进程树总内存或 JS heap。原型第 1 对多场景前后观察到其他 Bun；全部样本保留，端点快照不足以排除窗口内或宿主干扰。

**复测表仅使用修正窗口。**同批首轮长文后验使大 oracle 父进程污染 wait4 RSS；控制实验确认后，改用约 15 MiB resident 的独立计量进程，完整重跑两报告矩阵。首轮全部数据保留、两窗口分别统计；修正与控制证据见[共享复测方法](./_resources/261024-record-global-throughput-and-memory/current-version-methods.md)。

## 调查结果与边界

### 采用判断

**采用局部原地冻结：本次 JSON 解码与固定 schema 完整拥有 envelope 对象图，可以省去重复 JSON 复检与复制。**实现限于 [snapshot-parser.ts](../../tools/index-runtime/src/snapshot-parser.ts)，保留严格 schema、领域归一化、外部 parser 返回值的复制隔离及全部阶段保护。

采用依据是已验证的所有权和较小维护面。原型与落地版完整 CLI 均未一致加速：落地版 IR selected 三对 wall 上升，DR stage 两对变慢，IR stage 三对 RSS 上升。局部省工与端到端性能分别成立，不能互相替代。

### 落地版复测：时延与内存取舍

每格为 3 次正常运行的组中位，撤回版→落地版；wall／CPU 单位秒，RSS 单位 MiB。百分比按两组中位之比减一，资源另存 min／median／max 和全部逐对值。

| 场景 | wall | CPU | 峰值 RSS | wall 变慢对数 |
| --- | ---: | ---: | ---: | ---: |
| DR selected sync | 1.336→1.334 | 1.881→1.901 | 314.5→313.2 | 0/3 |
| IR selected sync | 1.273→1.298 | 1.825→1.825 | 299.4→302.5 | 3/3 |
| DR stage index | 2.395→2.397 | 3.288→3.250 | 412.4→371.0 | 2/3 |
| IR stage index | 2.253→2.194 | 3.101→2.994 | 357.2→382.0 | 0/3 |

- **DR selected sync**：wall 中位 −0.20%，三对 wall、RSS 均略低；CPU 中位 +1.08%，两对上升。
- **IR selected sync**：wall 中位 +1.94%，三对均变慢；RSS 中位 +1.06%，两对上升；CPU 中位近乎不变、两对上升。
- **DR stage index**：wall 中位 +0.08%；第 1 对 **3.198→4.088 秒（+27.8%）**，第 3 对也略慢；RSS 三对均下降，中位 −10.04%。
- **IR stage index**：wall 中位 −2.62%，三对均下降；RSS 三对均上升，中位 **+6.94%**。

每对完整输出、W／P 最终差异及索引效果一致，修正窗口正常样本与同版 smoke 也一致。独立 Python／PyYAML oracle 核对 W bytes/mode、P mode/OID/字节、HEAD、完整索引和逐 ID 指纹；stage 后验独立组合旧 pending 与所选工作区投影。起止源码、生成及依赖指纹相同，闭包文件 URL 均位于隔离副本。

### 原型诊断：剩余集合工作的责任

以下是原型独立 probe 的成功调用／返回字节，两版本计数相同；它们不是落地版新增计数，也不是物理 I/O 或耗时占比。

| 场景 | 严格 parse／完整 build | canonicalize／serialize | 完整领域图检查 | 工作区索引 API 读取 | Git 完整 payload |
| --- | --- | --- | --- | --- | --- |
| DR selected | 1／1 | 4／2 | 2 | 4 次，25,213,023 B | 0 |
| IR selected | 1／1 | 4／2 | 2 | 4 次，20,773,243 B | 0 |
| DR stage index | 3／1 | 6／1 | 4 | 2 次，12,606,504 B | 5 blob，31,516,292 B |
| IR stage index | 3／1 | 6／2 | 4 | 2 次，10,386,614 B | 5 blob，25,966,567 B |

selected 正文只有 2 个唯一读取路径、共 4 次，分别为所选及必要依赖在 prepare／fresh 的读取；stage index 未读正文。**正文局部与索引全量同时成立**：

- selected 的四次索引读取分别核对严格基线、交接时实际 baseline、写前 fresh 和写后 readback；两次 serialize 分别验证 canonical 基线和生成最终索引，新旧组合图具有不同输入。
- stage 严格解析 H/W/P 并验证最终组合图；fresh 重取 W/P 字节和完整身份，等价证明成立后复用确定性计算。
- 5 次 Git blob 分别为固定 H 索引、captured P 索引在准备／fresh／锁内 CAS 的三次读取、最终 P 写后验收。Git metadata index 另有集合级复制；API 字节明细见原型资源。

### 原型取舍与实施依据

基线在 `JSON.parse` 和严格 Valibot 外壳之后，以 `cloneAndFreezeTypedJsonObject` 再次递归验证、复制及冻结。局部方案改用私有原地冻结，所有权依据为：

1. 无 reviver 的 JSON 解码建立本调用对象图；固定 schema 的 metadata/state custom 只检查 JSON，严格外壳和安全 record 转换不注入外部引用。
2. schema 已拒绝非有限数值，包括解析后为 Infinity 的 `1e999`；特殊 own key 由安全 record 构造保留。
3. 冻结发生在领域 callback 前。callback 返回对象属于另一所有权边界，后续归一化继续复制隔离，调用方持有的对象保持可变。

因此，私有 helper 只冻结已验证、自有 JSON 图，通用复制 helper 的消费者责任不变。原型诊断观察到的局部成本如下，每场景只做一次；stage 的“三次”指该次 probe 内三次 seal 调用。

| 场景 | envelope seal wall ms，before→after | 进程 CPU ms，before→after |
| --- | --- | --- |
| DR selected | 55.8→19.6 | 88.1→22.8 |
| IR selected | 48.3→15.1 | 81.8→18.2 |
| DR stage index（三次合计） | 125.4→31.2 | 175.4→35.1 |
| IR stage index（三次合计） | 254.0→62.9 | 325.5→68.5 |

省掉的是**递归复检＋复制**，不是纯 clone 时间。inclusive 阶段计时存在嵌套且波动明显；例如 DR stage serialize 在两个 probe 中为 505.4／58.7 ms，无法将完整 CLI 差额全归因于 seal。

原型完整 CLI 中，DR stage 三对 wall／CPU／RSS 均下降；IR selected 三对 wall 都上升，中位 **wall +30.5%／CPU +24.0%／RSS +5.8%**；IR stage RSS 中位 **+5.4%**。完整逐对表和其他阶段数据在原型资源保留。局部省工未一致转为 CLI 收益的原因仍未闭合，已观察的集合工作、阶段波动和宿主活动尚不足以确定单一因果解释。

实施验证补足正确性证据：

- 五个新增原生节点覆盖完整 JSON／特殊键、callback 与上下文递归冻结、外部 parser 返回值隔离、十三种原始 envelope 错误及跨调用独立输入；Bun 与 Node 各 **5/5**，Index Runtime 聚合 **91/91**。
- 不冻结、浅冻结、接纳非有限数值、冻结外部返回值四种变异均被识别；断言放在 callback 外核对，避免生产异常转换吞掉失败。
- 源码 import 与生成闭包确认四个分发消费者：Decision Records、Investigation Report、Novel Cards、Test Evidence Review。联合生成、版本和账本同步后，18:13 UTC 的 `bun run check:changed` 为 **66 通过／0 失败／3 不适用**，最终版本调整后的增量复验通过。首次 fixture／类型诊断及修正保存在实施资源。

### 证明边界与复查条件

- 方案保持 definitionVersion、schemaVersion、领域图、序列化、Git payload 和 fresh／CAS／readback。固定 schema 若引入外部对象，须重新验证所有权；恢复 clone helper 即可撤回该优化，无数据迁移。
- 完整输出和最终状态后验不覆盖瞬态写入或同字节改写。测试与 Gate 仅证明实际断言及本地验收范围；落地版未新增阶段计数或 retained-heap／GC 因果实验。
- 性能覆盖暖缓存、万条稀疏关系输入；冷缓存、稠密关系、十万条和跨平台尚未测量。三次样本不足以证明显著性、生产 p95、稳定收益、并发穷尽或容量保证。
- 真实入口超出延迟／内存预算，或更大索引和明确 SLO 要求继续优化时，先测实际载荷及阶段；合并 H/W/P 图、调整安全复核或引入持久化新结构需独立契约判断。

资源保存形成时样本、后验、方法与实施证据；当前实现及验证入口由源码和测试 owner 维护。

## 随附资源

- [落地版复测：共享计量修正、方法与输入模板](./_resources/261024-record-global-throughput-and-memory/current-version-methods.md)
- [落地版复测：共享冻结、闭包、控制与审计](./_resources/261024-record-global-throughput-and-memory/current-version-provenance.json)
- [落地版复测：按原始 SHA 去重的完整输出](./_resources/261024-record-global-throughput-and-memory/current-version-streams.json)
- [落地版复测：两窗口分组与全部逐对变化](./_resources/261024-record-index-computation-and-transfer/current-version-results.json)
- [落地版复测：首轮及修正轮全部原始指标](./_resources/261024-record-index-computation-and-transfer/current-version-samples.jsonl)
- [实施验证：隔离变异结果与源码身份](./_resources/261024-record-index-computation-and-transfer/implementation-validation.json)
- [实施验证：维护面、所有权证据与验证记录](./_resources/261024-record-index-computation-and-transfer/implementation.md)
- [原型样本：正常、probe 与闭包 smoke](./_resources/261024-record-index-computation-and-transfer/measurements.jsonl)
- [原型方法与代码阅读副本](./_resources/261024-record-index-computation-and-transfer/methods.md)
- [原型协议：固定输入、计量与正确性](./_resources/261024-record-index-computation-and-transfer/protocol.md)
- [原型来源：环境、冻结身份、方法变更与边界](./_resources/261024-record-index-computation-and-transfer/provenance.json)
- [原型结果：统计、阶段事件、工作量、控制与 payload 身份](./_resources/261024-record-index-computation-and-transfer/results.json)
