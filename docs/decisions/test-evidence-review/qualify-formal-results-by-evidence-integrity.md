---
title: 按证据完整性判定正式测试结果资格
status: active
alignment: unaligned
createdAt: 2026-08-11T04:05:43Z
purpose: 让正式测试结果只有在身份、集合、来源和 Test–Case 关系完整时才形成行为通过或回归。
background: Runner 协议只提供 invocation 级逐 Test 结果；结果资格、账本关系和行为解释需要由消费侧独立判断。
decision: 先验证正式结果的证据链，再形成行为结论；诊断按 Test 报告并只从权威账本派生 Case 语境。
relations:
  - type: 修订
    target: test-evidence-review/qualify-formal-test-results-before-behavior-blocking.md
---

## 目的

- 阻止身份、集合、来源或语义关系不完整的测试结果被误报成行为回归。
- 让正式结果的资格判断、行为分类和诊断语境共享同一份权威 Test–Case 账本快照。

## 背景

- 一个 runner 结果只有在 Test 身份、预期范围、实际集合、来源新鲜度和语义关系都可核对时，才有资格说明被测行为是否成立。
- 版本化 runner envelope 负责传输 invocation 与逐 Test 结果，但不拥有 Test–Case 关系或行为解释。
- Case 描述语义证据，Test 对应 runner 报告节点；资格判断必须从账本恢复二者关系，不能把结果载荷当作第二关系真源。

## 决策

- 采用: 正式结果先通过资格门禁，再解释行为 pass 或 fail。门禁至少核对有效 Test ID、预期与实际 Test 集合闭合、身份和关系来源新鲜、每个 Test 具有当前有效 Case 关联，以及输入满足已接受的协议边界。
- 采用: 资格完整且原生结果失败时形成可追溯的行为回归；资格完整且通过时形成行为通过证据。身份、关系、来源、集合或协议不完整时以测试完整性问题硬阻断，但不形成行为 pass 或 fail。
- 采用: 诊断先报告有问题的 Test、原因和可用定位，再从同一权威账本快照派生全部关联 Case ID；输入载荷提供的 Case 字段或独立关系 manifest 不参与权威派生。
- 采用: Test 实体和 Case 不保存 invocation 的 pass、fail、完整性、覆盖率或聚合状态；资格与行为分类只属于一次正式执行。
- 采用: 只有 Test 身份与多对多关系已经可消费、出现真实正式阻断需求和优先级、明确正式门禁范围并获得实施授权时，才重新规划资格实现；届时重新确定 reason code、快照核对、试点和迁移边界。
- 不采用: 因依赖模型完成就自动启动门禁，也不让不合格结果通过裸退出码或日志回退获得行为阻断资格。
