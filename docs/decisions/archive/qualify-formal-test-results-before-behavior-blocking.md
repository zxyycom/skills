---
title: 先确认测试结果资格再形成行为阻断
status: archived
alignment: unaligned
createdAt: 2026-08-11T03:24:23Z
purpose: 让正式测试只有在身份、关系、来源和结果集合完整时才形成有资格约束实现的行为 pass 或 fail。
background: 无法追溯或关系不闭合的结果说明测试证据自身不完整，若解释成行为回归会混淆故障责任。
decision: 正式结果先通过 Test 身份、Case 关系与完整性门禁，再按 Test 报告并从权威账本派生 Case。
tags:
  - test-evidence-review
relations:
  - type: 拆分
    target: defer-standard-test-result-blocking.md
---

## 目的

- 让进入正式门禁的行为 pass 或 fail 都能追溯到当前受控 Test 实体及其语义 Case。
- 让测试证据完整性问题硬阻断不可靠结论，同时不把它误报成被测行为回归。

## 背景

- 一个进程或 runner 的失败只有在结果身份、预期范围、来源新鲜度和语义关系都可核对时，才有资格说明被测行为失效。
- 缺少 Test ID、出现未知或重复结果、预期与实际集合不闭合、来源漂移或 Test 没有关联 Case，首先说明测试证据链不完整。
- Case 描述语义证据，Test 实体对应 runner 报告节点；把 Case ID 写入 runner 结果会建立第二关系真源并掩盖多对多关系。

## 决策

- 采用: 正式测试结果先通过资格门禁，再解释行为 pass 或 fail。门禁至少核对有效 Test ID、预期与实际 Test 集合闭合、身份和关系来源新鲜、每个 Test 具有当前有效 Case 关联，以及输入结果满足已接受的协议边界。
- 采用: 资格完整且原生结果失败时形成可追溯的行为回归；资格完整且通过时形成行为通过证据。身份、关系、来源、集合或协议不完整时以测试完整性问题硬阻断，但不形成行为 pass 或 fail。
- 采用: 诊断先报告有问题的 Test 实体、原因和可用定位，再从同一权威账本快照派生全部关联 Case ID；runner producer、测试实体和独立 manifest 不保存 Case ID。
- 采用: Test 实体和 Case 都不保存 invocation 的 pass、fail、完整性、覆盖率或聚合状态；资格和行为分类只属于一次正式执行。
- 采用: 只有 Test 身份与多对多关系已经可消费、出现真实正式阻断需求和优先级、明确正式门禁范围并获得实施授权时，才重新规划资格实现；届时重新确定 reason code、快照核对、试点和迁移边界。
- 不采用: 因依赖模型完成就自动启动门禁，也不让不合格结果通过裸退出码或日志回退获得行为阻断资格。
