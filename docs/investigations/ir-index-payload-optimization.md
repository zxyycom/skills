---
title: "授权收窄与准备合并后的索引暂存实测"
id: "261022-ir-index-payload-optimization"
formedAt: "2026-10-22T06:09:01Z"
question: "一万条单选 index 暂存采用授权的非index payload范围收窄与准备合并后，实际收益与连续刷新效果如何？"
tags:
  - "investigation-report"
  - "performance"
  - "version-control"
relations:
  - type: "补充"
    target: "261022-ir-index-stage-regression-cause"
    summary: "在授权收窄条件下验证正式优化的成本与副作用"
---

## 形成时背景

**门禁收敛后的最终分发实现在一万条基本单选 index 场景中，将 wall 中位数从 5.689s 降至 2.975s，减少 47.7%；最终阶段的基本、连续刷新及计数探针共 16 次独立效果后验全部通过。** 收益成立的前提是用户已接受收窄非索引 pending payload 的验收责任，而非完整旧保证下的等价提速。

前序[分阶段根因调查](ir-index-stage-regression-cause.md)确认：完整调查领域 pending payload 的多轮读取是主因，准备阶段重复获取 pending 是次因；当时仅测试诊断变体。本轮以“补充”验证范围收窄与准备合并的最终实现，前序样本、方法及结论继续按其形成时条件解释。

下文 H 表示固定 HEAD 基线，P 表示调查领域的 Git pending。本轮只调整调查 `index` scope 的 payload 验收，`all`／`domain` 及其他消费者保持默认完整验证。index 仍保护完整 P 的路径、模式与对象 ID（OID）、未选内容及 staged 删除，并保留索引 payload 验收、独立工作区索引与 P 复核、锁内 HEAD 与 P 的 CAS、写后及范围外保护；非索引 payload 的即时可读性与内容指纹由该边界之外的验证承担。实现不引入缓存或新状态体系。

## 调查目的

比较优化前 `af4015ab` 与本轮最终公开 Node CLI 在同字节一万条存量、基本单选 index 下的 wall、含 Git CPU 与 RSS；另以连续 A/B 首次选择及再次刷新，验证 P≠H 条件下的完整目标 JSON、未选成员与表示、工作区不变及域外 pending 保持。

## 调查范围与依据

本轮方法于 2026-10-22 独立编写，fixture 重新生成并精确核对 HEAD tree `e234306131070fe7762852346d249d0468eb7497`：10,000 正式报告、9,000 分组边、2 个候选、全域 5×96B 资源，索引 5,893,454B，SHA-256 `f4c02ae3d237ca7ad8e0db88a1b5f4efda8b674a5b38d53cfeebe76c7b39e454`。

### 方法与效果后验

正式原生比较不插桩。CLI 子进程启动至退出由 `wait4` 记录 wall、user+system CPU 与 maxrss，含 Node 和它等待的 Git 子进程，不含准备、后验、Bun wrapper。保持 `NODE_OPTIONS=''` 与默认 heap，不清 OS 缓存。独占窗口只排除协作代理的构建、测试和副本准备，非整机隔离。

基本场景 pending 领域内容等于 H，B 的工作区正文及发布索引已刷新，并存在 B 的未引用 owner 成员；另保留域外 pending 修改与 staged 删除。每次恢复 pending index 为 H 后仅执行一次 `stage B --scope index`。原生组实际 baseline/final 交替各3次。

连续效果组独立运行 A1→B1→A2→B2：A、B 的工作区 title 和正文发生真实变化，A 的来源与未引用资源、B 的来源另有领域 pending；再次刷新时保留旧领域 pending，不混入基本性能样本。

独立后验以已知原始预期为准：完整目标 JSON 等于操作前 pending JSON 只替换所选发布条目与其独立计算的 revision；其余 Git 路径、stage、模式和 OID 保持；全部工作区文件 SHA 与模式保持；域外 pending 修改和 staged 删除保持；stdout 声明 scope 为 index。没有用被测 `check` 作为后验。

## 调查结果与边界

### 1. 最终原生比较：wall 减少 47.7%

2026-10-22 门禁收敛并重新冻结分发输入后，在第二个协作独占窗口串行完成 **16 次观察**：6 次正式原生、8 次连续效果、2 次 counter-only probe。全部退出成功，独立效果后验全部通过，无已知并发窗口冲突。性能比较仅使用交替运行的 6 次原生观察。

| 正式原生组，各3次中位 | wall（s） | CPU，含Git（s） | RSS（MiB） |
| --- | ---: | ---: | ---: |
| 优化前 af4015ab | 5.689 | 8.600 | 417.3 |
| 门禁收敛后最终实现 | 2.975 | 3.966 | 382.5 |

最终组合优化的中位 wall 减少 **47.7%（耗时约为优化前的 1/1.91）**，CPU 减少 53.9%，RSS 中位减少 34.8MiB。三对按顺序的 wall 减少 2.389／4.461／2.779s，final/baseline 分别为 0.580／0.400／0.482。原生 baseline 范围 5.364–7.436s、final 2.585–3.301s；第二对 baseline 7.436s 高于另两次，仍按原分组完整纳入统计。连续 final B2 为 4.067s、末两次 probe 为 8.823／4.398s，也体现窗口内波动，但这些组本就不进入原生中位数。没有取得特定宿主事件原因的证据，也没有已知协作代理构建／测试／复制重叠。

