---
title: 随索引快照携带类型化集合元数据
status: archived
alignment: aligned
createdAt: 2026-08-11T03:23:53Z
purpose: 让集合级信息与条目来自同一索引快照，并在解析、投影、校验和查询边界保持领域类型。
background: 集合级信息不能总从单条 state 恢复，消费方另读定义源会重复新鲜度、校验和序列化责任。
decision: Index Runtime 将不透明 JSON metadata 作为快照组成，并通过分阶段类型化上下文传播而不解释其领域语义。
tags:
  - index-runtime
relations:
  - type: 修订
    target: use-typed-collection-metadata.md
---

## 目的

- 让领域在同一次来源读取中提供集合级 metadata、条目状态和来源 revision。
- 让 parser、reader 和查询调用方获得已经校验的领域 metadata，同时避免逐条投影依赖未完成的索引。

## 背景

- 理解整个集合所需的信息可能无法从任一单条 state 推导，也不适合复制到每个条目。
- 消费方另行定位和解析集合定义，会重复索引运行时已有的读取、新鲜度和序列化责任，并可能与条目来自不同快照。
- 条目 parser、身份和 key 投影若能观察构造中的 entries，会让输出依赖遍历顺序并形成循环责任。

## 决策

- 采用: 索引快照要求提供合法 JSON 对象 metadata；没有集合级信息的领域显式提供空对象，通用层不为缺失值猜测默认内容。
- 采用: 完整来源读取同时返回 metadata、states 和 source revision；同一 definition 下，任何可能改变 metadata 或条目投影的来源变化都必须反映在 revision 中。
- 采用: 领域先用 `parseMetadata` 校验并收窄集合类型，再把只读 metadata 上下文传给逐条 parser、身份和 key 策略；逐条策略不能观察 entries 或部分索引。
- 采用: 跨条目约束由完整静态索引形成后的 `validateIndex` 承接。Reader 和查询结果传播同一只读 metadata；临时条目覆盖不能替换、合并或重新解释 metadata。
- 采用: 领域拥有 metadata schema、数组顺序和完整校验语义；通用层只做确定性 JSON 规范化，不固定某个持久化 schema 版本作为长期决策。
- 不采用: 为 metadata 提供通用查询语言、局部更新、隐式合并、统计缓存或领域 collection 模型。
