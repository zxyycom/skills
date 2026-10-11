---
title: 以发布快照承接纯索引决策查询
id: 261011-publish-decision-index-query-snapshots
status: active
alignment: aligned
createdAt: 2026-10-11T11:49:10Z
purpose: 让纯索引发现与来源验证各自承担明确成本和事实边界。
background: 每次快照查询遍历来源会扩大规模成本，未同步来源也不应改变快照含义。
decision: 列表、追溯和元数据搜索只验证已发布索引，并显式返回未核对来源的快照事实。
tags:
  - decision-records
  - performance
  - source-artifact-separation
relations: []
---

## 目的

让 `decision-records` 的纯索引发现成本与来源验证成本分离，同时让调用方直接知道结果代表什么。

## 背景

`skills/decision-records/` 的列表、追溯和元数据搜索依赖发布索引。逐次扫描全部 Markdown 核对索引新鲜度，会让这些查询承担不必要的来源读取成本；即使查询发现来源已变，也不能把索引结果解释为当前来源全集。

稳定身份与 sourcePath 继续承担索引定位，Markdown 继续拥有来源事实。本决策适用于 `skills/decision-records/` 的纯索引发现与追溯。

## 决策

- 采用: `list`、`trace` 和 metadata `search` 只读取已发布索引，完整验证其结构、身份和领域关系，不逐次核对 Markdown 新鲜度。索引缺失、损坏或非法关系图均失败关闭，不自动扫描来源或同步。
- 采用: 成功 `list`、`trace` 明确返回 `source={kind:"published-index",currentness:"unchecked",fallback:false}`；metadata 沿 `searchInfo.source` 返回相同事实。文本与机器输出一致，不把主动未核对来源包装成 warning。
- 采用: 快照的成员、关系、计数和覆盖不能证明当前来源仍相同，也不能用于当前全集的否定结论。需要当前来源事实时使用相应来源验证入口。
- 采用: 当前正文通过 `show` 的目标读取取得；当前文本发现、完整来源检查、发布和写前验证分别由 content `search`、`check`、`sync-index` 及维护事务承接。各入口的证据与恢复边界由[决策记录规则](../../skills/decision-records/references/decision-record-rules.md#派生索引与查询)维护。
