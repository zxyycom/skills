---
title: 以闭合策略演进决策生命周期
id: 261004-evolve-decision-lifecycle-through-closed-strategies
status: active
alignment: aligned
createdAt: 2026-10-04T15:22:42Z
purpose: 让决策复合演进通过完整后继集合共同维护关系、生命周期与索引，并保留可证明的恢复边界。
background: 单后继、拆分和重划需要不同拓扑但共同写入责任；纯关系修正已经由独立正式维护入口承接。
decision: evolve 独占复合生命周期演进，各关系策略只提供闭合不变量；纯关系修正使用 set-relations。
tags:
  - decision-records
  - record-relations
  - responsibility-boundaries
relations:
  - type: 重划
    target: use-strategy-driven-closed-decision-relation-evolution
    summary: 保留完整后继闭合、策略责任与写入恢复边界
  - type: 重划
    target: 260922-unify-formal-relation-maintenance-actions
    summary: 承接 evolve 与 set-relations 的生命周期分工
---

## 目的

- 为 `skills/decision-records/` 的复合生命周期演进提供稳定可扩展的事务 owner，并与正式关系原地修正明确分工。
- 让关系、前序生命周期、后继建立和派生索引在完整最终组合验证后共同生效。

## 背景

- 单后继、拆分和重划的拓扑不同，但都需在写入前恢复完整成员和最终关系图；旁路写入会绕过共同闭合与恢复责任。
- 正式关系修正不改变生命周期，可以由 `set-relations` 独立维护；有候选建立、前序归档或删除组合的事件仍需要 `evolve`。
- 普通文件系统只能在可处理失败后尽力恢复，无法承诺进程中断或恢复写入失败时严格原子。

## 决策

- 采用: `evolve` 统一拥有 Decision 复合生命周期演进的公开入口与内部事务；不改变生命周期的正式关系修正使用 `set-relations`。调用方选择完整后继集合，事务按最终关系恢复直接前序与全部受影响记录，验证后共同维护前序生命周期、后继、索引和读回检查。
- 关系策略只提供形状与闭合不变量；写入、归档、索引和恢复由统一事务负责。新增关系类型通过扩展策略接入同一入口。
- 单前序拆分须建立完整自包含后继集合，多前序多后继重划须形成连通且闭合的稀疏二部图。精确形状由决策记录规则拥有，agent 另行核对继续有效的长期语义是否被完整承接。
- 候选在来源声明关系；单候选由 `publish` 进入统一建立事务，多后继事件通过 `evolve`。统一覆盖与按 `--source` 分组覆盖互斥，每个覆盖都是完整 replacement，未覆盖成员保持原关系。
- `evolve` 的分组、摘要绑定与 `relationReview` 复用正式关系维护的共同协议；候选建立、前序归档与图闭合约束仍归 Decision 领域。
- 可处理失败时尽力恢复命令前全部受影响 Markdown 与索引；进程中断或恢复不完整时停止后续维护并进入恢复流程。普通文件系统下不承诺所有失败均严格原子。
- `evolve --discard` 仅在显式选择与删除授权覆盖的范围内组合删除和演进，可折叠无需独立保留的中间决策；不自动继承关系，也不因重划扩大删除范围。
