---
title: 以主题归属锚定调查资源
status: active
alignment: aligned
createdAt: 2026-08-17T08:03:12Z
purpose: 让集中存放的调查资源拥有可从路径恢复的稳定主题 owner，同时允许多份报告安全复用同一文件。
background: 统一资源目录只表达集中存放，任意嵌套路径没有声明由哪个主题维持资源，也无法区分 owner 引用与外部共享引用。
decision: 被引用资源的路径确定唯一 owner 主题；owner 必须参与当前引用，其他报告可以复用且不改变归属。
tags:
  - investigation-report
relations:
  - type: 拆分
    target: attach-verifiable-resources-to-investigation-reports.md
---

## 目的

- 让统一 `_resources/` 继续集中保存调查材料，同时从资源路径直接恢复负责维持该资源的主题。
- 让同一资源可以支持 owner 主题内的多份报告或其他主题，不因新增引用者复制、移动或重新命名文件。
- 让资源归属只有一个事实来源，不增加 manifest、共享注册表或反向引用清单。

## 背景

- 统一资源目录解决材料散落问题，但目录本身没有说明哪个主题负责维持具体资源。
- 报告 Markdown 已经声明精确引用关系；主题 ID 可以作为资源路径前缀，无需新增人工归属字段。
- Owner 只声明稳定归属，不表达排他访问。把 owner 误作唯一引用者会让跨报告复用退化为复制文件或改写身份。

## 决策

- 采用: 资源 ID 使用 `<category-id>/<semantic-slug>/<resource-subpath>`；前两段映射到 owner 主题 `<category-id>/<semantic-slug>.md`，`resource-subpath` 至少包含一个文件名并允许任意层合法嵌套。
- 采用: 报告继续逐字使用 `../_resources/<resource-id>`。现有资源名称、规范路径、根目录收口和文件身份规则继续适用，owner 结构不建立第二套链接语法。
- 采用: 资源一旦被报告引用，owner 主题必须存在，并且 owner 主题至少一份报告必须引用该资源。满足 owner 引用后，其他报告或主题可以引用同一文件，不改变 owner。
- 采用: 不从内容、哈希或外部引用者集合猜测 owner，也不自动转移归属。不符合 owner 结构的资源由维护者显式移动并更新报告链接。
