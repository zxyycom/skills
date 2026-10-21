---
title: "记录工具第一轮常数优化的十万条验证"
id: "261021-record-tools-first-optimization-validation"
formedAt: "2026-10-21T14:34:37Z"
question: "调用内去重、快照复用、来源复用与元数据窗口能否降低十万条成本并保持结果和失败边界？"
tags:
  - "decision-records"
  - "investigation-report"
  - "performance"
relations:
  - type: "复查"
    target: "261021-record-tools-100k-performance"
    summary: "在固定新样本上验证第一轮优化的结果一致性与性能收益，不覆盖原始调查的其他操作结论"
---

## 形成时背景

前序[十万条性能调查](record-tools-100k-performance.md)识别了证据去重的二次复杂度，以及整索引重复准备、决策多轮来源验证与元数据无界输出的常数成本。用户授权先实施这组改进，并沿用现有索引格式与架构，不建立跨调用缓存。批量操作优先复用现有入口。

本轮在修改前固定 `063115bdf290efa66a2d925b33d14ba33395b1a3`，使用新生成的输入和新编写的方法做前后对照。前序报告及随附资源保持不变，其历史数值不与本轮新样本直接拼接比较。

## 调查目的

验证首轮改动是否降低实际工作量和耗时，同时保持完整结果、排序、关系证据与失败边界。metadata 默认返回 100 条属于已授权接口变化：检查其精确总数、返回前缀与覆盖说明，而不是要求输出字节与无限返回相同。

## 调查范围与依据

- **实现范围**：`tools/decision-records/`、`tools/investigation-report/` 与共享 `tools/index-runtime/`；源码指纹见资源。分发闭包涉及两个记录 skill、Test Evidence Review 与 Novel Cards。
- **正式集合**：每域 100,000 条，按十条一组、每组九条边，90,000 条关系；Decision 每组一条 archived、九条 active，Investigation 全部正式。固定时间、十类 tags、短正文且无资源。索引分别为 66,730,257 和 55,830,262 字节。
- **归并样本**：总节点 N=1,000／10,000／100,000，一个来源有 N−1 条归并出边，用 type-only 过滤提取完整证据。与稀疏正式集合分别测量。
- **测量方式**：每次用独立 Node 进程，加载模块与生成 fixture 不计入操作耗时；结果 JSON 序列化另计。list／metadata 前后各三次，交替一轮先后顺序；来源检查与各归并点各一次。全部计时串行；不并行运行测试或其他规模基准，不清空操作系统缓存。
- **环境与时点**：2026-10-21 UTC，Node 26.8.2、Bun 1.4.2、WSL2 Linux x64，4 CPU 配额、6 GiB 容器内存，Node old-space 上限 4 GiB；完整记录见环境资源。只代表这一环境和合成负载，不是生产延迟承诺。

## 调查结果与边界

### 实现与一致性

| 优化 | 当前实现与保留边界 |
| --- | --- |
| 关系证据去重 | 调用内按结果分桶的 Set，以 sourceId、type、target 三元组去重，保留首次摘要和原词法顺序。 |
| 整索引准备 | 严格 loader 产生本次 reader，内部消费冻结索引与物化查询值；原始 JSON／索引入口仍严格验证，领域关系校验保留。 |
| 决策来源复用 | 完整检查复用同轮已验证的来源状态和字节指纹；仍独立复读 revision，并比较完整预期索引文本。旧 scan 与独立 sync 不复用该证据。 |
| metadata 窗口 | 默认 100、显式 limit 1–1000，全量匹配并精确计数，仅保留窗口内完整命中 DTO。超限说明结果不完整并 warning；content 仍为 20 且拒绝 limit。 |
| 批量工作流 | 调查候选通过已有多 selector publish；正文／tags 编辑集中同步。Decision 按现有 evolve／set-relations 多对象契约操作，publish 仍只接受一个候选。 |

reader 首次严格加载与建立时仍分别处理查询字段，查询仍执行合法排序；基础查询记录的全集投影也保留。本轮没有把全部遍历消除，调用结束后不保留共享状态。去重方案以线性辅助内存换取查重成本。

### 十万条对照

前后各三次的操作取中位数；来源检查与归并提取各一次，不能估计尾延迟。以下均为领域操作耗时，不含随后 JSON 序列化。