环境为 Node 26.8.2、Git 2.53.0、4 CPU 配额／6GiB cgroup、默认 heap 2,248,146,944B。实测副本 baseline/final 各 237 个文件；逐文件指纹见 `context.json`；最终冻结 final manifest SHA-256 为 `0a87d35a64cfe6744fc33b23a07bb423931bb677da42ac0659bbc97c699e0c74`，baseline 为 `857848da02f981241a45b590df0291eb0fbea5c8114f7eb25201d2b2a4645a7a`。结束后核对两份原生输入未变化，并确认当时仓库 runtime 与实测 final 字节一致。对应场景的 baseline/final stdout 完全相同，stderr 均为空，scope 输出保持为 index。

门禁收敛前另有 16 次有效观察，原生中位为 5.621→2.750s、独立效果 16/16 通过。因最终分发字节随后改变，这组资源以原字节保存在同 owner 的 `pre-gate/`，作为前阶段辅助证据；两阶段分别统计，最终性能结论仅使用新 16 次。两阶段均执行本轮新写的临时方法，归档方法仅供阅读。

本轮与前序 5.482s 或诊断变体分别解释。此次只测整体组合，无法拆分范围收窄与准备合并各自的收益，也不能将前序干预差相加。

### 2. 工作量：payload 读取减少，保留字节反增

baseline/final 的独立 counter-only 临时分发副本各运行 1 次基本单选，仅用于解释读取工作量。下表对象数按逐批请求并成功完成的数量累计，跨批重复计数；payload 是 Git batch 实际验收的 blob 声明内容大小，不等于磁盘物理 I/O 或缓存 miss。探针时长不参与原生性能比较。

| Git blob batch 工作量 | 优化前 | 最终实现 |
| --- | ---: | ---: |
| H 索引批次 | 1 × 1对象／5,893,454B | 1 × 1对象／5,893,454B |
| P 批次 | 5 × 10,004对象／13,524,459B | 4 × 1索引对象／5,893,454B |
| 所有批累计对象数 | 50,021 | 5 |
| 所有批累计 payload | 73,515,749B | 29,467,270B |
| 所有批累计 retained bytes | 23,575,360B | 29,467,270B |

最终 P 只读取索引，准备获取合并一轮；独立写前、锁内与写后仍读取索引。**retained bytes 反而增加 5,891,910B**：优化前两轮只保留所选来源完整内容（各 772B），仍验收完整 P payload；最终四轮均保留完整索引。此处 retained bytes 仅计 batch 返回的保留内容，不代表复制、分配或序列化总量；这些内部动作未单独计量。

### 3. 连续 A/B 效果及范围输出

baseline/final 各完成 A1→B1→A2→B2 的连续序列，逐次通过前述完整效果后验。A1 后加入 B1，再分别用 A2／B2 刷新；未选索引条目与旧领域 pending 保持，所选条目及 revision 按当前工作区投影更新，index 操作只修改目标索引。

连续组各 4 次是不同步骤，其时长仅作现场观察，不作为同条件重复性能样本。效果结论限于该具体序列，异常、并发及错误优先级由契约测试另行证明。所有运行只写隔离 fixture 的 Git pending；未对本仓库正式报告执行 stage、commit 或 push。

### 4. 判断与未证明边界

实测支持在已授权的责任边界下采用本轮组合实现：基本单选耗时约减半，基本及连续刷新效果符合独立预期。非索引 payload 的即时可读性与内容指纹不属于 index scope 的成功保证。

未测十万条、冷缓存、大附件、复杂图、其他 scope、全部异常与并发路径、p95 或统计置信区间；未分离对象扇出、每字节开销、Git 缓存及 GC 的精确贡献。三对样本只支持本环境下的代表性比较，不承诺固定倍数或容量上界。其他契约测试由实现与测试 owner 交付，最终结论仅使用门禁收敛后的 16 次实验，前阶段 16 次单独保留为辅助证据。

两阶段合计 32 次观察均通过独立效果后验，保存 64 个 stdout/stderr 输出流。主路径六份资源承接最终 16 次及其 32 个输出流，`pre-gate/` 六份资源以原字节承接前阶段对应材料，各自包含方法、输入指纹、原始观测、输出流的 SHA 去重表示与汇总。临时 fixture、分发副本和依赖链接不归档；方法作为阅读证据，不是维护或重跑入口。

## 随附资源

- [最终环境、fixture与全部输入指纹](./_resources/261022-ir-index-payload-optimization/context.json)
- [本轮最终方法阅读证据](./_resources/261022-ir-index-payload-optimization/methods.txt)
- [最终16次原始观测及独立后验](./_resources/261022-ir-index-payload-optimization/observations.jsonl)
- [前阶段环境与输入指纹](./_resources/261022-ir-index-payload-optimization/pre-gate/context.json)
- [前阶段方法原字节阅读证据](./_resources/261022-ir-index-payload-optimization/pre-gate/methods.txt)
- [前阶段16次原始观测及独立后验](./_resources/261022-ir-index-payload-optimization/pre-gate/observations.jsonl)
- [前阶段32个输出流去重全文](./_resources/261022-ir-index-payload-optimization/pre-gate/streams.json)
- [前阶段分组汇总](./_resources/261022-ir-index-payload-optimization/pre-gate/summary.json)
- [前阶段两个probe原始batch事件](./_resources/261022-ir-index-payload-optimization/pre-gate/workload.json)
- [最终32个原始输出流的去重全文](./_resources/261022-ir-index-payload-optimization/streams.json)
- [最终分组中位数、配对差与解释边界](./_resources/261022-ir-index-payload-optimization/summary.json)
- [最终两个独立probe的原始batch事件与加总](./_resources/261022-ir-index-payload-optimization/workload.json)
