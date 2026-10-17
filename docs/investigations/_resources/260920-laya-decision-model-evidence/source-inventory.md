# Laya 开源决策模型调查：来源与证据清单

本清单记录 2026-09-20 形成报告时直接使用的公开来源。厂商/作者自述用于确认其主张和公开 artifact；只有独立项目被标为独立测量。Laya 与 Jev 没有在本轮使用同一硬件、同一样本、同一 prompt 重新运行。

## Laya 本体

| 来源 | 本轮采用的事实 | 强度与边界 |
| --- | --- | --- |
| [Laya GitHub 仓库](https://github.com/NandhaKishorM/laya) | Apache-2.0 运行时、Python API、三个 checkpoint、router、预加载/内存说明和用例定位 | 一手实现与作者说明；项目变化很快 |
| [Laya README](https://github.com/NandhaKishorM/laya/blob/main/README.md) | 421M/322M 参数、512/1024 默认上下文、T4 延迟、冷加载与约 4.6 GB fp32 常驻量、`choice/score/noul` 接口 | 性能为作者自测；不等于独立 Jev head-to-head |
| [`laya/agent.py`](https://github.com/NandhaKishorM/laya/blob/main/laya/agent.py) | 每个问题分别用同一 state 构造序列，再把序列 batch 到一次 forward；usage 汇总 batch attention tokens | 一手源码；“state 随问题重复”是本轮对代码路径的推断 |
| [`laya/common.py`](https://github.com/NandhaKishorM/laya/blob/main/laya/common.py) | 双向 encoder、两层 Transformer head、`[MASK]` marker scorer、question type embedding、act head 和 proper-scoring reward | 一手源码；只说明公开 Laya 架构 |
| [Laya BENCHMARKS](https://github.com/NandhaKishorM/laya/blob/main/BENCHMARKS.md) | 低/高基数准确率、zero-shot 弱项、T4 latency、中文 MASSIVE、温度重拟合和限制 | 作者测量；文档自己声明 Jev 未在同项目中运行、sample/prompt 不同 |
| [research 分支](https://github.com/NandhaKishorM/laya/tree/research/research) | benchmark 脚本、notebook 与 JSON 结果存在 | 提高可审计性；不含基础 checkpoint 的完整训练流水线 |
| [初始提交](https://github.com/NandhaKishorM/laya/commit/136910c549eb54b05112b806d4d92cbba39ceb57) | GitHub API 显示提交时间 2026-09-18T04:46:27Z，消息为 `Initial commit for Laya package` | 可验证 Laya 公开仓库时间，不证明作者私下研发起点 |
| [PyPI `laya`](https://pypi.org/project/laya/) | 0.1.0–0.1.6 于 2026-09-18，0.2.0–0.3.3 于 9 月 19 日；Apache-2.0、Beta、Trusted Publishing | 一手发行记录；快速迭代意味着 API/权重仍可能变化 |
| [基础 Laya 模型卡](https://huggingface.co/convaiinnovations/laya) | Apache-2.0、421M、safetensors、英文 512 token 与限制 | 作者模型卡；校准需在真实分布复核 |
| [Laya Multilingual 模型卡](https://huggingface.co/convaiinnovations/laya-multilingual) | 322M、1024 token、多语言定位和 typed-decisions zero-shot 限制 | 作者模型卡；“100+ languages”不等于每种语言达到生产质量 |
| [Laya Typed-Decisions 模型卡](https://huggingface.co/convaiinnovations/laya-typed-decisions) | 0.766 accuracy、0.471 soft accuracy、0.213 ECE；基础模型低于多数类；在 benchmark train split 上微调；建议 choice 少于约 20 项 | 作者提供的最完整自我限制；Jev 数字来自他处而非同 run |
| [typed-decisions 微调 notebook](https://github.com/NandhaKishorM/laya/blob/main/notebooks/laya_finetune_typed_decisions_2xT4_kaggle.ipynb) | 专门 checkpoint 有公开微调路径 | 能复现专门化思路，不等于能从原始数据复现基础 Laya 权重 |

## Jev 对照与独立测量

| 来源 | 本轮采用的事实 | 强度与边界 |
| --- | --- | --- |
| [TypeSafe Jev 发布文章](https://typesafe.ai/blog/introducing-system-one-models-and-jev) | 2026-09-15 公开；厂商称闭门研发两年、新架构、parallel sampler、RLCD、类型化概率输出 | 官方时间与自述；未公开权重/架构，无法独立核对研发起点或同栈关系 |
| [TypeSafe Models 文档](https://docs.typesafe.ai/models) | Jev 1.13、`$0.042/M` input、64k request、32k `state + 最长问题`，state 一次摄入后并行评估问题 | 取证时官方产品契约；价格与限制会变化 |
| [`AbdelStark/jev-benchmarks`](https://github.com/AbdelStark/jev-benchmarks) | 独立 Jev 1.13 测量：AG News 0.910、Banking77/BTZSC 0.870、DAIR Emotion 0.480；法国访问托管 API p50 约 236–256 ms | 独立、协议冻结的 300 样本 pilot；不是 Laya 同场比较，延迟含网络 |
| [`nibzard/decision-model-benchmark`](https://github.com/nibzard/decision-model-benchmark) | 独立 Jev 测量：p50 264–276 ms、255-choice 上限、ECE/位置偏差与成本结果 | 独立可复核；仍是托管端到端数据，不能归一化到本地 T4 |

## 较早前身与社区主张

| 来源 | 本轮采用的事实 | 强度与边界 |
| --- | --- | --- |
| [SalesRLAgent arXiv](https://arxiv.org/abs/2503.23303) | 2025-03-30 提交；用强化学习做销售对话转化概率与逐 turn 跟踪 | 证明较早公开相近方向；是垂直销售系统，不是当前 Laya/Jev typed-question 架构 |
| [SalesRLAgent 模型卡](https://huggingface.co/DeepMostInnovations/sales-conversion-model-reinf-learning) | Stable Baselines3 PPO、embedding + LLM-derived metrics、连续 0–1 action | 一手 artifact，显示与当前 Laya encoder + marker head 的实现不同 |
| [SalesRLAgent 数据集](https://huggingface.co/datasets/DeepMostInnovations/saas-sales-conversations) | 100k synthetic 销售对话、embedding 与销售指标、Apache-2.0 | 是前身系统数据，不是 Laya 基础训练语料 |
| [作者在 LocalLLaMA 的说明](https://www.reddit.com/r/LocalLLaMA/comments/1wijo3e/i_literally_built_the_jev_architecture_one_year/) | 作者主张 2025 年已做相近思想，并明确区分其 PPO sequence embeddings 与 Jev RLCD parallel sampling | 作者自述/社区讨论，只用于界定主张，不作为同栈、抄袭或优先权证据 |

## 待补证据

- Jev 的公开模型权重、完整网络结构、训练代码或训练数据。
- Laya 基础 checkpoint 的完整原始训练 corpus、生成/清洗清单和端到端训练入口。
- Laya 与 Jev 在同一机器、同一网络条件、同一 prompt/sample、同一计时边界下的直接测量。
- 真实中文 agent 工具输出上的关键证据误删率、任务成功率、缓存影响与总成本数据。
