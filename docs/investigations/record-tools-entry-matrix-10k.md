---
title: "记录工具当前版本一万条存量全入口横向性能复查"
id: "261024-record-tools-entry-matrix-10k"
formedAt: "2026-10-24T10:59:25Z"
question: "当前记录工具在一万条存量、每次小操作下，哪些入口及关键分支存在异常时间、CPU、内存或工作量负担？"
tags:
  - "decision-records"
  - "investigation-report"
  - "performance"
  - "scale-testing"
relations:
  - type: "复查"
    target: "261022-record-tools-local-contracts-1w"
    summary: "在当前版本以全部入口和关键分支复查小操作成本"
---

## 形成时背景

前序[局部操作契约一万条验证](record-tools-local-contracts-1w.md)覆盖代表性起草、维护、查询和暂存。本轮补齐全部业务命令及关键状态分支，以统一测量识别高负担入口，作为后续定位依据。

被测源码固定为 Git `70c1a2555f5da48eea6013e7a7cab4aeb3cb2441`，使用 Decision Records 93（DR）与 Investigation Report 83（IR）的公开分发 CLI。源码及复制依赖的开始／结束指纹一致，测量期间实现保持不变。前后两轮的版本、载荷与覆盖不同，各自用于解释对应条件下的结果。

## 调查目的

在一万条存量、每次小操作下，记录完整 CLI 耗时、CPU、峰值 RSS 和实际工作量，区分正常业务、缺索引恢复、严格全集验收与 Git 暂存成本。结果用于选择下一轮定位入口；阶段耗时归因和实现优化另行开展。

## 调查范围与依据

### 覆盖与输入

DR 18 个命令、63 个场景，IR 14 个命令、58 个场景，合计 **32 个命令、121 个场景**。其中 117 个场景初态为一万条正式记录；另有 4 个零正式边界：DR 首次 `new`、`candidates`、`publish`，IR 首次 `publish`。DR 一万条缺索引恢复未测。

| 固定基线 | DR | IR |
| --- | --- | --- |
| 正式记录／关系／候选 | 10,000／9,000／2 | 10,000／9,000／2 |
| 生命周期与关系图 | 9,000 archived、1,000 active；1,000 条十节点链 | 全部正式；1,000 个稀疏十节点分量 |
| 正式 Markdown 总字节 | 3,958,672 | 3,740,095 |
| 基线索引字节 | 6,303,257 | 5,193,312 |
| 资源 | 无独立资源池 | 1 个基线 owner 资源，变体增加常数份小资源 |

两域使用独立合成 Git 仓库，每次恢复固定输入。查询采用小窗口，修改一个对象或少量关系。矩阵按初态区分候选／正式、有无资源 owner、有无前序／HEAD、预检／执行、真实 no-op、恢复及同步范围；三种 stage scope 均覆盖首次、未选保护、重选刷新和 unchanged，IR 另含完整 owner 资源树。

### 测量与可信边界

采样窗口为 **2026-10-24 09:11:41–10:56:15 UTC**。每场景按正序、反序、正序取得三个正常样本，再独立执行一次插桩计数（probe）。正式命令串行，每次新建 Node 26.8.2 进程；默认 heap 为 2,248,146,944B，cgroup 配额为 4 CPU、6 GiB。输入准备会预热 OS 缓存，宿主负载仍可能存在。

| 指标或核验 | 口径 |
| --- | --- |
| wall、CPU、RSS | `wait4` 覆盖启动至退出；CPU 为 user＋system，可计入已等待后代；RSS 是该口径高水位，区别于 JS heap 和子树同时内存之和。输入恢复与后验在计时外。 |
| 正常样本统计 | 保留三次 min／median／max；probe 的资源消耗单列。样本量用于观察分布，不支持生产 p95 或统计显著性结论。 |
| 文件工作量 | 成功完成的 Node 数据读写 API 次数、返回字节和 unique 路径，覆盖实际 worker。它区别于物理 I/O；解析、索引读取、构图分别计数。 |
| Git 工作量 | 记录 `cat-file` 完整 payload 与 framing。HEAD／pending 标签来自初态 OID 成员关系，可重叠，只能解释归属，不能相加或视为精确阶段。 |
| 操作效果 | 独立核对完整工作区字节与 mode、领域状态、索引与 sourceRevision、资源、完整 pending 和未选保护；再比较正常／probe 输出与最终状态。 |

源码和复制依赖虽已冻结，运行时依赖并非完全封闭：`simple-git → debug` 可解析到外部 optional `supports-color` 9.4.0，仅有发现时与结束时的一致哈希，缺少采样开始前哈希。未观察到的 loader 读取仍是覆盖边界。精确计数、等价归一化及环境记录见随附协议与来源材料。

