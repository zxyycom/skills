---
title: 在 Runner 生产边界标准化 Test 结果
status: active
alignment: unaligned
createdAt: 2026-08-11T04:03:18Z
purpose: 让 runner 私有事件在生产边缘转换为 invocation 级版本化 envelope，消费核心只依赖稳定 Test 结果协议。
background: 协议记录若同时承接 Case 派生、资格分类和持久状态，会与正式结果资格判断形成重复 owner。
decision: Producer 负责原生解析、Test ID 绑定和版本化 envelope；Case 派生、资格与行为分类留给下游。
tags:
  - test-evidence-review
relations:
  - type: 修订
    target: use-versioned-runner-result-protocol.md
---

## 目的

- 让不同 runner 的原生事件通过各自生产边缘收敛为同一版本化结果协议，不把 runner 分支扩散到消费核心。
- 让每次正式执行能够携带完整、稳定标识的逐 Test 结果和 producer 诊断，同时保持协议责任与结果资格责任分离。

## 背景

- Runner 的原生事件、显示名、日志、退出码和故障表达不同，只有理解该 runner 的 producer 能可靠绑定 Test ID 并判断逐 Test 结果集合是否完整。
- 聚合退出码、自然语言输出和路径不能安全恢复 Test ID，也不能替代结构化的 invocation 与逐 Test 结果。
- Test 到 Case 的关系来自权威测试证据账本；资格完整性、硬阻断和行为 pass 或 fail 是协议消费后的领域判断，不属于 runner 生产协议。

## 决策

- 采用: 每类 runner 在生产边缘使用专属 producer 读取原生事件，并为一次 invocation 输出一个显式版本化的 JSON envelope；runner 无关 consumer 只接受该共同协议。
- 采用: Envelope 表达 invocation 身份、完整逐 Test 结果以及 producer 能结构化报告的错误和诊断；每项测试结果以稳定 Test ID 标识，具体状态集合由协议实施时统一定义。
- 采用: Producer 和 envelope 不携带、复制或推断 Case ID。Test 到 Case 的派生、结果是否具备正式资格、测试完整性分类及行为 pass 或 fail 全部由下游资格 owner 决定。
- 采用: Consumer 不解析 runner 私有事件、TAP、JUnit、console 文本或 stderr，也不以显示名、路径或裸退出码补造 Test ID、完整结果集合或行为结论。
- 采用: 未知版本、非法结构、混杂输出、缺少 Test ID 或 producer 未能证明结果集合完整，均作为协议输入失败交给下游；本协议不决定这些失败是否形成硬阻断或行为结论。
- 采用: 只有出现真实正式结果需求、优先级和实施授权，稳定 Test ID 已可消费，且至少一个真实 runner 能证明原生事件与完整 envelope 一一对应时，才重新规划实现并确定 Schema、状态、传输和兼容策略。
- 不采用: 因身份模型或单次 runner 试验完成就自动启动实现，也不让消费核心通过 runner 私有回退路径绕过共同协议。
