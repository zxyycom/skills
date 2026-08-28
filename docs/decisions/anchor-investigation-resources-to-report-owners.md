---
title: 以报告归属锚定调查资源
status: active
alignment: aligned
createdAt: 2026-08-28T10:12:53Z
purpose: 让集中存放的调查资源由可从路径恢复的唯一 owner 报告负责，同时允许其他报告安全复用。
background: 资源 owner 当前由 topic 路径推导，但新集合不再保留主题容器；每份报告的 Investigation ID 已成为稳定身份。
decision: 被引用资源使用 Investigation ID stem 作为路径前缀确定唯一 owner 报告；owner 必须直接引用，其他报告可复用而不改变归属。
tags:
  - investigation-report
relations:
  - type: 修订
    target: anchor-investigation-resources-to-topic-owners.md
---

## 目的
- 让 `_resources/` 中每个被引用资源的维护归属可由路径直接恢复到唯一报告。
- 保留同一资源被多个报告引用时不复制、移动或重命名资源的能力。
- 让归属仍由报告链接和规范路径共同表达，不新增共享注册表或反向引用清单。

## 背景
- 统一资源目录只表达集中存放，原 `<category-id>/<semantic-slug>/` 前缀则依赖已退出的 topic ID。
- 新模型中 Investigation ID 是每份报告的稳定身份，其去除 `.md` 的 stem 可以作为资源目录的唯一 owner 前缀。
- Owner 只说明稳定维护责任，不等同于唯一引用者；将复用者变成 owner 会破坏路径事实的单一性。

## 决策
- 采用: 资源 ID 使用 `<investigation-id-stem>/<resource-subpath>`；首段映射到 owner Investigation ID `<investigation-id-stem>.md`，resource-subpath 至少包含一个文件名并可含合法嵌套路径。
- 采用: 报告以 `./_resources/<resource-id>` 逐字声明本地资源引用；链接语法、路径安全、根目录收口和文件身份规则继续由资源契约承接。
- 采用: 资源一经报告引用，其 owner 报告必须存在，且该 owner 报告至少直接引用该资源。满足 owner 引用后，其他报告可引用同一文件而不改变 owner。
- 采用: 不从资源内容、哈希或引用者集合猜测或自动转移 owner；不符合 owner 结构时由维护者显式移动资源并更新相关报告引用。
