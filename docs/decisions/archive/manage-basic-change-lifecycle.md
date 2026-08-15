---
title: 为 Change Plan 提供基础生命周期 CLI
status: archived
alignment: aligned
createdAt: 2026-07-25T02:15:47Z
purpose: 让独立 change plan 能够发现、读取、检查和归档计划，同时保持轻量且不依赖 OpenSpec。
background: 只读检查器要求 agent 手工扫描和移动计划，已经无法承接实际形成的 active 与 archive 目录状态。
decision: 在现有 change-plan 中提供 list、show、check 和 archive，并让语义审阅继续负责机械命令无法判断的完成条件。
tags:
  - change-plan
relations:
  - type: 拆分
    target: use-independent-change-plans.md
---

## 目的
- 让使用者和 agent 能通过同一个随包 CLI 发现 active 与 archived change、读取单个计划、检查固定结构并完成归档。
- 保持 `change-plan` 是不依赖 capability、delta spec、主 spec 合并和派生索引的轻量独立能力。

## 背景
- 第一版只提供三文件结构和只读 `check`，把项目级发现、状态查询与归档留给手工目录操作。
- 实际使用已经形成 `changes/archive/<change-name>/`，并需要手工扫描计划、判断任务进度和移动多个已完成 change。
- 继续让 agent 自行拼装目录发现和移动逻辑，会让 active/archive 识别、目标冲突和完成门禁在不同任务中产生不一致。

## 决策
- 采用: 扩展现有 `change-plan` 分发单元和随包 CLI，提供 `list`、`show`、`check` 与 `archive` 四个基础命令，不拆分新的 lifecycle skill。
- 采用: change 根目录的直接子目录表示 active change，`archive/` 的直接子目录表示 archived change；`list` 默认读取 `changes/`，也接受显式 change 根目录。
- 采用: `show` 和 `check` 继续接收显式 change 目录路径，避免引入项目索引、全局名称解析或隐藏搜索顺序。
- 采用: `archive` 只在结构有效且全部 checkbox 任务完成时，将 active change 移入同级 `archive/<change-name>/`；已经归档、符号链接和目标冲突必须拒绝。
- 采用: CLI 只证明目录结构、任务勾选和文件移动条件。成功标准、开放问题、稳定事实 owner 同步、验证充分性与归档授权仍由 `SKILL.md` 的语义流程负责。
- 不采用: 本次不增加 create、restore、delete、索引、spec 同步、跨根搜索或交互式审批。
