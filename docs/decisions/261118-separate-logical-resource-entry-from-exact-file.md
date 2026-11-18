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

- 采用：候选方向是按用途所需的精度建立身份。查一批持续演进的内容时，登记逻辑入口；固定文件的复用、选择和追溯引用确切版本及成员。这样可以增加过程文件而不改变已有的精确选择。日常登记按 [Resource Records](../../skills/resource-records/SKILL.md) 执行。
- 原始调用、反馈及保管证据留在形成处。入口提供回查位置，不能代替对具体内容、许可或备份的核验。
