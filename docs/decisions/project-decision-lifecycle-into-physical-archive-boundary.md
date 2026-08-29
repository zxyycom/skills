---
title: 将决策生命周期投影到物理归档边界
status: active
alignment: aligned
createdAt: 2026-08-29T16:11:33Z
purpose: 让 Markdown status 作为生命周期权威，并以根目录和统一 archive 目录提供受检的物理位置投影。
background: 已归档记录需要离开常规搜索路径，但物理移动只有在身份、关系和索引不再由路径定义时才安全。
decision: candidate 与 active 记录直属决策根，archived 记录直属统一 archive；位置与索引必须投影并验证 Markdown status。
tags:
  - decision-records
relations:
  - type: 拆分
    target: use-stable-decision-ids-tags-and-location-index.md
---

## 目的

- 让归档记录离开常规搜索路径，同时保留完整集合的回放和演进能力。
- 保持生命周期权威与物理位置投影可独立核验。

## 背景

- 生命周期状态必须由权威 Markdown 表达；目录位置和索引只应投影该状态。
- 统一归档边界使常规文件工具能够整体排除已归档记录。

## 决策

- 采用: Markdown `status` 是决策生命周期权威；candidate 与 active 记录直属决策根，archived 记录直属统一 `archive/` 边界。
- 采用: 位置和索引必须与 Markdown status 一致并受检；已归档记录继续保留正文、关系和最后生命周期状态，显式历史查询与关系追踪继续覆盖它们。
- 不采用: 由物理位置、目录路径或索引 state 定义生命周期，或为归档记录建立第二索引。
