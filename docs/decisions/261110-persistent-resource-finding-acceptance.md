---
title: 按来源与对象持久接受资源诊断
id: 261110-persistent-resource-finding-acceptance
status: active
alignment: aligned
createdAt: 2026-11-10T15:55:54Z
purpose: 让维护者保留已复核资源并减少重复提示，同时保留完整观察与覆盖事实。
background: 重复诊断缺乏逐对象处置，关闭规则会遮蔽其他对象。
decision: 允许按真实来源、规则和明确对象持久记录复核理由，直到显式撤销；不改变检测或覆盖。
tags:
  - investigation-report
  - resource-management
relations: []
---

## 目的

复核后的资源可因证据用途继续保留；重复呈现同一建议不应迫使维护者关闭整个规则。

## 背景

资源诊断已有有界读取和完整结构化结果，但不同来源可含相同相对路径。全局关闭规则会掩盖其他对象，按路径全局忽略又会跨来源误匹配。副本信号针对完整组而不是其中单个文件。

## 决策

- 采用: 在 `investigation-report`（`skills/investigation-report/`）的调用工作区统一配置中，由维护者以实际来源、规则、明确对象和理由记录复核；副本须明确匹配完整成员集合。
- 接受持续有效直至显式撤销，不引入内容绑定、过期或变化监控；后续复核由维护者决定。
- 保留全部诊断事实与覆盖状态，结构化结果标注接受及理由，终端主要呈现未接受项。覆盖缺口不可接受，诊断处置不影响发布资格与 readiness。
- 具体字段、合并及边界由 [资源诊断](../../skills/investigation-report/references/resource-review.md)维护。
