---
title: 以显式报告 ID 锚定调查资源
id: 261004-anchor-investigation-resources-to-explicit-report-ids
status: active
alignment: aligned
createdAt: 2026-10-04T15:22:46Z
purpose: 让调查资源由路径首段恢复到唯一报告 ID，同时允许其他报告复用而不转移 owner。
background: 报告 ID 与文件位置已分离，资源归属需直接使用稳定身份；共享引用不改变维护责任。
decision: 资源首段直接使用 extensionless Investigation ID；owner 直接引用自身资源，其他报告可共享而不改变归属。
tags:
  - artifact-identity
  - investigation-report
  - record-identity
  - responsibility-boundaries
relations:
  - type: 修订
    target: anchor-investigation-resources-to-report-owners
    summary: 保留报告归属与共享，改为直接使用显式纯 ID
---

## 目的

- 让 `skills/investigation-report/` 管理的每个被引用资源，从 `_resources/` 下的路径直接恢复到唯一 owner 报告。
- 让报告文件移动或 basename 改变不影响资源 owner；共享者无需复制、移动或重命名资源。

## 背景

- 先前归属规则从目录首段回拼 `.md` 得到 owner，依赖 basename 承担身份。当前报告由 frontmatter 声明不含扩展名的 ID，basename 与 sourcePath 只表达位置，资源归属也需沿用这一分工。
- 唯一 owner 表达维护责任而非唯一引用者；让每个复用者取得 owner 会破坏归属事实的单一性。

## 决策

- 采用: resource ID 使用 `<investigation-id>/<resource-subpath>`，首段就是 owner 报告 frontmatter 声明的不含扩展名的 Investigation ID；subpath 至少含文件名，可以合法嵌套。文件位置变化不改变 owner 身份。
- 报告以 `./_resources/<resource-id>` 逐字声明本地资源引用；链接、路径安全、根目录收口和普通文件身份由调查资源契约承接。
- 正式报告引用资源时，同 ID 正式 owner 必须存在并直接引用；其他报告可共享同一资源而不改变归属。
- 尚未建立的 authoring candidate 可按契约拥有同 ID 自有资源，并共享正式或候选 owner 的资源；candidate 不能替代正式报告所需的正式 owner。
- 归属变更须显式移动资源并更新全部受影响引用，不从内容、哈希或引用者集合猜测或自动转移 owner。
