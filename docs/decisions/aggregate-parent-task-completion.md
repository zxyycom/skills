---
title: 由子 task 结果聚合父 task 完成
status: active
alignment: aligned
createdAt: 2026-08-11T03:21:57Z
purpose: 让真实父子分解通过子 task 终态和后代租约形成父 task 的机械完成门禁。
background: 父 task 若独立宣称完成，会与尚未收敛的子目标或活动后代执行产生矛盾。
decision: 有子 task 的父项只在直接子项全部收敛、至少一项成功且没有活动后代租约时完成。
tags:
  - task-graph
relations:
  - type: 拆分
    target: model-task-topology-and-inheritance-explicitly.md
---

## 目的

- 让父 task 的成功事实证明其真实组成部分已经收敛，而不是与子 task 独立竞争执行状态。
- 让父子分解拥有可机械恢复的向上完成门禁。

## 背景

- `parentId` 表示子 task 是父目标的真实组成部分，因此父项不能在子项仍未终结时独立完成。
- 父 task 不领取执行租约，其完成应当聚合已经写入的子项结果；活动或待恢复的后代租约仍代表目标尚未稳定收敛。
- 全部子项取消不能证明父目标已经成功产生任何结果。

## 决策

- 采用: 有直接子 task 的父项不领取执行租约，只在满足子项完成门禁后使用当前 revision 收敛。
- 采用: 父项完成要求直接子项全部成功或取消、至少一个直接子项成功，并且不存在活动或待恢复的后代租约。
- 采用: 父项完成状态从当前权威索引中的子项结果聚合，不向子项复制父项执行状态，也不由 `acceptance` 文本自动判定。
- 不采用: 在子项尚未收敛、全部取消或仍有后代执行归属时独立完成父 task。
