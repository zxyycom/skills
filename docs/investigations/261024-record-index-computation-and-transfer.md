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

[一万条全入口横向复查](record-tools-entry-matrix-10k.md)曾显示：正文访问局部化不等于整索引计算与 Git 暂存成本局部化。本轮在后续普通维护局部化、同阶段证明交接和 stage 纯计算复用已生效的条件下，单独调查仍存在的索引解析、复制／构建／序列化、完整关系图及 Git 大 payload。历史耗时仅为选题背景，不作为当前性能。

初始任务基线为 `f381715c0bfddd015503544c0fe38e8889809600`；实际冻结时其他会话已合入无关生图／视频，HEAD 为 **`ac40e50c165aa13a8c3cdc11f817141960f0b584`**。受测五个工具目录及 DR／IR 两份 skill 与初始基线无差异，版本为 **DR95／IR85**。根 manifest／lock 的开发类型与视频脚本增量不回滚；采用实际安装依赖的冻结身份，不能把整仓称为旧 HEAD，也不与另一环境的样本作直接加速比较。

已完成的 DR all-scope locator parsed index 复用、IR 全成员 lstat batch32、正文吞吐与全量 check 单读正文，不是本轮新优化。首次计量只在隔离副本尝试原型，产品源码、生成文件、版本、测试与共享索引保持只读。随后用户明确以正确性和低维护面为先、容许合理常数回退，而非要求每个场景都加速；本轮据此继续收敛同一候选并获授权实施。下文区分首次性能实测与后续源码实现／正确性证据，不将后取得的证据写成首次计量已完成。

## 调查目的

1. 用当前版本分清局部入口剩余的整集合工作：哪些确有调用内可省计算，哪些属于不同投影或阶段的独立安全义务。
2. 在不改变持久格式、公开契约、跨调用缓存及 fresh／CAS／readback 的条件下，尝试一个可回退的小原型，核对局部省工是否转化为完整 CLI 的 wall、CPU 与 RSS 收益。
3. 支持“是否值得继续实施”的判断：先保证契约正确，再比较总维护面；完整 CLI 的性能用于揭示取舍，不把所有场景同时提升设为必要条件，也不许诺稳定可推广收益。

## 调查范围与依据

### 对象与最小矩阵

静态读取两域与共同操作、Index Runtime、shared 版本管理 owner；代码结构优先用当前 CodeGraph 的文件／符号入口，未提供的 explore 接口不作已执行事实。核心涉及 `snapshot-parser.ts`、`frozen-json.ts`、`projection.ts`、`canonicalization.ts`、`selected-synchronize.ts`、`record-staging.ts` 和 `pending-snapshot.ts`。

两域各 10,000 正式记录、9,000 稀疏关系、2候选；DR 为9k archived／1k active，IR另有一个小 owner 资源。基线索引分别为 **6,303,257B／5,193,312B**。输入 recipe 从已有验收材料只读恢复，但本次重新生成并独立核对，不沿用其计时。

| 场景 | 必要性与操作 |
| --- | --- |
| DR／IR selected sync | 改一个正式记录 title，真实写入；覆盖严格发布基线、所选及必要依赖、完整新投影／图、独立 fresh 与 readback。 |
| DR／IR stage index | 只暂存一个 ID 的索引投影；覆盖 H/W/P 全索引与完整 pending 保护，不混正文吞吐。初态另有未选 pending 索引变化、已暂存未选正文、范围外 sentinel。 |

未扩大为全入口矩阵或 all/domain：本轮定量结论只覆盖上述四场景。全量 check／sync 的共享构建和序列化路径仅作静态机制判断，其总耗时不由这些局部样本代替。

### 计量、闭包与验证

Node26.8.2、Git2.53.0；维护用 Bun1.4.2，未安装依赖或联网。cgroup 为4 CPU／6GiB。源码、生成、实际依赖及已存在的 optional `supports-color`9.4.0 在正式样本前冻结；optional七文件源／副本及起止身份相等。独立 loader smoke 的1,110个实际文件 URL 全在隔离副本内；源码与依赖始末 hash 相等。精确身份见 provenance。

每场景 **3对正常样本**，固定 before/after、after/before、before/after，共24次；另8次工作量／阶段 probe、8次闭包 smoke。全部40次产品 CLI 成功、完整后验通过，无产品失败、超时、丢样或替换。另有3个采集器自检，预期7／-15退出不混作产品失败。

正常计时不插桩，wait4 覆盖新进程启动到退出：CPU为user+system，可含已等待后代；RSS为该口径高水位，**不是同时进程树总内存或JS heap**。恢复、完整输入 capture 和后验在计时外，会预热文件缓存。第1对多场景前后观察到其他Bun，未干预；全部样本保留进程和cgroup快照。没有节点快照也不证明全局静默。

