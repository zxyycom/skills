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

前序[常数成本调查](./decision-investigation-constant-factor-audit.md)定位了重复读取、解析、校验和遍历。用户授权实施首批 C1、C2、C3、C5、C8，并要求保持 Markdown 权威来源、JSON 派生索引及现有 CLI，不增加缓存体系。

本轮在实施后的新条件下复核前序预测。前序保留调查时的基线计数，本报告单独保存实现前后对照，避免混淆探针预期与实际收益。

## 调查目的

回答两项验收问题：五项优化是否保持公开结果与失败边界；是否减少重复工作，并在无计数插桩时改善真实耗时。编码质量以项目编码规范为依据，文档按 AI-Ready Docs 审核。

## 调查范围与依据

实现前基线固定为 Git `acd4321cba0a7034ca993121b996b6253493ba19`，运行时为 Node `v26.8.2`、Bun `1.4.2`。本轮修改 Decision Records 与 Investigation Report 的领域实现，分发版本分别提升为 `84`、`73`；共享索引运行时保持原实现。

### 对照方法

- 从固定 Git ref 导出隔离源码，分别用原生 Node 运行基线和当前源码；两端使用同一依赖环境与合成条件。附件保存两端生产源码 SHA-256，测量起止核对当前源码未变。
- 决策源样本 N=20／200，各含 3 份候选；纯发布索引 N=1,000／1,001／5,000／10,000。调查样本 N=20／200，各含 3 份候选、星型复查关系及共享正式 owner 资源。
- 52 对条件中，48 对比较完整公开 JSON 语义，覆盖成功、坏 YAML、重复 ID、坏索引、陈旧搜索 fallback、关系筛选与 CLI 的 stdout／stderr／退出码。另 4 对只比较内部候选准备的可序列化数据投影，不能代表方法或私有状态等价。
- 只将临时 fixture 根路径及内部资源的设备／inode 身份归一化；公开诊断、warning、source、facets、coverage 与关系全部参与比较。Map／Set 保留有序内容。逐字段深比较后保存 hash 与字节数，避免重复保存大型列表。
- 同步入口与原语计数独立运行。耗时每端 7 个独立、无计数 hook 的 Node 进程，交错先后顺序；计时只包含实际操作，不含 fixture 建立、结果序列化和清理。同一进程按固定顺序执行多个操作，存在模块与文件系统热态；未测冷启动或 CPU 时间。

原始计数、全部耗时样本、条件与源码指纹见[测量结果](./_resources/261021-decision-investigation-first-batch-performance/first-run.json)。附件脚本记录当时方法；重跑入口为资源目录中的 `run-measurements.ts`，接受重复次数和未使用的结果标签，拒绝覆盖旧证据。

## 调查结果与边界

### 实施范围与保留职责

五项改动均通过同阶段数据交接消除重复工作，保留 Markdown 与 JSON 的原有职责。

| 候选 | 实际改动 | 保留的边界 |
| --- | --- | --- |
| C1 | 扫描向后传递已解析的 ID（含失败 `null`）；每轮来源发现同时提取 ID 与 candidate 状态。 | 完整正文校验、重复身份诊断、候选排除；revision 守卫仍独立读取新来源。 |
| C2 | 决策 list、trace 与名称选择直接消费严格加载的发布快照。 | 严格索引与关系图校验、排序、歧义、分页、facets、关系依据和来源声明；共享 reader 的动态分页契约保持原状。 |
| C3 | 调查 current 索引包装层直接返回共享加载器成功结果。 | 全集来源 revision 核对及完整结构、投影、关系校验。 |
| C5 | 调查 list 的一份关系 Map 同时提供匹配 ID 与关系依据。 | type-only、方向、同边交集、空结果、选择器诊断、total 与分页。 |
| C8 | 已取得非空完整正式 layout 时，直接使用其身份集合。 | 空 layout 的索引／发现路径、共享资源 owner、未知与移动身份的必要发现。 |

### 完整结果与工作量

