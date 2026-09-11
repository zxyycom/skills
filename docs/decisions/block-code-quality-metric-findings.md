---
title: 让代码质量指标 finding 阻断项目门禁
id: 260911-block-code-quality-metric-findings
status: active
alignment: aligned
createdAt: 2026-09-11T02:09:17Z
purpose: 让文件与函数指标发现成为必须在验收前处置的门禁结果。
background: 当前指标已清零，继续仅作 advisory 会允许新的质量债务无处置进入主线。
decision: 文件与函数指标统一使用 blocking policy，保持既有阈值与空 waiver。
tags:
  - project-tooling
relations:
  - type: 修订
    target: 260909-use-native-vibe-gate-controls
    summary: 将代码指标从 advisory 升级为阻断
---

## 目的

- 防止新的超长文件、函数密度、圈复杂度、嵌套深度或参数数量 finding 在未处置时进入主线。
- 让本地与 CI 的同一项目 Gate 对代码质量指标使用一致的失败语义。

## 背景

- 文件与函数指标此前是 required advisory：测量不可用或意外不适用会阻断，但可信 finding 只形成 warning。
- 责任驱动的代码质量重构已在不提高阈值、不增加 waiver 的前提下把两类 finding 清零，因而可以直接启用阻断而不建立历史基线或过渡例外。
- 编码规范仍把体量和复杂度指标定义为责任复核信号；阻断的含义是信号必须在验收前得到处置，不是把每条信号自动判为代码缺陷或要求机械拆分。

## 决策

- 采用: `file-metrics` 和 `function-metrics` 的顶层及全部 code area 统一使用 blocking policy；任何未豁免 finding 都使对应 Check failed，并由既有 aggregate 规则阻断项目 Gate。
- 采用: 保持现有文件选择、各区域阈值和空 finding waiver 不变，不用放宽阈值、批量豁免或隐藏输入作为启用阻断的配套手段。
- 采用: 每条新 finding 先按编码规范复核现实责任；需要重构时围绕 owner 和局部推理边界整改，信号不对应结构问题时只能由相应 owner 显式调整长期政策后解除阻断。
- 采用: scanner unavailable 与意外 not-applicable 继续 fail closed，不能把测量失败降级为没有 finding。
