---
title: "Rust 记录 CLI 原生复杂度：多词预览与批量名称解析"
id: "261107-record-cli-native-complexity"
formedAt: "2026-11-07T17:03:20Z"
question: "当前原生查询与批量选择有哪些可达的乘积工作，哪些值得优先优化？"
tags:
  - "algorithmic-complexity"
  - "decision-records"
  - "investigation-report"
  - "performance"
  - "record-cli"
  - "rust"
relations:
  - type: "补充"
    target: "261107-record-cli-current-process-cost-and-scale"
    summary: "以源码和定向探针补充复杂度机制"
---

## 形成时背景

[前轮新进程性能调查](./261107-record-cli-current-process-cost-and-scale.md)建立了当前 Rust 候选的延迟基线。本轮进一步检查增长来自哪些算法工作，重点核验多词内容预览和批量名称选择；前轮数据继续作为背景。

## 调查目的

定位可由公开入口触发的额外乘积工作，给出优化优先级及需要保持的结果语义。交付以源码分析和定向探针为依据，实施修复由后续任务承接。

## 调查范围与依据

- **版本与环境**：源码固定为 `c1161cf1`，复用同源 Rust 1.98.1 release 制品；运行于 Linux x86_64 WSL2、Ryzen AI 7 H 450，文件缓存已暖、整机未隔离。
- **覆盖**：动态探针使用 Investigation Report（IR）原生 CLI；Decision Records（DR）及共享路径作源码核对。
- **方法**：先由源码确定可达输入，再核对身份、匹配与截断语义。低成本预览单元各测 5 次；批量预检按首样成本测 2–5 次；较大的 Q=32/64 补探各测一次。
- **证据类型**：复杂度来自指定路径的源码级逻辑计数，耗时来自完整原生命令。版本摘要、输入构造、全部样本及复核方法见[证据说明](./_resources/261107-record-cli-native-complexity/evidence-notes.md)。

记号：L 为测试行长度，本轮 ASCII 字符数等于字节数；Q 为去重后的查询词数，R 为单行原始命中总数；N 为索引记录数，K 为选择器数量。

## 调查结果与边界

本轮确认两项可达的乘积工作：**优先评估多词预览的候选选择算法，其次评估批量名称查找索引**。小分页排序、图操作和身份更正作为次要候选保留。

### 多词重叠预览：逐次扫描全部候选位置

[Matcher::limited_ranges](../../tools/record-cli/src/queries/matcher.rs)为每个词保存下一个命中位置（head），每轮遍历全部 Q 个 head 选择最早范围，合并范围后推进对应词。

对连续 `x` 行、查询词 `x xx … x^Q`，第 j 个词有 `L-j+1` 个重叠命中，因此：

- 原始命中总数：`R = Q * L - Q * (Q - 1) / 2`。
- head 槽遍历数：`Q * (R + 1)`，包括最后一次空检查。
- 仅选择最小 head 这一项为 **Θ(Q·R)**；本构造且 Q≪L 时约为 **Θ(Q²·L)**。

固定 L=65,536，完整 CLI 耗时如下。每次均只命中一条记录，连续命中合并为一个范围，长预览按 24,000 个 UTF-16 单元裁剪。

| Q | 耗时（ms） | 样本数与统计 |
| ---: | ---: | --- |
| 1 | 9.377 | 5 次中位数 |
| 8 | 18.805 | 5 次中位数 |
| 16 | 38.313 | 5 次中位数 |
| 32 | 115.312 | 单次 |
| 64 | 390.289 | 单次 |

**优化约束**：保持重叠与相邻范围合并、原文 UTF-16 映射，以及命中和预览截断判断。范围上限约束的是合并后的结果；连续命中仍需正确确定终点。可比较更低成本的候选选择或跨词合并算法，并核查真实查询中的收益。

### 批量名称解析：每个名称重新扫描索引

[resolve_selector](../../tools/record-cli/src/domains/mod.rs)通过遍历全部条目识别名称匹配及歧义。公开的 IR `sync-index --preflight --select` 对 K 个选择器逐项调用它，名称过滤项为 **Θ(K·N)** 次比较，单次字符比较长度另计。完整日期 ID 使用 BTreeMap 查找。

在 N=5,000 的合法发布基线上，K=1,000 对应源码推导的 500 万次名称比较。名称与完整 ID 均解析到相同的预期身份，预检结果为 unchanged，输入树首尾摘要一致。

| K | 完整 ID 中位数（ms） | ID 样本数 | 名称中位数（ms） | 名称样本数 |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 73.582 | 5 | 75.799 | 5 |
| 100 | 71.524 | 5 | 75.042 | 5 |
| 500 | 84.803 | 5 | 103.527 | 2 |
| 1,000 | 90.363 | 5 | 118.240 | 2 |

**优化约束**：可评估在单次调用内建立“名称 → 所有 ID”映射，保持不存在、歧义和重复选择的诊断。收益需要同时考虑批量大小与建表成本。

### 其他源码候选

| 对象 | 本轮判断 | 后续评估重点 |
| --- | --- | --- |
| 小分页与 metadata 搜索 | 全集统计有结果依据，全量排序及匹配引用保留可进一步评估 | 真实匹配数、offset、稳定顺序与有界窗口成本 |
| 图查询 | 已核对完整图准备、按度排序、事件聚合和 BFS 结构 | 复杂事件、长共同前缀与 DR 重划的独立工作量 |
| 选择性同步与身份更正 | 有完整投影副本及新身份分支的乘积扫描候选 | 批量更正的公开入口可达性、对象生命周期与实际内存 |

具体位置和推理归入[证据说明](./_resources/261107-record-cli-native-complexity/evidence-notes.md#其他源码候选)。

### 结论适用范围

- 乘积项是上述路径与输入下的源码结构结论；完整命令还承担解析、规范化、读取和输出等工作。
- 耗时为本机少量观测。名称与 ID 单元按顺序执行、输出内容不同，比较反映完整预检成本；两个较大 Q 点为单次值。
- 动态覆盖限于 IR 内容查询和选择性同步预检。图专项、DR 动态行为、stage 执行、真实业务分布、其他平台及实际 RSS 仍需对应证据。

## 随附资源

- [证据说明：版本、方法、统计与其他源码候选](./_resources/261107-record-cli-native-complexity/evidence-notes.md)
- [长行探针结束摘要](./_resources/261107-record-cli-native-complexity/guard-after.json)
- [长行探针开始摘要](./_resources/261107-record-cli-native-complexity/guard-before.json)
- [大 Q 单次观测与摘要](./_resources/261107-record-cli-native-complexity/large-q.json)
- [大 Q 补探方法](./_resources/261107-record-cli-native-complexity/large-q.py)
- [第一次预探记录](./_resources/261107-record-cli-native-complexity/pre-samples.jsonl)
- [第二次预探记录](./_resources/261107-record-cli-native-complexity/pre2-samples.jsonl)
- [长行探针方法](./_resources/261107-record-cli-native-complexity/probe.py)
- [长行探针样本](./_resources/261107-record-cli-native-complexity/samples.jsonl)
- [批量预检结束摘要](./_resources/261107-record-cli-native-complexity/select-guard-after.json)
- [批量预检开始摘要](./_resources/261107-record-cli-native-complexity/select-guard-before.json)
- [批量预检方法](./_resources/261107-record-cli-native-complexity/select-probe.py)
- [批量预检样本](./_resources/261107-record-cli-native-complexity/select-samples.jsonl)