独立 Python/PyYAML oracle 核对完整 W bytes/mode、全部 P mode/OID/字节、HEAD、完整索引与逐ID指纹。AB及正常/probe stdout/stderr、完整状态摘要、索引字节和命令返回后的最终文件／pending差异相等；这不证明全部瞬态写入或同字节改写，probe仅另提供其覆盖内API写入证据。stage另核对 pending 基底＋所选W组合，以及全部未选保护。小输入控覆盖冻结、特殊键、错误与parser外部返回对象的隔离。方法、全部逐次数字及其限制在随附资源。

后续实施于 **2026-10-24 16:48 UTC** 补证，工作树 HEAD 为 `a661d059fd782a476d094410c40fe706ff394d3a`，不是重新冻结首次性能环境。实际读取固定通用 schema、安全 record 转换及已安装 Valibot 1.4.2 的实现，核对所有权后，仅在 `snapshot-parser.ts` 实施私有原地冻结；新增五个原生测试、对应 Case 与聚合 import。源码／测试身份、变异方法与验证结果见新的 implementation 资源；旧计量资源保持原样。本次没有重跑性能矩阵，也不以当前测试耗时与旧样本作性能比较。

## 调查结果与边界

### 结论：采用所有权局部的原地冻结，保留性能取舍

**局部化后的整索引成本仍真实存在；envelope 的递归 JSON 复检与复制可以一并删除，但这不等于完整 CLI 都会加速。**首次样本中，DR stage三对 wall／CPU／RSS 均下降；IR selected三对 wall／CPU反而均上升，两类IR场景RSS均上升。样本少且有宿主干扰，不能称为显著性结论；这些反向结果仍全部保留。

原先由“未见跨两域稳定净收益”直接推到“不落地”，把性能单调提升当成必要条件，未充分比较维护面。按用户澄清的判断标准，选定 **只在 text 解码／固定 schema owner 内原地 deep-freeze**：没有新依赖、缓存、公开参数、持久格式或跨 owner 机制，保留严格边界和外部 parser 输出的复制隔离；以一个私有递归函数取代对已验证、自有 graph 的再次复检及复制。源码已实施，定向正确性与现有 Index Runtime 聚合回归通过；不将历史回退解释为已解决，也不在完成生成同步和完整 Gate 前称为可发布制品。

### 当前仍承担什么工作

以下为每个独立 probe 的实际成功调用／返回字节，AB计数相同；不是物理I/O或时间占比。

| 场景 | 严格parse／完整build | canonicalize／serialize | 完整领域图检查 | 工作区索引API读取 | Git完整payload |
| --- | --- | --- | --- | --- | --- |
| DR selected | 1／1 | 4／2 | 2 | 4次，25,213,023B | 0 |
| IR selected | 1／1 | 4／2 | 2 | 4次，20,773,243B | 0 |
| DR stage index | 3／1 | 6／1 | 4 | 2次，12,606,504B | 5 blob，31,516,292B |
| IR stage index | 3／1 | 6／2 | 4 | 2次，10,386,614B | 5 blob，25,966,567B |

selected正文只读2个unique路径、合计4次，分别为所选和必要依赖在prepare/fresh读取；stage index未读正文。**正文局部、索引全量**在同一个当前版本内同时成立。

这些数字不自动等于冗余：

- selected的4次索引读取对应严格基线、交接时实际baseline核对、写前fresh及写后readback；2次serialize分别验基线canonical文本与生成最终完整索引。所选和新旧组合图也不是同一输入。
- stage严格解析3个索引，完整图还检查最终组合目标。H/W/P可能不同；fresh仍重新取得W/P实际字节和完整身份，只有等价证明后才复用解析／确定性目标。本轮没有再次“优化”已存在的复用。
- stage的5个Git blob经OID与完整JSON后验绑定为**固定H索引1、captured P索引3、最终P索引1**。后三次P读取分属准备、fresh与锁内CAS；最终P读取是写后验收。完整payload很大，不代表可以仅凭旧OID绕过当前字节门禁。
- Git物理metadata index另有集合级复制：Node观察到 `.git/index` 读1次并向 `.git/index.lock` 写1次，DR各1,112,506B，IR各1,120,707B。它与领域JSON／cat-file payload不是同一对象；Git内部I/O不在该API计数内。

因此，这里更准确的问题是“保持全索引格式与安全阶段时，减少哪一段纯计算值得”，不是把所有集合级工作解释为局部化失败。

### 哪些阶段有直接计量

原型前的独立probe给出以下 inclusive wall 毫秒；它们有嵌套，**不能相加**。例如strict parse包含envelope／normalize／部分图，serialize包含canonicalize；shared stage prepare不一定包含领域在进入协调器前完成的全部H/W解析。

