---
title: "Rust trace 查重优化后的关系图性能对照"
id: "261105-rust-trace-aligned-graph-performance"
formedAt: "2026-11-05T08:27:31Z"
question: "移除 Rust trace 平方查重后，在合法高直接度、深链、宽层和复杂事件图上，与旧 Rust 和 TS 相比还剩多少延迟与资源收益？"
tags:
  - "decision-records"
  - "graph"
  - "performance"
  - "rust"
relations:
  - type: "补充"
    target: "261105-rust-query-algorithmic-complexity"
    summary: "修复已确认查重风险并补充关系图三臂计量"
---

## 形成时背景

前序调查发现，普通关系 unit 逐个与已有 unit 两两比较：高直接度 d 的合法 fan-in 会触发 d(d−1)/2 次比较，即使记录预算为 1 亦然。原先时间基准以无边集合为主，不能回答有关系的图上这一缺陷的实际代价。

## 调查目的

修正原型后，在输入合法、输出行为已核对的条件下比较 TS、旧 Rust 与新 Rust 对不同图形的响应和资源，并确定可归因与不可归因的边界。本轮没有改生产 TS，也没有把测得差异归结为语言本身。

## 调查范围与依据

- 修复删除 Rust 所有 unit 生成末尾的冗余线性查重；已校验的普通边邻居唯一，复杂事件由已有 seen 逻辑去重，最终排序保持不变。结构探针以独立构建副本确认 d=8、16、32、64 时，旧比较分别 28、120、496、2016，新比较均为 0；两侧都观察 d 条边。这不证明完整 trace 线性，也不证明重划等其他路径算法已对齐。
- 三臂为 Node 直接运行生产分发 CLI、旧冻结 Rust 二进制、新 Rust release 二进制；两份 Rust 二进制 SHA-256 与生产 TS 源码和分发树摘要见[正确性数据](./_resources/261105-rust-trace-aligned-graph-performance/correctness.jsonl)的首尾守卫；Node 记录路径和版本，未记录其二进制哈希。Rust 变化、测试变化和构建/测试转录见随附资源；独立复验的 fmt/test/list/clippy 原始日志另行保存，作者的 build 等命令结果仍为转录，转录不是原始日志。
- 固定 N=8193 的三个普通 fan-in 图分别令 d=16、512、8192，每组对后继方向分别测试 max-records=1 和 d+1；depth=all。深链与宽层均 N=8193、E=272，前者 273 个连通节点，后者 33 个；足量输出。重划是 4 节点、3 边，分别以预算 3 阻断整个事件和预算 4 完整闭合。其他记录为无边填充。全部生成后由生产 `sync-index` 和 `check` 通过，原始结果在[校验数据](./_resources/261105-rust-trace-aligned-graph-performance/fixture-validation.json)。
- 测量前分别对全部 10 单元进行三臂退出码、JSON 解析后的值与 stderr 比较，并独立断言 traceIds、contextIds、frontier、coverage 和重划阻断事件；三臂均通过。通过仅适用于所列输入，不扩展为整体行为等价。
- 新进程 wall 10 单元，另行 wait4 资源 6 单元，Node 常驻直接导入与 Rust 同一宿主 spawn 的调用边界 3 单元；每臂每单元独立预热后 12 样本，六种臂顺序各两次，轮次在 case 外层，case 顺序轮换并反转。逐次保存顺序、精确命令、退出和规范化输出摘要；wall 不使用资源包装器。新进程 elapsed 覆盖子进程启动至输出收集，不含监督端 JSON 解析；常驻 elapsed 为宿主内接收请求至结果，双方均包含成功 JSON 解析，不含监督 IPC。wait4 单列子进程 CPU、峰值 RSS 与 wrapper CPU，不把插桩 wall 当纯 wall。常驻宿主 CPU 包含该请求宿主工作但不含 Rust 子进程 CPU；RSS 为宿主生命周期累计峰值，含预导入 TS，不是每请求增量，也不与子进程内存相加。
- 运行于 Linux WSL2、AMD Ryzen AI 7 H 450、Node v26.8.2；正式范围为北京时间 16:33:20–16:38:04（UTC+08）；原始时间戳保留 UTC。协调方停止编译与门禁并让其他代理只做轻量阅读，但未控制整机其他进程或文件系统缓存，不能声称机器隔离或冷缓存。正式调用前后守卫输入树、生产源码及分发、实验源码、脚本、二进制、manifest/lock 等；不保证期间每次调用间均未变，也不证明所有运行时依赖字节未变化。

## 调查结果与边界

### 新进程直接调用：墙钟中位数（毫秒）

| 图与预算 | TS | 旧 Rust | 新 Rust |
| --- | ---: | ---: | ---: |
| fan-in d=16，1 | 885.378 | 34.481 | 33.346 |
| fan-in d=16，17 | 945.901 | 33.508 | 32.148 |
| fan-in d=512，1 | 940.744 | 36.503 | 35.809 |
| fan-in d=512，513 | 919.824 | 40.040 | 39.421 |
| fan-in d=8192，1 | 1031.682 | 203.722 | 50.665 |
| fan-in d=8192，8193 | 1018.189 | 264.623 | 130.109 |
| 深链 E=272 | 880.487 | 38.015 | 36.068 |
| 宽层 E=272 | 908.166 | 33.437 | 34.749 |
| 重划预算 3 | 396.710 | 1.890 | 2.051 |
| 重划预算 4 | 384.116 | 1.967 | 2.002 |

