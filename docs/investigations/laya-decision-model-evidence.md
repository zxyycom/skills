---
title: "Laya 开源决策模型：实现、性能证据与使用边界"
id: "260920-laya-decision-model-evidence"
formedAt: "2026-09-20T08:06:39+08:00"
question: "Laya 与 Jev 的接口、实现、性能和开放程度有何差异，哪些证据支持本地类型化判断试验？"
tags:
  - "decision-models"
  - "lightweight-judgment"
  - "local-inference"
  - "model-evaluation"
relations: []
---

## 形成时背景

Jev 以共享 state 与 Choice、Score、Noul 问题提供托管类型化判断。Laya 提供同类任务范式下的开源本地实现，作者另提出底层实现相同、前身工作更早和部分性能更高的主张。

本调查分别核对接口、实现、性能与开放程度，为本地类型化判断试验选择候选。

## 调查目的

本轮为 Laya 是否进入 Jev 同场 PoC 回答五个问题：

1. Laya 的公开实现究竟是什么，和 Jev 相同的是任务/API 形态还是已能证明的模型架构。
2. “Laya 开发更早”的时间线应怎样拆分为 Laya 本体、作者前身工作和 TypeSafe 未公开研发。
3. “Laya 性能更好”在哪些条件下成立，哪些数字不构成同条件 head-to-head。
4. Laya 的开源范围是否包含代码、权重、数据、训练与评测，能否从原始数据完整复现。
5. 它是否比 Jev 更适合本地 agent 路由和 agent 工具输出裁剪，以及最小 PoC 应怎样避免误删关键上下文。

## 调查范围与依据

本报告保存 **2026-09-20** 的公开资料认识，“当前”均指该时点。Laya 公开不足两天，取证锚点为当时的 GitHub `main`/`research`、PyPI 0.3.3 和 Hugging Face 三个 checkpoint；采用前需重新核对版本、接口与限额。

依据分为四层：

- **Laya 一手材料**：GitHub README、`BENCHMARKS.md`、`laya/agent.py`、`laya/common.py`、research 分支结果与脚本、PyPI 发行记录，以及三个 Hugging Face 模型卡。源码审阅用于区分“一次 forward 调用”和“共享 state 只编码一次”。
- **Jev 一手材料**：TypeSafe 2026-09-15 的发布文章和当前 Models 文档。Jev 权重与架构未公开，本轮据此核对官方声明的共享 state、上下文、并行问题、价格和产品边界。
- **独立 Jev 测量**：`AbdelStark/jev-benchmarks` 与 `nibzard/decision-model-benchmark`。它们提供 Jev 的独立准确率、校准和托管端到端延迟，但没有在同一硬件和同一请求上运行 Laya。
- **时间线前身**：作者 2025-03-30 的 SalesRLAgent 论文、模型和数据集，以及作者的 Reddit 自述。论文与 artifact 可确认较早公开过“用强化学习输出概率而非生成文本”的垂直系统；自述用于界定作者主张。

本轮未安装模型、调用推理或改变运行环境；性能均为公开测量，未独立复现，也未校验训练数据污染或审计全部数据来源。质量判断依据实现与评测，不以热度、宣传图或单个演示作证。逐项 URL、观察值和来源边界见随附“来源与证据清单”。

## 调查结果与边界

### 结论先行

Laya 是**可审阅、可本地运行并适合领域专门化的决策模型底座**，值得进入 Jev 的业务内同场 PoC。公开证据支持的差异如下：

| 说法 | 判定 | 可支持的精确表述 |
| --- | --- | --- |
| 与 Jev 是“同一技术栈” | **同一任务范式；底层同栈无证据** | 两者都非自回归地把文本映射为封闭类型的概率决策，并都使用 `choice`、`score`、`noul` 和 RLCD 叙事。Laya 是可审阅的 ModernBERT/mmBERT 编码器方案；Jev 架构未公开，因此当前只能确认接口与任务同类。 |
| 性能更好 | **短输入与领域微调下局部占优** | Laya 在作者 T4 测量中本地延迟很低，专门微调后在少数低基数任务上高于 Jev 的已发布数字；这些结果不是同一 harness 的比较。零样本、长上下文、高基数选择、原始校准和概率分布匹配仍需业务内同场验证。 |
| 开发更早 | **前身工作更早；当前 Laya 发布更晚** | Jev 于 2026-09-15 公开，Laya 仓库首提交与 PyPI 首发是 2026-09-18。作者的 SalesRLAgent 于 2025-03-30 公开，早于 Jev 发布，但它是 PPO + 嵌入/LLM 指标的销售转化系统，不是当前 Laya 实现。TypeSafe 又自述有两年闭门研发，公开证据无法裁定实际研发先后。 |
| 已开源 | **开放权重与运行时；基础训练未完整复现** | Laya 运行时代码、Apache-2.0 权重、PyPI 包、评测脚本/结果和一个 typed-decisions 微调 notebook 可用；基础 checkpoint 的完整训练语料与从原始数据复现基础权重的流水线尚未公开。 |

