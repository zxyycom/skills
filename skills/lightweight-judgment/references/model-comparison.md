# 模型对照与选择

本文帮助首次选型、升级或比较替代方案：先按需求确定候选，再核对基础差别与效果证据。基础规格核对日期为 **2026-10-17**；历史评测按各自日期与任务条件解释。

## 按需求确定候选

以下为依据后文规格与证据形成的建议：

- **已有合格文本流程**：以当前实际型号为基线，升级或替换时比较同任务收益与切换开销。
- **新中文／多语言任务**：可优先把 JEV 1.14 列入试验；多语言改进是官方预期，目标任务收益仍需验证。
- **图片或定位任务**：原生 Box 需要 JEV 1.14；题目局部图片需要支持它的 JEV 通道；共享图片分类可比较 JEV 与 Decisions。开启方式和作用域由[模态合同](protocol-adapters.md#图片节点与作用域)承接。
- **OpenAI 接入或供应商备选**：可考虑 Decisions，并分别验收所选通道的质量与[拒答处理](protocol-adapters.md#完成度与逐题拒答)；直接 OpenAI 与 OpenRouter 路由使用不同合同。
- **成本或延迟优先**：JEV 的基础输入价较低，Decisions 有特定负载更快的测量；选择依据是同任务总费用与耗时分布。已有用量和耗时可用 [stats](statistics.md)分层核对。

## 基础差别

JEV 1.13 是下节历史测量的文本基线；[1.14 公告](https://typesafe.ai/blog/jev-1-14)将新版定位为小幅整体改进、多语言收益预期最大，并增加 Box。图像与长上下文实验能力则适用于两版。OpenAI 此处指专用 Decisions API 的 `gpt-6-luna`，处于 public beta；普通 Responses API 是另一效果与计费对象。

| 维度 | JEV 1.13／1.14 | OpenAI Decisions（`gpt-6-luna`） |
| --- | --- | --- |
| 文本判断 | 原生 state/questions，Choice、Score、Noul | 原生 input/questions，choice、score、predicate；本 CLI 从 JEV 载体编译 |
| 图片与定位 | 两版均支持实验图片，可放共享 state 或题目局部；Box 仅 1.14 | 本 CLI 支持共享 state 图片；局部图片与 Box 整次拒绝 |
| 每次题数 | 无独立题数上限，受 token 预算约束 | 1–200 题 |
| 上下文 | 整次 64K／单题 32K token；实验长上下文开启后均为 262K | 原生容量按 Decisions 专用契约核对；CLI 字符上限不是 token 窗口 |
| 原生服务基础输入价 | $0.042／百万 token，输出免费 | $0.10／百万 token，无额外输出或缓存读写费用；区域处理与长输入加价另计 |

规格依据：[TypeSafe Models](https://docs.typesafe.ai/models)、[OpenAI Decisions Guide](https://developers.openai.com/api/docs/guides/decisions)与 [Reference](https://developers.openai.com/api/reference/resources/decisions/methods/create)。JEV 图像、Box 与长上下文的实验状态影响采用；官方说明长上下文更慢且准确率下降。

模型与 adapter 分别决定判断能力和接入方式；实际调用以[接入合同](protocol-adapters.md#选择合同)为准。表中价格限于核对日期的原生服务，OpenRouter 按所选路由报价；总费用还受 tokenizer、转换模板、图片、题数和复核开销影响。采用前重核别名、报价与实验状态，记录响应的实际 model。

## 效果、校准、延迟与成本证据

[Model Fatigue](https://modelfatigue.news/decision-models/) 于 **2026-10-07** 从柏林在同晚逐次调用两家原生服务，比较 BANKING77 的 3,080 条消息，每条提供五个检索示例；JEV 为 1.13。以下是作者直接调用服务的测量，本 CLI 转换后的表现须另测：

| 指标 | JEV 1.13 | OpenAI Decisions |
| --- | --- | --- |
| 分类正确率 | 93.9% | 93.5% |
| confidence 的 ECE（校准误差，越低越好） | 0.035 | 0.041 |
| 客户端 p50／p99 | 242／386 ms | 239／594 ms |
| 每千次估计费用（单价 × 报告用量，非账单） | $0.078 | $0.114 |

该组分类差异的配对区间跨零，结果接近而优势未确立；中位耗时接近，JEV 尾部更短、估计费用更低，均限于该负载。

[StackToHeap 的 2026-10-08 对照](https://stacktoheap.com/blog/2026/10/08/jev-the-decisions-strike-back/)使用同一数据集，但提示与样本不同，JEV 对照来自历史运行：Decisions 的平均耗时更低、选中标签概率的分箱 ECE 更好，JEV 的整体分布 Brier 分数更好。速度与校准的排序因此须保留测量条件。

这些测量集中于一个文本分类数据集，JEV 1.14、中文、多题和图像的同任务对照仍待补足。正式采用按[目标任务验证](jev-characteristics.md#按目标任务验证)分别检验每个实际型号的错误、覆盖与复核比例，独立确定 confidence、Score 和概率阈值；试验外发与费用仍遵循原任务授权。
