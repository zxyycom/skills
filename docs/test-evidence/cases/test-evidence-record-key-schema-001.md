### Case TEST-EVIDENCE-RECORD-KEY-SCHEMA-001: State Index 只接受合法 Case ID Record Key

Tests:
- `test:a52a7a1d09e6248aa42e80348e473af99bcabd47a92a1405f8bc831820a34899`

Tags:
- `test-evidence`

Contract:
- 持久索引的 record key 必须是合法 Case ID，且 state 不得以冗余 `id` 字段重复身份。

Proves:
- 非法 key 和冗余 state `id` 都使查询阻断，且不会返回 Case。
