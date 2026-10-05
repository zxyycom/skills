---
title: 以共同输入契约原地维护正式记录关系
id: 261004-maintain-formal-record-relations-with-shared-input-contract
status: active
alignment: aligned
createdAt: 2026-10-04T15:22:42Z
purpose: 让两域正式关系修正采用同一完整替换协议，并与生命周期事务明确分工。
background: 两域具有相同的来源分组与完整核对需求；单纯关系修正需要独立于生命周期演进的写入边界。
decision: set-relations 只替换正式关系与索引；两域共享输入与核对协议，领域各自保留图和生命周期约束。
tags:
  - common-denominator-design
  - decision-records
  - investigation-report
  - record-relations
  - shared-protocols
relations:
  - type: 重划
    target: 260922-unify-formal-relation-maintenance-actions
    summary: 承接两域正式关系维护的共同输入与审核协议
  - type: 重划
    target: use-strategy-driven-closed-decision-relation-evolution
    summary: 将无生命周期变化的关系修正移出 evolve
---

## 目的

- 让 Decision Records 与 Investigation Report 的正式关系原地修正使用同一命令、来源分组和审核结果。
- 让单纯关系维护与复合生命周期演进按实际写入范围选择，不按领域记忆两套入口。

## 背景

- 两域都维护从来源记录指向真实直接前序的完整关系集合，摘要绑定最终集合的一条边，预检与提交需要完整 before/after。
- Decision 曾以 `evolve` 独占关系事务入口，导致原地关系修正被迫附带生命周期语义；Investigation 已有独立 `set-relations`。
- 共同输入与审核协议不意味着共同 relation type、图形约束或生命周期，更不要求提取跨工具运行时组件。

## 决策

- 采用: 两域以 `set-relations` 原地维护已建立正式记录的关系和派生索引。该命令保留 status、alignment 与 createdAt，不建立候选或归档前序；最终图须满足各领域约束，需要改变生命周期时使用对应领域事务。
- 输入采用 `--source <selector>` 分组，每组以重复 `--relation <type=target>` 给出完整 replacement，或以 `--clear-relations` 清空；可用 `--relation-summary <target=summary>` 绑定摘要。完整替换不合并旧关系，未提供摘要的最终边清除旧摘要。
- 来源在请求内唯一，target 在组内唯一，摘要须命中该组最终关系；多来源形成单一事务。重复 source/target、空组、仅摘要、clear 混用及摘要失配使用一致错误分类：输入形态问题为参数错误，需要集合知识的解析与绑定为领域失败。
- `--preflight` 与正式成功均以按规范 source ID 排序的 `relationReview` 返回 `phase`、`action` 和完整 `before`/`after`。预检零写入且不构成提交凭据；执行重新读取和验证，失败不附成功 review。
- 候选初始关系在候选来源维护并在 `publish` 时审核。Decision 的 `evolve` 复用同一分组与完整 replacement 协议，复合生命周期与拓扑闭合由其领域规则承接。
- 两域共享公开协议和行为测试；relation type、图闭合、生命周期与运行时实现各归本领域，不提取跨工具运行时组件。
