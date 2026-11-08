---
title: "Rust 记录 CLI 公开入口复杂度与成本普查"
id: "261108-record-cli-native-complexity-survey"
formedAt: "2026-11-08T06:22:13Z"
question: "当前两个原生记录 CLI 各公开入口的主要成本、覆盖边界和可避免工作是什么？"
tags:
  - "algorithmic-complexity"
  - "decision-records"
  - "investigation-report"
  - "performance"
  - "record-cli"
  - "rust"
relations:
  - type: "补充"
    target: "261107-record-cli-native-complexity"
    summary: "扩展公开入口与成本覆盖范围"
---

## 形成时背景

[新进程成本调查](./261107-record-cli-current-process-cost-and-scale.md)建立了规模基线，[局部复杂度调查](./261107-record-cli-native-complexity.md)定位了多词预览和批量名称选择。本轮保留这两轮认识，在相同 Rust 候选源码下扩展到两个 CLI 的全部公开业务入口，检查整体成本及值得继续验证的工作。

## 调查目的

建立公开入口的成本地图，区分结果与保护所需的工作、可达的额外工作和待验证线索，支持后续优化选题。调查先普查入口和正常行为，再由观察与源码选择放大探针，以覆盖结算作为本轮收尾依据。

## 调查范围与依据

- **对象**：Decision Records（DR）18 个、Investigation Report（IR）14 个业务入口，均有源码路径和至少一次合法私有输入的实际代表；help/version 单列。逐入口分支、断言和证据见[覆盖地图](./_resources/261108-record-cli-native-complexity-survey/inventory/coverage.md)。
- **版本**：2026-11-08，源码 HEAD `c1161cf1db52cf2de9ba5e0829808e18ebdccf19`，复用前轮 Linux x86_64 release；manifest 中 316 个源码文件与工作树逐字节相同，二进制 hash 一致。原生候选在私有 fixture 上运行，写入与 Git 操作使用独立私有仓库；生产入口仍为 TypeScript。
- **方法**：源码分析、独立期望核验、完整新进程墙钟（wall）及单独的 Git Trace2 计数分别取证。小成本适量重复，高成本少测；档位按工作量与区分度选择。采样、输入守卫及调查脚本纠错见[证据说明](./_resources/261108-record-cli-native-complexity-survey/evidence-notes.md)。

## 调查结果与边界

**整体成本随索引、实际来源、关系、资源和 Git 工作量增长；本轮新增两项可达工作：IR 历史目标重复读取、资源 owner 线性查找的二次比较。** 优先级取决于实际使用分布，正常规模成本和待验证线索同时保留。

### 公开入口成本地图

记 N 为正式记录数、C 为候选数、B 为实际读取字节、E 为关系边及事件规模、K 为所选对象数、R 为资源数、P 为 Git index 全成员数；输入与输出大小另计。

| 入口族 | 主要工作与规模依据 |
| --- | --- |
| help / version | 独立文本入口，提供轻路径参照；业务成本另测。 |
| list / metadata search / show | 查询先解析完整发布索引。list 在分页前完成全量 facets 和命中排序；metadata 为精确命中数检查筛选集合；show 再安全读取所选正文并核对身份、指纹。输出少仍可能承担 N 级工作。 |
| content search | 读取实际访问来源，校验身份、匹配和生成预览；成本受 B、命中分布及预算影响。IR N=5000 样例触发 2000 文件预算拒绝，本轮成功扫描覆盖至 N=1200。 |
| candidates / show-candidate | 先发现整个候选集合及身份，再检查结构、正文和 readiness；IR 另涉及资源。C=1/32/250 均有代表，单项 show 也承担集合发现成本。缩小发现范围需保留身份、歧义和安全保护。 |
| trace / 关系筛选 | 构造并验证完整关系图，准备双邻接、拓扑、顺序及原子事件，再遍历和输出。两域有合法事件、宽普通边、深度与预算边界代表；一般无关系条件查询按需省去建图。 |
| check / sync-index | full 读取校验集合。DR check 仅 full，IR check 的 selected 核验所选来源；两域 sync 均支持 full/selected，selected 读取已知位置及必要依赖，仍验证完整组合投影。上述路径均有代表。 |
| new / publish / set-relations | 身份发现、选择、关系或资源校验及写入准备；正式变更按需发布完整索引。候选创建、发布、关系 no-op、适用的预检与实写均有代表。 |
| rename / discard / DR 生命周期 | 判断身份、引用者、历史及保护条件，按需移动或改写来源、资源和索引。实际更名、真正 no-op、候选/正式删除及 DR 四项生命周期入口均有代表。 |
| stage | 取得 HEAD、工作区和 pending 事实，组合所选快照，保护未选成员。两域 all/index/domain 均核对选中结果与未选保护，IR 另核对 owner 资源；规模受 K、P 和实际文件影响。 |

