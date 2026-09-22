---
title: 为记录维护统一公共候选生命周期动作
id: 260922-unify-record-candidate-lifecycle-actions
status: active
alignment: unaligned
createdAt: 2026-09-22T14:05:18Z
purpose: 让 Decision Records 与 Investigation Report 用同一动作词汇表达候选创建、审核、建立和删除。
background: 两个领域都有候选、机械准备、语义审核和正式建立过程，但首次建立、历史记录重新启用和删除使用不同动作边界，调用者需要记忆领域差异。
decision: 两个记录 CLI 用共同动作表达候选生命周期；首次建立与重新启用拆为 publish 与 reactivate，删除确认统一为 --delete-recorded。
tags:
  - decision-records
  - project-tooling
relations: []
---

## 目的
- 两个领域的候选从创建到正式建立、再到删除，使用相同动作词汇、预检语义和结果层次。
- 首次建立与历史记录重新启用是两个明确状态转移，不再由同一命令按目标种类分派。

## 背景
- Decision 的 activate 同时承担候选首次建立与 archived 记录重新启用，还叠加关系覆盖输入；Investigation 的删除按候选与正式报告拆成 discard 与 discard-candidate，Git 历史确认参数也按目标种类命名。
- 发布门禁失败容易被误判为命令或参数故障，动作差异迫使调用者按领域记忆调用形态。

## 决策
- 采用: 共同状态流为 不存在 --new--> 候选 --publish--> 正式记录，候选与正式记录都可 --discard--> 不存在；共同动作 new、candidates、show-candidate、publish --preflight、publish、discard 返回同层次的准备与 mutation 结果。
- 采用: Decision publish 只建立显式候选并要求 alignment，按候选声明的关系归档其活动前序；reactivate 只执行 archived -> active；同时改变后继与前序生命周期的复合事务由 evolve 承接。
- 采用: discard 按稳定 ID 自动识别候选或正式记录；进入 Git HEAD 的目标统一要求 --delete-recorded，Investigation owner 资源删除额外要求 --delete-owned-resources，共享引用门禁保持独立有效。
- 采用: 被取代的 activate、discard-candidate 与目标专属删除确认参数只得到普通未知命令或无效参数结果，不保留兼容别名、弃用分支或迁移专用提示。
- 采用: 准备结果统一区分结构、正文、领域条件、语义审核和授权；门禁失败属于领域结果，参数形态无效才属于 CLI 参数错误。
