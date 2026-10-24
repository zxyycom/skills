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

[一万条全入口横向复查](record-tools-entry-matrix-10k.md)显示，正文访问局部化之后，整索引计算与 Git 暂存仍有集合级成本。本轮在普通维护局部化、同阶段证明交接和 stage 纯计算复用的基础上，单独调查解析、复制、构建、序列化、关系图及 Git 大 payload。

任务基线为 `f381715c0bfddd015503544c0fe38e8889809600`，实际冻结 HEAD 为 `ac40e50c165aa13a8c3cdc11f817141960f0b584`。受测五个工具目录及 DR／IR skill 与任务基线无差异（DR 95／IR 85），根依赖与脚本采用冻结时的实际版本。历史耗时只提供选题背景。

调查先比较隔离原型，随后在同轮实施局部原地冻结。判断由“是否跨两域稳定加速”调整为“正确性成立后，是否以更小维护面消除重复工作”，因此保留反向性能样本，同时采用低复杂度实现。原型性能与后续正确性证据各有独立时点。

## 调查目的

1. 区分可省的调用内纯计算与不同投影、阶段各自承担的安全验证。
2. 在保持持久格式、公开契约及 fresh／CAS／readback 的条件下，比较一个局部原型的 wall、CPU、RSS 与正确性。
3. 以正确性和总维护面支持采用判断，用端到端性能揭示取舍，而非要求所有场景同时提升。

## 调查范围与依据

### 对象与矩阵

检查两域、共同记录操作、Index Runtime 和 shared 版本管理 owner，覆盖 envelope 解析、归一化、构建、序列化、selected sync 与 pending 传输。

两域各有 10,000 正式记录、9,000 稀疏关系和 2 个候选；DR 为 9,000 archived／1,000 active，IR 另有一个小 owner 资源。基线索引分别为 **6,303,257 B／5,193,312 B**。输入按既有 recipe 重新生成并独立核对。

| 场景 | 操作与初态 |
| --- | --- |
| DR／IR selected sync | 修改一个正式记录 title 并真实写入；覆盖严格发布基线、所选及必要依赖、完整新投影／图、独立 fresh 与 readback。 |
| DR／IR stage index | 只暂存一个 ID 的索引投影；另有未选 pending 索引变化、已暂存未选正文及范围外 sentinel，覆盖 H/W/P 全索引与 pending 保护。 |

定量结论只覆盖这四场景。全量 check／sync 的共享路径用于静态机制判断，未测 all／domain 或全入口矩阵。

### 计量与证据阶段

- **冻结环境**：Node 26.8.2、Git 2.53.0、Bun 1.4.2，cgroup 4 CPU／6 GiB。源码、生成文件、实际依赖及 optional `supports-color` 9.4.0 在正式采样前冻结，始末 hash 相等。loader smoke 的 1,110 个文件 URL 均在隔离副本内。
- **样本**：每场景 3 对，顺序为 before/after、after/before、before/after，共 24 次正常运行；另 8 次阶段 probe、8 次闭包 smoke。40 次产品 CLI 均成功且后验通过，无超时、丢样或替换。采集器的 3 次自检单列保存。
- **指标**：正常运行不插桩，wait4 覆盖新进程启动至退出；CPU 为 user+system，可含已等待后代，RSS 是该口径高水位，不是同时进程树总内存或 JS heap。恢复、capture 和后验在计时外，文件缓存因此已暖。
- **干扰**：第 1 对多场景前后观察到其他 Bun，全部样本保留进程及 cgroup 快照；未观察到其他进程也不足以证明宿主静默。
- **正确性**：独立 Python／PyYAML oracle 核对完整 W bytes/mode、P mode/OID/字节、HEAD、完整索引与逐 ID 指纹。AB 及正常/probe 的完整输出、最终状态、索引和 pending 差异相等。该比较不覆盖全部瞬态写入或同字节改写。
- **实施补证**：2026-10-24 16:48 UTC，基于当时 `a661d059` 工作树继续验证固定 schema 与实际 Valibot 1.4.2 的所有权，实施私有冻结并新增五个原生节点及定向变异。未重跑性能矩阵。

## 调查结果与边界

### 结论：采用局部原地冻结，保留端到端取舍

**通用 envelope 已由本次文本解析和固定 schema 完整拥有，可以原地递归冻结，省去重复 JSON 复检与复制。**实现局限在 [snapshot-parser.ts](../../tools/index-runtime/src/snapshot-parser.ts)，保留严格 schema、领域归一化、外部 parser 返回值的复制隔离及全部阶段保护。

原型局部计算减少，但完整 CLI 并未一致加速：DR stage 三对 wall／CPU／RSS 均下降；IR selected 三对 wall／CPU 均上升，两类 IR 场景 RSS 均上升。采用依据是已验证的所有权和低维护面，不是可推广的性能优势。

