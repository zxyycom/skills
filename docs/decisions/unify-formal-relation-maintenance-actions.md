---
title: 为正式记录统一关系维护动作
id: 260922-unify-formal-relation-maintenance-actions
status: active
alignment: aligned
createdAt: 2026-09-22T15:15:53Z
purpose: 让两个记录领域用同一命令结构原地替换正式记录的完整直接关系。
background: Decision 只有演进事务可改关系，Investigation 已有独立替换命令，调用者需要记忆两套入口与选择条件。
decision: 两域 CLI 以 set-relations 按 source 分组完整替换正式关系；evolve 只承接复合生命周期事务并改用同一分组语法。
tags:
  - decision-records
  - project-tooling
relations:
  - type: 修订
    target: replace-decision-relations-as-complete-sets
    summary: 将完整集合替换统一为两域共同基础动作
---

## 目的

- 让 Decision Records 与 Investigation Report 的正式记录原地关系修正使用相同的命令、输入分组和审核结果。
- 让调用者用唯一判断在单纯关系维护与复合生命周期事务之间选择，不再按领域记忆不同入口。

## 背景

- 两个领域都维护由来源记录指向直接前序的完整关系集合，关系摘要绑定最终集合中的一条边，预检与提交都需要完整 before/after。
- Investigation Report 已有按 source 分组的 `set-relations` 事务；Decision Records 只有 `evolve` 这一个复合事务入口，原地修正关系被迫叠加生命周期语义。
- [以完整集合审核和替换决策关系](archive/replace-decision-relations-as-complete-sets.md)确立了完整集合替换原则，但它的输入模型只在 Decision 的演进事务中定义。

## 决策

- 采用: 两域 CLI 共用同一输入模型：`set-relations --source <selector> (--relation <type=target>... | --clear-relations) [--relation-summary <target=summary>...] [--preflight]`。每个 `--source` 开始一个完整替换分组；组内 target 唯一，摘要必须命中该组最终关系，多个 source 在同一请求中形成单一事务。
- 采用: 重复 source、组内重复 target、空分组、只含摘要、clear 与 relation 混用、摘要失配在两个 CLI 中得到一致错误分类：输入形态问题属于 CLI 参数错误，需要集合知识的解析与绑定结果属于领域失败。预检与正式成功都返回按规范 source ID 排序、含 `phase`、`action`、完整 `before` 与 `after` 的 `relationReview`。
- 采用: Decision Records 新增 `set-relations`，只替换已建立记录的正式关系并重建派生索引，不建立候选、不归档前序、不改变 status、alignment 或 createdAt；其最终关系目标必须已经满足领域图约束。候选初始关系继续在候选来源中维护并在 publish 时审核。
- 采用: Decision `evolve` 保留候选建立、后继关系、前序归档与删除组合，复用相同的关系分组、摘要绑定与审核形状；其分组参数统一为 `--source`。两域之间只共享公开协议与行为测试，不提取跨工具运行时组件；relation type、图闭合和生命周期约束继续由各领域拥有。
- 采用: 被取代的 `--relations-for` 分组参数只得到普通无效参数结果，不保留兼容别名、弃用分支或迁移专用提示。
- 不采用: 用统一关系命令改变生命周期，或把领域图验证上收到共同层。
