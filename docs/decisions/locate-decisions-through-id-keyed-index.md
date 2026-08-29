---
title: 通过 ID 键控索引定位决策
status: active
alignment: aligned
createdAt: 2026-08-29T16:11:33Z
purpose: 让常规决策查询从受检索引按稳定 ID 恢复当前位置，并保持索引与权威 Markdown 的单向派生关系。
background: 常规查询需要持久快照，候选需要直接发现源码；二者都需要与身份无关的当前位置定位，索引不能反向制造来源事实。
decision: 持久索引以 Decision ID 为键、以 sourcePath 定位来源；查询读取受检快照，check、同步与生命周期事务维护来源一致性。
tags:
  - decision-records
relations:
  - type: 拆分
    target: use-stable-decision-ids-tags-and-location-index.md
---

## 目的

- 让查询和维护通过单一派生索引恢复决策的当前来源位置。
- 保持权威 Markdown、候选源码发现与持久查询快照之间的责任边界。

## 背景

- 持久索引适合作为常规查询快照，候选仍需从权威 Markdown 容错发现。
- 当前位置需要独立于身份定位，且索引不能反向补造或改写 Markdown 事实。

## 决策

- 采用: 持久索引以 Decision ID 为键，并保存唯一的 `sourcePath` 作为当前来源定位。
- 采用: `list`、`show` 和 `trace` 读取受检索引快照，`show` 只额外读取目标正文；`check`、同步和生命周期事务负责完整来源、关系与索引的一致性。
- 采用: candidate 直接从根目录权威 Markdown 发现，不进入正式索引；索引缺失、损坏或陈旧时只能由权威 Markdown 重建。
- 不采用: 把索引或 `sourcePath` 当作身份、关系目标或可反向制造 Markdown 事实的来源。
