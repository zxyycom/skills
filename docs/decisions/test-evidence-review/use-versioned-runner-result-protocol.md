---
title: 使用版本化的测试结果生产者协议
status: archived
alignment: unaligned
createdAt: 2026-08-11T03:24:23Z
purpose: 为未来正式测试提供 runner 无关的逐 Test 结果边界，并阻止消费核心逐个解析 runner 私有格式。
background: Runner 原生事件、日志和退出码各不相同，只有生产边缘能可靠绑定稳定 Test ID 并保留完整结果语义。
decision: Runner 侧 producer 输出版本化 JSON 与 Test ID，consumer 严格消费共同协议且不从私有格式猜测结果。
relations:
  - type: 拆分
    target: test-evidence-review/defer-standard-test-result-blocking.md
---

## 目的

- 让不同 runner 的正式测试结果通过同一个版本化边界进入资格判断，而不把 runner 分支扩散到消费核心。
- 让每项运行结果能够关联稳定 Test 实体，并让协议故障与行为结果保持可区分。

## 背景

- Runner 的原生事件、显示名、日志、退出码和故障表达不同，消费核心逐个适配会持续扩大公共行为面。
- 聚合退出码和自然语言输出不能证明逐 Test 身份、实际结果集合或协议完整性，也不能安全恢复 Test ID。
- 精确字段、状态映射、传输和兼容策略仍依赖稳定 Test 身份模型与真实 runner 生产证据，不应在证据形成前冻结。

## 决策

- 采用: 若未来建立正式测试结果协议，每类 runner 在生产边缘使用专属 producer 读取原生事件、绑定稳定 Test ID，并输出一个统一、显式版本化的 JSON 结果；runner 无关 consumer 只接受该共同协议。
- 采用: 协议表达一次 invocation、完整逐 Test 结果和 producer 能结构化报告的故障；每项测试结果使用 Test ID 标识测试实体，不携带或推断 Case ID，显示名、路径和诊断只作辅助信息。
- 采用: Consumer 不解析 runner 私有事件、TAP、JUnit、console 文本或 stderr，也不以显示名、路径或裸退出码补造 Test ID、完整结果集合或行为结论。未知版本、非法结构、混杂输出或缺少 Test ID 属于协议或测试完整性问题。
- 采用: Test 实体与 Case 不保存单次运行状态；协议结果只属于当前 invocation，并由下游资格判断决定能否形成行为 pass 或 fail。
- 采用: 只有出现真实正式阻断需求、优先级和明确实施授权，Test ID、locator 与发现模型已经可消费，并且至少一个真实 runner 能证明原生事件与完整逐 Test JSON 一一对应时，才重新规划协议实现；届时重新选择 Schema、状态、传输、兼容和加固边界。
- 不采用: 因身份模型或 runner 试验之一完成就自动启动实现，也不在重启前冻结具体字段、runner 映射或迁移顺序。