## 调查结果与边界

### 结论与重点入口

**优先定位 DR 普通发布／演进，以及两域候选删除的全集负担；IR 缺索引恢复单独评估。**健康查询与选择性同步已有局部读取效果。多轮全集读取证明工作范围较大，是否可削减仍需区分严格验收义务和同阶段重复。

484 个样本全部完成：363 次正常运行（345 次预期成功、18 次预期拒绝）及 121 次 probe（115 次预期成功、6 次预期拒绝）。没有非预期 CLI 失败、超时或 OOM。独立审计覆盖全部样本、968 个输出流身份及状态后验，正常／probe 等价通过；正式采样无删样或失败替换。

下表按用途分组，时间与 RSS 为三个正常样本的统计，工作量来自独立 probe。完整场景见随附总表。

| 分组与场景 | wall 中位（最小–最大），秒 | CPU 中位，秒 | RSS 中位，MiB | probe 实际工作量 |
| --- | ---: | ---: | ---: | --- |
| 普通发布：DR `publish`，无前序 | 8.271（5.060–9.506） | 9.650 | 346.3 | 10,002 次正式读取，unique 10,001 |
| 普通发布：DR `publish`，有前序 | 15.932（9.346–24.323） | 17.845 | 373.7 | 10,012 次正式读取，另有 1 批历史 payload |
| 候选删除：IR `discard`，无资源 | 7.917（7.640–8.638） | 8.891 | 302.1 | 50,000 次正式读取、5 次 layout |
| 候选删除：DR `discard` | 10.264（10.097–10.961） | 12.563 | 509.6 | 40,000 次正式读取，unique 10,000 |
| 恢复：IR `new`，缺索引 | 49.954（43.004–65.381） | 49.157 | 184.8 | 30,000 次正式读取，unique 10,000 |
| 严格删除：DR `evolve`，含删除 | 16.812（13.062–17.758） | 20.619 | 512.4 | 40,004 次正式读取 |
| 严格删除：DR `discard`，正式记录 | 9.726（9.723–10.161） | 12.072 | 557.9 | 40,000 次正式读取；RSS 中位高点 |

1. **正常发布／演进。**DR 在有效发布基线上，无前序 `publish` 仍读取全部一万条存量；有前序发布和不含删除的 `evolve` 也保留万级读取。其正常 `new`／候选查询不读正式正文，selected sync 只读 4 次、unique 2，说明局部操作之间存在明显的工作范围差异。
2. **候选删除与身份更正。**IR 无资源候选删除仍有 5 次 layout、20,004 次 report parse；DR 候选删除累计 40,000 次正式读取。实际 rename 的 DR 约 30,000 次、IR 约 60,000 次正式读取。下一轮应逐阶段辨别独立 fresh／写后验收与同阶段重复；含删除的演进也按严格义务单列。
3. **缺索引恢复。**IR 缺索引 `new` 约 49.95 秒，对照缺索引 `candidates`／`show-candidate` 各约 16 秒、10,000 次读取，正常 `new` 约 1.824 秒。恢复确有身份发现义务，其成本应在该前提下解释。
4. **Git 历史与 pending。**IR 有前序 `publish` 取得 2 批、20,000 个历史 blob、7,480,190B payload；无关系或无 HEAD 时无该 payload。stage 的 index scope 虽不读工作区正式正文，仍保护完整 pending：首次 index／domain／all 的 DR payload 约 30.06／45.16／64.73 MiB，IR 约 24.76／47.55／47.55 MiB。局部正文读取与 Git 集合成本需分别评估。

### 对照结果与适用范围

- **查询保持所声明的读取范围。**两域 list／metadata 不读正式正文，show 读一份；IR metadata 一万条命中仍只返回窗口且不构图。关系 list／trace 按需构图，content 小范围只读所选来源；预算拒绝发生在正文读取前。
- **同步范围差异已生效。**selected sync 为 4 次正式读取、unique 2，中位约 1.28–1.50 秒；full sync 为 20,000 次读取，DR 6.59–7.38 秒、IR 2.79–3.67 秒。full check 每域 10,000 次读取，DR 3.743 秒、IR 3.585 秒。全集审计与独立 fresh 属于相应契约义务。
- **零变化仍承担索引验证。**IR canonical rename no-op 读取索引 5 次、约 25.97 MB，中位候选 4.569 秒／正式 3.934 秒；set-relations unchanged 也保留同量索引读取。三样本及宿主噪声不足以支持其普遍慢于实写的判断。
- **本轮内存高点已量化。**正常场景 RSS 中位最高 557.9 MiB，单样本最高 579.3 MiB；一万条短正文输入未出现 OOM。十万条容量、大正文与大附件需另测。

