---
title: 将候选脚手架与正文 readiness 分离
status: active
alignment: aligned
createdAt: 2026-09-02T06:13:35Z
purpose: 让长期决策候选能够先稳定创建并继续编辑。
background: 候选创建需要固定身份和元数据，但正文与语义审核通常晚于创建。
decision: 使用结构合法 scaffold 与机械 body readiness 分离候选创建和正式建立。
tags:
  - decision-records
relations:
  - type: 修订
    target: separate-reviewable-candidates-from-established-decisions.md
---

## 目的

- 让长期决策候选可以先获得稳定、可查询且可安全删除的身份，再由维护者继续完成正文和审核。

## 背景

- 创建时已经能够明确标题、摘要、tags 和预期直接前序，但目的、背景与决策正文仍可能需要后续调查或协作才能完成。
- 把空正文一律视为非法会迫使维护者在创建前完成所有写作；把结构合法 scaffold 误称为已审核又会混淆建立边界。
- 正式索引和关系图继续只能表达已经建立的记录，不能因脚手架存在而提前纳入候选。

## 决策

- 采用: candidate 可以是具有合法身份、frontmatter、关系语法和固定章节形状的 scaffold；CLI 以 `scaffoldValid` 与 `bodyReady` 分别报告结构与机械正文条件。
- 采用: `new` 只以显式 metadata 原子、不覆盖地创建 scaffold；创建成功不因正文未完成、alignment 未预演或辅助预检 attention 变成失败。
- 采用: 只有 body-ready candidate 才能被 `activate` 或 `evolve` 建立；建立前仍要求人工或 agent 完成语义审核与本次授权判断。
- 采用: `activate --preflight` 与 `evolve --preflight` 复用当前准备逻辑但零写入、不保存 receipt；正式命令重新读取并验证所有当前参数与来源。
