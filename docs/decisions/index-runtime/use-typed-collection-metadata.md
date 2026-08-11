---
title: 为通用索引提供类型化集合元数据
status: archived
alignment: aligned
createdAt: 2026-07-24T14:34:00Z
purpose: 让领域通过同一索引快照安全携带读取整个集合所需的类型化元数据。
background: 既有索引只投影条目，消费方若另读集合定义会重复新鲜度、校验和序列化责任。
decision: 通用索引要求不透明 JSON metadata，并按元数据、条目投影、完整索引校验的阶段传播类型化上下文。
relations:
  - type: 拆分
    target: index-runtime/use-independent-read-side-index-runtime.md
---

## 目的

- 让领域在同一次源读取中提供集合级 metadata、条目 state 和 revision，并让 reader 与查询调用方直接获得已校验的领域类型。
- 让通用层继续只管理派生索引、新鲜度、确定性序列化和查询，不解释集合元数据的领域语义。
- 让逐条投影与完整索引校验拥有明确阶段，避免条目遍历顺序、部分索引或 runtime overlay 改变持久投影。

## 背景

- 既有 schema v1 只保存条目、查询键和 revision，无法承载理解整个集合所需且不能从单条 state 恢复的信息。
- 消费方若自行寻找并解析另一份集合定义源，会重复通用索引已有的读取、新鲜度、校验和序列化责任，也难以保证与条目来自同一快照。
- `parseState`、身份和 key 策略只接收单条 state；若直接向它们暴露构造中的索引，投影会依赖条目顺序并形成循环责任。
- 当前三个消费方都能迁移到同一外壳；没有集合级数据的领域可以用空对象明确表达，而不需要兼容缺省值。

## 决策

- 采用: 通用索引使用 schema v2，并要求顶层保存合法 JSON 对象 `metadata`；没有集合级数据的领域显式保存空对象。通用层不读取 schema v1，也不为缺失 metadata 插入默认值。
- 采用: `StateSnapshot` 从同一领域读取返回 metadata、states 和 revision；同一 `definitionVersion` 下，任何会改变 metadata 或条目投影的源变化都必须改变 revision。
- 采用: 领域 definition 先通过 `parseMetadata` 校验并收窄集合类型，再把只读 `{ metadata }` 上下文传给 `parseState`、身份和 key 策略。逐条策略不能观察 entries 或尚未完成的索引。
- 采用: 确需跨条目约束时使用可选的同步 `validateIndex`。它只在构建或解析完整静态索引并完成规范化后运行，失败使用稳定的 `state-index.index-validation-failed` 诊断；它不参与 key 派生或 runtime overlay。
- 采用: `StateIndex`、definition、snapshot、reader、runtime 和查询结果共同传播 state 与 metadata 两个泛型。reader 和查询结果暴露同一只读 metadata；runtime state overlay 只能替换或追加条目，不能替换、合并或重新解释 metadata。
- 采用: 通用 canonicalization 确定性排序 metadata 对象字段并保留领域 parser 返回的数组顺序。领域拥有数组的语义顺序、metadata Schema 和完整校验规则。
- 采用: 通用层不提供 metadata 查询语言、局部更新、合并、缓存、统计字段或领域 collection 模型；能够从 entries 推导的数据不复制进 metadata。
