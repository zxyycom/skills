---
title: 为 AI-ready 文档建立主承诺检查
status: active
alignment: aligned
createdAt: 2026-08-29T16:09:38Z
purpose: 让 AI-ready 文档从入口信号恢复主承诺，并以正文结构和结果检查是否兑现预期。
background: 原 prompt-optimize 的主承诺检查与当前 AI-ready 内容组织方向共同要求入口承诺、正文重心和具体规格保持一致。
decision: 在 AI-ready 文档流程中建立主承诺，以目标方向组织内容并用正文主题、层级、篇幅、结论和验收验证兑现情况。
tags:
  - ai-ready-docs
relations:
  - type: 归并
    target: 260701-add-document-main-promise-check.md
  - type: 归并
    target: organize-ai-ready-docs-around-main-promise.md
---

## 目的

- 让 AI-ready 文档正文兑现入口建立的预期，并能识别整体重心偏移。
- 让当前 `skills/ai-ready-docs/` 以统一的主承诺判断指导内容组织、具体规格和内容 owner。

## 背景

- 入口信号能够建立文档的中心对象、预期展开方向和预期结论或操作结果；仅靠内容 owner 判断不足以识别正文重心偏离。
- AI-ready 文档需要同时保持目标方向和定义或检验所需的精确规格，不能为统一表达形式而牺牲语义保真。

## 决策

- 采用: 在 `skills/ai-ready-docs/` 的流程中，从标题、开头、适用范围、触发条件、前置条件、资源名、字段或输入输出恢复文档主承诺。
- 采用: 用正文主题、层级、篇幅、结论、验收或校验方式检查是否兑现入口承诺；背景、例外、历史、实现细节或示例压过主承诺时，移动、降级、删减偏离内容或收窄入口承诺。
- 采用: 默认用目标状态、必要约束、推荐路径和验收方式组织主线，再保留定义或检验主承诺所需的具体规格；内容 owner 判断不代替主承诺和重心判断。
- 采用: 无法确认语义等价时保留原规则并暴露不确定性，不为统一正负形式而改写。
- 不采用: 继续由已退出当前默认路径的 `prompt-optimize` 单独承接主承诺检查，或只强化 owner 规则。