高直接度 d=8192 且预算 1 时新 Rust 中位数约为旧版的 25%；完整输出时约为 49%。相同 N 的小、中直接度上差异小得多，符合平方查重在高 d 才更显著的预期，但整条命令还有加载、全图校验、排序、序列化和启动，计时不能分解为单独算法成本。链与宽层固定 N/E 但输出节点数不同，因此不是纯拓扑单因素对照。

独立 wait4 资源组中，d=8192、预算 1 的子进程 CPU 中位数分别为 TS 2001.600、旧 Rust 269.543、新 Rust 60.587 ms；峰值 RSS 中位数分别为 217900、24814、24736 KiB。完整输出时分别为 CPU 2136.102、327.847、136.810 ms，RSS 237784、59112、59114 KiB。wait4 的 CPU 与峰值是独立测量，不能用其 wall 替代上表；wrapper 消耗另见资源。

### 常驻调用边界不同，结论也不同

Node 常驻导入后的请求中位数：d=16、预算 1 为 TS 422.577、旧 Rust spawn 44.549、新 Rust spawn 43.412 ms；d=8192、预算 1 分别为 542.497、246.743、64.979 ms；4 节点重划完整输出分别为 4.059、7.899、9.097 ms。后者表明对极小图，启动 native 子进程可抵消计算优势；不应把新进程差异外推到所有嵌入式调用。常驻模块首次导入单独保存在 host-ready；本组 RSS 是累计宿主峰值，不能当作单次查询内存。

### 归因和适用边界

普通 unit 的无谓平方比较已经移除，所选高 d 单元新旧差异明显；TS 与新 Rust 仍在整体命令的解析、图表示、容器、校验、运行时与进程边界上不同。在 d=8192 时，预算 1 和足量输出的新进程新 Rust 中位数分别约为 TS 的 1/20.36 和 1/7.83；常驻宿主的高 d 预算 1 约为 TS 的 1/8.35。但小型重划常驻调用中新 Rust spawn 约慢 2.24 倍。即使该局部算法不再有同一平方比较，剩余差异仍是实现和调用方式的组合，**不是纯 Rust 语言贡献**。此试验不覆盖真实图度分布，也不能推断所有规模、复杂事件或其他查询。旧版多图错误诊断等既知兼容缺口不由本轮合法输入消除。

新增原生测试 `graph_trace::ordinary_fan_in_orders_neighbors_before_applying_budget` 的 Contract 是普通 fan-in 先按直接邻居排序再受预算约束；Proves 是 64 个后继在预算 1 和 3 下的独立 trace 与有序 frontier、空 context 和无阻断事件。该测试当时保护行为，不单独证明复杂度。完整 22 个测试节点与 fmt/test/list/clippy 已独立复验，见[原始验证日志](./_resources/261105-rust-trace-aligned-graph-performance/validation.txt)；首次命令与构建结果为代理观察转录，见[验证转录](./_resources/261105-rust-trace-aligned-graph-performance/evidence.txt)。

当时使用独立实验目录中的生成、测量和汇总脚本，并复用同目录宿主和资源包装器。实验源码、测试及制品不作为长期产物保留；随附材料用于审阅方法和结果，不是现行运行入口，也不保证完整重跑。JSONL 的 start 行含驱动 argv、环境及前后指纹，样本含命令和请求。探针旧新 stdout 仅 Cargo 结束时间不同，归一化后逐字相同；只保存一份原样输出及双方哈希和差异记录。此前误用同一 target 缓存的初次探针结果已排除。

## 随附资源

- [三臂正确性结果及前后指纹](./_resources/261105-rust-trace-aligned-graph-performance/correctness.jsonl)
- [首次构建与测试的观察转录](./_resources/261105-rust-trace-aligned-graph-performance/evidence.txt)
- [生成图的生产同步与检查结果](./_resources/261105-rust-trace-aligned-graph-performance/fixture-validation.json)
- [常驻宿主调用原始样本](./_resources/261105-rust-trace-aligned-graph-performance/host.jsonl)
- [优化后探针构建记录](./_resources/261105-rust-trace-aligned-graph-performance/new-build.txt)
- [优化后探针标准错误](./_resources/261105-rust-trace-aligned-graph-performance/new-final.err)
- [优化后计数探针补丁](./_resources/261105-rust-trace-aligned-graph-performance/new-probe.patch)
- [优化前探针构建记录](./_resources/261105-rust-trace-aligned-graph-performance/old-build.txt)
- [优化前探针标准错误](./_resources/261105-rust-trace-aligned-graph-performance/old-final.err)
- [探针标准输出原样记录](./_resources/261105-rust-trace-aligned-graph-performance/old-final.out)
- [优化前计数探针补丁](./_resources/261105-rust-trace-aligned-graph-performance/old-probe.patch)
- [原始源码指纹清单](./_resources/261105-rust-trace-aligned-graph-performance/original.sha256)
- [探针输出去重说明及双方哈希](./_resources/261105-rust-trace-aligned-graph-performance/probe-output-dedup.json)
- [计数探针源码](./_resources/261105-rust-trace-aligned-graph-performance/probe.rs)
- [独立资源测量原始样本](./_resources/261105-rust-trace-aligned-graph-performance/resources.jsonl)
- [三臂测量统计汇总](./_resources/261105-rust-trace-aligned-graph-performance/summary.json)
- [优化新增测试补丁](./_resources/261105-rust-trace-aligned-graph-performance/test.patch)
- [trace 查重优化源码补丁](./_resources/261105-rust-trace-aligned-graph-performance/trace.patch)
- [独立复验原始日志](./_resources/261105-rust-trace-aligned-graph-performance/validation.txt)
- [新进程墙钟测量原始样本](./_resources/261105-rust-trace-aligned-graph-performance/wall.jsonl)
