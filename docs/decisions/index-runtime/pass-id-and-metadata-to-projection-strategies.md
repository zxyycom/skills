---
title: 向状态投影传递 ID 与类型化元数据
status: archived
alignment: aligned
createdAt: 2026-08-11T04:02:46Z
purpose: 让集合元数据与条目来自同一快照，并只以只读上下文进入 parser 和 key 策略。
background: 条目 ID 已由外层身份集合提供；若再把 metadata 传给身份回调，会重复身份责任并描述不存在的接口。
decision: 先校验集合 metadata，再向 parser 和 key 策略传递只读的 ID 与 metadata，不设置身份回调。
relations:
  - type: 修订
    target: index-runtime/carry-typed-collection-metadata.md
---

## 目的

- 让领域在同一次来源读取中提供集合级 metadata、条目状态和来源 revision，并在静态投影与查询边界保持同一类型化快照。
- 让 metadata 只进入真正依赖它的状态 parser 和 key 策略，不把集合上下文扩散为新的身份、查询或更新协议。

## 背景

- 理解整个集合所需的信息可能无法从任一单条 state 推导，也不适合复制到每个条目或由消费方另行读取。
- 索引身份已经由来源 state record 的当前 ID 提供；metadata 参与身份回调会重复身份 owner，而当前定义也不存在从 state 或 metadata 恢复身份的 callback。
- 逐条策略若能观察正在构造的 entries，会让输出依赖遍历顺序并形成循环责任；跨条目约束需要独立的后置边界。

## 决策

- 采用: 来源快照同时返回合法 JSON 对象 metadata、ID 键控的 states 和同一时点的 source revision；没有集合级信息的领域显式返回空对象。
- 采用: 领域先通过 `parseMetadata` 校验并收窄 metadata，再只向逐条 `parseState` 和 key 策略传递递归只读的 `{ id, metadata }` 上下文；两类策略都不能观察 entries 或部分索引。
- 采用: 上下文中的 ID 由外层身份集合提供，只是当前条目的投影上下文；本决策不设置 identify callback，也不允许从 state 或 metadata 二次推导通用身份。
- 采用: 跨条目约束由完整静态投影形成后的 `validateIndex` 承接。Reader 和查询结果传播同一只读 metadata，runtime overlay 不能替换、合并或重新解释 metadata。
- 采用: 任何可能改变 metadata 或条目投影的来源变化都必须反映在同一 definition 的 source revision 中；领域拥有 metadata schema、数组顺序和完整校验语义。
- 不采用: 为 metadata 提供通用查询、局部更新、隐式合并、统计缓存、领域 collection 模型，或在本判断中固定持久化 metadata schema 版本。
