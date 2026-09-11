### Case TEST-EVIDENCE-QUERY-KEYED-ID-001: 查询以合法 Record Key 作为唯一 Case 身份

Tests:
- `test:a52a7a1d09e6248aa42e80348e473af99bcabd47a92a1405f8bc831820a34899`

Tags:
- `test-evidence`

Contract:
- 查询只接受以合法 Case ID record key 标识身份的持久索引；state 不能重复该身份。

Proves:
- 非法 key 或 state 的冗余 `id` 使查询产生阻断诊断并返回零个 Case。
