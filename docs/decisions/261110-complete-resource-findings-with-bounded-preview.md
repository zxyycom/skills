---
title: 调查资源工作有界而机器结果完整返回
id: 261110-complete-resource-findings-with-bounded-preview
status: active
alignment: aligned
createdAt: 2026-11-10T11:16:43Z
purpose: 让机器调用取得完整资源问题清单，同时保持日常终端提示可读和扫描成本可控。
background: 前序将结果条数也限制在诊断数据层，机器调用可能丢失低优先级问题；输出展示与检查工作量需要分开约束。
decision: 维持有预算的非阻断资源检查，结构化结果完整返回，终端预览独立限制。
tags:
  - investigation-report
  - resource-management
  - validation-boundaries
relations:
  - type: 修订
    target: 261110-bounded-investigation-resource-advisories
    summary: 保留有界检查，改为仅限制终端预览而完整返回诊断
---

## 目的

让 `investigation-report`（`skills/investigation-report/`）在日常候选查看、发布和检查中主动提供资源信号，维护者和程序均可恢复本次发现的全部问题，并按证据用途决定保留、节选或共享。

## 背景

前序已采用统一配置和有预算的非阻断诊断，也把结果条数限制在诊断数据层。该方向控制了扫描成本与展示量，但仅提供汇总和有限明细时，机器调用会失去部分已发现问题，难以完成批量分析。

扫描工作量、结构化事实和终端预览承担不同责任：读取及文件数限制控制成本，终端只显示重点，JSON 则保存本次实际产生的完整问题清单。

## 决策

- 采用: 保留默认接入候选查看、发布及检查的只读、非阻断资源诊断，覆盖体积、数量、类型、完整副本及内部重复性信号。资源合法性与历史保真继续由原契约约束，提示不替代证据价值判断。
- 同一 CLI 使用统一项目／本地配置，来源组与资源策略分别装载；配置装载与多来源路由分离，显式定位仍加载策略。发现、合并及字段规则由 [CLI 契约](../../skills/investigation-report/references/cli-operations.md#统一配置)维护。
- 内容类型与压缩采用现成库，经安全文件边界取得有限输入。压缩率按文件大小分档作为重复信息启发值，小文件全文、大文件抽样；副本须经完整字节确认，共享引用不作为副本。
- 单次读取与文件数有上限，关闭、抽样、预算不足和读取失败均可观察。JSON 完整返回本次已产生的全部 findings，不另设输出条数上限；扫描未完成与输出截断分别判断。
- 终端预览独立限制，优先展示重要问题并引导回读完整 JSON；分类汇总与完整明细一致。参数、排序、预览及覆盖含义由 [资源诊断](../../skills/investigation-report/references/resource-review.md)维护。
