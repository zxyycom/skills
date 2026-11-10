---
title: 以可组合来源 key 统一调查访问与发现
id: 261110-compose-investigation-source-selection
status: active
alignment: aligned
createdAt: 2026-11-10T13:17:54Z
purpose: 复用来源定义，让只读访问按源独立执行，并在帮助中直接发现选择范围。
background: 原来源组只编排 list/search，回读需搬运路径，来源组合重复且 key 对应关系不可直接发现。
decision: key 表达可组合来源选择，只读逐源追加，写入限明确单源，帮助展示配置解析上下文。
tags:
  - cli-help
  - investigation-report
  - query-composition
relations:
  - type: 修订
    target: 261110-preserve-source-query-boundaries-with-shared-config
    summary: 保留逐源语义与统一配置，扩展为可组合来源选择及读写路由
---

## 目的

让 `investigation-report`（`skills/investigation-report/`）以命名来源统一发现、复用与访问，降低组合配置和命中回读的定位成本，同时保持跨仓结果与写入授权的边界。

## 背景

前序已分开统一配置与来源组路由，但只覆盖 `list/search`。命中回读仍须搬运路径，重复组合须复制来源定义，key 的含义也需另查配置。扩展来源选择可复用既有单源能力；跨仓统一身份或关系图则会引入另一套解析责任，超出当前访问需求。

## 决策

- 采用: 以 key 命名一个集合或有序组合，复用调查来源配置。路径保留定义层基准，来源身份结合工作区与调查目录；去重身份与执行路径分开，使别名识别不改变符号链接路径的实际目标。配置发现仍归调用工作区，来源选择不会递归切换配置上下文。
- 只读语义：所有业务只读操作使用同一选择模型，各源保留自己的身份、关系图、预算与错误。相同 ID 和部分失败都可如实返回，无须引入跨仓消歧；汇总退出状态与逐源结果分别承担机器判断和具体诊断。
- 写入边界：写操作及预检必须选定单源，默认查询 key 不重定向写入。这样可扩展读取范围，同时维持当前工作区写入的可预期性。
- 帮助发现：基础帮助附当前配置解析与来源定位，使 key 可直接发现。帮助只读取配置与定位所需元数据，不打开索引或扫描报告；配置错误仍能得到基础帮助与诊断，来源可用性由业务操作核验。

来源定义、展开与帮助展示由[来源配置与帮助](../../skills/investigation-report/references/source-selection.md)承接，命令路由及结果由 [CLI 操作契约](../../skills/investigation-report/references/cli-operations.md)承接。本决策适用于 Investigation Report；Decision Records 与 version 保持各自行为。