当前证据支持入口分组与工作量判断，**尚未证明每轮读取的耗时占比或可删除性**。后续可优先为普通发布／演进和候选删除补最小阶段证据，同时保留授权、未选保护、历史门禁与 fresh 义务。

适用范围为本轮版本、稀疏关系及串行暖缓存输入。冷缓存、并发漂移／中断恢复、权限故障、复杂归并拆分及全部参数组合未覆盖；跨域载荷不同，结果不用于跨域总时长排名、跨报告加速比或线性伸缩推算。本轮仅形成调查材料，被测实现与 skill 版本未变。

### 证据阅读路径

| 阅读目的 | 入口 |
| --- | --- |
| 找到全部场景和重点指标 | `measurements.csv`；两域 `*-summary.json` 保存三样本统计 |
| 确认输入、工作量与操作效果 | `*-matrix.json` 定位初态与 argv，`*-metrics.jsonl`／`*-workloads.jsonl` 核对指标与计数，`*-streams.jsonl`／`*-outcomes.jsonl` 核对输出与后验 |
| 审查来源与方法 | `environment-and-inputs.json`、`protocol.md`、`measurement-methods.md`；`*-provenance.jsonl` 保存来源映射及准备阶段纠正 |
| 核对审计和机械检查 | `audit.json` 与 `verification.json`；后者的资源体积及文本审阅结论对应报告初次建立时的快照 |

资源保存经审计材料的展示与摘要：路径一致标记化，原始 bytes／SHA 与展示身份分开；输出按 SHA 去重，长路径／OID 列表保留 count＋SHA。JSONL 的 `bundlePath` 是逻辑来源名。完整 maps、大索引字节、依赖和合成仓库未随附；方法代码供审查形成时做法，材料支持审查而非完整重放。

## 随附资源

- [审计：全样本、导出自验与聚合边界](./_resources/261024-record-tools-entry-matrix-10k/audit.json)
- [DR 场景：精确 argv 与初态](./_resources/261024-record-tools-entry-matrix-10k/decision-matrix.json)
- [DR 指标：全部正常与 probe 样本](./_resources/261024-record-tools-entry-matrix-10k/decision-metrics.jsonl)
- [DR 后验：状态指纹与小 delta](./_resources/261024-record-tools-entry-matrix-10k/decision-outcomes.jsonl)
- [DR 来源：输出映射、方法前提与导出依据](./_resources/261024-record-tools-entry-matrix-10k/decision-provenance.jsonl)
- [DR 输出：内容去重的完整展示](./_resources/261024-record-tools-entry-matrix-10k/decision-streams.jsonl)
- [DR 统计：三样本与逐场景工作量](./_resources/261024-record-tools-entry-matrix-10k/decision-summary.json)
- [DR 工作量：probe 计数与 Git 批次](./_resources/261024-record-tools-entry-matrix-10k/decision-workloads.jsonl)
- [来源：冻结版本、环境、输入指纹与依赖边界](./_resources/261024-record-tools-entry-matrix-10k/environment-and-inputs.json)
- [IR 场景：精确 argv 与初态](./_resources/261024-record-tools-entry-matrix-10k/investigation-matrix.json)
- [IR 指标：全部正常与 probe 样本](./_resources/261024-record-tools-entry-matrix-10k/investigation-metrics.jsonl)
- [IR 后验：状态指纹与小 delta](./_resources/261024-record-tools-entry-matrix-10k/investigation-outcomes.jsonl)
- [IR 来源：输出映射、方法前提与导出依据](./_resources/261024-record-tools-entry-matrix-10k/investigation-provenance.jsonl)
- [IR 输出：内容去重的完整展示](./_resources/261024-record-tools-entry-matrix-10k/investigation-streams.jsonl)
- [IR 统计：三样本与逐场景工作量](./_resources/261024-record-tools-entry-matrix-10k/investigation-summary.json)
- [IR 工作量：probe 计数与 Git 批次](./_resources/261024-record-tools-entry-matrix-10k/investigation-workloads.jsonl)
- [方法：计量、计数、后验与整理代码导航](./_resources/261024-record-tools-entry-matrix-10k/measurement-methods.md)
- [总表：121 场景的耗时、CPU、RSS 与工作量](./_resources/261024-record-tools-entry-matrix-10k/measurements.csv)
- [方法：本轮计量协议](./_resources/261024-record-tools-entry-matrix-10k/protocol.md)
- [验证：报告初次建立时的审计与门禁记录](./_resources/261024-record-tools-entry-matrix-10k/verification.json)
