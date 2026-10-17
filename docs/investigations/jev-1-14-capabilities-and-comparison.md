---
title: "Jev 1.14：新版能力、实验限制与 Decisions 对比"
id: "261015-jev-1-14-capabilities-and-comparison"
formedAt: "2026-10-15T09:02:40Z"
question: "Jev 1.14 的版本、图像、Box 和长上下文能力有何变化，公开证据如何影响与 Decisions 的比较？"
tags:
  - "decision-models"
  - "lightweight-judgment"
  - "model-api"
  - "model-evaluation"
relations:
  - type: "复查"
    target: "261009-openai-decisions-jev-comparison"
    summary: "新版与实验能力开放后复核模型对比结论"
---

## 形成时背景

TypeSafe 于官网日期 **2026-10-14** 发布 Jev 1.14，同时开放图像、Box 和长上下文实验能力。本轮以[10 月 9 日的 Jev 1.13 对照](openai-decisions-jev-comparison.md)为背景，复查新版的功能、试用条件和相对 Decisions API 的采用价值。[发布公告](https://typesafe.ai/blog/jev-1-14)

## 调查目的

说明新版改了什么、怎样试用，以及官方与社区证据能够支持多强的效果判断。

## 调查范围与依据

本报告保存 **2026-10-15（Asia/Shanghai）** 的公开资料认识，“当前”均指该时点。读取 TypeSafe 公告及 Models、Images、Box、Choice 文档，核对 Decisions Guide／Reference；新版评测检索后，实际审阅 Model Fatigue 现有对照与 Hacker News 新版讨论，链接随结果列出。

厂商说法、作者测量与综合判断分别标明；未调用 API、上传图片或独立复现，账号可用性与账单待验证。采用前须重核版本与易变契约。

## 调查结果与边界

### 结论摘要

**更新应分为 1.14 模型改进与跨版本实验能力开放。** 官方预计多语言收益最大；图像、长上下文同时开放给 1.13／1.14，Box 为 1.14 专属。

原生图像与定位扩大了 Jev 可试用范围，削弱 Decisions 的功能差异化；实际质量、校准与速度仍缺同任务新版对照。

### 新版变化与开启方式

| 变化 | 适用范围 | 使用含义 |
| --- | --- | --- |
| 模型改进 | 1.14 | 官方称多数能力小幅改善，预计多语言提升最大 |
| 图像输入 | 1.13、1.14 | 请求带 `TypeSafe-Danger-Zone-Images: true`；图片可进入 state、问题说明和候选条件 |
| Box 定位 | 仅 1.14 | 使用同一图像开关；每题输出一个边界框和 confidence |
| 262K 上下文 | 1.13、1.14 | 带 `TypeSafe-Danger-Zone-Long-Context: true`，整次与单题上限均为 262K |
| 排障数据共享 | 独立 opt-in | 可选择分享查询协助调试；与模型及实验功能分开授权 |

依据：[发布公告](https://typesafe.ai/blog/jev-1-14)、[Images](https://docs.typesafe.ai/images)、[Models](https://docs.typesafe.ai/models)。

图像与 Box 尚未达到官方生产可靠性标准，协议和效果可能变化。长上下文单价不变，但官方称更慢且准确率下降，宜按负载开启。[实验功能说明](https://docs.typesafe.ai/images)、[长上下文说明](https://docs.typesafe.ai/models#long-context)

### 试用入口与必要限制

- **入口：**从官网进入 API console；原生端点为 `POST https://api.typesafe.ai/v1/systemone`。
- **版本：**对照时固定 `jev-1.13.0` 和 `jev-1.14.0`，记录响应的 `model` 与 usage。当前 `jev-preview` 指向 1.14，`jev-latest` 仍指向 1.13；公告计划发布约一周后更新后者。
- **费用：**两版均为 **$0.042／百万输入 token，输出免费**；图片也计入输入。实际限流查看组织 console。
- **默认容量：**state 加全部问题合计 64K；state 加任一问题在 32K 内。问题数无独立上限，受这两项预算约束；单个 Choice 最多 255 个候选。

依据为[公告](https://typesafe.ai/blog/jev-1-14)、[Models](https://docs.typesafe.ai/models)与[Choice](https://docs.typesafe.ai/primitives/choice)；升级后须重验业务阈值。

图片与定位分别遵循以下契约：

- **图片准备：**在 `assets` 登记，以唯一字符串引用；官方推荐 multipart。JSON Base64 的 `data_base64` 不带 `data:` 前缀。共享图片优先放 state，重复引用展开仍占预算。
- **图片容量：**仅静态 PNG/JPEG，单图最多 16 MiB；宽高各 256～1568 像素，总像素 78,400～2,458,624。HTTP body、处理后的全部图片、引用展开后的请求各限 32 MiB；任一图片被拒，整次请求失败。[图片契约](https://docs.typesafe.ai/images)
- **定位结果：**Box 输出 `top`、`bottom`、`left`、`right` 四个 0～1 归一化边界及 confidence。目标不存在也返回框，无“未找到”结果；先用 Noul 验证存在，再消费框。多目标分题或分区，小目标、裁切遗漏及阈值分别验收。[Box 契约](https://docs.typesafe.ai/primitives/box)

### 效果证据：哪些属于新版

| 来源 | 实际材料 | 可支持的判断 |
| --- | --- | --- |
| [TypeSafe 内部评测](https://typesafe.ai/blog/jev-1-14) | 厂商自测，外部对手只选开放权重模型，并承认可能偏向自家模型 | 支持其“小幅改进”发布定位，未直接对照 Decisions |
| [官方 Box 小实验](https://docs.typesafe.ai/primitives/box#check-a-box-with-edge-questions) | 36 个已知裁切不完整的画作 crop；分四条边问 Noul 检出 30 个，单题完整性检查检出 26 个 | 值得验证分解检查；不是一般定位准确率 |
| [Model Fatigue](https://modelfatigue.news/decision-models/) | Decisions 同晚对照测于 10-07，Jev 为 1.13 | 保留为历史基线，不能改标为 1.14 成绩 |
| [Hacker News 新版讨论](https://news.ycombinator.com/item?id=50095353) | 工作负载采用反馈与模型比较自述，缺少可核对版本、数据和原始记录 | 作为使用场景与评测需求信号 |

这些材料支持能力变化与试验设计，尚不足以排名 1.14 相对 Decisions 的准确率、校准或延迟；中文收益也待独立验证。

### 与 Decisions 的当前比较

| 维度 | Jev 新开放能力 | OpenAI Decisions |
| --- | --- | --- |
| 图像 | 原生支持，需实验开关 | 原生支持，最多 128 张／请求；接口仍为 public beta |
| 定位输出 | 1.14 提供原生 Box | 本轮 Reference 列出 predicate、choice、score |
| Choice 候选 | 最多 255 个 | 2～255 个 |
| 多题批量 | 无独立题数上限，受 token 预算限制 | 每次 1～200 题 |
| 基础输入价 | $0.042／百万 token | $0.10／百万 token，区域与长输入条件另计 |

Jev 依据见上述来源，OpenAI 依据为 [Guide](https://developers.openai.com/api/docs/guides/decisions) 与 [Reference](https://developers.openai.com/api/reference/resources/decisions/methods/create)。后者还支持多角色消息、函数／custom tool 调用轨迹作为评价输入；Decisions 本身不执行工具。

**采用判断：**按同任务质量、延迟和总费用比较，并计入实验状态、图片处理与额外验证成本；单价或最大批量不能代替链路验收。

### 建议验证与未决项

如继续试用，优先分开检验：

1. **文本：**固定 1.13、1.14 和 Decisions 的真实响应版本，用相同中文／英文标注及示例；开发集分别调阈值，留出集比较错误、拒判、人工回退、校准、p50/p95 和费用。
2. **图像：**分类、目标存在、Box 定位分别验收，覆盖目标缺失、小目标及裁切遗漏；普通视觉模型对照固定输出要求与推理设置。
3. **长输入：**对比精简证据与逐步加噪长输入，记录质量、延迟和服务错误，区分容量接收与内容利用。

别名切换、实验功能转正式、协议更新或可复核的新版同场测评出现时，重新核对对应判断。
