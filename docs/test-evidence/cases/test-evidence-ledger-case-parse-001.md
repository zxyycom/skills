### Case TEST-EVIDENCE-LEDGER-CASE-PARSE-001: Case-only 索引支持查询与 Tag

Tests:
- `test:9f785c8b981a3e5eee8157a374166e6ffd1ec598e63bb0df28464827512ec9b8`

Tags:
- `test-evidence`

Contract:
- Case-only 索引必须保留 Case 的 Test 与 Tag，使查询和 tags 操作无需实体快照。

Proves:
- 按 `access-control` tag 查询仅返回其匹配 Case；tags 结果保留两个 tag 及各自 Case 计数。
