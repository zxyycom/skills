---
title: "OpenAI Decisions API：官方接口、接入与限制"
id: "261009-openai-decisions-api-contract"
formedAt: "2026-10-09T05:57:54Z"
question: "OpenAI Decisions API 公测的调用协议、类型语义、输入限制与费用条件是什么？"
tags:
  - "decision-models"
  - "lightweight-judgment"
  - "model-api"
relations: []
---

## 形成时背景

OpenAI 于 2026-10-06 发布 Decisions API 公测，形成了与 Jev 相邻的托管类型化判断入口。本调查核对公测时的原生协议、试用方式及限制。[官方 Changelog](https://developers.openai.com/api/docs/changelog)

## 调查目的

回答“在哪里试、怎样调用、官方承诺什么”。相对 Jev 的效果、社区测量与选型分析由[社区评测与讨论](openai-decisions-jev-comparison.md)承接。

## 调查范围与依据

本报告保存 **2026-10-09（Asia/Shanghai）** 的官方文档认识，“当前”均指该时点。来源为 Changelog、[Decisions Guide](https://developers.openai.com/api/docs/guides/decisions)、[HTTP Reference](https://developers.openai.com/api/reference/resources/decisions/methods/create)、计费与数据控制说明；同日补充核对选项数、图片数及外链描述。

本轮未安装 SDK 或发送 API 请求，未产生费用；示例仅通过本地 JSON 语法检查。账号权限、实际响应、延迟与账单尚待验证，采用前须重核易变契约。

## 调查结果与边界

### 官方定位

Decisions 将文字、图片或图文混合输入转换为类型化判断，public beta 仅支持 `gpt-6-luna`。官方宣传约比 Responses API 快 10 倍；这是相对 Responses 的说法，不是 Jev 对照或目标环境的延迟保证。[Guide](https://developers.openai.com/api/docs/guides/decisions)

| 类型 | 使用场景 | 结果含义 |
| --- | --- | --- |
| `predicate` | 某个条件是否成立 | `probability`，条件成立的估计概率 |
| `choice` | 从互斥类别中选一项 | 选中值、各选项概率及单独的 `confidence` |
| `score` | 按有序档位评价 | 从 0 开始的档位索引的概率加权平均，可落在两档之间；另有分布与 `confidence` |

三种类型适合分类、路由、过滤和排序。自由文本解释、自定义 JSON 抽取及工具参数生成使用 Responses 的相应能力。[Guide](https://developers.openai.com/api/docs/guides/decisions)

### 试用入口与最小调用

| 入口 | 准备方式 |
| --- | --- |
| Playground | 从 [Guide](https://developers.openai.com/api/docs/guides/decisions) 的 Playground 链接进入，先试虚构输入 |
| 官方 SDK | Python SDK 至少 `3.26.0`、JavaScript SDK 至少 `7.30.0`；调用 `client.decisions.create(...)` |
| 原生 HTTP | `POST https://api.openai.com/v1/decisions`；使用 API Bearer key 和 JSON 请求体 |

SDK 版本以 Guide 为据，HTTP 字段以 [Reference](https://developers.openai.com/api/reference/resources/decisions/methods/create) 为据。密钥在仓库外注入；使用中转服务时另核原生端点支持。

以下为本轮编写的虚构工单示例，只判断处理部门：

```json
{
  "model": "gpt-6-luna",
  "input": "同一订单扣了两次款，请帮助核实。",
  "questions": [{
    "type": "choice",
    "name": "route",
    "instructions": "选择处理部门；信息不足时选择人工复核。",
    "choices": [
      { "value": "billing", "description": "扣款、账单和退款问题。" },
      { "value": "technical", "description": "软件功能故障。" },
      { "value": "review", "description": "信息不足或范围外，交人工复核。" }
    ]
  }]
}
```

结果在 `answers` 数组中按问题排序；可选 `name` 建议逐题唯一。消费前校验类型与合法值，将 `refusal`、缺项、HTTP 错误及超时导向失败或复核分支。`review` 候选仍需验收不确定性识别效果。[Reference](https://developers.openai.com/api/reference/resources/decisions/methods/create)

### 模态与容量限制

| 项目 | 当前公开契约 |
| --- | --- |
| 单个 `choice` | 2～255 个唯一选项；“其他”也占一个位置 |
| 图片数量 | 每次请求合计最多 128 张 |
| 消息输入 | `user` 消息中的 `input_text`、`input_image`；原生音频、文件、工具调用和 item 引用不受支持 |
| 多问题 | 可共享输入；独立问题一起提交，依赖前一答案的问题分后续请求 |
| 问题数、评分档位、token 上限 | 本次读取的专属 Reference 未明列完整硬上限，使用前需针对负载核对 |

选项与输入限制见 [Reference](https://developers.openai.com/api/reference/resources/decisions/methods/create)，问题组织见 [Guide](https://developers.openai.com/api/docs/guides/decisions)。255 指每题同时比较的候选数，集合可随请求改变；Decisions 的稳定预算须单独确认，不能沿用普通 Luna 上下文规格。

**图片外链契约冲突：**Reference 允许公开 HTTP(S) URL，Guide 要求内联 Base64 data URL；均排除 file ID。试用建议采用共同认可的内联路径，外链待实测。[Reference](https://developers.openai.com/api/reference/resources/decisions/methods/create)、[Guide](https://developers.openai.com/api/docs/guides/decisions)

### 费用与数据条件

标准输入价为 **$0.10/百万 token**，输出及缓存读写不收费；区域处理溢价和长上下文倍率另计。预算按返回的全部 `usage.input_tokens` 核算。[专属价格](https://developers.openai.com/api/docs/guides/decisions) API 与 ChatGPT 订阅分别计费。[计费说明](https://help.openai.com/en/articles/9039756)

默认滥用监控日志可保留至 30 天；符合资格的客户可使用 ZDR，但缓存及图片安全检查存在条件和例外。区域可用与区域推理是不同条件，首次试用宜使用虚构或经授权脱敏数据。[数据控制](https://developers.openai.com/api/docs/guides/your-data)

### 试用与验证边界

建议先以少量虚构样例核对账号权限、三种结果、拒绝处理、usage 和账单，再用人工标注数据设置阈值；效果验收见社区篇对照方案。实际限制与图像质量尚未验证；GA、模型、协议、价格或数据政策变化时，重新核对对应官方来源。
