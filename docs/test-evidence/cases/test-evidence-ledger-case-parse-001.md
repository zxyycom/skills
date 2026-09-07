### Case TEST-EVIDENCE-LEDGER-CASE-PARSE-001: Case-only 索引支持查询与 Tag

Tests:
- `test:f7c4dce8bcbf191958a208314365a709c8b4d8c23c72b05267da499522b01572`

Tags:
- `test-evidence`

Contract:
- Case-only 索引必须保留 Case 的 Test 与 Tag，使查询和 tags 操作无需实体快照。

Proves:
- 按 `access-control` tag 查询仅返回其匹配 Case；tags 结果保留两个 tag 及各自 Case 计数。
