---
title: 用策略驱动的闭合事务演进决策关系
status: active
alignment: aligned
createdAt: 2026-08-30T04:18:53Z
purpose: 让所有决策关系策略共享一个按完整后继集合执行的可恢复 evolve 事务。
background: 独立关系命令和单后继入口会绕过多后继拓扑闭合，新增关系类型应扩展策略而非命令面。
decision: evolve 统一预演和执行关系事务，拆分与重划仅以各自的形状和闭合不变量接入。
tags:
  - decision-records
relations:
  - type: 修订
    target: unify-closed-decision-relation-evolution.md
---

## 目的

- 为决策关系的建立、完整修订和后继集合变化提供稳定、可扩展的事务 owner。
- 让新增关系类型只扩展拓扑与闭合策略，不增加同级生命周期命令或绕过写入恢复路径。
- 让关系、前序生命周期、后继建立和派生索引只在完整最终组合通过验证后共同生效。

## 背景

- 单后继关系、拆分和重划的拓扑不同，但都需要在写入前恢复完整成员和最终关系图。
- 若各关系策略各自维护命令、生命周期或索引路径，新增策略会绕过共同的闭合与恢复责任。
- 普通文件系统可在可处理失败后尽力恢复受影响文件组合，却不能承诺进程中断或恢复写入失败时严格原子。

## 决策

- 采用: `evolve` 是决策关系事务的唯一公开入口和内部 owner。调用方显式选择完整后继集合；事务以其最终关系恢复直接前序和全部受影响记录，在验证后共同处理前序生命周期、后继、索引与读回检查。
- 采用: 关系策略只接入各自的形状和闭合不变量，不拥有旁路的命令、写入、归档、索引或恢复流程。精确策略规则由[决策记录规则](../../skills/decision-records/references/decision-record-rules.md)拥有；单前序拆分和多前序、多后继重划的长期边界分别由[单前序决策的闭合拆分](use-closed-splits-for-single-predecessor-decisions.md)和[闭合重划决策 owner 边界](support-closed-reallocation-of-decision-owners.md)说明。
- 采用: `activate --relation` 保留为新候选的单后继便利入口；候选自身声明关系时，普通 `activate` 同样进入统一建立事务。关系来源、完整替换和 CLI 覆盖优先级由[以完整集合审核和替换决策关系](replace-decision-relations-as-complete-sets.md)拥有。
- 采用: 不保留独立 `split`、`reorganize`、`重组` 或其他同级关系命令；新关系类型扩展策略而非命令面。
- 采用: 对可处理失败，事务尽力恢复命令前的全部受影响 Markdown 和索引；进程中断或恢复不完整时停止后续维护并进入恢复流程，不以“原子”名义承诺普通文件系统无法保证的结果。
- 采用: `evolve --discard` 可在关系事务中显式折叠一个未记录中间决策；该动作不自动继承关系，也不因重划而扩大适用范围。
