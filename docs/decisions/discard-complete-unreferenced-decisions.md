---
title: 显式剔除完整且无引用的决策
status: active
alignment: aligned
createdAt: 2026-08-29T15:42:44Z
purpose: 让明确不应保留的候选、活动或归档决策能安全退出集合，而不把删除与关系演进混为一谈。
background: 长期保留不等于禁止删除；手工移除会遗留关系和派生索引，而已进入 Git 历史的删除需要明确机械确认。
decision: discard 只删除结构完整且在最终集合中无引用的决策，并由事务验证关系与索引；已记录决策删除须显式确认。
tags:
  - decision-records
  - version-control
relations:
  - type: 拆分
    target: guard-unrecorded-decision-evolution.md
---

## 目的

- 让错误建立、重复或明确不应继续保留的决策能够安全退出集合。
- 让删除与关系演进、索引同步和 Git 历史删除确认拥有清楚边界。

## 背景

- 候选、活动和归档状态都可能包含明确不应继续保留的完整记录。
- 裸删 Markdown 会留下悬空关系或陈旧索引；删除本身不推断后继关系。
- 已进入 Git `HEAD` 的记录需要额外确认，避免机械删除历史记录。

## 决策

- 采用: `discard` 只删除完整、结构有效且在删除后的最终集合中无剩余引用的 candidate、active 或 archived 决策。
- 采用: `evolve --discard` 可以将删除与后继建立、完整最终关系替换和索引重建置于同一可恢复事务；删除不放宽普通关系形状和闭包要求。
- 采用: 已进入 Git `HEAD` 的删除在未提供明确机械确认时暂停且零写入；非 Git、unborn `HEAD` 或未记录 ID 不增加该门禁，Git 检查异常时失败关闭。
- 采用: 删除不决定或改写其他记录的关系；不满足完整性、无引用或最终图条件时拒绝写入。
- 不采用: 手工删除 Markdown、以归档代替删除，或由删除动作自动合成关系。
