---
title: "Intern-Decision、CLM-8B 与 Jev：协议、校准与性能证据"
id: "260926-intern-decision-clm-evidence"
formedAt: "2026-09-26T14:37:39Z"
question: "Intern-Decision 与 CLM-8B 的接口、模型特征、校准和性能有哪些证据，能否作为 Jev 的本地替代候选？"
tags:
  - "decision-models"
  - "lightweight-judgment"
  - "local-inference"
  - "model-evaluation"
relations: []
---

## 形成时背景

Intern-Decision 与 CLM-8B 提供 Jev 相邻的类型化决策能力。本地替代需要分别核对接口、质量、校准与部署条件，而非只看结果类型相近。

## 调查目的

确认两个项目的技术路线、开放与复现程度，比较质量、校准和速度，为本地试验选择候选及验收重点。

## 调查范围与依据

本报告保存 **2026-09-26** 的公开资料认识，“当前”均指该时点。依据公开文档、模型卡、代码和评测数据，未运行模型、部署服务或复现测量。来源分为三层：

- **实现与产品契约**：Jev 的 [Models](https://docs.typesafe.ai/models)、[Primitives](https://docs.typesafe.ai/primitives)和 [Confidence](https://docs.typesafe.ai/confidence)；Intern-Decision 的[固定代码快照](https://github.com/InternLM/Intern-Decision/tree/2f815802058b2464144218859ea9221c1bc0d2a8)；CLM 的[官方仓库](https://github.com/Contrastive-LM/CLM)与[模型卡](https://huggingface.co/Contrastive-LM/CLM-v0.1-8B)。
- **发布方自测**：Intern 的评测说明和表格；CLM 的任务结果与专用微调头。用于理解各自实验条件下的表现。
- **第三方测量**：[JevBench v1.4.2](https://benchmarkheaven.com/api/jevbench/v1.4.2)及其方法、部署披露。用于同协议比较。

版本锚点：Jev 文档为 `jev-1.13.0`；Intern 代码为 `2f815802058b2464144218859ea9221c1bc0d2a8`（2026-09-26 08:58:43 UTC），下文实现链接固定该版本；CLM 模型卡读取时最新提交为 `e939398d4556fcd9400c76fa8c5a513202f42b0a`，第三方实际测试版本另列。

覆盖限制：CLM `engine.py/schema.py` 与官方 Notion 博客未成功读取，其 API 和缓存机制依据官方说明；Intern 相关代码已抽查。两者的独立 arXiv/会议论文和精确正式发布日期本轮未确认。

## 调查结果与边界

### 核心判断

**两者都属于 Jev 相邻的类型化决策路线，适合进入不同方向的试验。**

- **Intern-Decision：本地类型化判断候选。** 基于 Qwen3.5 微调，一次因果前向计算得到多个字段的候选概率。4B 官方自测较强，0.8B/2B 可作资源对照；下一步重点是业务质量、运行入口校准和代码许可。
- **CLM-8B：候选匹配与微调选优候选。** 冻结 Qwen3-8B，分别编码状态和动作，经双投影头打分。候选复用和领域微调是其主要试验价值；通用零样本质量与官方专用头成绩应分别评价。

### 类型接口与运行边界

Jev 以共享 state 和 typed questions 返回 Choice、Score、Noul，官方描述使用 RLCD、并行评估。当前提供托管 API，输入为文本，总请求上限 64k token，state 加最长问题为 32k。[官方契约](https://docs.typesafe.ai/models)

| 候选 | 决策方式 | 已核对的输入边界 |
| --- | --- | --- |
| Intern-Decision | Qwen3.5 因果模型读取候选 token logits；多字段共用一次前向计算 | HF wrapper 默认 8192 token，超限拒绝；1–16 题，每题最多 62 候选，最多 8 张图 |
| CLM-v0.1-8B | state+question 与候选动作分别编码、匹配，可复用缓存 | quickstart 默认 2048 token，超长截断；扩展长度须同时提高 encoder/server 限额 |

两者都输出候选分数，省去自由文本解码，但 backbone 不同。Intern 的因果顺序可能影响多字段判断；CLM 多题是否只编码一次共享 state，尚无代码级证据。

#### Intern-Decision 的实现与校准

[训练配置](https://github.com/InternLM/Intern-Decision/blob/2f815802058b2464144218859ea9221c1bc0d2a8/configs/training/qwen35.py)冻结 vision/projector、微调语言部分。官方称其为 autoregressive masked language modeling：以含 `<decision>` 的 JSON 骨架为输入，真值进入 labels，按全词表交叉熵训练。

[schema 编译器](https://github.com/InternLM/Intern-Decision/blob/2f815802058b2464144218859ea9221c1bc0d2a8/src/inputs/schema.py)将选项映射到单 token 符号；[HF backend](https://github.com/InternLM/Intern-Decision/blob/2f815802058b2464144218859ea9221c1bc0d2a8/src/inference/hf_backend.py)一次 forward 读取标记前位置的 logits；[engine](https://github.com/InternLM/Intern-Decision/blob/2f815802058b2464144218859ea9221c1bc0d2a8/src/inference/engine.py)在各字段合法候选内做 softmax。Choice 选最大概率标签，Noul 取 no/yes 中的 P(yes)，Score 取数值等级期望。字段答案不回填，问题、候选和字段顺序仍需测试。

[温度校准](https://github.com/InternLM/Intern-Decision/blob/2f815802058b2464144218859ea9221c1bc0d2a8/src/inference/temperature.py)使用 `softmax(log(p)/T)`，保留 argmax，改变概率及 Score。各尺寸模型卡报告以 1728 条记录拟合、1693 条验证：

| 权重与固定模型卡 | 拟合温度约值 |
| --- | ---: |
| [0.8B](https://huggingface.co/internlm/Intern-Decision-0.8B/blob/85a0cc5a99d67ea8d56dfe98115689212867171d/README.md) | 2.748 |
| [2B](https://huggingface.co/internlm/Intern-Decision-2B/blob/8797836c65fc91a2435b1fb6850b5f0aabd75cc3/README.md) | 2.101 |
| [4B](https://huggingface.co/internlm/Intern-Decision-4B/blob/0e5e6aa7d6d750e2b1504ba11a8136cb58aeb3cd/README.md) | 1.992 |

校准依赖入口：GitHub engine 未传 artifact 时 T=1；HF 发布包默认加载拟合温度；[正式评测 preset](https://github.com/InternLM/Intern-Decision/blob/2f815802058b2464144218859ea9221c1bc0d2a8/docs/EVALUATION.md)绑定 XTuner，并提示 HF 数值可能变化、建议重新拟合。目标 backend 与业务分布均需验证温度。

#### CLM-8B 的实现与部署成本

[模型卡](https://huggingface.co/Contrastive-LM/CLM-v0.1-8B)与[配置](https://huggingface.co/Contrastive-LM/CLM-v0.1-8B/blob/main/config.json)说明：冻结 Qwen3-8B，使用 last-token pooling，状态头与动作头以双向 InfoNCE 训练。[训练配方](https://github.com/Contrastive-LM/CLM#how-it-works)约含 60M Q&A、30M 困难负例和 1M agent 轨迹。

状态、动作独立缓存，为固定工具集和重复候选提供潜在编码成本优势。[发布头文件](https://huggingface.co/Contrastive-LM/CLM-v0.1-8B/commit/a6cabbc226257a8ad572e818e13a23f2e1c8b9d7)约 75.6 MB，完整部署仍包含 8B encoder；官方示例使用 GPU pooling。本轮未测实际显存、Windows 原生或量化性能。

#### 概率与阈值

| 系统 | confidence 的已知定义 |
| --- | --- |
| Jev | 分布的统计摘要；本轮读取页面未给精确公式 |
| Intern-Decision | 最大候选概率 |
| CLM | 最大概率减去其余概率均值 |

CLM 的三种类型由候选匹配分数派生，概率相对于候选集合；其 Score 是等级索引期望，Intern 则按数值等级求期望。因此阈值应分别标定，并测试候选描述、顺序、温度和 backend 变化；概率只辅助分流，执行授权由既有规则负责。

### 开放与复现程度

| 项目 | 已确认公开 | 复现缺口 |
| --- | --- | --- |
| Intern-Decision | 三个尺寸权重，训练、推理、评测和校准代码，测试套件及校准 pilot | 原始训练数据、准备流水线、私有拟合/验证集；外部基线 runners 和历史响应 |
| CLM | 基础头、推理包、微调和评估入口，部分数据及专用头 | 完整三阶段训练流水线与全部原始数据的可取得性尚未核实 |

许可需按发布物判断：

- **Intern**：模型卡标 Apache-2.0，4B 包内 [LICENSE](https://huggingface.co/internlm/Intern-Decision-4B/blob/0e5e6aa7d6d750e2b1504ba11a8136cb58aeb3cd/LICENSE) 和 [LICENSE-QWEN](https://huggingface.co/internlm/Intern-Decision-4B/blob/0e5e6aa7d6d750e2b1504ba11a8136cb58aeb3cd/LICENSE-QWEN)均有相应文本；GitHub 固定快照未见根 LICENSE，API license 为 null。复用或分发原创代码前应确认代码统一许可。[数据说明](https://github.com/InternLM/Intern-Decision/blob/2f815802058b2464144218859ea9221c1bc0d2a8/docs/DATA.md)与评测说明亦保留训练、校准数据缺口。
- **CLM**：[代码](https://github.com/Contrastive-LM/CLM/blob/main/LICENSE)和基础头标 Apache-2.0；[DeepSWE 专用头](https://huggingface.co/Contrastive-LM/deepswe-clm-heads-8k)与[训练 embeddings](https://huggingface.co/datasets/Contrastive-LM/deepswe-clm-train-embeddings-8k)标 MIT。[预训练数据页](https://huggingface.co/datasets/Contrastive-LM/CLM-v0.1-Pretrain-Nemotron)显示约 6245 万行但缺少 dataset card，原始问答、完整字段和数据许可仍待核实。

### 质量与速度证据

#### Intern 官方自测

[官方表格](https://github.com/InternLM/Intern-Decision/blob/2f815802058b2464144218859ea9221c1bc0d2a8/README.md)报告：

| 模型 | 七套件平均准确率 | 平均延迟 |
| --- | ---: | ---: |
| Jev | 88.74% | 109.70 ms |
| Intern 0.8B | 79.38% | 33.98 ms |
| Intern 2B | 84.68% | 33.28 ms |
| Intern 4B | 90.02% | 44.16 ms |

| 模型 | Hard Brier ↓ | Hard ECE ↓ |
| --- | ---: | ---: |
| Jev | 0.3584 | 0.0947 |
| Intern 0.8B | 0.5295 | 0.0657 |
| Intern 2B | 0.4373 | 0.1002 |
| Intern 4B | 0.3468 | 0.0653 |

读数条件：

- 准确率是七套件的不加权平均；Brier/ECE 只覆盖 111 条 Hard。4B 在 WildJailBreak 为 89.86%，Jev 为 96.29%，反映综合平均与专项质量的差别。
- 准确率/校准 preset 使用 XTuner；延迟使用 native HF、单 RTX4090、BF16、289 输入 token 和 3 字段。Jev 服务硬件、网络距离和完整测量设置披露不足，速度仅作为该实验条件下的观察。
- 结果支持将 4B 纳入本地试验；通用校准和安全审查能力仍需独立业务样本验证。

#### CLM 官方自测与微调结果

[官方 Results](https://github.com/Contrastive-LM/CLM#results)称零样本 computer-use、gaming、tool-calling 与 Jev 相当、最高快 9 倍；微调 verifier 的 DeepSWE 为 81.6%、Terminal-Bench 2.1 为 87.6%。后两者分别含 38/30 个 held-out 任务，延迟测于 H100，由其他生成模型提供候选，CLM 负责选优。

[DeepSWE 专用头](https://huggingface.co/Contrastive-LM/deepswe-clm-heads-8k)给出的协议为：75/38 任务不相交划分、best-of-4、末尾最多 12 步平均评分；选优成功 31/38，对照 pass@1 为 28/38、oracle 为 34/38。[评估实现](https://github.com/Contrastive-LM/CLM/blob/main/evaluation/bon_eval.py)提供选优逻辑。

上述成绩仅评价特定候选池与微调头；基础 checkpoint 的零样本能力、Terminal-Bench 完整重现材料和冷/热缓存延迟分布仍需核对。

#### JevBench 第三方横评

[JevBench v1.4.2](https://benchmarkheaven.com/jev-models)页面标注计分日期 2026-09-24。下表取自[版本 JSON](https://benchmarkheaven.com/api/jevbench/v1.4.2)的 `systems`，选择 `clm-8b` 与 `jev-1.13.0`：

| 指标 | CLM-8B | Jev 1.13.0 |
| --- | ---: | ---: |
| Intelligence 轴 | 22.35 | 53.06 |
| Calibration 轴 | 39.81 | 76.34 |
| Hard 准确率，220 题 | 35.91% | 74.09% |
| Sealed 准确率，308 题 | 24.03% | 36.69% |
| Sealed 有效回答 | 308/308 | 308/308 |
| 原始 p50 | 16.77 ms | 652.43 ms |
| 计分 p50 | 183.55 ms | 652.43 ms |

[CLM 测试条目](https://benchmarkheaven.com/jev-models/clm-8b)固定以下版本：

- 源码：`cca045ffdb07b3ebcfe6938537cdeac5e14899c9`；
- 头：`87655cb835bd76fd66c2da78e1e3709f7fa11a94`；
- Qwen3-8B：`b968826d9c46dd6066d109eabc6255188de91218`。

测试采用作者 `system_one` 路径、温度 1.0、last-token pooling；在评测者 RTX PRO 6000 上离线运行、默认缓存开启，JSON 记载覆盖全部 842 个决策。解释结果时保留四项条件：

1. [计分方法](https://github.com/fstandhartinger/jevbench/blob/main/docs/METHOD-v1.4.md)包含机会水平修正、sealed 组合及低轴惩罚；Intelligence、Calibration 和综合分均为派生指标，准确率应读取对应字段。与 v1.2 结果比较时须重新对齐协议。
2. CLM 原始延迟为缓存开启的进程内 `Engine.answer`；Jev 包含德国到生产 API 的网络往返。CLM 的 `×2+150ms` 为计分假设。
3. CLM 每千次约 $0.005234 是参照 Qwen3-Embedding-8B 托管价乘缓存未命中 token 的估算，实际部署成本需另测。
4. sealed 题面和答案私有，公众只能审查方法与聚合结果；英文、串行 pilot 的外推范围有限。

**CLM 的专项微调优势与通用判断质量应分开评价。** 此协议下弱于 Jev，与不同任务、头和协议的官方成绩不矛盾。榜单和 JSON 未见 Intern-Decision，其同协议第三方表现仍未知。

### 后续试验选择

| 需求 | 候选 | 关键验收 |
| --- | --- | --- |
| 本地分类、路由、多条件判断 | Intern 4B；0.8B/2B 作资源对照 | 代码许可，backend/温度，中文质量和字段顺序 |
| 固定工具集、重复动作、大候选池 | CLM 基础头 | 冷/热缓存收益与任务准确率 |
| 有标注的轨迹验证、方案选优 | CLM 专用微调头 | 任务级训练/评估拆分，固定生成器和候选池 |
| 命令审查、证据裁剪 | 先影子运行 | 危险误放行/关键误删率、覆盖率和升级机制 |

试验固定模型 revision、精度、运行库、温度、题面、候选和长度分布，分别报告语言、缓存状态、p50/p95、并发、硬件与端到端成本。保留 Jev 作对照：Intern 进入本地判断路线，CLM 进入缓存和微调路线；直接替换仍缺目标业务证据。

剩余未知为中文与代码混合任务、设备资源、长期校准、完整训练复现和 Intern 代码统一许可。新权重、许可补齐、backend 变化、独立评测出现或准备部署时，重新核对相应部分。
