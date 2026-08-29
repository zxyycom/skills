---
title: 将物理归档边界维护为生命周期投影
status: active
alignment: aligned
createdAt: 2026-08-29T16:13:11Z
purpose: 让归档记录退出常规文件搜索，同时保持 Markdown 生命周期权威、物理位置和索引投影一致。
background: 通用文件工具不能解析 frontmatter；统一路径边界可整体排除历史，但位置不能成为独立生命周期事实或承担决策身份。
decision: Markdown status 决定生命周期；根目录和 archive 位置及索引受检投影 status，历史记录仍可显式查询和追踪。
tags:
  - decision-records
relations:
  - type: 归并
    target: project-decision-lifecycle-into-physical-archive-boundary.md
  - type: 归并
    target: use-physical-archive-boundary-for-decision-search.md
---

## 目的

- 让常规文件搜索能够整体排除归档决策，并从路径识别历史集合。
- 保持归档记录的长期回放、显式查询、关系追踪和严格检查能力。
- 让生命周期权威、物理位置与索引投影保持清楚且可验证的边界。

## 背景

- `rg` 等通用文件工具按路径和文本工作，不能读取 Markdown frontmatter 的生命周期语义。
- 统一物理归档边界为常规搜索提供整体排除条件，但位置只能投影生命周期，不能独立决定状态或身份。
- 决策关系和维护选择依赖稳定 Decision ID，不能由当前位置替代。

## 决策

- 采用: Markdown `status` 是生命周期权威；candidate 与 active 记录直属决策根，archived 记录直属统一 `archive/` 边界。
- 采用: 统一 archive 边界让通用文件搜索可以整体排除历史记录，并从路径识别历史集合。
- 采用: 位置和索引必须与 Markdown status 一致并受检，它们不形成第二份生命周期事实，也不承担决策身份。
- 采用: 已归档记录继续保留正文、关系和最后生命周期状态；显式历史查询、单条读取、关系追踪和严格检查继续覆盖它们。
- 不采用: 由物理路径或索引 state 定义生命周期，或让路径承担 Decision ID、关系目标或生命周期操作选择。
