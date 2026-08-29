---
title: 使用稳定 Decision ID 选择关系与生命周期
status: active
alignment: aligned
createdAt: 2026-08-29T16:11:33Z
purpose: 让关系、查询、生命周期和选择性暂存以不随目录移动变化的决策身份为输入。
background: 目录路径承担身份时，分类调整或归档移动会扩大为关系、引用和维护操作的身份迁移。
decision: 使用 Markdown basename 作为全集合唯一的稳定 Decision ID；目录移动不改变身份，关系与生命周期操作按 ID 选择。
tags:
  - decision-records
relations:
  - type: 拆分
    target: use-stable-decision-ids-tags-and-location-index.md
---

## 目的

- 让分类调整、当前来源移动和归档不改变一条决策的稳定身份或关系目标。
- 让维护操作以可直接解析的决策身份选择记录，而不依赖当前位置。

## 背景

- 目录路径同时表达身份、分类和位置时，任一分类或生命周期移动都会连带迁移不应由位置决定的关系和操作输入。
- 决策集合需要在目录移动后仍能用同一身份恢复关系和维护选择。

## 决策

- 采用: 决策 Markdown 的 basename（含 `.md`）是全集合唯一且稳定的 Decision ID；目录移动不改变 ID，basename 改变是显式身份迁移。
- 采用: 关系、查询、生命周期和选择性暂存以 Decision ID 指向记录，不以领域路径或当前位置充当身份。
- 不采用: 由目录路径、分类或索引 state 共同定义决策身份。