### Laya 实际上是什么

Laya 当前有三个 checkpoint：

| checkpoint | 底座与参数 | 默认上下文 | 主要定位 |
| --- | --- | --- | --- |
| `convaiinnovations/laya` | ModernBERT-large，421M | 512 | 英文通用决策 |
| `laya-multilingual` | mmBERT-base，322M | 1024 | 多语言决策 |
| `laya-typed-decisions` | ModernBERT-large，421M | 1024 | 四类 typed-decisions 工作流的专门模型 |

公开源码显示 Laya 是专门的判定模型：每题构造独立序列 `[CLS] 类型 + 指令 + [MASK] 选项… [SEP] state [SEP]`，双向 encoder 后接两层 Transformer head；选项的 `[MASK]` 表示经 scorer 得到 logits，另有 act/escalate head。训练包含 log、spherical 与 ordinal ranked-probability 等严格 proper scoring reward。

**一次 forward 不等于 state 只编码一次。** `agent.py` 为每题调用 `build_sequence(state, question, ...)`，将重复含 state 的序列组成 batch 做一次 forward，token usage 汇总全部 attention mask。由此推断，state 编码与 token 工作量随问题数增加；TypeSafe 文档则宣称 Jev **只摄入 state 一次**再并行评估。该差异需纳入多题负载试验；Jev 底层架构未公开，尚不能证明同栈。

两者还存在明显的产品边界差异：

- Laya 是本地 Python/PyTorch/Transformers 包和 Hugging Face checkpoint；主仓库没有与 Jev 等价的托管 HTTP 服务和 JavaScript SDK。
- Laya 英文默认 512 token，扣除 192 token 的 question head 预算后，state 约剩 320 token；多语言/专门模型默认 1024，扣除 256 后约剩 768。Jev 当前文档是每请求 64k、`state + 最长问题` 32k。
- Laya 推荐 `choice` 少于约 20 个选项；默认 head 预算下，77 个标签只剩每项约 3–4 token。Jev 支持到 255 个选项。
- Laya 可以完全本地运行，文本不必送给第三方；Jev 是托管服务，换来长上下文、无需自管推理和按输入 token 计费。

### 性能数字的可比边界

Laya 在 Tesla T4 上自报 `laya-multilingual` 的 1、10、50 问题耗时分别为 32.8、72.3、337.4 ms，英文模型为 39.5、158.6、771.3 ms。独立 Jev 测量约为 236–276 ms p50。前者是本地模型计算，后者包含从法国访问托管服务的网络与排队；结果支持低延迟本地短输入试验，但“7.8×”不能解释为归一化的架构吞吐优势。

质量数字同样是混合结果：

| 观察 | 可支持的判断与边界 |
| --- | --- |
| typed-decisions 专门 checkpoint 准确率 0.766，Jev 已发布数字 0.727 | 是局部正证据，但 Laya 模型卡明确说 Jev 未在该项目中重跑，样本和 prompts 不同；Laya 还在该 benchmark 的 1,200-case 训练 split 上做过专门微调。 |
| 未微调的 `laya` / multilingual 在同一测试上仅 0.361 / 0.342，低于多数类 0.461 | 基础 checkpoint 的稳定价值在可专门化，而非开箱即用的通用质量。 |
| AG News 0.950 对 Jev 0.910 | AG News 在 Laya 训练 mix 中，不能当纯零样本优势。 |
| DAIR Emotion 约 0.595–0.600 对 Jev 0.480 | 是有利信号，但仍来自不同 run；需要同 harness 复测。 |
| Banking77：Laya 0.425，独立 Jev 约 0.870 | Jev 在高基数 choice 上明显更强，符合 Laya 固定 option-head 预算限制。 |
| typed-decisions soft accuracy：Laya 0.471，Jev 0.580；Laya raw ECE 0.213，Jev 0.144 | Laya argmax 更高不等于概率分布更好。Laya README 的 ECE 0.081 是按领域重新拟合 temperature 后的值，不应与 Jev 原始或另一数据分布直接混比。 |

