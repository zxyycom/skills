---
title: 统一配置下保持调查来源组逐源查询
id: 261110-preserve-source-query-boundaries-with-shared-config
status: archived
alignment: aligned
createdAt: 2026-11-10T08:43:22Z
purpose: 跨仓库发现继续复用单源语义，统一配置装载与来源组路由各守边界。
background: 来源查询原先独占本地配置；资源提示需要所有业务命令装载同一项目与本地设置，显式定位也须验证策略。
decision: 来源组仅路由 list/search，保留逐源结果与预算；配置发现交统一配置，显式定位只抑制路由。
tags:
  - investigation-report
  - query-composition
relations:
  - type: 修订
    target: 261109-query-investigations-from-local-source-groups
    summary: 保留逐源查询，改由统一配置装载并分离显式定位
---

## 目的

让 `investigation-report`（`skills/investigation-report/`）跨仓库发现报告时继续复用单集合查询，使每个结果的来源、筛选、窗口和覆盖可独立解释。来源选择归于调用工作区，与共享 skill 安装分离。

## 背景

前序判断已用于来源组查询：只从调用目录的本地配置发现设置，显式定位与配置选择互斥，其他业务命令不装载配置。它保证了明确的单源／多源选择，但把配置装载和路由绑定在一起。

[资源诊断决策](261110-bounded-investigation-resource-advisories.md)采用统一项目／本地配置，所有业务命令需要读取策略。因此修订装载与显式定位边界，同时保留逐源查询的主体方向；配置发现不应再由多源查询独占。

## 决策

- 采用: 来源组只为 `list` 与 `search` 编排“key → 有序来源数组”，逐源执行现有单集合查询，按来源保留原结果。筛选、limit、offset、预算、顺序和覆盖属于每次单源调用，不增加全局排序、去重、分页或覆盖汇总。
- 所有业务命令通过统一工作区配置装载器取得设置；来源组路由另行选择。显式 root 或调查目录选单源入口，仍验证统一设置，仅与来源组 key 互斥。配置发现和合并由 [来源配置契约](../../../skills/investigation-report/references/source-selection.md#配置发现与合并)维护。
- `sources` 将 key 映射到有序来源数组，`defaultKey` 选择默认组；每源声明 root 和调查目录。相对 root 在所属配置文件目录解析，调查目录相对该源 root；来源配置不属于 skill 分发输入，查询保持只读。
- 无来源组时使用单源查询；显式请求缺失配置、未知 key 或已有非法配置时明确失败。某源失败后继续读取其余源，交付整体失败与逐源结果；命中后按所属来源通过 `show` 回读。候选与写命令使用配置策略，但不按来源组路由。
