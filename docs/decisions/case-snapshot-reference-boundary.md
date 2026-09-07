---
title: 以 Case 声明与项目快照划分引用责任
id: 260907-case-snapshot-reference-boundary
status: active
alignment: aligned
createdAt: 2026-09-07T10:02:51Z
purpose: 让核心验证 Case 对显式完整快照的引用，而不拥有项目实体覆盖或关系图。
background: 闭合双向关系把项目采集、Case 语义和核心查询耦合为同一事实。
decision: Case 保存 Tests 集合，核心仅检查显式快照引用，项目另行拥有实体覆盖策略。
tags:
  - test-evidence-review
relations:
  - type: 替代
    target: maintain-closed-many-to-many-test-case-relations
---

## 目的
- 让一个 Case 的 Tests 集合直接表达共同支持其 Contract 与 Proves 的实体，而不增加证明点映射、关系图或反向人工表。
- 将项目是否要求所有发现实体都有 Case 的覆盖策略留在项目 owner，避免核心把项目范围判断误当作通用引用有效性。

## 背景
- 测试实体能支持多个 Case，Case 也能引用多个实体，但双向闭合图要求核心维护项目实体集合和反向覆盖结论。
- 显式快照已经能证明所选 Case 的引用存在；未被 Case 引用的实体在通用核心中不等于无效，是否阻断取决于项目策略。

## 决策
- 采用: Case 的 `Tests:` 记录一个或多个不透明实体 ID；Case 内的 Contract 与 Proves 保持人工语义，Tests 共同支持它们，不建立证明点级映射。
- 采用: 核心按显式 snapshot、expectedSource、complete 状态与所选 Case 检查引用；成功仅说明相对于该快照的引用有效，不说明测试已执行、源码未变或 Proves 充分。
- 采用: 一个实体可以被多个 Case 引用，未引用快照实体在核心中合法；项目可在调用核心后实施自身的全部实体覆盖门禁。
- 采用: 新增、删除或语义改变的最小原生测试入口仍按测试证据审查维护 Case；重命名或拆合是否保留 Case ID 由意图连续性和 Contract/Proves 审查决定，不由引用检查自动决定。
- 不采用: 核心维护双向关系图、要求所有快照实体被引用，或把项目覆盖策略升级为通用结果平台。
