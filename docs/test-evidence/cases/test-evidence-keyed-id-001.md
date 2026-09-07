### Case TEST-EVIDENCE-KEYED-ID-001: 领域解析以 Record Key 作为唯一 Case 身份

Tests:
- `test:8fb2ca7749d06e1b074237968f1907f8008579ecff3f5de965ecafd6cb45921b`

Tags:
- `test-evidence`

Contract:
- 持久索引以合法 Case ID record key 作为唯一身份；state 不得重复保存 `id` 字段。

Proves:
- 非法 record key 或 state 中冗余 `id` 都阻断查询，且不返回任何 Case。
