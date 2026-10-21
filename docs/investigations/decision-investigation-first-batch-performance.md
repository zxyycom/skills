---
title: "决策与调查首批常数优化的结果一致性与性能复查"
id: "261021-decision-investigation-first-batch-performance"
formedAt: "2026-10-21T06:28:49Z"
question: "C1、C2、C3、C5、C8 在保留现有架构与验证职责后，是否保持完整结果并减少真实工作与耗时？"
tags:
  - "decision-records"
  - "investigation-report"
  - "performance"
  - "skill-tooling"
relations:
  - type: "复查"
    target: "261021-decision-investigation-constant-factor-audit"
    summary: "实施首批五项并对照完整结果、调用量与耗时"
---

## 形成时背景

前序[常数成本调查](./decision-investigation-constant-factor-audit.md)提出了重复读取、解析、校验和遍历的优化候选。本轮实施 C1、C2、C3、C5、C8，并复核实际收益：保持 Markdown 权威来源、JSON 派生索引及现有 CLI，通过阶段内数据复用优化，不增加缓存体系。前序保存候选与预测，本报告保存实施后的对照结果。

## 调查目的

回答两项问题：五项优化是否保持公开结果与失败边界；是否减少重复工作，并改善无计数插桩时的实际耗时。

## 调查范围与依据

实施前基线为 Git `acd4321cba0a7034ca993121b996b6253493ba19`。原始 `currentHead=4580beb6` 表示采集时 HEAD，被测的未提交生产字节由 `currentManifest` 标识，已核对与提交 `5443b7f5` 一致。

形成时运行时为 Node `v26.8.2`、Bun `1.4.2`，Decision Records／Investigation Report 分发版本为 `84`／`73`；共享索引运行时保持原实现。

### 对照方法

- 从固定 Git ref 导出隔离基线，与实施后源码分别由原生 Node 运行；两端使用同一依赖环境与合成条件，测量起止核对实施后源码未变。
- 决策源样本 N=20／200，各含 3 份候选；纯发布索引 N=1,000／1,001／5,000／10,000。调查样本 N=20／200，各含 3 份候选、星型复查关系及共享正式 owner 资源。
- 48 对条件比较完整公开 JSON 语义，覆盖成功、坏 YAML、重复 ID、坏索引、陈旧搜索 fallback、关系筛选及 CLI 的 stdout／stderr／退出码；另 4 对比较内部候选准备的可序列化数据投影。
- 临时 fixture 根路径及内部资源的设备／inode 身份归一化；公开诊断、warning、source、facets、coverage 与关系全部参与比较，Map／Set 保留有序内容。逐字段深比较后保存 hash 与字节数。
- 同步函数入口与原语计数单独运行。耗时每端使用 7 个无计数 hook 的独立 Node 进程，交错先后顺序；计时范围为实际操作，fixture 建立、结果序列化和清理在范围外。同一进程按固定顺序执行多个操作，存在模块与文件系统热态。