### 剩余集合工作及其责任

以下为独立 probe 的成功调用／返回字节，AB 计数相同；它们不是物理 I/O 或耗时占比。H、W、P 分别为固定 HEAD、工作区和 Git pending。

| 场景 | 严格 parse／完整 build | canonicalize／serialize | 完整领域图检查 | 工作区索引 API 读取 | Git 完整 payload |
| --- | --- | --- | --- | --- | --- |
| DR selected | 1／1 | 4／2 | 2 | 4 次，25,213,023 B | 0 |
| IR selected | 1／1 | 4／2 | 2 | 4 次，20,773,243 B | 0 |
| DR stage index | 3／1 | 6／1 | 4 | 2 次，12,606,504 B | 5 blob，31,516,292 B |
| IR stage index | 3／1 | 6／2 | 4 | 2 次，10,386,614 B | 5 blob，25,966,567 B |

selected 正文仅有 2 个唯一读取路径、共 4 次，分别为所选及必要依赖在 prepare／fresh 的读取；stage index 未读正文。**正文局部与索引全量同时成立**，各阶段责任如下：

- selected 的索引读取分别核对严格基线、交接时实际 baseline、写前 fresh 和写后 readback；两次 serialize 分别验证 canonical 基线和生成最终索引。新旧组合图具有不同输入。
- stage 严格解析 H/W/P，并验证最终组合图；fresh 重取 W/P 实际字节和完整身份，等价证明成立后复用确定性计算。
- 5 次 Git blob 经 OID 与完整 JSON 后验定位为：固定 H 索引 1 次，captured P 索引在准备、fresh、锁内 CAS 各 1 次，最终 P 写后验收 1 次。
- Git 物理 metadata index 另有集合级复制：Node 观察到 `.git/index` 读 1 次、`.git/index.lock` 写 1 次，DR 各 1,112,506 B，IR 各 1,120,707 B；Git 内部 I/O 不在该 API 计数内。

### 局部成本与所有权依据

原型前 probe 的 inclusive wall 如下，单位 ms。strict parse 包含 envelope／normalize／部分图，serialize 包含 canonicalize，故各列不能相加；每场景只有一次诊断。

| 场景 | strict parse | full build | serialize | 完整图 | P blob 读取 |
| --- | --- | --- | --- | --- | --- |
| DR selected | 543.6 | 344.6 | 183.2 | 67.9 | 不适用 |
| IR selected | 473.0 | 288.8 | 114.1 | 77.9 | 不适用 |
| DR stage index | 1,122.0 | 624.7 | 505.4 | 89.2 | 285.9 |
| IR stage index | 2,227.2 | 586.0 | 230.8 | 310.0 | 179.6 |

基线在 `JSON.parse` 和严格 Valibot 外壳之后，调用 `cloneAndFreezeTypedJsonObject` 再次递归验证、复制及冻结。原型仅把这一调用替换为私有原地冻结，依据为：

1. 无 reviver 的 JSON 解码建立本调用对象图；固定 schema 的 metadata/state custom 只检查 JSON，严格外壳与安全 record 转换没有外部引用注入。
2. schema 已拒绝非有限数值，包括标准 JSON 解析后为 Infinity 的 `1e999`；特殊 own key 由安全 record 构造保留。
3. 冻结发生在领域 callback 前。callback 返回对象属于另一所有权边界，后续归一化仍复制隔离；其调用方持有的对象保持可变。

因此，该 helper 只承接已验证、自有 JSON 图的冻结；通用 helper 增加复制模式会扩大消费者责任，删去后续复制则会冻结外部对象。局部方案保留了更小的正确边界。

| 场景 | envelope seal wall ms，before→after | 进程 CPU ms，before→after |
| --- | --- | --- |
| DR selected | 55.8→19.6 | 88.1→22.8 |
| IR selected | 48.3→15.1 | 81.8→18.2 |
| DR stage index（三次合计） | 125.4→31.2 | 175.4→35.1 |
| IR stage index（三次合计） | 254.0→62.9 | 325.5→68.5 |

局部省掉的是**递归复检＋复制**，不是纯 clone 时间。其他阶段波动明显，例如 DR stage serialize 在另一次 probe 为 58.7 ms，不能将 CLI 总差额全部归因于 seal。

### 完整 CLI 配对结果

每格为 before→after，wall／CPU 单位秒、RSS 单位 MiB；第 2 对实际按 after/before 执行。“未见”只指两端进程快照。

