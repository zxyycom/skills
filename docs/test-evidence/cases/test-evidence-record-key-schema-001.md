### Case TEST-EVIDENCE-RECORD-KEY-SCHEMA-001: State Index 只接受合法 Case ID Record Key

Tests:
- `test:8fb2ca7749d06e1b074237968f1907f8008579ecff3f5de965ecafd6cb45921b`

Tags:
- `test-evidence`

Contract:
- 持久索引的 record key 必须是合法 Case ID，且 state 不得以冗余 `id` 字段重复身份。

Proves:
- 非法 key 和冗余 state `id` 都使查询阻断，且不会返回 Case。
