---
title: "OpenAI Decisions 与 Jev：质量、校准、延迟和成本证据"
id: "261009-openai-decisions-jev-comparison"
formedAt: "2026-10-09T06:51:13Z"
question: "公开评测支持 OpenAI Decisions 相对 Jev 处于什么水平，哪些性能和采用结论仍未得到证明？"
tags:
  - "decision-models"
  - "lightweight-judgment"
  - "model-evaluation"
relations: []
---

## 形成时背景

OpenAI Decisions API 公测后，模型接入可用性与实际替代价值需要分别判断。本调查记录 2026-10-09 可取得的社区质量、校准、延迟和费用证据；调用协议由[官方接口调查](openai-decisions-api-contract.md)承接。

## 调查目的

比较任务效果、概率校准、延迟和调用成本，区分接近、领先、落后与尚未证明的稳定性，并识别有价值的后续评测。

## 调查范围与依据

本报告保存 **2026-10-09（Asia/Shanghai）** 的公开证据认识，“当前”均指该时点。审阅四组社区文本测评、一组图像测评，以及 OpenAI 社区和 Reddit 讨论；同日补核配对差异区间、自动接受错误率与容量探测，来源随结果列出。

数字均为作者测量的公开汇总，本轮未下载全量日志、独立复现或调用 API，未产生费用。测评日期、提示和指标分别保留；图像仅覆盖 100 张照片的人数判断，采用时须核对目标业务与服务的新条件。

## 调查结果与边界

### 总体结论

**Decisions 是与 Jev 同档、已读文本测评偏弱的竞争候选，尚无明确替换优势。** 综合依据是：分类分数多略偏向 Jev，多项判断出现明显回退；较可比测量中位延迟接近，Decisions 长尾更慢且估计费用更高。

任务覆盖有限，两篇共用一个公开数据集，故不足以证明跨任务稳定落后、等效或迁移收益。照片计数测评提供了相对普通 Luna 的速度信号，图像精度结论仍限于该小样本任务。

### 任务效果对照

下表保留各作者指标，不跨任务合成总分。

