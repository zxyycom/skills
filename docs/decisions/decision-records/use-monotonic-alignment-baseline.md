---
title: 将对齐状态定义为单向基线
status: active
alignment: aligned
createdAt: 2026-07-22T10:07:23Z
purpose: 让 alignment 与只允许从 unaligned 进入 aligned 的状态机保持同一语义。
background: 把 alignment 称为实时事实关系，会与已对齐后不允许回退的基线约束产生歧义。
decision: active 即生效；alignment 表示目标是否已核对并建立为单向基线，偏离按一致性问题处理。
relations:
  - type: 修订
    target: decision-records/express-alignment-as-field-relation.md
---

## 目的
- 区分决策是否已经生效，以及决策目标是否已经核对并建立为后续必须保持的当前基线。
- 让 `alignment` 的文字含义与 `unaligned` 到 `aligned` 的单向状态变化一致。
- 保持决策、当前事实和索引各自只有一个 owner，不为对齐差距建立第二份说明。

## 背景
- `active` 和 `archived` 表达决策是否仍然有效；活动决策无论对齐状态如何都已经生效。
- 当前实现、行为 owner 和事实可能随工作继续变化，`alignment` 不是自动计算或持续同步的实时监控值。
- 已经核对并建立的决策基线必须继续遵守；发生偏离时把字段退回 `unaligned` 会把一致性问题重新解释成尚待落实的目标。
- 当前差距和偏离证据属于实际行为 owner，复制进决策记录会形成并行事实源。

## 决策
- 采用: `active + unaligned` 表示决策已经生效，但完整目标尚未通过实际行为 owner 和事实核对并建立为当前基线；实际差距仍需比较完整决策、行为 owner 和事实，它不要求实施已经开始，也不自动授予或取消实现、操作或抽象空间。
- 采用: `active + aligned` 表示完整决策已经通过实际行为 owner 和事实核对，并建立为后续必须持续遵守的当前基线。
- 采用: 对齐状态只允许从 `unaligned` 单向进入 `aligned`；`mark-aligned` 是唯一对齐转换，不能把已对齐记录改回 `unaligned`。
- 采用: 已对齐基线发生事实偏离时按一致性问题处理，应恢复符合基线的事实，或在长期方向改变时形成新决策；不通过回退字段重新开放实现空间。
- 采用: `alignment` 是经过核对后建立的治理基线状态，不是 CLI 自动计算的实时事实镜像；当前差距仍从完整决策与实际 owner 和事实的比较中得出。
- 采用: 对齐状态只由 Markdown frontmatter 表达并由 JSON 索引原样投影；两种活动状态使用同一正文结构，不增加专门差距、过渡或完成条件章节。
