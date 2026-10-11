### Case GRAPH-TRACE-INHERITED-001: 继承字段的事件与预算快照

Tests:
- `test:36f9f24223e5b0a75a54d55a59c22547aa723fce8b3d093755dba44a788d0636`

Tags:
- `performance`
- `semantic-fidelity`

Contract:
- 冻结实例不冻结继承的 kind、recordIds 或 traceIds 读取结果；后续预算判断仍消费当前事件。

Proves:
- 继承 getter 改变 kind 和成员后，第二次事件按 split 阻断，blockedEvent、requiredMaxRecords 与 frontier 完整保留。