| 来源与测量日期 | 样本、指标 | Decisions | Jev |
| --- | --- | --- | --- |
| [Model Fatigue](https://modelfatigue.news/decision-models/)，10-07 | BANKING77 3,080 条，单标签正确率 | 93.5% | 93.9% |
| [StackToHeap](https://stacktoheap.com/blog/2026/10/08/jev-the-decisions-strike-back/)，Decisions 10-08 | BANKING77 770 条，每意图两个示例，正确率 | 84.16% | 85.32% |
| [Nexus Agent](https://agent.nexus/blog/openai-decisions-api-vs-jev)，10-07 | 8 类 Agent 检查，2,155 个标注案例，错误数 | 233 | 221 |
| [Takeshi Kada/Zenn](https://zenn.dev/tkada/articles/f758587a326d83)，Decisions 10-07 | 易读组 / 需理解上下文组，各 200 条日文工单，六项全部正确的比例 | 64.5% / 76.5% | 99.0% / 93.5% |

解释这些结果需要同时保留以下条件：

- **Model Fatigue 的对照较完整：**同晚、同地点顺序调用，双方共享五个检索出的训练示例；配对差异为 −0.39 个百分点，95% 区间 −0.91～+0.13，跨零支持“接近但差距未确立”，不是等效证明。仍只有一个公开分类任务。
- **StackToHeap 说明提示影响明显：**双方使用相同定义及示例，Jev 为历史运行；Decisions 无示例正确率 78.96%，加入示例后提升到 84.16%。两种设置分别拒绝 2 条和 5 条请求，作者把拒绝计作错误。
- **Nexus 的标注和阈值限制较大：**标签来自 AI reviewers 与 resolver，提示和阈值为 Jev 设置，未给 Decisions 重调；作者披露对 Jev 的利益关联。延迟另测 6,624 次调用，不能当作 6,624 个独立质量样本。
- **Zenn 的大幅失分是端到端行为问题：**作者说明一组单看部门分类为 100%，损失主要来自过度要求人工复核；因此不能把全项一致率当成部门分类准确率。Jev 测于 09-21，完整请求与标签未复核；普通 Luna 对照名称在正文和表格中不一致。

### 延迟与成本：中位接近，尾部证据偏向 Jev

下表使用上述来源的客户端时间。前两组为同一晚对照；后两组的 Jev 数据来自历史运行。p50 是中位数，mean 是平均数。

| 来源与统计口径 | Decisions | Jev |
| --- | --- | --- |
| [Model Fatigue](https://modelfatigue.news/decision-models/)：p50 / p99 | 239 / 594 ms | 242 / 386 ms |
| [Nexus](https://agent.nexus/blog/openai-decisions-api-vs-jev)：p50 / p99 | 268 / 1,469 ms | 269 / 526 ms |
| [StackToHeap](https://stacktoheap.com/blog/2026/10/08/jev-the-decisions-strike-back/)：有示例 mean | 194.41 ms | 520.03 ms |
| [Zenn](https://zenn.dev/tkada/articles/f758587a326d83)：六项判断 p50 | 301 ms | 615 ms |

结果支持“某些负载更快，较可比负载中位打平、长尾更慢”；客户端时间含网络、地点与服务负载，不是通用 SLA。

费用估算也偏向 Jev：Model Fatigue 每千次 **$0.114 / $0.078**，Nexus 每千次约 **$0.22 / $0.11**，StackToHeap 有示例的整轮 770 次为 **$0.3024 / $0.1831**，均按 Decisions/Jev 排列。这是作者按 usage 与单价估算，token 计数和题数影响比值。

### 概率校准与稳健性：尚无一致领先证据

[Model Fatigue](https://modelfatigue.news/decision-models/) 评估 `confidence`，以下顺序为 Decisions/Jev：ECE 为 **0.041 / 0.035**；开发集选定阈值后，自动接受 **84.0% / 84.1%**，接受部分错误率 **2.13% / 2.05%**。双方阈值均为 0.99，但实际错误率仍超过 1%；阈值数值不是可靠性承诺。

[StackToHeap](https://stacktoheap.com/blog/2026/10/08/jev-the-decisions-strike-back/) 评估的是选中标签的概率：Decisions 分箱 ECE 较好，Jev 的 Brier 较好。两个测评的字段和指标不同，不能合成“谁的概率全面更可靠”。

[硬币/弹珠实验](https://community.openai.com/t/results-from-toy-experiments-with-decisions-api/1404010)报告三批各 1,000 次请求：真实红球概率为 50%，`predicate` 约 50%，`choice` 给红色 86%，反转顺序后为 73%。这是选项顺序敏感性的窄场景线索；重复同一问题不扩大任务覆盖，选最高概率类别也不是随机抽签。帖子中的其他异常与内部架构猜测未取得可核对证据。

### 图像测评：额外模态与速度价值

[Zenn 图像测评](https://zenn.dev/tkada/articles/c7854943de4292)于 10-09 发布，测量日期为 10-08：100 张公开照片，真实人数为 0～10；Decisions 从 0～20 共 21 个候选中选择。对照为关闭推理、以 JSON schema 输出人数的普通 Luna，以及关闭 thinking、以工具输出人数的 Haiku 5.5；三者共享计数规则。

| 指标 | Decisions | 普通 Luna（Responses） | Haiku 5.5 |
| --- | --- | --- | --- |
| 人数完全正确 | 78% | 81% | 79% |
| 误差不超过 1 人 | 97% | 95% | 93% |
| 客户端 p50 | 351 ms | 1,466 ms | 835 ms |
| 每千张估计费用 | $0.100 | $0.058 | $0.121 |

100 张均取得人数结果。Decisions 中位时间约为普通 Luna 的四分之一，但估计费用更高；候选及说明也计入输入。单任务、小样本且未复核全量日志，三张照片的正确数差距与近似误差不足以支持视觉能力排名。

取证时 Jev 1.13 的[官方输入契约](https://docs.typesafe.ai/models)仅支持文字，因此本表不是 Jev 原生图像对照。后续实验能力见[10 月 15 日复查](jev-1-14-capabilities-and-comparison.md)。若以 OCR 或视觉描述转文字后交给 Jev，须另测全链路错误、时间和费用。

### 社区讨论与容量探测

- **多标签需求：**[开发者反馈](https://community.openai.com/t/decisions-api-mutually-inclusive-answers-in-choice-questions/1404238)希望同时识别发票、合同等标签。这是接口需求，不是准确率基准；对应问题组织见官方篇。
- **采用门槛：**[Reddit 讨论](https://www.reddit.com/r/LLMDevs/comments/1x0cngd/jev_alternatives_openais_decisions_api_is/)关注 sub-200 ms、区域处理与失败回退。缺少完整测量日志，适合作需求信号。
- **超长输入：**StackToHeap 曾成功提交 692,197 输入 token；约 700K～900K 请求又出现超时或服务错误。它证明一次容量观察，不证明稳定上限或长上下文质量。官方明确的选项与图片数量限制由官方篇承接。

### 采用判断与后续对照

采用理由可来自 OpenAI 接入体系、供应商备选或图像需求；文本效果是否足以替换 Jev，仍须业务验收。

如继续试用，建议选择一个明确任务，人工标注约 100～300 条作为初筛：

1. Jev、Decisions 和普通 Luna 使用相同语义问题，分别比较零样本与相同示例；记录模型、日期、地点、并发和 usage。
2. 用独立开发集调各自阈值，在留出的测试集比较正确率、漏拦/过拦、人工回退及拒绝/超时；需要概率时再测校准。
3. 记录客户端 p50/p95；判断 p99 需更大样本。互换选项、改写提示和重复调用，检查答案及概率的变化。
4. 图像任务单独建集，对照支持图像的普通 Luna 等模型；评测保持离线，动作授权由应用另行处理。

目标业务效果、其他图像任务及模型内部机制仍未知。出现新领域测评、可复核原始数据或实测授权时，再复核对应判断。
