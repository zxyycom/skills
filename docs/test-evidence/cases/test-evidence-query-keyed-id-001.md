### Case TEST-EVIDENCE-QUERY-KEYED-ID-001: 查询以合法 Record Key 作为唯一 Case 身份

Tests:
- `test:8fb2ca7749d06e1b074237968f1907f8008579ecff3f5de965ecafd6cb45921b`

Tags:
- `test-evidence`

Contract:
- 查询只接受以合法 Case ID record key 标识身份的持久索引；state 不能重复该身份。

Proves:
- 非法 key 或 state 的冗余 `id` 使查询产生阻断诊断并返回零个 Case。
