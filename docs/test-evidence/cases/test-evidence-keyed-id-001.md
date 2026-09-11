### Case TEST-EVIDENCE-KEYED-ID-001: 领域解析以 Record Key 作为唯一 Case 身份

Tests:
- `test:a52a7a1d09e6248aa42e80348e473af99bcabd47a92a1405f8bc831820a34899`

Tags:
- `test-evidence`

Contract:
- 持久索引以合法 Case ID record key 作为唯一身份；state 不得重复保存 `id` 字段。

Proves:
- 非法 record key 或 state 中冗余 `id` 都阻断查询，且不返回任何 Case。
