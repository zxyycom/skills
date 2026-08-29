---
title: 用记录级 tags 分类决策
status: active
alignment: aligned
createdAt: 2026-08-29T16:11:33Z
purpose: 让每条决策以可独立组合的记录级分类表达实际主题，而不受唯一目录归属限制。
background: 一条长期判断可能需要多个彼此独立的分类维度；唯一领域路径会迫使维护者在身份迁移与分类信息丢失之间取舍。
decision: 每条权威 Markdown 保存非空、有序且唯一的 tags；tags 只承接分类，重复 tag 查询使用 AND 交集语义。
tags:
  - decision-records
relations:
  - type: 拆分
    target: use-stable-decision-ids-tags-and-location-index.md
---

## 目的

- 让决策使用多个独立分类维度，而不把分类绑定为唯一目录归属。
- 让分类查询以明确、可组合的记录级 tags 恢复相关决策。

## 背景

- 一条长期判断可能跨越多个主题；唯一领域路径不能表达这种分类组合。
- 分类不应承担状态、对齐、关系、生命周期位置或当前事实的含义。

## 决策

- 采用: 每条权威 Markdown 直接保存至少一个按词法顺序排列且唯一的 tag。
- 采用: tags 只承接分类，不编码 status、alignment、关系类型、生命周期位置或当前事实；重复 tag 查询要求同时满足全部 tag。
- 采用: 分类重组通过记录级 tags 演进，不维护领域目录表、唯一领域路径、领域查询或领域谱系作为并行分类机制。
- 不采用: 预先登记全部合法 tag、维护 tag 层级或别名，或用目录位置表达唯一分类。
