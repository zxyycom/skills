---
title: 区分逻辑资源入口与精确文件身份
id: 261118-separate-logical-resource-entry-from-exact-file
status: candidate
alignment: ~
createdAt: ~
purpose: 让持续演进的资源可发现，同时保持精确选用与证据不漂移。
background: 逐项登记过程文件扩大维护范围，而可变目录不能证明确切文件或历史内容。
decision: resource-records 将可变逻辑入口与精确文件身份分开，按用途所需精度登记和选择。
tags:
  - resource-records
relations: []
---

## 目的

让 `skills/resource-records/` 能发现持续演进的资源，同时保留需要精确复用的文件身份与可回查证据。

## 背景

实验批次等逻辑对象可能跨目录持续增加内容；逐个登记过程文件会扩大维护范围并重复原始事实。目录或说明入口的内容会变化，不能作为确定文件、历史调用或某时刻完整内容的证明。

## 决策

- 采用：在 resource-records 中区分可变逻辑入口与精确文件身份。入口用于定位和理解逻辑对象，不要求内容中的每个文件成为资产；需要固定文件的选择、复用或追溯时，另行登记并引用确切版本和成员。
- 入口和精确引用服务不同精度的用途；入口内容演进不自动改变已有精确选择。原始调用、反馈及媒体保管由各自 owner 负责，入口路径或记录本身不证明内容、许可、可用性或备份。
