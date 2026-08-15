---
title: 归档 change 不参与持续链接校验
status: archived
alignment: aligned
createdAt: 2026-08-04T06:30:59Z
purpose: 让 Markdown 链接校验聚焦仍需维护的文档，避免历史计划阻塞当前仓库演进。
background: 归档会增加目录层级，稳定 owner 后续也可能移动；持续校验历史计划会迫使维护者改写归档内容。
decision: bun run validate 排除 changes/archive 下的 Markdown，同时继续校验 active change 与当前稳定文档。
tags:
  - project-tooling
relations: []
---

## 目的

- 让仓库 Markdown 链接校验覆盖当前仍需维护和使用的内容，不让只用于历史回放的 change 计划持续产生维护义务。
- 保留 active change 的交接质量和归档动作本身的完成门禁。

## 背景

- `changes/archive/<change-name>/` 只保存已经完成的临时计划，当前事实和长期方向由稳定 owner 承接。
- change 从 active 目录移入 `archive/` 时会增加一层路径，计划内指向仓库 owner 的相对链接会系统性失效。
- 后续 owner 移动或删除也可能让历史链接失效；若持续校验归档计划，普通仓库演进会被旧计划阻断，或要求维护者改写已经归档的历史内容。

## 决策

- 采用: `bun run validate` 的主仓库 Markdown 链接检查排除 `changes/archive/**`，不再要求归档计划中的链接持续指向当前文件布局。
- 采用: `changes/` 下的 active change、稳定项目文档和其他当前维护 Markdown 继续参与链接检查。
- 采用: change 归档前仍由 change-plan 门禁确认结构有效、任务全部完成且归档目标无冲突；归档历史仍可由 change-plan 查询，但不成为持续链接完整性的事实来源。
