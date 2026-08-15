---
title: 将决策领域定义投影到查询结果
status: archived
alignment: aligned
createdAt: 2026-08-11T03:25:28Z
purpose: 让查询消费者直接取得领域责任定义和记录归属，而不读取第二分类源或猜测路径含义。
background: 只返回领域 ID 无法解释责任边界，在索引 state 复制领域又会与路径和目录表形成漂移。
decision: 索引 metadata 投影完整领域目录，记录领域键由路径派生，CLI 查询返回与结果相关的领域定义。
tags:
  - decision-records
relations:
  - type: 拆分
    target: use-domain-paths-as-primary-classification.md
---

## 目的

- 让索引和 CLI 消费者从同一查询结果恢复领域 ID、责任描述和每条记录的唯一归属。
- 保持查询投影可校验且不成为领域定义或记录身份的第二事实源。

## 背景

- 领域目录表拥有完整定义，但常规查询读取持久索引；若结果只提供 ID，消费者仍需额外定位目录表才能理解责任边界。
- 把领域重复写入 Markdown frontmatter或索引 state 会与路径身份形成多个可独立漂移的来源。
- 查询筛选服务定位当前记录，不应通过多领域并集掩盖每条判断唯一的主要 owner。

## 决策

- 采用: `decision-index.json` 的 `metadata.domains` 完整投影当前领域目录表，包含暂时没有记录的已定义领域，并让领域定义参与 source revision。
- 采用: 每条索引记录的 `keys.domain` 从 `state.path` 第一段确定并由 metadata 校验；索引 state 不重复保存独立 `domain` 字段。
- 采用: `domains` 直接读取并展示完整领域目录表；`list` 至多接受一个领域筛选，并在结果中提供涉及的领域定义。
- 采用: `show` 和 `trace` 返回所涉及领域的 ID 与描述，使调用方不需要从路径文本猜测责任边界。
- 采用: 索引是从目录表和已建立 Markdown 重建的查询快照，不能反向补造领域定义、路径身份或归属。
- 不采用: 可重复领域并集参数、只返回裸领域 ID，或在查询 state 中维护第二份领域归属。
