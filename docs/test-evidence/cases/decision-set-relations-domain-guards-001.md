### Case DECISION-SET-RELATIONS-DOMAIN-GUARDS-001: set-relations 仅维护已建立记录并校验摘要命中

Tests:
- `test:f8264139cd816e115baaf81969b5f1e6098c8a23af887c6c0057554b428f4799`

Tags:
- `decision-records`

Contract:
- `set-relations` 的 source 必须是已建立记录；候选关系继续在候选来源中维护。摘要必须命中该组最终关系集合。

Proves:
- 原生事务预检对合法 candidate source 返回 `source-selector`，索引字节保持不变。
- 同一 fixture 的摘要 selector 指向不同完整 ID 时预检失败且索引不变；name 与完整 ID 指向同一对象时预检通过并返回规范化摘要。