中文证据为 Laya 的 20-way MASSIVE intent 自测：`laya-multilingual` 的 zh-CN 准确率 0.630、zh-TW 0.540。同批样本的 Jev 结果与中文 coding-agent 工具输出 benchmark 仍缺，部署前需用真实日志重测并校准。

### 时间线与优先权边界

公开时间线是：

1. 2025-03-30：同一作者公开 SalesRLAgent 论文；对应模型使用 Stable Baselines3 PPO，以嵌入和 LLM 派生指标表示销售对话状态，输出连续转化概率。
2. 2026-09-15：TypeSafe 公开 Jev，并称此前闭门研发两年、使用新架构、parallel sampler 与 RLCD。
3. 2026-09-18：Laya GitHub 初始提交与 PyPI 0.1.x 出现；9 月 19 日快速推进到 0.3.3。

SalesRLAgent 比 Jev 公开早约 18 个月，但仅输出销售转化轨迹，依赖预计算/动态特征，没有任意 state + 多种 typed questions 接口。作者在 Reddit 称两者“architecturally similar with the vertical use case”，同时区分 SalesRL 的 PPO sequence embeddings 与 Jev 的 RLCD parallel sampling。因此只可确认**思想与垂直前身较早公开**；Laya 本体公开较晚，TypeSafe 的未公开研发起点与架构同源关系无法裁定。

### 开源程度与工程成熟度

已公开的本地试验材料包括：

- 运行时代码、测试和 Apache-2.0 仓库公开，三个权重以 safetensors/Hugging Face 形式发布；
- PyPI 提供 wheel/sdist，并带 GitHub Actions Trusted Publishing provenance；
- research 分支提供评测脚本和 JSON 结果，typed-decisions checkpoint 有可运行的 2×T4 微调 notebook；
- 可以离线/内网推理，也能自行量化、ONNX/MLX 转换、加 HTTP 包装或用自有数据微调。

开放等级为 **open weights + open runtime + 部分训练/评测 recipe**。基础 checkpoint 的完整语料、生成/清洗清单和从底座到权重的训练入口仍缺；SalesRLAgent 的 100k 合成销售数据属于另一系统。

工程条件也影响选型：PyPI 两日内从 0.1.0 到 0.3.3，状态为 Beta。README 称冷加载需数秒，三个 checkpoint 全常驻约 1.16B 参数/4.6 GB fp32；当时 Hugging Face 无托管 inference provider。`$0` 仅指无第三方 API 账单，成本仍含显存/RAM、启动、部署、升级与观测。

### 对 agent 工具输出裁剪的适配判断

PoC 优先覆盖以下负载与分工：

- **适合**：对单个短工具结果或已切好的 chunk 做 `keep / drop / shorten / critical`；判断风险、相关性、是否需要贵模型；在少量已知模型、工具或技能之间路由；本地处理包含隐私的短文本。
- **适配条件**：输入以单个短结果或带来源标识的 chunk 为单位；长 transcript、几十个并行判断和跨段关系需要先由上游缩小范围或改用长上下文候选。
- **确定性代码优先**：文件大小、重复行、ANSI/日志噪音、路径白名单、固定格式截断、权限和精确计数先由 parser/规则处理，Laya 只处理剩余语义灰区。

推荐的最小 shadow PoC 是：

1. 先用确定性规则删除可证明无价值的噪音，并把长结果切成有来源标识的 chunk；永久保留用户指令、错误、diff、最近证据和不可重取结果。
2. 用 Laya 只给出保留/缩短/风险概率，不实际删内容；中文输入分别测 `laya-multilingual`，并独立标定中英文阈值。
3. 在同一冻结样本上比较规则基线、Laya base、Laya domain-tuned、Jev 1.13；需要生成摘要时由便宜生成模型承担，决策模型只输出评分。
4. 以“关键证据误删率”为第一门槛，再看任务成功率、固定错误预算下的自动覆盖率、ECE、p50/p95、冷启动、RAM/显存、总模型输入 token、缓存损失和因误删导致的重读/返工。
5. 若候选工具/技能超过约 20 个，先用确定性检索缩小候选或做分层 coarse-to-fine choice，不把完整 schema 一次塞给 Laya。

按负载选择：**短文本、本地隐私、愿意微调和自管运行时，优先试 Laya；长共享 state、多题、开箱零样本和高基数选择，Jev 的公开边界更有利。** 自动删除权限须以同分布 shadow 数据达到关键证据误删率门槛为前提，并保留原文恢复与升级路径。

## 随附资源

- [来源与证据清单](./_resources/260920-laya-decision-model-evidence/source-inventory.md)