| 场景 | strict parse合计 | full build | serialize合计 | 完整图合计 | P blob读取合计 |
| --- | --- | --- | --- | --- | --- |
| DR selected | 543.6 | 344.6 | 183.2 | 67.9 | 不适用 |
| IR selected | 473.0 | 288.8 | 114.1 | 77.9 | 不适用 |
| DR stage index | 1,122.0 | 624.7 | 505.4 | 89.2 | 285.9 |
| IR stage index | 2,227.2 | 586.0 | 230.8 | 310.0 | 179.6 |

阶段probe各只有一次，并非稳定阶段SLO。例如DR stage的serialize在另一次原型probe为58.7ms，与上表差异远大于单独seal的变化；不能把全部CLI差额归因于被改动的seal。资源同时保存每个stage prepare/fresh、锁内复核、写后验收事件和CPU，不只保存一个聚合数字。

### 实际尝试：只原地冻结本次新建 envelope

原实现：`JSON.parse`→严格Valibot外壳→`cloneAndFreezeTypedJsonObject`（再次递归JSON检查、复制、冻结）→领域normalize／完整验证。原型只把外壳最后一步替换为对其**本次拥有的graph原地递归冻结**；不删除后续normalize、canonicalization、完整图或fresh。

安全性的静态依据是输入仅为text：JSON创建graph，固定通用Valibot schema仅从该graph构建／筛选对象；metadata/state的custom校验只判断JSON，不注入外部引用。密封前没有公开返回或领域parser callback，因而没有调用方需要保留可变的原graph。它不是可通用于任意外部对象的“省clone”规则。

小控直接核对：嵌套数组／对象、metadata/context/index与parser输入递归冻结；own `__proto__`／`constructor`；schema、版本、ID成员、标量、JSON及数值溢出错误的诊断与回调顺序；完整序列化相等。领域parser返回外部共享mutable对象时，后续归一化仍复制隔离，外部对象不被冻结、后改不影响结果。没有以冻结状态替代任何领域证明。

| 场景 | envelope seal wall ms，before→after | 当前进程CPU ms，before→after |
| --- | --- | --- |
| DR selected | 55.8→19.6 | 88.1→22.8 |
| IR selected | 48.3→15.1 | 81.8→18.2 |
| DR stage index（三次合计） | 125.4→31.2 | 175.4→35.1 |
| IR stage index（三次合计） | 254.0→62.9 | 325.5→68.5 |

这是一次probe中的局部工作减少，省掉的是**递归复检＋复制这一组工作**，不是纯clone耗时，更不是CLI净加速百分比。

### 后续收敛：局部所有权而非通用冻结框架

维护面比较的正确候选是“保留通用 clone helper”与“只对 owned envelope 私有原地冻结”。前者无需新增 helper，却继续承担已经由固定 schema 完成的递归 JSON 检查和没有隔离对象的复制；后者新增一个局部所有权前提与递归冻结函数，但不扩大通用 helper 的参数或消费者责任，删除该边界的重复工作。把通用 clone helper 改成可选复制模式，会把前提分散给其他调用方；删除后续 normalize 的复制又会冻结外部 parser 对象，均不是更小的正确方案。

所有权证据不是“JSON 文本大概安全”：`JSON.parse` 无 reviver、创建本调用 graph；固定 `stateIndexSchema` 的 metadata/state custom 只执行 `isJsonObject`，包含有限数值检查；strictObject 创建外壳、安全 record 的编码／解码用 `Object.fromEntries` 创建 record，均不注入外部引用。密封前没有领域 callback。故成功 envelope 中没有需保留可变性的外部别名，且不可能来自 JSON 的环、getter 或 symbol 无须另建检测框架。`1e999` 虽能被标准 JSON 解析为 Infinity，仍由已有 JSON schema 在密封前拒绝；删的是其后重复检查，不是数值义务。

五个新增原生节点证明值／特殊键、callback 及上下文递归冻结、外部 parser 可变返回对象的隔离、十三种原始 envelope 错误和跨调用独立输入。断言在 callback 外核对记录，不让 parser 的异常捕获吞掉测试失败；不检查生产源码文本。Bun 与 Node 各 **5/5**；`bun run test:index-runtime` **91/91**，保留现有 fresh 两次采集、实际字节漂移、锁内竞争／CAS、pending 范围保护与文件身份测试。四个隔离变异均被相关节点识别：不冻结、仅浅冻结、接纳非有限数值、错误地原地冻结外部 parser 返回值。完整过程包含一次测试 fixture 替换错误、一次测试类型检查失败及修正，详见 implementation 资源。

实际消费者由源码 import 与生成闭包交叉确认：Decision Records、Investigation Report、Novel Cards、Test Evidence Review；`record-operations` 仅经前两域分发。本切面没有改变 definitionVersion、schemaVersion、持久缓存、领域图、序列化、Git payload 读取或 fresh／CAS／readback。四域版本和生成同步、共享索引与完整门禁由主线程汇总验收；当前定向证据不代替这些交付步骤。