### 两项新发现及其依据

**IR 全量 check：同一历史目标可在调用内重复读取。** 入口普查与源码阅读发现逐关系读取 HEAD 目标的路径；随后固定 N=250、唯一历史目标数 22，将关系边由 30 增至 62，同一目标出现次数由 8 增至 40。两组无插桩完整 check 各两次，分别为 177.238/191.952 ms 和 321.522/340.657 ms。独立 Trace2 调用的 Git start 数为 98→194，`ls-tree`、`cat-file blob`、`hash-object --stdin` 各增加 32 次，与逐边读取并核验固定 HEAD 目标的源码一致。

建议优先评估**单次调用、固定 revision 内复用目标事实**，保留每条关系的 warning、mode、identity 和历史校验。适用场景是频繁 full check 且许多关系共享目标；实际收益、内存及异常语义由实现对照验证。原始参数、历史差异及计数见[写入与 Git 证据](./_resources/261108-record-cli-native-complexity-survey/writes/coverage.md)。

**IR 资源 owner 校验：合法输入可触发二次元素比较。** 图源码对每个资源引用在 owner 的有序列表中线性 `contains`。单 owner 自有 R 条唯一资源时，成功元素比较次数为 `R(R+1)/2`：R=500 为 125,250，R=2000 为 2,001,000。私有来源经 sync、full check 和图查询接受，确认公开入口可达；R=2000、输出固定 414 字节的 anchor trace 守卫复测为 5.62/5.49 ms。

该三角数是源码与输入推导，墙钟则包含进程、解析、图和输出工作；两者分别支持机制与端到端观察。资源集中于单 owner 时，可比较索引或二分查找，并保持字符比较及 owner 语义。合法输入和守卫范围见[图与领域验证证据](./_resources/261108-record-cli-native-complexity-survey/graphs/coverage.md)。

### 正常观察、候选与适用边界

DR index-only no-op stage 在 K=1、P=503/1003/2003 各测三次，约 29–37 ms，本范围未显示显著恶化。这为静态乘积循环提供了反例约束；三档 P 计时仅在 DR 进行。两域 P=2003 的实际 all stage 均核对 2001 个未选成员保持。关系筛选在全图验证后复制全部边，以及 stage 随 K 增大而增加的 Git 工作，仍是待隔离量化的候选。

前轮多词预览和批量名称解析继续由其报告承接。后续按真实查询词、批量选择、共享历史目标和资源分布选择优化对象，验收同时比较结果、诊断、安全与历史语义。

本轮结论适用于所列版本、私有合法输入和少量新进程样本。覆盖是入口级代表而非参数与异常分支穷举；缓存未控制、整机未严格隔离，wall 与 Trace2 来自不同调用，未测纯启动、冷缓存、CPU/RSS、并发、跨平台或生产分布。完整未测项见覆盖矩阵；本轮交付调查认识，发布资格另行验收。

资源按用途展开：[证据说明](./_resources/261108-record-cli-native-complexity-survey/evidence-notes.md)解释方法、计量边界和阅读顺序；`inventory` 定位入口，`queries`、`graphs`、`writes` 保存对应切面的说明、数据和历史脚本。脚本供审阅当时做法，执行及副作用需另行授权。

## 随附资源

