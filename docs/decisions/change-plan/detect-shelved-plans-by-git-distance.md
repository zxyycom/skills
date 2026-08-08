---
title: 按 Git 演进距离识别搁置计划
status: active
alignment: aligned
createdAt: 2026-08-08T02:29:49Z
purpose: 让已确认但尚未实施的计划获得统一、可复核的机械搁置候选信号。
background: 日历时间不能区分项目停滞与计划偏离，完全依赖个人判断又难以稳定识别退出当前主线的计划。
decision: 使用固定 Git 演进距离产生候选；查询不改阶段，显式 reconcile 以机械证据写入 shelved。
relations: []
---

## 目的

- 让已经确认、尚未进入实施的 Change plan 能根据项目在其后发生的实际演进，快速得到统一、可复核的搁置候选信号。
- 保留人工复核和显式阶段转换，使机械信号辅助识别计划是否退出当前主线，而不代替对计划有效性的判断。

## 背景

- 项目整体没有继续演进时，计划放置多久都没有因此远离确认时的事实；日历时间和文件修改时间不能表达计划与项目当前状态的距离。
- 只靠操作者主动判断并记录搁置，会让长期未进入实施的计划难以被一致发现。
- 确认计划后的 first-parent 提交数量，以及这些提交在当前 Change 目录外产生的累计 diff 行数，能够直接反映项目继续演进了多少，同时排除维护计划自身产生的变化。

## 决策

- 采用: 对已确认且尚未实施的 plan，从其确认 `baseCommit` 到当前 `HEAD` 统计 first-parent 提交；只修改当前 Change 目录的提交不计入距离，其他提交计入 `commitCount`，并累计其在当前 Change 目录外的 additions 与 deletions 为 `changedLines`。
- 采用: 使用统一固定的 `git-distance-v1`。`commitCount > 3 && changedLines > 1000`、`commitCount >= 9` 或 `changedLines >= 3000` 任一成立时，plan 成为 `shelve-candidate`。
- 采用: `list`、`show` 和 `check` 只报告候选，不改变 Change 阶段；操作者显式执行 `reconcile` 时，才把 Git 距离判定证据写入 `shelved`。明确暂停仍可通过带原因的显式 shelve 表达，复核后仍准备实施则重新确认 plan 并更新基线。
- 不采用: 不以日历时间、文件 mtime 或单个 Change 自定义阈值判断机械搁置。