### 三对完整CLI：同时保留反向结果

每格为before→after；wall／CPU单位秒，RSS单位MiB。第2对实际执行after/before，表格只是统一展示方向。“未见”仅指两端Node/Bun快照。

| 场景 | 对 | wall | CPU | RSS | 干扰观察 |
| --- | --- | --- | --- | --- | --- |
| DR selected | 1 | 2.313→1.440 | 3.179→2.038 | 312.777→295.844 | 发现其他Bun |
| DR selected | 2 | 1.702→1.720 | 2.424→2.447 | 308.754→297.695 | 未见 |
| DR selected | 3 | 1.410→1.311 | 2.005→1.869 | 310.453→297.531 | 未见 |
| IR selected | 1 | 1.678→2.598 | 2.298→3.363 | 308.613→308.680 | 发现其他Bun |
| IR selected | 2 | 1.329→1.398 | 1.868→1.998 | 287.598→288.945 | 未见 |
| IR selected | 3 | 1.440→1.880 | 2.032→2.520 | 288.320→304.949 | 未见 |
| DR stage index | 1 | 6.289→5.034 | 7.567→6.612 | 363.312→358.539 | 发现其他Bun |
| DR stage index | 2 | 2.426→2.336 | 3.346→3.228 | 371.375→360.398 | 未见 |
| DR stage index | 3 | 3.289→2.948 | 4.481→4.041 | 372.691→365.039 | 未见 |
| IR stage index | 1 | 3.473→3.508 | 4.612→4.621 | 338.148→380.836 | 未见 |
| IR stage index | 2 | 2.368→2.310 | 3.236→3.139 | 332.152→346.559 | 未见 |
| IR stage index | 3 | 3.809→3.362 | 4.942→4.499 | 352.047→356.570 | 未见 |

相应median只是压缩描述：DR selected wall−15.4%／CPU−15.9%／RSS−4.2%；IR selected **wall＋30.5%／CPU＋24.0%／RSS＋5.8%**；DR stage wall−10.4%／CPU−9.8%／RSS−3.0%；IR stage wall−3.2%／CPU−2.4%／**RSS＋5.4%**。它们不是生产p95、显著性或可推广收益承诺。

局部seal省时未稳定转成CLI收益的原因**没有闭合**。本轮直接观察到：其余normalize／build／serialize仍有更大的集合工作、阶段波动及宿主活动，IR selected端到端反向、IR RSS未随复制减少而下降。没有采集retained heap或做JIT/GC因果实验，不能把回退归因为某一内存／对象布局机制，也不能仅用宿主干扰抹去全部反向样本。

### 下一步与不可外推边界

- **当前选择：交付局部 owned-envelope 原地冻结及匹配正确性证明。**不因部分历史性能回退而否决已通过正确性门槛、无新全局机制的低维护方案；也不声称回退可忽略或机制已闭合。若实际使用出现不能接受的延迟／内存预算，再针对真实入口做区分性测量；回退只需恢复 envelope 的既有 clone helper，不涉及数据迁移。
- 本轮没有证明应合并H/W/P图、跳过fresh、锁内CAS或readback；也没有证明数据库／分片／跨调用cache值得引入。它们会改变当前格式、状态或安全责任，不能由本报告默认授权。
- 将来若更大索引或明确SLO使完整重建／传输成为瓶颈，应先测真实载荷与阶段，而不是按读取次数直接估算加速上限。
- 首次性能样本的正确性仅限隔离原型与小控。后续已补新原生测试、针对性变异、Index Runtime 聚合和全仓类型检查；完整发布 Gate、四域生成制品验收仍由主线程完成。未新测冷缓存、dense图、十万条、跨平台或retained-heap；单次正确性通过不证明性能、并发穷尽或已可发布。

## 随附资源

- [后续实施的隔离变异结果与源码身份](./_resources/261024-record-index-computation-and-transfer/implementation-validation.json)
- [后续候选维护面、所有权证据与验证记录](./_resources/261024-record-index-computation-and-transfer/implementation.md)
- [全部正常、probe与闭包smoke样本](./_resources/261024-record-index-computation-and-transfer/measurements.jsonl)
- [形成时方法与原型阅读副本](./_resources/261024-record-index-computation-and-transfer/methods.md)
- [固定输入、计量与正确性协议](./_resources/261024-record-index-computation-and-transfer/protocol.md)
- [环境、冻结身份、方法变更与未覆盖边界](./_resources/261024-record-index-computation-and-transfer/provenance.json)
- [分组统计、逐次阶段事件、工作量、控与payload身份](./_resources/261024-record-index-computation-and-transfer/results.json)
