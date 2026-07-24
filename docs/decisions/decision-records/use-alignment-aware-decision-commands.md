---
title: 使用对齐感知的决策命令
status: archived
alignment: null
createdAt: 2026-07-22T07:38:16Z
purpose: 让查询和状态命令准确区分决策是否活动、当前实现是否已经与决策对齐，并保持状态变化显式可校验。
background: 只维护 active 和 archived 会把尚未落实的有效决策与已经完全对齐的当前基线混为一类。
decision: activate 显式设置对齐状态，mark-aligned 只完成 unaligned 到 aligned，list 支持对齐筛选；关系不隐式改变状态。
relations:
  - type: 修订
    target: decision-records/260720-separate-status-commands-from-relations.md
---

## 目的
- 让每个 CLI 命令的名称、参数和实际状态变化直接对应，避免从正文、关系或默认值猜测对齐状态。
- 让日常查询同时看到已经对齐和尚未对齐的活动决策，并能按任务需要筛选其中一类。
- 让未对齐决策只有在实际核对行为 owner 后才能标记为已对齐，且不能用状态回退掩盖一致性问题。

## 背景
- 一项未来决策从确认时起就已经活动，但实现可能尚未推进到目标；只输出 `active` 无法指导 agent 应按当前基线执行，还是先读取未对齐边界。
- 对齐状态由决策文件拥有后，生命周期和对齐命令需要同步更新 Markdown 元数据并重新生成索引。
- 修订、替代、判定无效和归并关系只表达判断演进，不应承担活动、归档或对齐状态切换。

## 决策
- 采用: `list` 默认返回全部活动决策，包括 `aligned` 和 `unaligned`；增加 `--alignment aligned|unaligned|all`，并允许与主题和生命周期筛选组合。
- 采用: `list` 和 `trace` 同时显示生命周期与对齐状态；`show` 在完整 Markdown 前显示路径、生命周期、对齐状态、创建时间和临时 `pending` 标记。
- 采用: `activate <path> --alignment aligned|unaligned` 首次激活或重新激活决策；首次激活同时写入 `createdAt`，选择 `unaligned` 时必须存在完整未对齐说明。
- 采用: `mark-aligned <path>` 只允许活动决策从 `unaligned` 变为 `aligned`；调用前由人类或 agent 核对当前实现和行为 owner 已经满足对齐条件，CLI 不把状态写入当作实施行为。
- 采用: 不提供把已建立的 `aligned` 决策改回 `unaligned` 的日常命令；事实偏离按一致性问题处理，新的未来目标通过新决策表达。
- 采用: `archive <path...>` 把决策设为 `archived` 并把对齐状态设为 `null`；它不改变其他记录，也不根据关系隐式激活后续决策。
- 采用: `sync-index --write` 从全部决策 Markdown 完整重建索引，不保留任何索引独有状态；`check` 校验元数据组合、未对齐说明、正文结构、投影和关系图。
- 采用: 路径尚未进入 Git `HEAD` 的记录继续只在查询输出中临时标记为 `pending`，不把 `pending` 写入决策文件或索引。
- 采用: 所有状态命令在写回前构建并验证完整候选 Markdown 与索引，失败时恢复原文件；关系本身不改变生命周期或对齐状态。
