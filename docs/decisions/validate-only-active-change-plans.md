---
title: 只对 Active Change 执行机械校验
status: active
alignment: aligned
createdAt: 2026-08-23T12:48:09Z
purpose: 让 Change 的归档动作终止当前契约门禁，同时保留历史记录的发现和原始读取能力。
background: 对 archived Change 重用当前 checker 会让已经完成的历史记录因后续 artifact 契约演进而重新失效。
decision: 单项与集合 checker 只接受 active Change；archive 在移动前完成最终门禁，list 和 show 不校验 archived 内容。
tags:
  - change-plan
relations:
  - type: 修订
    target: check-change-plan-collections-as-a-gate.md
---

## 目的

- 让 archived Change 作为完成后的历史快照，不再承担当前结构、metadata、任务或 Git 基线契约。
- 保持 active Change 的单项门禁、集合门禁与归档前验证，同时让历史记录仍可发现和读取。

## 背景

- `archive` 已在移动目录前要求 active Plan 通过机械检查且所有任务完成；移动后的目录只保存该时点的历史记录。
- Artifact 契约会随 Change Plan 演进。继续对 archived Change 套用当前 checker，会把后续规则追溯施加到历史内容，并要求无实际价值的批量迁移。
- `list` 和 `show` 需要查询 active 与 archived，但发现和读取历史记录不要求产生 valid、invalid、stage、任务进度或 Git 距离判断。

## 决策

- 采用: `check <change-directory>` 只校验 active Change；目标位于 archive 时直接报告 checker 不适用，且不读取历史 metadata 或 artifacts。
- 采用: `check-all [change-root]` 固定门禁 active 直接成员，不提供 archived 或 active+archived 集合选择。
- 采用: `archive` 在移动前完成 active Plan 的最终机械门禁；归档成功后不再以当前或独立历史契约复检内容。
- 采用: `list` 可以发现 archived Change，`show` 可以读取其普通 artifact 文件；两者都不为 archived 记录投影检查结果、stage、任务进度、Git 距离或有效性。
