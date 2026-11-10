---
title: 独立配置调查报告默认写入来源
id: 261110-configure-default-investigation-write-source
status: active
alignment: aligned
createdAt: 2026-11-10T15:16:18Z
purpose: 减少重复指定写目标，同时保持读取范围与写入选择独立。
background: 多源读取已有默认 key，写入仍须反复指定单源；将查询默认直接用于写入会扩大意外写入风险。
decision: 新增可选 defaultWriteKey，仅默认路由到唯一来源，显式定位优先，缺省保持工作区写入。
tags:
  - investigation-report
  - source-selection
relations: []
---

## 目的

让 Investigation Report（`skills/investigation-report/`）在读取多个集合时，将日常写入稳定地指向一个集合。

## 背景

命名来源已支持组合读取，`defaultKey` 负责默认读取；未指定写目标时使用当前工作区。跨集合发现、向固定集合写入的工作习惯因此需要反复传入单源 key。独立的写入默认可以减少重复定位，并使读取范围变化与写入位置各自演进。

## 决策

- 采用: 增加可选的 `defaultWriteKey`，复用现有来源定义与配置合并规则，独立选择写操作及预检的默认单源。显式 key 或工作区／调查目录优先，未配置时保持当前工作区行为。
- 读取继续使用 `defaultKey`。帮助与业务操作使用同一选择规则，并展示读写默认标记，使调用者能直接核对目标。

配置合法性与帮助展示由[来源配置与帮助](../../skills/investigation-report/references/source-selection.md)承接，路由及单源写入约束由 [CLI 操作契约](../../skills/investigation-report/references/cli-operations.md)承接。