| 操作与样本 | 优化前 | 优化后 | 耗时下降 | 一致性与工作量 |
| --- | ---: | ---: | ---: | --- |
| Decision list，10 万条、返回 50 | 8.009 s | 5.870 s | 26.7% | 完整结果 JSON 摘要一致，均不读 Markdown。 |
| Investigation list，10 万条、返回 50 | 7.597 s | 4.860 s | 36.0% | 完整结果 JSON 摘要一致，均不读 Markdown。 |
| Decision metadata，9 万命中 | 13.027 s | 10.738 s | 17.6% | 返回前 100 条与原前缀一致，matched 均为 exact 90,000。 |
| Decision 完整检查，10 万条 | 125.546 s | 72.766 s | 42.0% | 完整结果 JSON 摘要一致；Markdown 读取由 300,000 次降为 200,000 次。 |
| 归并证据，99,999 条边 | 27.927 s | 0.251 s | 99.1% | 完整证据 JSON 摘要一致，约快 111 倍。 |

归并提取在 N=1,000／10,000／100,000 时，前值分别为 6.81／238.27／27,927.30 ms，后值为 3.80／25.02／250.88 ms。结合已移除的逐条 array.some 查重，支持二次查重成本已被调用内集合查询替代；三个单样本不承担生产分位数结论。

metadata 的 JSON 结果由 **50,580,512 降为 56,760 字节**，scanComplete 仍为 true，resultsComplete 变为 false，明确回显 maxRecords=100 与 max-records 原因。这里比较的是完整领域 DTO 的 JSON，而非终端文本或网络耗时。它仍扫描与投影全集，不能把输出缩小等同于扫描成本同比下降。

每进程峰值 RSS 含模块加载与结果序列化。list 三次峰值的中位数，Decision 为 932→873 MiB，Investigation 为 858→762 MiB；metadata 为 849→872 MiB，未观察到稳定内存收益。归并提取单次为 309→344 MiB，反映线性 Set 的空间代价；完整检查单次约 2,812→2,691 MiB。GC、样本次数与 worker 范围限制了内存归因。

### 批量操作的独立小样本

在相同的 1,000 条正式调查报告上发布 10 份相同候选，逐份调用共 7.782 s、发布完整索引 10 次；使用已有多候选 publish，一次调用 0.768 s、发布完整索引一次。最终索引字节摘要相同。两组各一次，且仅千条规模，证明已有批量入口与最终结果一致，不外推为十万条批量操作的具体加速比例。

### 正确性、验证与未覆盖范围

验证记录见随附 verification.json；定向测试覆盖冻结隔离、原始入口严格验证、stale 优先级、首次摘要与全部方向、100 条边界、窗口后 matcher 错误，以及来源漂移优先于索引文本差异。独立审查按编码规范核对责任、类型、信任边界与错误映射；文档按 AI-Ready Docs 检查 owner、重心、引用与可执行性。

本轮未重测 trace、stage、资源密集正文、完整搜索回退与每种 mutation 的十万条成本；其原始调查边界仍由前序报告承接。调用内复用不取消跨调用完整准备，百万规模、冷缓存、长期并发与真实大附件仍需单独测量。

方法代码记录本轮实际做法，默认供阅读，不是持续维护的工具或独立可运行包；重跑须按所记版本与环境准备。原始观测保留各次时点、操作时间、序列化时间、进程峰值、输出字节与结果摘要。summary 按操作与版本分组，计算中位数、最小值、最大值与 `1 − 后值/前值`；SHA-256 用于比较完整结果或指定前缀。环境、fixture 与源码指纹用于核对条件，verification 记录实际验证范围。

## 随附资源

- [批量发布的调用数、耗时与最终索引对照](./_resources/261021-record-tools-first-optimization-validation/batch-results.jsonl)
- [运行环境与固定基线](./_resources/261021-record-tools-first-optimization-validation/environment.json)
- [正式 fixture 规模与索引大小](./_resources/261021-record-tools-first-optimization-validation/fixture.json)
- [全部 26 次原始性能与一致性观测](./_resources/261021-record-tools-first-optimization-validation/measurements.jsonl)
- [批量发布测量方法](./_resources/261021-record-tools-first-optimization-validation/method-batch.ts)
- [正式合成集合的构造方法](./_resources/261021-record-tools-first-optimization-validation/method-fixture.ts)
- [操作计时、读取计数与结果摘要方法](./_resources/261021-record-tools-first-optimization-validation/method-measure.ts)
- [串行调度与采样顺序](./_resources/261021-record-tools-first-optimization-validation/method-run.sh)
- [实测实现源码指纹](./_resources/261021-record-tools-first-optimization-validation/source.sha256)
- [分组时间范围、中位数与变化比例](./_resources/261021-record-tools-first-optimization-validation/summary.json)
- [正确性、测试与审查验证记录](./_resources/261021-record-tools-first-optimization-validation/verification.json)