原始计数、全部耗时样本、条件与源码指纹见[测量结果](./_resources/261021-decision-investigation-first-batch-performance/first-run.json)。四份代码附件保存形成时采集方法，使用边界见下方[附件复核](#附件复核)。

## 调查结果与边界

**48 对公开 JSON 结果全部一致，另 4 对内部数据投影一致。五项均减少重复工作；万条决策查询的耗时中位数下降约 32%–34%，其余小幅耗时变化见下表及适用范围。**

### 改动与确定性工作量

| 候选与改动 | 样本／指标 | 基线 → 实施后 |
| --- | --- | ---: |
| C1：扫描传递已解析 ID（含失败 `null`） | 200 正式＋3 候选，`scan` 的 YAML 解析 | 609 → 406 |
| C1：每轮发现同时提取 ID 与 candidate 状态 | 同样本，`sync` 预检的 YAML 解析 | 1,621 → 1,012 |
| C2：list、trace、名称选择直接消费严格发布快照 | 10,000 条，list／ID trace 的 reader 构造／query 调用 | 1／10 → 0／0 |
| C2：消除 reader 的重复全集分页 | 同样本，list／ID trace 的通用 query 筛选输入元素合计 | 110,000 → 10,000 |
| C2：名称选择直接筛选快照 | 同样本，name trace 的 reader query 调用／通用筛选输入元素合计 | 11／120,000 → 0／10,000 |
| C3：current 包装层返回共享加载结果 | 200 份正文搜索，`parseStateIndex`／`Date.parse` | 2／1,000 → 1／600 |
| C5：一份关系 Map 同时提供 ID 与边依据 | 200 份关系列表，关系投影 | 2 → 1 |
| C8：完整非空 layout 直接提供正式身份 | 200 份 publish prepare，索引读取／`parseStateIndex`／`Date.parse` | 2／1／2,408 → 1／0／2,008 |

计量口径：C2 的 name trace 原有 10 次 `all` 分页查询和 1 次名称查询；通用 query 的筛选输入数包含保留的严格加载遍历，表示该入口累计处理的元素数。Markdown `readFile` 次数在 C1 scan／sync 中保持 203／609，C3 保持 200，C8 prepare 保持 400；正文匹配另用 `FileHandle.read`。

### 结果与安全边界

- 查询继续严格验证索引与关系图，保留排序、名称歧义、分页、facets、关系依据、来源及诊断；共享 reader 的动态分页契约保持原状。
- 扫描保留完整正文校验、重复身份诊断与候选排除；同步结束 revision 守卫独立读取新来源，current 搜索核对全集当前性。
- C8 只作用于完整非空 layout；空／局部 layout 的索引与发现流程、未知或移动资源 owner 的必要发现保持原有职责。局部 layout 对照的读取与解析计数不变。

形成时新增 17 个测试入口，覆盖同边关系交集与方向、错误优先级、严格索引校验、取消、不安全来源、移动或不可读 owner 及独立 revision 守卫。

### 无插桩耗时

单位为毫秒，括号内为 7 次的最小值–最大值；百分比仅描述中位数变化。

| 操作 | 基线中位数（范围） | 实施后中位数（范围） | 中位数下降 |
| --- | ---: | ---: | ---: |
| 决策 scan，200＋3 | 155.3（147.7–185.7） | 151.6（133.3–183.5） | 2.4% |
| 决策 list，10,000 | 825.4（802.9–1,677.1） | 561.8（540.5–857.2） | 31.9% |
| 决策 ID trace，10,000 | 789.2（752.7–1,191.4） | 523.4（507.3–761.2） | 33.7% |
| 决策 name trace，10,000 | 790.8（757.6–1,317.9） | 527.9（509.0–842.7） | 33.2% |
| 调查 current search，200 | 366.1（357.7–388.0） | 352.7（345.3–396.7） | 3.7% |
| 调查关系列表，200 | 24.4（23.9–26.9） | 21.4（20.4–21.7） | 12.5% |
| 调查完整 prepare，200 | 196.2（190.3–212.3） | 191.7（188.1–199.0） | 2.3% |

C5 的小样本耗时也下降；C1、C3、C8 的重复工作量确定减少，但 7 次耗时范围重叠，尚不足以区分小幅耗时改善与环境波动。万条决策查询两端的首个进程有明显慢值，表格保留完整范围。

### 交付验证

形成时通过两个领域套件（`bun run test:decision-records-cli` 306 项、`bun run test:investigation-report-check` 308 项）、源码／生成物检查、项目测试账本检查（1,326 个实体）及 `bun run check`（61 项通过、0 失败、3 项发布专用检查不适用）。独立审查核对了实现、测试、计量代码、源码指纹、结果 hash 与计时统计；测量脚本的严格类型、lint、格式命令见[验证记录](./_resources/261021-decision-investigation-first-batch-performance/measurement-verification.json)。

2026-10-21 后续编码复审将上述测试拆为 20 个独立入口，共同承接原 17 个 Case；决策来源声明改用独立字面量预期。整改后两个领域套件分别为 308、309 项通过，生产实现保持形成时字节。

### 附件复核

同日后续复审逐项核对了原 52 对结果、7 次采样统计及源码／脚本指纹，原固定样本的结果一致性与计时统计得到复核。也确认了两处可执行入口缺口：采集器只验证观测形状，可能接纳空观测或相同错误结果；调查 worker 接受 N=1，但关系 fixture 至少需要两份报告。反例及适用影响见[附件边界复核](./_resources/261021-decision-investigation-first-batch-performance/measurement-boundary-review.json)。

原代码与原始结果一起保留为形成时证据。新的采集任务应先补齐样本前提、预期操作集合、结果类别及采样次数校验，再建立测量入口；`equivalent` 单个字段不足以验收。这里记录的是复审发现与使用边界，原脚本未作行为修复。

### 适用范围

结果适用于所列版本、短元数据与稀疏关系的合成集合；等价证据覆盖已列条件，内部 4 对投影仅覆盖可序列化数据。真实项目、关系密图、大附件、其他平台、内存峰值、CPU 时间、并发竞态及冷启动仍待验证。规模或数据形态改变时应重新测量，再判断实际收益。

## 随附资源

- [计数 hook](./_resources/261021-decision-investigation-first-batch-performance/count-hook.ts)
- [计数会话状态](./_resources/261021-decision-investigation-first-batch-performance/counter-state.ts)
- [完整对照结果、计数与耗时](./_resources/261021-decision-investigation-first-batch-performance/first-run.json)
- [隔离样本与测量 worker](./_resources/261021-decision-investigation-first-batch-performance/measure-worker.ts)
- [附件输入与观测边界复核](./_resources/261021-decision-investigation-first-batch-performance/measurement-boundary-review.json)
- [测量脚本验证与覆盖边界](./_resources/261021-decision-investigation-first-batch-performance/measurement-verification.json)
- [形成时固定基线采集脚本](./_resources/261021-decision-investigation-first-batch-performance/run-measurements.ts)