**48 对公开 JSON 结果全部一致，另 4 对内部数据投影也一致。** 新增 17 个最小原生测试分别登记 Case，补足类型／同边关系交集、歧义与错误优先级、严格索引校验、取消、不安全来源、移动或不可读 owner、独立 revision 守卫等边界。

| 候选与样本 | 指标 | 基线 → 实施后 |
| --- | --- | ---: |
| C1，200 正式＋3 候选 scan | YAML 解析 | 609 → 406 |
| C1，同样本 sync 预检 | YAML 解析 | 1,621 → 1,012 |
| C2，10,000 条 list／ID trace | reader 构造／query 调用 | 1／10 → 0／0 |
| C2，同样本 list／ID trace | 通用 query 筛选输入元素合计 | 110,000 → 10,000 |
| C2，同样本 name trace | reader query 调用；通用筛选输入元素合计 | 11 → 0；120,000 → 10,000 |
| C3，200 份 current content search | 完整 `parseStateIndex` 解析；Date.parse | 2 → 1；1,000 → 600 |
| C5，200 份关系列表 | 关系投影 | 2 → 1 |
| C8，200 份完整 publish prepare | 索引读取；完整 `parseStateIndex` 解析；Date.parse | 2 → 1；1 → 0；2,408 → 2,008 |

C2 的 name trace 原有 10 次 all 分页查询和 1 次名称查询；通用 query 计数包含保留的严格加载工作，它不是整个命令的全部遍历，也不是排序比较次数。C1 scan／sync 的 Markdown readFile 分别保持 203／609 次，C3 保持 200 次，C8 prepare 保持 400 次；阶段读取与当前性职责继续存在。正文搜索另有 FileHandle.read，不包含在该 readFile 指标内。局部候选 layout 的读取与解析计数保持原值，未套用 C8 的完整 layout 快路径。

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

**C2 的收益最明确：本样本万条查询中位数下降约 32%–34%。** C5 的小样本耗时也下降。C1、C3、C8 已确定减少重复工作，但实际耗时范围重叠，当前 7 次样本不足以证明其小幅中位数下降超出环境波动。万条决策查询两端的首个进程有明显慢值，表格保留全部样本范围，不将结果外推为固定加速比。

### 交付验证

实际通过 `bun run test:decision-records-cli`（306 项）、`bun run test:investigation-report-check`（308 项）、两领域源码／生成物检查、项目测试账本检查（1,326 个实体）及 `bun run check`（61 项通过、0 失败、3 项发布专用检查不适用）。类型、lint、格式、Markdown、链接及索引检查均通过；测量脚本另外完成严格类型、lint 和格式检查，命令与覆盖见[测量验证记录](./_resources/261021-decision-investigation-first-batch-performance/measurement-verification.json)。

独立审查以编码规范检查本次实现、测试和计量代码，并核对源码指纹、全部结果 hash 与计时统计。文档按 AI-Ready Docs 收敛计量表述，代表性阅读能够区分计数与耗时、公开结果与内部投影、前序预测与本轮事实，以及继续保留的安全复核职责。

### 适用范围

结果限于所列版本、短元数据与稀疏关系的合成集合。用户真实项目、关系密图、大附件、其他平台、内存峰值、全部并发竞态及冷启动未测。既有测试和本轮失败对照支持保留受影响边界，不能证明所有输入均等价。后续规模或数据形态改变时，应重新测量；本轮未实施其余候选。

## 随附资源

- [计数 hook](./_resources/261021-decision-investigation-first-batch-performance/count-hook.ts)
- [计数会话状态](./_resources/261021-decision-investigation-first-batch-performance/counter-state.ts)
- [完整对照结果、计数与耗时](./_resources/261021-decision-investigation-first-batch-performance/first-run.json)
- [隔离样本与测量 worker](./_resources/261021-decision-investigation-first-batch-performance/measure-worker.ts)
- [测量脚本验证与覆盖边界](./_resources/261021-decision-investigation-first-batch-performance/measurement-verification.json)
- [固定基线与对照入口](./_resources/261021-decision-investigation-first-batch-performance/run-measurements.ts)
