---
title: 在索引快照中传播已校验集合元数据
status: active
alignment: aligned
createdAt: 2026-08-11T04:11:06Z
purpose: 让集合级信息与条目来自同一快照，并在投影、完整校验和查询结果中保持同一领域类型。
background: Metadata 不能总从单条 state 恢复；另行读取会重复新鲜度和校验责任，而身份与 revision 已有独立 owner。
decision: 先校验快照 metadata，再以递归只读值传播到逐条投影和 reader，并在完整投影后执行跨条目校验。
tags:
  - index-runtime
relations:
  - type: 修订
    target: pass-id-and-metadata-to-projection-strategies.md
---

## 目的

- 让领域在同一来源快照中提供集合级 metadata 与条目状态，避免消费方另行定位和解释集合定义。
- 让逐条投影、完整索引校验和查询调用方观察同一份已校验 metadata，而不让 metadata 取得身份、revision 或更新责任。

## 背景

- 理解整个集合所需的信息可能无法从任一单条 state 推导，也不适合复制到每个条目。
- 逐条策略若能观察正在构造的 entries，会让输出依赖遍历顺序；跨条目约束需要在完整静态投影形成后检查。
- 条目 ID 的来源和投影上下文由索引身份决策拥有；metadata 与条目来源变化怎样进入 source revision 由 revision 决策拥有。

## 决策

- 采用: 来源快照包含合法 JSON 对象 metadata；没有集合级信息的领域显式提供空对象，通用层不为缺失值猜测默认内容。
- 采用: 领域先通过 `parseMetadata` 校验并收窄 metadata，再把规范化结果复制为内部递归只读值，供逐条 parser 和 key 策略通过既有投影上下文读取；逐条策略不能观察 entries 或部分索引。
- 采用: 跨条目约束由完整静态索引形成后的 `validateIndex` 承接；Reader 和查询结果传播同一只读 metadata。
- 采用: Runtime overlay 只替换或追加条目，不替换、合并或重新解释集合 metadata。
- 采用: 领域拥有 metadata schema、数组顺序和完整校验语义；通用层只提供确定性 JSON 规范化与只读传播。
- 不采用: 为 metadata 提供通用查询语言、局部更新、隐式合并、统计缓存或领域 collection 模型。