- [证据说明与资源导航](./_resources/261108-record-cli-native-complexity-survey/evidence-notes.md)
- [graphs/coverage.md](./_resources/261108-record-cli-native-complexity-survey/graphs/coverage.md)
- [graphs/guard_recheck.py](./_resources/261108-record-cli-native-complexity-survey/graphs/guard_recheck.py)
- [graphs/ordinary-results.json](./_resources/261108-record-cli-native-complexity-survey/graphs/ordinary-results.json)
- [graphs/ordinary_probe.py](./_resources/261108-record-cli-native-complexity-survey/graphs/ordinary_probe.py)
- [graphs/realloc-250-results.json](./_resources/261108-record-cli-native-complexity-survey/graphs/realloc-250-results.json)
- [graphs/realloc-3-results.json](./_resources/261108-record-cli-native-complexity-survey/graphs/realloc-3-results.json)
- [graphs/realloc-50-results.json](./_resources/261108-record-cli-native-complexity-survey/graphs/realloc-50-results.json)
- [graphs/reallocation_probe.py](./_resources/261108-record-cli-native-complexity-survey/graphs/reallocation_probe.py)
- [graphs/resource-0-results.json](./_resources/261108-record-cli-native-complexity-survey/graphs/resource-0-results.json)
- [graphs/resource-2000-guarded.json](./_resources/261108-record-cli-native-complexity-survey/graphs/resource-2000-guarded.json)
- [graphs/resource-2000-results.json](./_resources/261108-record-cli-native-complexity-survey/graphs/resource-2000-results.json)
- [graphs/resource-30-results.json](./_resources/261108-record-cli-native-complexity-survey/graphs/resource-30-results.json)
- [graphs/resource-500-results.json](./_resources/261108-record-cli-native-complexity-survey/graphs/resource-500-results.json)
- [graphs/resource_probe.py](./_resources/261108-record-cli-native-complexity-survey/graphs/resource_probe.py)
- [graphs/trace_guards.json](./_resources/261108-record-cli-native-complexity-survey/graphs/trace_guards.json)
- [graphs/trace_probe.py](./_resources/261108-record-cli-native-complexity-survey/graphs/trace_probe.py)
- [graphs/trace_results.jsonl](./_resources/261108-record-cli-native-complexity-survey/graphs/trace_results.jsonl)
- [inventory/coverage.json](./_resources/261108-record-cli-native-complexity-survey/inventory/coverage.json)
- [inventory/coverage.md](./_resources/261108-record-cli-native-complexity-survey/inventory/coverage.md)
- [queries/branches.py](./_resources/261108-record-cli-native-complexity-survey/queries/branches.py)
- [queries/candidates.py](./_resources/261108-record-cli-native-complexity-survey/queries/candidates.py)
- [queries/coverage.md](./_resources/261108-record-cli-native-complexity-survey/queries/coverage.md)
- [queries/date_retry.py](./_resources/261108-record-cli-native-complexity-survey/queries/date_retry.py)
- [queries/environment.json](./_resources/261108-record-cli-native-complexity-survey/queries/environment.json)
- [queries/guards.json](./_resources/261108-record-cli-native-complexity-survey/queries/guards.json)
- [queries/samples.jsonl](./_resources/261108-record-cli-native-complexity-survey/queries/samples.jsonl)
- [queries/survey.py](./_resources/261108-record-cli-native-complexity-survey/queries/survey.py)
- [writes/coverage.md](./_resources/261108-record-cli-native-complexity-survey/writes/coverage.md)
- [writes/d-stage-k8.trace.jsonl](./_resources/261108-record-cli-native-complexity-survey/writes/d-stage-k8.trace.jsonl)
- [writes/history-after.trace.jsonl](./_resources/261108-record-cli-native-complexity-survey/writes/history-after.trace.jsonl)
- [writes/history-before.trace.jsonl](./_resources/261108-record-cli-native-complexity-survey/writes/history-before.trace.jsonl)
- [writes/history-edges-continue.py](./_resources/261108-record-cli-native-complexity-survey/writes/history-edges-continue.py)
- [writes/history-edges.jsonl](./_resources/261108-record-cli-native-complexity-survey/writes/history-edges.jsonl)
- [writes/history-edges.py](./_resources/261108-record-cli-native-complexity-survey/writes/history-edges.py)
- [writes/i-stage-k8.trace.jsonl](./_resources/261108-record-cli-native-complexity-survey/writes/i-stage-k8.trace.jsonl)
- [writes/pending-scale.jsonl](./_resources/261108-record-cli-native-complexity-survey/writes/pending-scale.jsonl)
- [writes/pending-scale.py](./_resources/261108-record-cli-native-complexity-survey/writes/pending-scale.py)
- [writes/scale.jsonl](./_resources/261108-record-cli-native-complexity-survey/writes/scale.jsonl)
- [writes/scale.py](./_resources/261108-record-cli-native-complexity-survey/writes/scale.py)
- [writes/unselected-audit.jsonl](./_resources/261108-record-cli-native-complexity-survey/writes/unselected-audit.jsonl)
- [writes/unselected-audit.py](./_resources/261108-record-cli-native-complexity-survey/writes/unselected-audit.py)
- [writes/wide-continue.py](./_resources/261108-record-cli-native-complexity-survey/writes/wide-continue.py)
- [writes/wide-continue2.py](./_resources/261108-record-cli-native-complexity-survey/writes/wide-continue2.py)
- [writes/wide-extra.py](./_resources/261108-record-cli-native-complexity-survey/writes/wide-extra.py)
- [writes/wide-more.py](./_resources/261108-record-cli-native-complexity-survey/writes/wide-more.py)
- [writes/wide.jsonl](./_resources/261108-record-cli-native-complexity-survey/writes/wide.jsonl)
- [writes/wide.py](./_resources/261108-record-cli-native-complexity-survey/writes/wide.py)
