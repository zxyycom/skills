### Case GRAPH-TRACE-ARRAY-SNAPSHOT-001: 冻结数组的动态成员消费

Tests:
- `test:92ebf8e0b080604be254c4d874e45d019e161ab77b2a1459df0cc7a201f8a01f`

Tags:
- `performance`
- `semantic-fidelity`

Contract:
- 冻结成员数组仍可能由索引 accessor 或自定义 iterator 提供动态 ID，不能按对象身份复用旧结果。

Proves:
- 索引 getter 与自定义 iterator 两种冻结数组均在后续扩展观察到 b，保持完整 trace/context 结果。
