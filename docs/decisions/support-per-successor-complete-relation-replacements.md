---
title: 按后继分别完整替换决策关系
id: 260912-support-per-successor-complete-relation-replacements
status: active
alignment: aligned
createdAt: 2026-09-12T08:47:39Z
purpose: 让闭合多后继事务能够表达各成员不同的完整最终关系。
background: 统一覆盖会复制关系和摘要，无法维护已建立多后继事件的独立关系载荷。
decision: 将完整成员集合与各后继完整关系载荷分离，并保留既有闭合与字段保护边界。
tags:
  - decision-records
relations:
  - type: 修订
    target: replace-decision-relations-as-complete-sets
    summary: 允许各后继分别完整替换关系
---

## 目的

- 让一次闭合的多后继关系事务能够为每个成员表达并审核不同的完整最终关系集合。
- 在不放宽演进图闭合、历史保留或恢复保障的前提下，允许已建立后继保留各自不同的关系摘要和关系目标。

## 背景

- [以完整集合审核和替换决策关系](archive/replace-decision-relations-as-complete-sets.md)已确定关系必须按完整最终集合维护：候选可以保留自己的关系，统一 CLI 覆盖则替换所有已选后继的同一集合。
- 对已建立的拆分或稀疏重划，多个后继可能需要指向不同前序，或对同一前序给出不同摘要。把统一覆盖复制给全部成员不能表达这种有效事件；以逐边追加、摘要补丁或手工编辑绕开事务又会破坏完整替换和核对边界。
- 完整 successor 集合、拆分、重划和统一关系事务各自已有长期 owner。本判断只调整每个已选 successor 如何提供其完整关系载荷，不重新定义那些策略。

## 决策

- 采用: `evolve` 继续显式选择一次闭合事件的完整 successor 集合；该集合只确定参与成员，包含关系不变的成员，不表示全部成员必须使用相同 relations。
- 采用: 每个 successor 的最终 relations 独立来自其权威 Markdown 的完整原值，或来自本次为该 successor 提供的完整 replacement（包括显式空集合）。公开输入允许按 successor 分组提供 replacement；未被分组覆盖的成员保留自身完整原值，无分组的既有统一覆盖继续兼容地应用于全部已选成员。
- 采用: 每个 replacement 只替换所属 successor 的整个关系集合，绝不与旧关系合并；summary 只能绑定同组 replacement 中的关系，未在新集合给出的旧 summary 随该 successor 的完整替换移除。已建立 successor 的正文、`status`、`alignment` 和 `createdAt` 继续受保护，不因关系维护隐式改变。
- 采用: 事务先汇集所有已选 successor 的最终集合，再沿既有统一事务执行历史基线探测、拓扑与语义闭合、前序归档、锁、可恢复写入、索引重建及完整 before/after 核对。完整成员约束、拆分策略和重划策略仍分别由[统一关系事务](use-strategy-driven-closed-decision-relation-evolution.md)、[闭合拆分](use-closed-splits-for-single-predecessor-decisions.md)和[闭合重划](support-closed-reallocation-of-decision-owners.md)拥有；本决策不接管或放宽它们。