| 场景 | 对 | wall | CPU | RSS | 干扰观察 |
| --- | --- | --- | --- | --- | --- |
| DR selected | 1 | 2.313→1.440 | 3.179→2.038 | 312.777→295.844 | 发现其他 Bun |
| DR selected | 2 | 1.702→1.720 | 2.424→2.447 | 308.754→297.695 | 未见 |
| DR selected | 3 | 1.410→1.311 | 2.005→1.869 | 310.453→297.531 | 未见 |
| IR selected | 1 | 1.678→2.598 | 2.298→3.363 | 308.613→308.680 | 发现其他 Bun |
| IR selected | 2 | 1.329→1.398 | 1.868→1.998 | 287.598→288.945 | 未见 |
| IR selected | 3 | 1.440→1.880 | 2.032→2.520 | 288.320→304.949 | 未见 |
| DR stage index | 1 | 6.289→5.034 | 7.567→6.612 | 363.312→358.539 | 发现其他 Bun |
| DR stage index | 2 | 2.426→2.336 | 3.346→3.228 | 371.375→360.398 | 未见 |
| DR stage index | 3 | 3.289→2.948 | 4.481→4.041 | 372.691→365.039 | 未见 |
| IR stage index | 1 | 3.473→3.508 | 4.612→4.621 | 338.148→380.836 | 未见 |
| IR stage index | 2 | 2.368→2.310 | 3.236→3.139 | 332.152→346.559 | 未见 |
| IR stage index | 3 | 3.809→3.362 | 4.942→4.499 | 352.047→356.570 | 未见 |

中位变化为：DR selected wall −15.4%／CPU −15.9%／RSS −4.2%；IR selected **wall +30.5%／CPU +24.0%／RSS +5.8%**；DR stage −10.4%／−9.8%／−3.0%；IR stage −3.2%／−2.4%／**+5.4%**。小样本和干扰限制其外推，不能视为生产 p95、显著性或稳定收益。

局部省工未一致转为 CLI 收益的原因仍未闭合。其余集合工作、阶段波动与宿主活动均被观察到，但缺少 retained-heap 或 JIT／GC 因果实验，不能用某一种机制解释全部回退。

### 实施验证与适用边界

五个新增原生节点覆盖完整 JSON／特殊键、callback 与上下文递归冻结、外部 parser 返回值隔离、十三种原始 envelope 错误及跨调用独立输入。Bun 与 Node 各 **5/5**，Index Runtime 聚合 **91/91**；不冻结、浅冻结、接纳非有限数值、冻结外部返回值四种变异均被识别。测试在 callback 外核对观察，避免被生产异常转换吞掉失败。首次 fixture 和类型诊断及其修正保存在实施资源。

源码 import 与生成闭包确认四个分发消费者：Decision Records、Investigation Report、Novel Cards、Test Evidence Review。联合生成、版本和账本同步后，2026-10-24 18:13 UTC 的 `bun run check:changed` 为 **66 通过／0 失败／3 不适用**；最终版本调整后的增量复验通过。此处记录本地验收，发布制品与远端 CI 另按项目交付契约判断。

- 方案保持 definitionVersion、schemaVersion、领域图、序列化、Git payload 与 fresh／CAS／readback；若固定 schema 将来引入外部对象，须重新验证所有权前提。
- 当前采用不等于历史回退已解决。真实使用超出延迟或内存预算时，应针对相应入口重测；回退只需恢复 envelope 的 clone helper，无数据迁移。
- 本轮未测冷缓存、稠密关系、十万条、跨平台或 retained-heap，也未重跑落地版本性能。正确性测试仅证明实际断言，不提供并发穷尽或容量保证。
- 更大索引或明确 SLO 需要进一步优化时，先测真实载荷和阶段。合并 H/W/P 图、跳过安全复核、引入数据库／分片／跨调用缓存均需独立契约判断。

随附资源保存原始样本、完整后验、方法和实施证据；其中代码用于理解形成时做法，当前实现及重跑入口由源码和测试 owner 维护。

## 随附资源

- [后续实施的隔离变异结果与源码身份](./_resources/261024-record-index-computation-and-transfer/implementation-validation.json)
- [后续候选维护面、所有权证据与验证记录](./_resources/261024-record-index-computation-and-transfer/implementation.md)
- [全部正常、probe与闭包smoke样本](./_resources/261024-record-index-computation-and-transfer/measurements.jsonl)
- [形成时方法与原型阅读副本](./_resources/261024-record-index-computation-and-transfer/methods.md)
- [固定输入、计量与正确性协议](./_resources/261024-record-index-computation-and-transfer/protocol.md)
- [环境、冻结身份、方法变更与未覆盖边界](./_resources/261024-record-index-computation-and-transfer/provenance.json)
- [分组统计、逐次阶段事件、工作量、控与payload身份](./_resources/261024-record-index-computation-and-transfer/results.json)
